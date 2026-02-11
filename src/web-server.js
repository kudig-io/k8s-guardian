const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const { connectK8s } = require('./k8s');
const { checkClusterHealth, getClusterResourceUsage } = require('./health');
const { getPodLogs, analyzePodLogs } = require('./logs');
const { getEvents, getAllEvents, analyzeEvents } = require('./events');
const alerts = require('./alerts');
const automation = require('./automation');
const multitenancy = require('./multitenancy');
const audit = require('./audit');

let k8sClient = null;
let app = express();
let server = null;
let io = null;

async function startWebServer(port = 3000) {
  try {
    k8sClient = await connectK8s();
    
    app = express();
    server = http.createServer(app);
    io = socketIo(server);

    app.use(express.json());
    app.use(express.static(path.join(__dirname, '../web-ui')));

    io.on('connection', (socket) => {
      console.log('Client connected');
      
      socket.on('disconnect', () => {
        console.log('Client disconnected');
      });
    });

    app.get('/api/health', async (req, res) => {
      try {
        const health = await checkClusterHealth(k8sClient);
        res.json(health);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/resource-usage', async (req, res) => {
      try {
        const usage = await getClusterResourceUsage(k8sClient);
        res.json(usage);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/monitoring', async (req, res) => {
      try {
        const { getNodes, getAllPods } = require('./k8s');
        const timeRange = req.query.timeRange || '5m';
        
        const [nodes, pods, usage] = await Promise.all([
          getNodes(k8sClient),
          getAllPods(k8sClient),
          getClusterResourceUsage(k8sClient)
        ]);

        const monitoringData = {
          timestamp: new Date().toISOString(),
          timeRange,
          nodes: nodes.map(node => ({
            name: node.metadata.name,
            cpu: {
              capacity: parseResourceValue(node.status.capacity?.cpu || '0'),
              allocatable: parseResourceValue(node.status.allocatable?.cpu || '0'),
              usagePercent: calculateUsagePercent(node.status.capacity?.cpu, node.status.allocatable?.cpu)
            },
            memory: {
              capacity: parseResourceValue(node.status.capacity?.memory || '0'),
              allocatable: parseResourceValue(node.status.allocatable?.memory || '0'),
              usagePercent: calculateUsagePercent(node.status.capacity?.memory, node.status.allocatable?.memory)
            },
            pods: node.status.capacity?.pods || 0
          })),
          pods: pods.map(pod => ({
            name: pod.metadata.name,
            namespace: pod.metadata.namespace,
            phase: pod.status.phase,
            cpu: {
              request: pod.spec.containers.reduce((sum, c) => sum + parseResourceValue(c.resources?.requests?.cpu || '0'), 0),
              limit: pod.spec.containers.reduce((sum, c) => sum + parseResourceValue(c.resources?.limits?.cpu || '0'), 0)
            },
            memory: {
              request: pod.spec.containers.reduce((sum, c) => sum + parseResourceValue(c.resources?.requests?.memory || '0'), 0),
              limit: pod.spec.containers.reduce((sum, c) => sum + parseResourceValue(c.resources?.limits?.memory || '0'), 0)
            },
            restarts: pod.status.containerStatuses?.reduce((sum, c) => sum + (c.restartCount || 0), 0) || 0,
            node: pod.spec.nodeName
          })),
          cluster: {
            cpu: usage.cpu,
            memory: usage.memory
          }
        };

        res.json(monitoringData);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    function parseResourceValue(value) {
      if (typeof value !== 'string') {
        return 0;
      }

      if (value.endsWith('m')) {
        return parseFloat(value) / 1000;
      }

      const memoryMatch = value.match(/^(\d+)([KMGTP]i?)$/);
      if (memoryMatch) {
        const [, num, unit] = memoryMatch;
        const base = parseFloat(num);
        const units = {
          'K': 1024,
          'Ki': 1024,
          'M': 1024 * 1024,
          'Mi': 1024 * 1024,
          'G': 1024 * 1024 * 1024,
          'Gi': 1024 * 1024 * 1024
        };
        return base * (units[unit] || 1);
      }

      const parsed = parseFloat(value);
      return isNaN(parsed) ? 0 : parsed;
    }

    function calculateUsagePercent(capacity, allocatable) {
      const cap = parseResourceValue(capacity || '0');
      const alloc = parseResourceValue(allocatable || '0');
      if (cap === 0) return 0;
      return ((cap - alloc) / cap * 100);
    }

    app.get('/api/nodes', async (req, res) => {
      try {
        const { getNodes } = require('./k8s');
        const nodes = await getNodes(k8sClient);
        res.json(nodes);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/pods', async (req, res) => {
      try {
        const { getPods, getAllPods } = require('./k8s');
        const namespace = req.query.namespace;
        const pods = namespace ? await getPods(k8sClient, namespace) : await getAllPods(k8sClient);
        res.json(pods);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/deployments', async (req, res) => {
      try {
        const { getDeployments } = require('./k8s');
        const namespace = req.query.namespace || 'default';
        const deployments = await getDeployments(k8sClient, namespace);
        res.json(deployments);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/services', async (req, res) => {
      try {
        const { getServices } = require('./k8s');
        const namespace = req.query.namespace || 'default';
        const services = await getServices(k8sClient, namespace);
        res.json(services);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/events', async (req, res) => {
      try {
        const namespace = req.query.namespace;
        const events = namespace && namespace !== 'all' 
          ? await getEvents(k8sClient, namespace, { limit: 100 })
          : await getAllEvents(k8sClient, { limit: 100 });
        res.json(events);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/logs/:podName', async (req, res) => {
      try {
        const { podName } = req.params;
        const namespace = req.query.namespace || 'default';
        const container = req.query.container;
        const tailLines = req.query.tailLines || 100;
        
        const logs = await getPodLogs(k8sClient, podName, namespace, { container, tailLines });
        res.json({ logs });
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/logs/:podName/analyze', async (req, res) => {
      try {
        const { podName } = req.params;
        const namespace = req.body.namespace || 'default';
        const container = req.body.container;
        
        const logs = await getPodLogs(k8sClient, podName, namespace, { container, tailLines: 1000 });
        const analysis = analyzePodLogs(logs);
        res.json(analysis);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/namespaces', async (req, res) => {
      try {
        const { getNamespaces } = require('./k8s');
        const namespaces = await getNamespaces(k8sClient);
        res.json(namespaces);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/daemonsets', async (req, res) => {
      try {
        const { getDaemonSets } = require('./k8s');
        const namespace = req.query.namespace || 'default';
        const daemonsets = await getDaemonSets(k8sClient, namespace);
        res.json(daemonsets);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/statefulsets', async (req, res) => {
      try {
        const { getStatefulSets } = require('./k8s');
        const namespace = req.query.namespace || 'default';
        const statefulsets = await getStatefulSets(k8sClient, namespace);
        res.json(statefulsets);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/jobs', async (req, res) => {
      try {
        const { getJobs } = require('./k8s');
        const namespace = req.query.namespace || 'default';
        const jobs = await getJobs(k8sClient, namespace);
        res.json(jobs);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/cronjobs', async (req, res) => {
      try {
        const { getCronJobs } = require('./k8s');
        const namespace = req.query.namespace || 'default';
        const cronjobs = await getCronJobs(k8sClient, namespace);
        res.json(cronjobs);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/configmaps', async (req, res) => {
      try {
        const { getConfigMaps } = require('./k8s');
        const namespace = req.query.namespace || 'default';
        const configmaps = await getConfigMaps(k8sClient, namespace);
        res.json(configmaps);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/secrets', async (req, res) => {
      try {
        const { getSecrets } = require('./k8s');
        const namespace = req.query.namespace || 'default';
        const secrets = await getSecrets(k8sClient, namespace);
        res.json(secrets);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/ingresses', async (req, res) => {
      try {
        const { getIngresses } = require('./k8s');
        const namespace = req.query.namespace || 'default';
        const ingresses = await getIngresses(k8sClient, namespace);
        res.json(ingresses);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/persistent-volumes', async (req, res) => {
      try {
        const { getPersistentVolumes } = require('./storage');
        const pvs = await getPersistentVolumes(k8sClient);
        res.json(pvs);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/persistent-volume-claims', async (req, res) => {
      try {
        const { getPersistentVolumeClaims } = require('./storage');
        const namespace = req.query.namespace || 'default';
        const pvcs = await getPersistentVolumeClaims(k8sClient, namespace);
        res.json(pvcs);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/storage-classes', async (req, res) => {
      try {
        const { getStorageClasses } = require('./storage');
        const storageClasses = await getStorageClasses(k8sClient);
        res.json(storageClasses);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/network-policies', async (req, res) => {
      try {
        const { getNetworkPolicies } = require('./network');
        const namespace = req.query.namespace || 'default';
        const policies = await getNetworkPolicies(k8sClient, namespace);
        res.json(policies);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/roles', async (req, res) => {
      try {
        const { getRoles } = require('./rbac');
        const namespace = req.query.namespace || 'default';
        const roles = await getRoles(k8sClient, namespace);
        res.json(roles);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/cluster-roles', async (req, res) => {
      try {
        const { getClusterRoles } = require('./rbac');
        const roles = await getClusterRoles(k8sClient);
        res.json(roles);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/role-bindings', async (req, res) => {
      try {
        const { getRoleBindings } = require('./rbac');
        const namespace = req.query.namespace || 'default';
        const bindings = await getRoleBindings(k8sClient, namespace);
        res.json(bindings);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/cluster-role-bindings', async (req, res) => {
      try {
        const { getClusterRoleBindings } = require('./rbac');
        const bindings = await getClusterRoleBindings(k8sClient);
        res.json(bindings);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/resource-quotas', async (req, res) => {
      try {
        const { getResourceQuotas } = require('./resource');
        const namespace = req.query.namespace || 'default';
        const quotas = await getResourceQuotas(k8sClient, namespace);
        res.json(quotas);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/limit-ranges', async (req, res) => {
      try {
        const { getLimitRanges } = require('./resource');
        const namespace = req.query.namespace || 'default';
        const limits = await getLimitRanges(k8sClient, namespace);
        res.json(limits);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/service-accounts', async (req, res) => {
      try {
        const { getServiceAccounts } = require('./k8s');
        const namespace = req.query.namespace || 'default';
        const accounts = await getServiceAccounts(k8sClient, namespace);
        res.json(accounts);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/crds', async (req, res) => {
      try {
        const { getCustomResourceDefinitions } = require('./k8s');
        const crds = await getCustomResourceDefinitions(k8sClient);
        res.json(crds);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/replicasets', async (req, res) => {
      try {
        const { getReplicaSets } = require('./k8s');
        const namespace = req.query.namespace || 'default';
        const replicasets = await getReplicaSets(k8sClient, namespace);
        res.json(replicasets);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/endpoints', async (req, res) => {
      try {
        const { getEndpoints } = require('./k8s');
        const namespace = req.query.namespace || 'default';
        const endpoints = await getEndpoints(k8sClient, namespace);
        res.json(endpoints);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/horizontal-pod-autoscalers', async (req, res) => {
      try {
        const { getHorizontalPodAutoscalers } = require('./k8s');
        const namespace = req.query.namespace || 'default';
        const hpas = await getHorizontalPodAutoscalers(k8sClient, namespace);
        res.json(hpas);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/pod-disruption-budgets', async (req, res) => {
      try {
        const { getPodDisruptionBudgets } = require('./k8s');
        const namespace = req.query.namespace || 'default';
        const pdbs = await getPodDisruptionBudgets(k8sClient, namespace);
        res.json(pdbs);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/priority-classes', async (req, res) => {
      try {
        const { getPriorityClasses } = require('./k8s');
        const priorityClasses = await getPriorityClasses(k8sClient);
        res.json(priorityClasses);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/leases', async (req, res) => {
      try {
        const { getLeases } = require('./k8s');
        const namespace = req.query.namespace || 'default';
        const leases = await getLeases(k8sClient, namespace);
        res.json(leases);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/runtime-classes', async (req, res) => {
      try {
        const { getRuntimeClasses } = require('./k8s');
        const runtimeClasses = await getRuntimeClasses(k8sClient);
        res.json(runtimeClasses);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/volume-attachments', async (req, res) => {
      try {
        const { getVolumeAttachments } = require('./k8s');
        const attachments = await getVolumeAttachments(k8sClient);
        res.json(attachments);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/csi-drivers', async (req, res) => {
      try {
        const { getCSIDrivers } = require('./k8s');
        const drivers = await getCSIDrivers(k8sClient);
        res.json(drivers);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/csi-nodes', async (req, res) => {
      try {
        const { getCSINodes } = require('./k8s');
        const nodes = await getCSINodes(k8sClient);
        res.json(nodes);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/csi-storage-capacities', async (req, res) => {
      try {
        const { getCSIStorageCapacities } = require('./k8s');
        const namespace = req.query.namespace || 'default';
        const capacities = await getCSIStorageCapacities(k8sClient, namespace);
        res.json(capacities);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/alerts/rules', (req, res) => {
      try {
        const options = {};
        if (req.query.enabled !== undefined) {
          options.enabled = req.query.enabled === 'true';
        }
        if (req.query.severity) {
          options.severity = req.query.severity;
        }
        const rules = alerts.getAlertRules(options);
        res.json(rules);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/alerts/rules', (req, res) => {
      try {
        const rule = alerts.addAlertRule(req.body);
        res.status(201).json(rule);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.put('/api/alerts/rules/:ruleId', (req, res) => {
      try {
        const rule = alerts.updateAlertRule(req.params.ruleId, req.body);
        res.json(rule);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.delete('/api/alerts/rules/:ruleId', (req, res) => {
      try {
        const rule = alerts.deleteAlertRule(req.params.ruleId);
        res.json(rule);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/alerts/history', (req, res) => {
      try {
        const options = {};
        if (req.query.severity) {
          options.severity = req.query.severity;
        }
        if (req.query.acknowledged !== undefined) {
          options.acknowledged = req.query.acknowledged === 'true';
        }
        if (req.query.resolved !== undefined) {
          options.resolved = req.query.resolved === 'true';
        }
        if (req.query.limit) {
          options.limit = parseInt(req.query.limit);
        }
        const history = alerts.getAlertHistory(options);
        res.json(history);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/alerts/:alertId/acknowledge', (req, res) => {
      try {
        const alert = alerts.acknowledgeAlert(req.params.alertId);
        if (!alert) {
          return res.status(404).json({ error: 'Alert not found' });
        }
        res.json(alert);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/alerts/:alertId/resolve', (req, res) => {
      try {
        const alert = alerts.resolveAlert(req.params.alertId);
        if (!alert) {
          return res.status(404).json({ error: 'Alert not found' });
        }
        res.json(alert);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/alerts/active', (req, res) => {
      try {
        const activeAlerts = alerts.getActiveAlerts();
        res.json(activeAlerts);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/alerts/statistics', (req, res) => {
      try {
        const stats = alerts.getAlertStatistics();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/alerts/export', (req, res) => {
      try {
        const format = req.query.format || 'json';
        const data = alerts.exportAlertRules(format);
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=alert-rules.json');
        res.send(data);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/alerts/import', (req, res) => {
      try {
        const format = req.query.format || 'json';
        const result = alerts.importAlertRules(req.body, format);
        res.json(result);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/automation/scripts', (req, res) => {
      try {
        const options = {};
        if (req.query.enabled !== undefined) {
          options.enabled = req.query.enabled === 'true';
        }
        if (req.query.type) {
          options.type = req.query.type;
        }
        const scripts = automation.getAutomationScripts(options);
        res.json(scripts);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/automation/scripts', (req, res) => {
      try {
        const script = automation.addAutomationScript(req.body);
        res.status(201).json(script);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.put('/api/automation/scripts/:scriptId', (req, res) => {
      try {
        const script = automation.updateAutomationScript(req.params.scriptId, req.body);
        res.json(script);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.delete('/api/automation/scripts/:scriptId', (req, res) => {
      try {
        const script = automation.deleteAutomationScript(req.params.scriptId);
        res.json(script);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/automation/scripts/:scriptId/execute', async (req, res) => {
      try {
        const execution = await automation.executeScript(req.params.scriptId, 'manual', req.body);
        res.json(execution);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/automation/history', (req, res) => {
      try {
        const options = {};
        if (req.query.scriptId) {
          options.scriptId = req.query.scriptId;
        }
        if (req.query.status) {
          options.status = req.query.status;
        }
        if (req.query.limit) {
          options.limit = parseInt(req.query.limit);
        }
        const history = automation.getScriptHistory(options);
        res.json(history);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/automation/history/:executionId', (req, res) => {
      try {
        const execution = automation.getScriptExecution(req.params.executionId);
        if (!execution) {
          return res.status(404).json({ error: 'Execution not found' });
        }
        res.json(execution);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/automation/statistics', (req, res) => {
      try {
        const stats = automation.getScriptStatistics();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/tenants', (req, res) => {
      try {
        const options = {};
        if (req.query.name) {
          options.name = req.query.name;
        }
        if (req.query.namespace) {
          options.namespace = req.query.namespace;
        }
        const tenants = multitenancy.getTenants(options);
        res.json(tenants);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/tenants', async (req, res) => {
      try {
        const tenant = await multitenancy.createTenant(req.body);
        res.status(201).json(tenant);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.put('/api/tenants/:tenantId', async (req, res) => {
      try {
        const tenant = await multitenancy.updateTenant(req.params.tenantId, req.body);
        res.json(tenant);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.delete('/api/tenants/:tenantId', async (req, res) => {
      try {
        const tenant = await multitenancy.deleteTenant(req.params.tenantId);
        res.json(tenant);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/tenants/:tenantId/usage', async (req, res) => {
      try {
        const usage = await multitenancy.getTenantUsage(req.params.tenantId);
        res.json(usage);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/tenants/statistics', (req, res) => {
      try {
        const stats = multitenancy.getTenantStatistics();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/tenants/:tenantId/users', (req, res) => {
      try {
        const options = {};
        if (req.query.role) {
          options.role = req.query.role;
        }
        if (req.query.username) {
          options.username = req.query.username;
        }
        const users = multitenancy.getTenantUsers({ ...options, tenantId: req.params.tenantId });
        res.json(users);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/tenants/:tenantId/users', async (req, res) => {
      try {
        const user = await multitenancy.addTenantUser(req.params.tenantId, req.body);
        res.status(201).json(user);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.put('/api/tenants/:tenantId/users/:userId', async (req, res) => {
      try {
        const user = await multitenancy.updateTenantUser(req.params.userId, req.body);
        res.json(user);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.delete('/api/tenants/:tenantId/users/:userId', async (req, res) => {
      try {
        const user = await multitenancy.deleteTenantUser(req.params.userId);
        res.json(user);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/audit/logs', (req, res) => {
      try {
        const options = {};
        if (req.query.eventType) {
          options.eventType = req.query.eventType;
        }
        if (req.query.category) {
          options.category = req.query.category;
        }
        if (req.query.severity) {
          options.severity = req.query.severity;
        }
        if (req.query.user) {
          options.user = req.query.user;
        }
        if (req.query.startTime) {
          options.startTime = req.query.startTime;
        }
        if (req.query.endTime) {
          options.endTime = req.query.endTime;
        }
        if (req.query.limit) {
          options.limit = parseInt(req.query.limit);
        }
        const logs = audit.getAuditLogs(options);
        res.json(logs);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/audit/logs/:logId', (req, res) => {
      try {
        const log = audit.getAuditLog(req.params.logId);
        if (!log) {
          return res.status(404).json({ error: 'Audit log not found' });
        }
        res.json(log);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/audit/statistics', (req, res) => {
      try {
        const stats = audit.getAuditStatistics();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/security/events', (req, res) => {
      try {
        const options = {};
        if (req.query.type) {
          options.type = req.query.type;
        }
        if (req.query.severity) {
          options.severity = req.query.severity;
        }
        if (req.query.status) {
          options.status = req.query.status;
        }
        if (req.query.acknowledged !== undefined) {
          options.acknowledged = req.query.acknowledged === 'true';
        }
        if (req.query.startTime) {
          options.startTime = req.query.startTime;
        }
        if (req.query.endTime) {
          options.endTime = req.query.endTime;
        }
        if (req.query.limit) {
          options.limit = parseInt(req.query.limit);
        }
        const events = audit.getSecurityEvents(options);
        res.json(events);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/security/events/:eventId', (req, res) => {
      try {
        const event = audit.getSecurityEvent(req.params.eventId);
        if (!event) {
          return res.status(404).json({ error: 'Security event not found' });
        }
        res.json(event);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/security/events/:eventId/acknowledge', (req, res) => {
      try {
        const event = audit.acknowledgeSecurityEvent(req.params.eventId, req.body.acknowledgedBy || 'system');
        res.json(event);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/security/events/:eventId/resolve', (req, res) => {
      try {
        const event = audit.resolveSecurityEvent(req.params.eventId, req.body.resolvedBy || 'system');
        res.json(event);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/security/statistics', (req, res) => {
      try {
        const stats = audit.getSecurityStatistics();
        res.json(stats);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/compliance/reports', (req, res) => {
      try {
        const options = {};
        if (req.query.reportType) {
          options.reportType = req.query.reportType;
        }
        if (req.query.status) {
          options.status = req.query.status;
        }
        if (req.query.limit) {
          options.limit = parseInt(req.query.limit);
        }
        const reports = audit.getComplianceReports(options);
        res.json(reports);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.get('/api/compliance/reports/:reportId', (req, res) => {
      try {
        const report = audit.getComplianceReport(req.params.reportId);
        if (!report) {
          return res.status(404).json({ error: 'Compliance report not found' });
        }
        res.json(report);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post('/api/compliance/reports/generate', async (req, res) => {
      try {
        const reportType = req.body.reportType || 'basic';
        const report = await audit.generateComplianceReport(reportType);
        res.json(report);
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    server.listen(port, () => {
      console.log(`Web UI server is running on http://localhost:${port}`);
      console.log(`Press Ctrl+C to stop the server`);
    });

    return { app, server, io };
  } catch (error) {
    console.error('Failed to start web server:', error.message);
    throw error;
  }
}

function stopWebServer() {
  if (server) {
    server.close(() => {
      console.log('Web server stopped');
    });
  }
}

async function broadcastUpdate(type, data) {
  if (io) {
    io.emit('update', { type, data });
  }
}

module.exports = {
  startWebServer,
  stopWebServer,
  broadcastUpdate
};
