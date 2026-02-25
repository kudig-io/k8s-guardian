const { connectK8s, getNodes, getPods, getAllPods, getDeployments, getServices, getConfigMaps, getSecrets, getIngresses, getNamespaces, getDaemonSets, getStatefulSets, getJobs, getCronJobs, getServiceAccounts, getCustomResourceDefinitions, getReplicaSets, getEndpoints, getHorizontalPodAutoscalers, getPodDisruptionBudgets, getPriorityClasses, getLeases, getRuntimeClasses, getVolumeAttachments, getCSIDrivers, getCSINodes, getCSIStorageCapacities } = require('./k8s');
const { checkClusterHealth, getClusterResourceUsage } = require('./health');
const { getPodLogs, analyzePodLogs } = require('./logs');
const { getEvents, getAllEvents, analyzeEvents, generateAlerts } = require('./events');
const { getResourceQuotas, getLimitRanges, getNodeAffinity, getAllNodeAffinity, analyzeResourceUsage } = require('./resource');
const { getAllClusters, getCurrentCluster, switchCluster } = require('./cluster');
const { getRoles, getClusterRoles, getRoleBindings, getClusterRoleBindings, analyzeRBAC } = require('./rbac');
const { backupCluster, restoreCluster, listBackups, deleteBackup } = require('./backup');
const { getNetworkPolicies, getIngressClasses, getNetworkServices, analyzeNetworkConfig, getNetworkTrafficAnalysis } = require('./network');
const { getPersistentVolumes, getPersistentVolumeClaims, getStorageClasses, getStorageUsageAnalysis } = require('./storage');

// 处理命令执行
async function handleCommand(command, k8sClient) {
  const args = command.split(' ');
  const cmd = args[0];

  switch (cmd) {
    case 'nodes':
      return await listNodes(k8sClient);
    case 'pods':
      return await listPods(k8sClient, args[1]);
    case 'deployments':
      return await listDeployments(k8sClient, args[1]);
    case 'services':
      return await listServices(k8sClient, args[1]);
    case 'configmaps':
      return await listConfigMaps(k8sClient, args[1]);
    case 'secrets':
      return await listSecrets(k8sClient, args[1]);
    case 'ingresses':
      return await listIngresses(k8sClient, args[1]);
    case 'namespaces':
      return await listNamespaces(k8sClient);
    case 'cluster-health':
      return await listClusterHealth(k8sClient);
    case 'resource-usage':
      return await listResourceUsage(k8sClient);
    case 'logs':
      return await listPodLogs(k8sClient, args[1], args[2], { container: args[3], tailLines: args[4] });
    case 'analyze-logs':
      return await analyzePodLogsCommand(k8sClient, args[1], args[2], { container: args[3] });
    case 'events':
      return await listEvents(k8sClient, args[1]);
    case 'analyze-events':
      return await analyzeEventsCommand(k8sClient, args[1]);
    case 'resource-quotas':
      return await listResourceQuotas(k8sClient, args[1]);
    case 'limit-ranges':
      return await listLimitRanges(k8sClient, args[1]);
    case 'node-affinity':
      return await listNodeAffinity(k8sClient, args[1]);
    case 'analyze-resources':
      return await analyzeResourcesCommand(k8sClient, args[1]);
    case 'clusters':
      return listClusters();
    case 'current-cluster':
      return getCurrentClusterInfo();
    case 'switch-cluster':
      return switchClusterCommand(args[1]);
    case 'roles':
      return await listRoles(k8sClient, args[1]);
    case 'cluster-roles':
      return await listClusterRoles(k8sClient);
    case 'role-bindings':
      return await listRoleBindings(k8sClient, args[1]);
    case 'cluster-role-bindings':
      return await listClusterRoleBindings(k8sClient);
    case 'analyze-rbac':
      return await analyzeRBACCommand(k8sClient);
    case 'backup':
      return await backupClusterCommand(k8sClient, args[1]);
    case 'restore':
      return await restoreClusterCommand(k8sClient, args[1]);
    case 'list-backups':
      return listBackupsCommand();
    case 'delete-backup':
      return deleteBackupCommand(args[1]);
    case 'network-policies':
      return await listNetworkPolicies(k8sClient, args[1]);
    case 'ingress-classes':
      return await listIngressClasses(k8sClient);
    case 'network-analysis':
      return await analyzeNetworkCommand(k8sClient, args[1]);
    case 'network-traffic':
      return getNetworkTrafficCommand();
    case 'persistent-volumes':
      return await listPersistentVolumes(k8sClient);
    case 'persistent-volume-claims':
      return await listPersistentVolumeClaims(k8sClient, args[1]);
    case 'storage-classes':
      return await listStorageClasses(k8sClient);
    case 'storage-analysis':
      return await analyzeStorageCommand(k8sClient, args[1]);
    case 'daemonsets':
      return await listDaemonSets(k8sClient, args[1]);
    case 'statefulsets':
      return await listStatefulSets(k8sClient, args[1]);
    case 'jobs':
      return await listJobs(k8sClient, args[1]);
    case 'cronjobs':
      return await listCronJobs(k8sClient, args[1]);
    case 'serviceaccounts':
      return await listServiceAccounts(k8sClient, args[1]);
    case 'crds':
      return await listCustomResourceDefinitions(k8sClient);
    case 'replicasets':
      return await listReplicaSets(k8sClient, args[1]);
    case 'endpoints':
      return await listEndpoints(k8sClient, args[1]);
    case 'hpas':
      return await listHorizontalPodAutoscalers(k8sClient, args[1]);
    case 'pdbs':
      return await listPodDisruptionBudgets(k8sClient, args[1]);
    case 'priority-classes':
      return await listPriorityClasses(k8sClient);
    case 'leases':
      return await listLeases(k8sClient, args[1]);
    case 'runtime-classes':
      return await listRuntimeClasses(k8sClient);
    case 'volume-attachments':
      return await listVolumeAttachments(k8sClient);
    case 'csi-drivers':
      return await listCSIDrivers(k8sClient);
    case 'csi-nodes':
      return await listCSINodes(k8sClient);
    case 'csi-capacities':
      return await listCSIStorageCapacities(k8sClient, args[1]);
    case 'help':
      return showHelp();
    case 'clear':
      return 'clear';
    default:
      return `Unknown command: ${cmd}. Type 'help' for available commands.`;
  }
}

// 列出所有节点
async function listNodes(k8sClient) {
  try {
    const nodes = await getNodes(k8sClient);
    let result = 'Nodes:\n';
    
    nodes.forEach(node => {
      result += `\nName: ${node.metadata.name}\n`;
      result += `Status: ${node.status.conditions.find(c => c.type === 'Ready').status}\n`;
      result += `Roles: ${node.metadata.labels['kubernetes.io/role'] || 'none'}\n`;
      result += `Version: ${node.status.nodeInfo.kubeletVersion}\n`;
    });
    
    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出Pod
async function listPods(k8sClient, namespace) {
  try {
    let pods;
    if (namespace) {
      pods = await getPods(k8sClient, namespace);
    } else {
      pods = await getAllPods(k8sClient);
    }
    
    let result = `Pods ${namespace ? `in namespace ${namespace}` : 'in all namespaces'}:\n`;
    
    pods.forEach(pod => {
      result += `\nName: ${pod.metadata.name}\n`;
      result += `Namespace: ${pod.metadata.namespace}\n`;
      result += `Status: ${pod.status.phase}\n`;
      result += `Node: ${pod.spec.nodeName}\n`;
    });
    
    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出Deployment
async function listDeployments(k8sClient, namespace = 'default') {
  try {
    const deployments = await getDeployments(k8sClient, namespace);
    let result = `Deployments in namespace ${namespace}:\n`;
    
    deployments.forEach(deployment => {
      result += `\nName: ${deployment.metadata.name}\n`;
      result += `Replicas: ${deployment.spec.replicas} / ${deployment.status.readyReplicas || 0}\n`;
      result += `Image: ${deployment.spec.template.spec.containers[0].image}\n`;
      result += `Status: ${deployment.status.conditions.find(c => c.type === 'Available')?.status || 'Unknown'}\n`;
    });
    
    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出Service
async function listServices(k8sClient, namespace = 'default') {
  try {
    const services = await getServices(k8sClient, namespace);
    let result = `Services in namespace ${namespace}:\n`;
    
    services.forEach(service => {
      result += `\nName: ${service.metadata.name}\n`;
      result += `Type: ${service.spec.type}\n`;
      result += `ClusterIP: ${service.spec.clusterIP || 'None'}\n`;
      if (service.spec.ports && service.spec.ports.length > 0) {
        result += `Ports: ${service.spec.ports.map(p => `${p.port}/${p.protocol}`).join(', ')}\n`;
      }
    });
    
    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出ConfigMap
async function listConfigMaps(k8sClient, namespace = 'default') {
  try {
    const configMaps = await getConfigMaps(k8sClient, namespace);
    let result = `ConfigMaps in namespace ${namespace}:\n`;
    
    configMaps.forEach(configMap => {
      result += `\nName: ${configMap.metadata.name}\n`;
      result += `Data keys: ${Object.keys(configMap.data || {}).join(', ')}\n`;
    });
    
    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出Secret
async function listSecrets(k8sClient, namespace = 'default') {
  try {
    const secrets = await getSecrets(k8sClient, namespace);
    let result = `Secrets in namespace ${namespace}:\n`;
    
    secrets.forEach(secret => {
      result += `\nName: ${secret.metadata.name}\n`;
      result += `Type: ${secret.type}\n`;
      result += `Data keys: ${Object.keys(secret.data || {}).join(', ')}\n`;
    });
    
    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出Ingress
async function listIngresses(k8sClient, namespace = 'default') {
  try {
    const ingresses = await getIngresses(k8sClient, namespace);
    let result = `Ingresses in namespace ${namespace}:\n`;
    
    ingresses.forEach(ingress => {
      result += `\nName: ${ingress.metadata.name}\n`;
      if (ingress.spec.rules && ingress.spec.rules.length > 0) {
        ingress.spec.rules.forEach(rule => {
          result += `Host: ${rule.host || '*'}\n`;
          if (rule.http && rule.http.paths) {
            rule.http.paths.forEach(path => {
              result += `Path: ${path.path || '/'}\n`;
              result += `Backend: ${path.backend.service.name}:${path.backend.service.port.number || path.backend.service.port.name}\n`;
            });
          }
        });
      }
    });
    
    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出所有命名空间
async function listNamespaces(k8sClient) {
  try {
    const namespaces = await getNamespaces(k8sClient);
    let result = 'Namespaces:\n';
    
    namespaces.forEach(namespace => {
      result += `\nName: ${namespace.metadata.name}\n`;
      result += `Status: ${namespace.status.phase}\n`;
    });
    
    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出集群健康状态
async function listClusterHealth(k8sClient) {
  try {
    const healthStatus = await checkClusterHealth(k8sClient);
    let result = `Cluster Health Status: ${healthStatus.overall}\n\n`;
    
    result += 'Nodes Health:\n';
    healthStatus.nodes.forEach(node => {
      result += `\nName: ${node.name}\n`;
      result += `Status: ${node.status}\n`;
      result += `Conditions:\n`;
      result += `  Ready: ${node.conditions.ready}\n`;
      result += `  Memory Pressure: ${node.conditions.memoryPressure}\n`;
      result += `  Disk Pressure: ${node.conditions.diskPressure}\n`;
      result += `  PID Pressure: ${node.conditions.pidPressure}\n`;
      result += `  Network Unavailable: ${node.conditions.networkUnavailable}\n`;
    });
    
    result += '\nPods Health:\n';
    result += `Total Pods: ${healthStatus.pods.total}\n`;
    result += `Healthy Pods: ${healthStatus.pods.healthy}\n`;
    result += `Unhealthy Pods: ${healthStatus.pods.unhealthy}\n`;
    result += `Healthy Ratio: ${((healthStatus.pods.healthy / healthStatus.pods.total) * 100).toFixed(2)}%\n`;
    
    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出集群资源使用情况
async function listResourceUsage(k8sClient) {
  try {
    const resourceUsage = await getClusterResourceUsage(k8sClient);
    let result = 'Cluster Resource Usage:\n\n';
    
    result += 'CPU Usage:\n';
    result += `Total CPU: ${resourceUsage.cpu.total.toFixed(2)} cores\n`;
    result += `Used CPU: ${resourceUsage.cpu.used.toFixed(2)} cores\n`;
    result += `CPU Usage: ${resourceUsage.cpu.usagePercent.toFixed(2)}%\n\n`;
    
    result += 'Memory Usage:\n';
    result += `Total Memory: ${(resourceUsage.memory.total / (1024 * 1024 * 1024)).toFixed(2)} GB\n`;
    result += `Used Memory: ${(resourceUsage.memory.used / (1024 * 1024 * 1024)).toFixed(2)} GB\n`;
    result += `Memory Usage: ${resourceUsage.memory.usagePercent.toFixed(2)}%\n`;
    
    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出Pod日志
async function listPodLogs(k8sClient, podName, namespace = 'default', options = {}) {
  try {
    if (!podName) {
      return 'Error: Pod name is required';
    }

    const logs = await getPodLogs(k8sClient, podName, namespace, options);
    return `Logs for pod ${podName} in namespace ${namespace}:\n\n${logs}`;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 分析Pod日志
async function analyzePodLogsCommand(k8sClient, podName, namespace = 'default', options = {}) {
  try {
    if (!podName) {
      return 'Error: Pod name is required';
    }

    const logs = await getPodLogs(k8sClient, podName, namespace, options);
    const analysis = analyzePodLogs(logs);

    let result = `Log Analysis for pod ${podName} in namespace ${namespace}:\n\n`;
    result += `Total Lines: ${analysis.totalLines}\n`;
    result += `Error Count: ${analysis.errorCount}\n`;
    result += `Warning Count: ${analysis.warningCount}\n`;
    result += `Info Count: ${analysis.infoCount}\n\n`;

    if (analysis.errors.length > 0) {
      result += 'Errors:\n';
      analysis.errors.slice(0, 5).forEach(error => {
        result += `Line ${error.line}: ${error.content}\n`;
      });
      if (analysis.errors.length > 5) {
        result += `... and ${analysis.errors.length - 5} more errors\n\n`;
      } else {
        result += '\n';
      }
    }

    if (analysis.warnings.length > 0) {
      result += 'Warnings:\n';
      analysis.warnings.slice(0, 5).forEach(warning => {
        result += `Line ${warning.line}: ${warning.content}\n`;
      });
      if (analysis.warnings.length > 5) {
        result += `... and ${analysis.warnings.length - 5} more warnings\n\n`;
      } else {
        result += '\n';
      }
    }

    if (Object.keys(analysis.patternAnalysis).length > 0) {
      result += 'Pattern Analysis:\n';
      Object.entries(analysis.patternAnalysis).forEach(([pattern, count]) => {
        result += `${pattern}: ${count}\n`;
      });
    }

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出集群事件
async function listEvents(k8sClient, namespace = 'default') {
  try {
    let events;
    if (namespace === 'all') {
      events = await getAllEvents(k8sClient, { limit: 50 });
    } else {
      events = await getEvents(k8sClient, namespace, { limit: 50 });
    }

    let result = `Events ${namespace === 'all' ? 'in all namespaces' : `in namespace ${namespace}`}:\n\n`;

    events.forEach(event => {
      const type = event.type || 'Normal';
      const reason = event.reason || 'Unknown';
      const message = event.message || '';
      const source = event.source?.component || 'Unknown';
      const timestamp = event.lastTimestamp || event.firstTimestamp;
      const involvedObject = `${event.involvedObject?.kind || 'Unknown'}/${event.involvedObject?.name || 'Unknown'}`;

      result += `[${type}] ${reason} at ${timestamp}: ${message}\n`;
      result += `  Source: ${source}\n`;
      result += `  Object: ${involvedObject}\n`;
      if (event.involvedObject?.namespace && namespace === 'all') {
        result += `  Namespace: ${event.involvedObject.namespace}\n`;
      }
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 分析集群事件
async function analyzeEventsCommand(k8sClient, namespace = 'default') {
  try {
    let events;
    if (namespace === 'all') {
      events = await getAllEvents(k8sClient, { limit: 100 });
    } else {
      events = await getEvents(k8sClient, namespace, { limit: 100 });
    }

    const analysis = analyzeEvents(events);
    const alerts = generateAlerts(events);

    let result = `Event Analysis ${namespace === 'all' ? 'for all namespaces' : `for namespace ${namespace}`}:\n\n`;
    
    // 事件统计
    result += 'Event Statistics:\n';
    result += `Total Events: ${analysis.totalEvents}\n`;
    result += 'Events by Type:\n';
    Object.entries(analysis.byType).forEach(([type, count]) => {
      result += `  ${type}: ${count}\n`;
    });
    
    // 关键事件
    if (analysis.criticalEvents.length > 0) {
      result += '\nCritical Events:\n';
      analysis.criticalEvents.slice(0, 5).forEach(event => {
        const reason = event.reason || 'Unknown';
        const message = event.message || '';
        const timestamp = event.lastTimestamp || event.firstTimestamp;
        const involvedObject = `${event.involvedObject?.kind || 'Unknown'}/${event.involvedObject?.name || 'Unknown'}`;
        result += `  ${reason} at ${timestamp}: ${message}\n`;
        result += `  Object: ${involvedObject}\n`;
      });
      if (analysis.criticalEvents.length > 5) {
        result += `  ... and ${analysis.criticalEvents.length - 5} more critical events\n`;
      }
    }
    
    // 告警
    if (alerts.length > 0) {
      result += '\nGenerated Alerts:\n';
      alerts.slice(0, 5).forEach(alert => {
        result += `  [${alert.level}] ${alert.message}\n`;
        result += `  Object: ${alert.involvedObject.kind}/${alert.involvedObject.name}\n`;
        result += `  Namespace: ${alert.involvedObject.namespace}\n`;
        result += `  Source: ${alert.source}\n`;
        result += `  Time: ${alert.timestamp}\n`;
      });
      if (alerts.length > 5) {
        result += `  ... and ${alerts.length - 5} more alerts\n`;
      }
    }

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出资源配额
async function listResourceQuotas(k8sClient, namespace = 'default') {
  try {
    const quotas = await getResourceQuotas(k8sClient, namespace);

    let result = `Resource Quotas in namespace ${namespace}:\n\n`;

    quotas.forEach(quota => {
      result += `Name: ${quota.metadata.name}\n`;
      result += 'Hard Limits:\n';
      Object.entries(quota.spec.hard || {}).forEach(([resource, limit]) => {
        result += `  ${resource}: ${limit}\n`;
      });
      if (quota.status?.used) {
        result += 'Used:\n';
        Object.entries(quota.status.used).forEach(([resource, used]) => {
          result += `  ${resource}: ${used}\n`;
        });
      }
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出限制范围
async function listLimitRanges(k8sClient, namespace = 'default') {
  try {
    const limitRanges = await getLimitRanges(k8sClient, namespace);

    let result = `Limit Ranges in namespace ${namespace}:\n\n`;

    limitRanges.forEach(limitRange => {
      result += `Name: ${limitRange.metadata.name}\n`;
      limitRange.spec.limits.forEach(limit => {
        result += `Type: ${limit.type}\n`;
        if (limit.min) {
          result += 'Min:\n';
          Object.entries(limit.min).forEach(([resource, value]) => {
            result += `  ${resource}: ${value}\n`;
          });
        }
        if (limit.max) {
          result += 'Max:\n';
          Object.entries(limit.max).forEach(([resource, value]) => {
            result += `  ${resource}: ${value}\n`;
          });
        }
        if (limit.default) {
          result += 'Default:\n';
          Object.entries(limit.default).forEach(([resource, value]) => {
            result += `  ${resource}: ${value}\n`;
          });
        }
        if (limit.defaultRequest) {
          result += 'Default Request:\n';
          Object.entries(limit.defaultRequest).forEach(([resource, value]) => {
            result += `  ${resource}: ${value}\n`;
          });
        }
      });
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出节点亲和性配置
async function listNodeAffinity(k8sClient, namespace = 'default') {
  try {
    let affinityConfig;
    if (namespace === 'all') {
      affinityConfig = await getAllNodeAffinity(k8sClient);
    } else {
      affinityConfig = await getNodeAffinity(k8sClient, namespace);
    }

    let result = `Node Affinity Configurations ${namespace === 'all' ? 'for all namespaces' : `for namespace ${namespace}`}:\n\n`;

    affinityConfig.forEach(config => {
      result += `Pod: ${config.name}\n`;
      if (config.namespace && namespace === 'all') {
        result += `Namespace: ${config.namespace}\n`;
      }
      if (Object.keys(config.nodeSelector).length > 0) {
        result += 'Node Selector:\n';
        Object.entries(config.nodeSelector).forEach(([key, value]) => {
          result += `  ${key}: ${value}\n`;
        });
      }
      if (config.affinity) {
        if (config.affinity.nodeAffinity) {
          result += 'Node Affinity:\n';
          if (config.affinity.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution) {
            result += '  Required:\n';
            config.affinity.nodeAffinity.requiredDuringSchedulingIgnoredDuringExecution.nodeSelectorTerms.forEach(term => {
              term.matchExpressions.forEach(expr => {
                result += `    ${expr.key} ${expr.operator} [${expr.values.join(', ')}]\n`;
              });
            });
          }
          if (config.affinity.nodeAffinity.preferredDuringSchedulingIgnoredDuringExecution) {
            result += '  Preferred:\n';
            config.affinity.nodeAffinity.preferredDuringSchedulingIgnoredDuringExecution.forEach(preference => {
              preference.preference.matchExpressions.forEach(expr => {
                result += `    ${expr.key} ${expr.operator} [${expr.values.join(', ')}] (weight: ${preference.weight})\n`;
              });
            });
          }
        }
      }
      if (config.tolerations.length > 0) {
        result += 'Tolerations:\n';
        config.tolerations.forEach(toleration => {
          result += `  Key: ${toleration.key || '*'}, Operator: ${toleration.operator}, Value: ${toleration.value || ''}, Effect: ${toleration.effect || 'NoSchedule'}\n`;
        });
      }
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 分析资源使用情况
async function analyzeResourcesCommand(k8sClient, namespace = 'default') {
  try {
    let pods;
    if (namespace === 'all') {
      pods = await k8sClient.core.listPodForAllNamespaces();
    } else {
      pods = await k8sClient.core.listNamespacedPod(namespace);
    }

    const analysis = analyzeResourceUsage(pods.body.items);

    let result = `Resource Usage Analysis ${namespace === 'all' ? 'for all namespaces' : `for namespace ${namespace}`}:\n\n`;

    result += 'Pod Distribution by Node:\n';
    Object.entries(analysis.podsByNode).forEach(([node, count]) => {
      result += `  ${node}: ${count} pods\n`;
    });

    result += '\nResource Requests:\n';
    result += `  CPU: ${analysis.resourceRequests.cpu.toFixed(2)} cores\n`;
    result += `  Memory: ${(analysis.resourceRequests.memory / (1024 * 1024 * 1024)).toFixed(2)} GB\n`;

    result += '\nResource Limits:\n';
    result += `  CPU: ${analysis.resourceLimits.cpu.toFixed(2)} cores\n`;
    result += `  Memory: ${(analysis.resourceLimits.memory / (1024 * 1024 * 1024)).toFixed(2)} GB\n`;

    result += `\nTotal Pods: ${analysis.totalPods}\n`;

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出所有集群
function listClusters() {
  try {
    const clusters = getAllClusters();
    const currentCluster = getCurrentCluster();

    let result = 'Available Clusters:\n\n';

    Object.values(clusters).forEach(cluster => {
      const isCurrent = cluster.name === currentCluster;
      result += `${isCurrent ? '[*] ' : '    '}${cluster.name}\n`;
      result += `    Server: ${cluster.server}\n`;
      if (cluster.contexts) {
        result += `    Contexts: ${cluster.contexts.map(c => c.name).join(', ')}\n`;
      }
      if (cluster.users) {
        result += `    Users: ${cluster.users.join(', ')}\n`;
      }
      result += '\n';
    });

    if (currentCluster) {
      result += `Current cluster: ${currentCluster}\n`;
    } else {
      result += 'No current cluster set\n';
    }

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 获取当前集群信息
function getCurrentClusterInfo() {
  try {
    const currentCluster = getCurrentCluster();
    const clusters = getAllClusters();

    if (!currentCluster) {
      return 'No current cluster set';
    }

    const cluster = clusters[currentCluster];

    let result = `Current Cluster: ${currentCluster}\n\n`;
    result += `Server: ${cluster.server}\n`;
    if (cluster.certificateAuthority) {
      result += `Certificate Authority: ${cluster.certificateAuthority}\n`;
    }
    if (cluster.contexts) {
      result += 'Contexts:\n';
      cluster.contexts.forEach(context => {
        result += `  ${context.name}: user=${context.user}, namespace=${context.namespace}\n`;
      });
    }
    if (cluster.users) {
      result += `Users: ${cluster.users.join(', ')}\n`;
    }

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 切换集群
function switchClusterCommand(clusterName) {
  try {
    if (!clusterName) {
      return 'Error: Cluster name is required';
    }

    const newCluster = switchCluster(clusterName);
    return `Switched to cluster: ${newCluster}`;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出Role
async function listRoles(k8sClient, namespace = 'default') {
  try {
    const roles = await getRoles(k8sClient, namespace);

    let result = `Roles in namespace ${namespace}:\n\n`;

    roles.forEach(role => {
      result += `Name: ${role.metadata.name}\n`;
      if (role.rules) {
        result += 'Rules:\n';
        role.rules.forEach(rule => {
          result += `  Resources: ${rule.resources ? rule.resources.join(', ') : '*'}\n`;
          result += `  Verbs: ${rule.verbs ? rule.verbs.join(', ') : '*'}\n`;
          if (rule.apiGroups) {
            result += `  API Groups: ${rule.apiGroups.join(', ')}\n`;
          }
          if (rule.resourceNames) {
            result += `  Resource Names: ${rule.resourceNames.join(', ')}\n`;
          }
          if (rule.nonResourceURLs) {
            result += `  Non-Resource URLs: ${rule.nonResourceURLs.join(', ')}\n`;
          }
        });
      }
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出ClusterRole
async function listClusterRoles(k8sClient) {
  try {
    const clusterRoles = await getClusterRoles(k8sClient);

    let result = 'Cluster Roles:\n\n';

    clusterRoles.forEach(clusterRole => {
      result += `Name: ${clusterRole.metadata.name}\n`;
      if (clusterRole.rules) {
        result += 'Rules:\n';
        clusterRole.rules.forEach(rule => {
          result += `  Resources: ${rule.resources ? rule.resources.join(', ') : '*'}\n`;
          result += `  Verbs: ${rule.verbs ? rule.verbs.join(', ') : '*'}\n`;
          if (rule.apiGroups) {
            result += `  API Groups: ${rule.apiGroups.join(', ')}\n`;
          }
          if (rule.resourceNames) {
            result += `  Resource Names: ${rule.resourceNames.join(', ')}\n`;
          }
          if (rule.nonResourceURLs) {
            result += `  Non-Resource URLs: ${rule.nonResourceURLs.join(', ')}\n`;
          }
        });
      }
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出RoleBinding
async function listRoleBindings(k8sClient, namespace = 'default') {
  try {
    const roleBindings = await getRoleBindings(k8sClient, namespace);

    let result = `Role Bindings in namespace ${namespace}:\n\n`;

    roleBindings.forEach(binding => {
      result += `Name: ${binding.metadata.name}\n`;
      result += `Role: ${binding.roleRef.kind}/${binding.roleRef.name}\n`;
      result += `Subjects:\n`;
      binding.subjects.forEach(subject => {
        result += `  ${subject.kind}: ${subject.name}\n`;
        if (subject.namespace) {
          result += `    Namespace: ${subject.namespace}\n`;
        }
      });
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出ClusterRoleBinding
async function listClusterRoleBindings(k8sClient) {
  try {
    const clusterRoleBindings = await getClusterRoleBindings(k8sClient);

    let result = 'Cluster Role Bindings:\n\n';

    clusterRoleBindings.forEach(binding => {
      result += `Name: ${binding.metadata.name}\n`;
      result += `ClusterRole: ${binding.roleRef.name}\n`;
      result += `Subjects:\n`;
      binding.subjects.forEach(subject => {
        result += `  ${subject.kind}: ${subject.name}\n`;
        if (subject.namespace) {
          result += `    Namespace: ${subject.namespace}\n`;
        }
      });
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 分析RBAC配置
async function analyzeRBACCommand(k8sClient) {
  try {
    const roles = await getRoles(k8sClient, 'default');
    const clusterRoles = await getClusterRoles(k8sClient);
    const roleBindings = await getRoleBindings(k8sClient, 'default');
    const clusterRoleBindings = await getClusterRoleBindings(k8sClient);

    const analysis = analyzeRBAC(roles, clusterRoles, roleBindings, clusterRoleBindings);

    let result = 'RBAC Analysis:\n\n';

    result += 'Summary:\n';
    result += `Total Roles: ${analysis.totalRoles}\n`;
    result += `Total Cluster Roles: ${analysis.totalClusterRoles}\n`;
    result += `Total Role Bindings: ${analysis.totalRoleBindings}\n`;
    result += `Total Cluster Role Bindings: ${analysis.totalClusterRoleBindings}\n\n`;

    result += 'Roles by Namespace:\n';
    Object.entries(analysis.rolesByNamespace).forEach(([namespace, roleNames]) => {
      result += `  ${namespace}: ${roleNames.join(', ')}\n`;
    });

    result += '\nCluster Roles by Prefix:\n';
    Object.entries(analysis.clusterRolesByPrefix).forEach(([prefix, roleNames]) => {
      result += `  ${prefix}: ${roleNames.join(', ')}\n`;
    });

    result += '\nBindings by Subject (Top 5):\n';
    const topSubjects = Object.entries(analysis.bindingsBySubject)
      .sort(([,a], [,b]) => b.length - a.length)
      .slice(0, 5);
    topSubjects.forEach(([subject, bindings]) => {
      result += `  ${subject}: ${bindings.length} bindings\n`;
      bindings.forEach(binding => {
        result += `    - ${binding.type}: ${binding.name}\n`;
      });
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 备份集群
async function backupClusterCommand(k8sClient, backupName) {
  try {
    if (!backupName) {
      return 'Error: Backup name is required';
    }

    const backupResult = await backupCluster(k8sClient, backupName);

    let result = `Backup created successfully:\n\n`;
    result += `Name: ${backupResult.name}\n`;
    result += `File: ${backupResult.file}\n`;
    result += `Timestamp: ${backupResult.timestamp}\n`;
    result += `Resources: ${backupResult.resourcesCount}\n`;
    result += `Path: ${backupResult.path}\n`;

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 恢复集群
async function restoreClusterCommand(k8sClient, backupFile) {
  try {
    if (!backupFile) {
      return 'Error: Backup file name is required';
    }

    const restoreResult = await restoreCluster(k8sClient, backupFile);

    let result = `Restore completed:\n\n`;
    result += `Namespaces: ${restoreResult.namespaces}\n`;
    result += `Deployments: ${restoreResult.deployments}\n`;
    result += `Services: ${restoreResult.services}\n`;
    result += `ConfigMaps: ${restoreResult.configmaps}\n`;
    result += `Secrets: ${restoreResult.secrets}\n`;
    result += `Ingresses: ${restoreResult.ingresses}\n`;
    result += `Roles: ${restoreResult.roles}\n`;
    result += `Role Bindings: ${restoreResult.roleBindings}\n`;
    result += `Cluster Roles: ${restoreResult.clusterRoles}\n`;
    result += `Cluster Role Bindings: ${restoreResult.clusterRoleBindings}\n`;

    if (restoreResult.errors.length > 0) {
      result += `\nErrors (${restoreResult.errors.length}):\n`;
      restoreResult.errors.forEach(error => {
        result += `  - ${error}\n`;
      });
    }

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出所有备份
function listBackupsCommand() {
  try {
    const backups = listBackups();

    let result = 'Available Backups:\n\n';

    if (backups.length === 0) {
      return 'No backups found';
    }

    backups.forEach(backup => {
      result += `File: ${backup.file}\n`;
      result += `Name: ${backup.name}\n`;
      result += `Timestamp: ${backup.timestamp}\n`;
      result += `Resources: ${backup.resourcesCount}\n`;
      result += `Size: ${(backup.size / 1024).toFixed(2)} KB\n`;
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 删除备份
function deleteBackupCommand(backupFile) {
  try {
    if (!backupFile) {
      return 'Error: Backup file name is required';
    }

    const result = deleteBackup(backupFile);
    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出NetworkPolicy
async function listNetworkPolicies(k8sClient, namespace = 'default') {
  try {
    const networkPolicies = await getNetworkPolicies(k8sClient, namespace);

    let result = `Network Policies in namespace ${namespace}:\n\n`;

    networkPolicies.forEach(policy => {
      result += `Name: ${policy.metadata.name}\n`;
      if (policy.spec.podSelector) {
        result += `Pod Selector: ${JSON.stringify(policy.spec.podSelector.matchLabels || {})}\n`;
      }
      if (policy.spec.ingress) {
        result += 'Ingress Rules:\n';
        policy.spec.ingress.forEach((rule, index) => {
          result += `  Rule ${index + 1}:\n`;
          if (rule.from) {
            result += `    From: ${JSON.stringify(rule.from)}\n`;
          }
          if (rule.ports) {
            result += `    Ports: ${JSON.stringify(rule.ports)}\n`;
          }
        });
      }
      if (policy.spec.egress) {
        result += 'Egress Rules:\n';
        policy.spec.egress.forEach((rule, index) => {
          result += `  Rule ${index + 1}:\n`;
          if (rule.to) {
            result += `    To: ${JSON.stringify(rule.to)}\n`;
          }
          if (rule.ports) {
            result += `    Ports: ${JSON.stringify(rule.ports)}\n`;
          }
        });
      }
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出IngressClass
async function listIngressClasses(k8sClient) {
  try {
    const ingressClasses = await getIngressClasses(k8sClient);

    let result = 'Ingress Classes:\n\n';

    ingressClasses.forEach(ingressClass => {
      result += `Name: ${ingressClass.metadata.name}\n`;
      if (ingressClass.spec.controller) {
        result += `Controller: ${ingressClass.spec.controller}\n`;
      }
      if (ingressClass.spec.parameters) {
        result += `Parameters: ${JSON.stringify(ingressClass.spec.parameters)}\n`;
      }
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 分析网络配置
async function analyzeNetworkCommand(k8sClient, namespace = 'default') {
  try {
    const networkPolicies = await getNetworkPolicies(k8sClient, namespace);
    const services = await getNetworkServices(k8sClient, namespace);
    const ingresses = await k8sClient.networking.listNamespacedIngress(namespace);

    const analysis = analyzeNetworkConfig(networkPolicies, services, ingresses.body.items);

    let result = `Network Analysis in namespace ${namespace}:\n\n`;

    result += 'Summary:\n';
    result += `Total Network Policies: ${analysis.totalNetworkPolicies}\n`;
    result += `Total Services: ${analysis.totalServices}\n`;
    result += `Total Ingresses: ${analysis.totalIngresses}\n\n`;

    result += 'Services by Type:\n';
    Object.entries(analysis.servicesByType).forEach(([type, serviceNames]) => {
      result += `  ${type}: ${serviceNames.join(', ')}\n`;
    });

    result += '\nExposed Services:\n';
    analysis.exposedServices.forEach(service => {
      result += `  ${service.name} (${service.type}):\n`;
      service.ports.forEach(port => {
        result += `    Port: ${port.port}/${port.protocol || 'TCP'}\n`;
      });
    });

    result += '\nIngresses by Host:\n';
    Object.entries(analysis.ingressesByHost).forEach(([host, ingressNames]) => {
      result += `  ${host}: ${ingressNames.join(', ')}\n`;
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 获取网络流量分析
function getNetworkTrafficCommand() {
  try {
    const trafficAnalysis = getNetworkTrafficAnalysis();

    let result = 'Network Traffic Analysis:\n\n';

    result += 'Summary:\n';
    result += `Total Requests: ${trafficAnalysis.totalRequests}\n`;
    result += `Successful Requests: ${trafficAnalysis.successfulRequests}\n`;
    result += `Failed Requests: ${trafficAnalysis.failedRequests}\n`;
    result += `Success Rate: ${((trafficAnalysis.successfulRequests / trafficAnalysis.totalRequests) * 100).toFixed(2)}%\n`;
    result += `Request Rate: ${trafficAnalysis.requestRate}\n`;
    result += `Average Response Time: ${trafficAnalysis.averageResponseTime}\n\n`;

    result += 'Top Services by Traffic:\n';
    trafficAnalysis.topServices.forEach(service => {
      result += `  ${service.name}: ${service.requests} requests, ${service.errorRate}% error rate\n`;
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出PersistentVolume
async function listPersistentVolumes(k8sClient) {
  try {
    const persistentVolumes = await getPersistentVolumes(k8sClient);

    let result = 'Persistent Volumes:\n\n';

    persistentVolumes.forEach(pv => {
      result += `Name: ${pv.metadata.name}\n`;
      result += `Status: ${pv.status.phase || 'Unknown'}\n`;
      result += `Storage Class: ${pv.spec.storageClassName || 'default'}\n`;
      result += `Capacity: ${pv.spec.capacity?.storage || 'Unknown'}\n`;
      result += `Access Modes: ${pv.spec.accessModes?.join(', ') || 'Unknown'}\n`;
      if (pv.status.phase === 'Bound' && pv.spec.claimRef) {
        result += `Claimed By: ${pv.spec.claimRef.namespace}/${pv.spec.claimRef.name}\n`;
      }
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出PersistentVolumeClaim
async function listPersistentVolumeClaims(k8sClient, namespace = 'default') {
  try {
    const persistentVolumeClaims = await getPersistentVolumeClaims(k8sClient, namespace);

    let result = `Persistent Volume Claims in namespace ${namespace}:\n\n`;

    persistentVolumeClaims.forEach(pvc => {
      result += `Name: ${pvc.metadata.name}\n`;
      result += `Status: ${pvc.status.phase || 'Unknown'}\n`;
      result += `Storage Class: ${pvc.spec.storageClassName || 'default'}\n`;
      result += `Requested: ${pvc.spec.resources?.requests?.storage || 'Unknown'}\n`;
      result += `Used: ${pvc.status.capacity?.storage || 'Unknown'}\n`;
      if (pvc.status.phase === 'Bound' && pvc.spec.volumeName) {
        result += `Bound to: ${pvc.spec.volumeName}\n`;
      }
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出StorageClass
async function listStorageClasses(k8sClient) {
  try {
    const storageClasses = await getStorageClasses(k8sClient);

    let result = 'Storage Classes:\n\n';

    storageClasses.forEach(sc => {
      result += `Name: ${sc.metadata.name}\n`;
      result += `Provisioner: ${sc.provisioner || 'Unknown'}\n`;
      result += `Reclaim Policy: ${sc.reclaimPolicy || 'Delete'}\n`;
      result += `Volume Binding Mode: ${sc.volumeBindingMode || 'Immediate'}\n`;
      result += `Allow Volume Expansion: ${sc.allowVolumeExpansion || 'false'}\n`;
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 分析存储配置
async function analyzeStorageCommand(k8sClient, namespace = 'default') {
  try {
    const analysis = await getStorageUsageAnalysis(k8sClient, namespace);

    let result = `Storage Analysis in namespace ${namespace}:\n\n`;

    result += 'Summary:\n';
    result += `Total Persistent Volumes: ${analysis.totalPersistentVolumes}\n`;
    result += `Total Persistent Volume Claims: ${analysis.totalPersistentVolumeClaims}\n`;
    result += `Total Storage Classes: ${analysis.totalStorageClasses}\n\n`;

    result += 'Persistent Volumes by Status:\n';
    Object.entries(analysis.pvByStatus).forEach(([status, pvNames]) => {
      result += `  ${status}: ${pvNames.length} PVs\n`;
    });

    result += '\nPersistent Volume Claims by Status:\n';
    Object.entries(analysis.pvcByStatus).forEach(([status, pvcNames]) => {
      result += `  ${status}: ${pvcNames.length} PVCs\n`;
    });

    result += '\nStorage Capacity:\n';
    result += `  Total: ${(analysis.storageCapacity.total / (1024 * 1024 * 1024)).toFixed(2)} GB\n`;
    result += `  Used: ${(analysis.storageCapacity.used / (1024 * 1024 * 1024)).toFixed(2)} GB\n`;
    result += `  Available: ${(analysis.storageCapacity.available / (1024 * 1024 * 1024)).toFixed(2)} GB\n`;
    result += `  Usage: ${analysis.storageCapacity.total > 0 ? ((analysis.storageCapacity.used / analysis.storageCapacity.total) * 100).toFixed(2) : 0}%\n`;

    result += '\nStorage Classes by Provisioner:\n';
    Object.entries(analysis.storageClassesByProvisioner).forEach(([provisioner, scNames]) => {
      result += `  ${provisioner}: ${scNames.join(', ')}\n`;
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出DaemonSet
async function listDaemonSets(k8sClient, namespace = 'default') {
  try {
    const daemonSets = await getDaemonSets(k8sClient, namespace);

    let result = `Daemon Sets in namespace ${namespace}:\n\n`;

    daemonSets.forEach(ds => {
      result += `Name: ${ds.metadata.name}\n`;
      result += `Replicas: ${ds.spec.replicas || 1} / ${ds.status.numberReady || 0}\n`;
      result += `Image: ${ds.spec.template.spec.containers[0].image}\n`;
      result += `Status: ${ds.status.conditions.find(c => c.type === 'Available')?.status || 'Unknown'}\n`;
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出StatefulSet
async function listStatefulSets(k8sClient, namespace = 'default') {
  try {
    const statefulSets = await getStatefulSets(k8sClient, namespace);

    let result = `Stateful Sets in namespace ${namespace}:\n\n`;

    statefulSets.forEach(ss => {
      result += `Name: ${ss.metadata.name}\n`;
      result += `Replicas: ${ss.spec.replicas || 1} / ${ss.status.readyReplicas || 0}\n`;
      result += `Image: ${ss.spec.template.spec.containers[0].image}\n`;
      result += `Status: ${ss.status.conditions.find(c => c.type === 'Available')?.status || 'Unknown'}\n`;
      if (ss.spec.serviceName) {
        result += `Service Name: ${ss.spec.serviceName}\n`;
      }
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出Job
async function listJobs(k8sClient, namespace = 'default') {
  try {
    const jobs = await getJobs(k8sClient, namespace);

    let result = `Jobs in namespace ${namespace}:\n\n`;

    jobs.forEach(job => {
      result += `Name: ${job.metadata.name}\n`;
      result += `Completions: ${job.status.succeeded || 0} / ${job.spec.completions || 1}\n`;
      result += `Active Pods: ${job.status.active || 0}\n`;
      result += `Failed Pods: ${job.status.failed || 0}\n`;
      result += `Start Time: ${job.status.startTime || 'Unknown'}\n`;
      if (job.status.completionTime) {
        result += `Completion Time: ${job.status.completionTime}\n`;
      }
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出CronJob
async function listCronJobs(k8sClient, namespace = 'default') {
  try {
    const cronJobs = await getCronJobs(k8sClient, namespace);

    let result = `Cron Jobs in namespace ${namespace}:\n\n`;

    cronJobs.forEach(cj => {
      result += `Name: ${cj.metadata.name}\n`;
      result += `Schedule: ${cj.spec.schedule}\n`;
      result += `Suspend: ${cj.spec.suspend || false}\n`;
      if (cj.status.lastScheduleTime) {
        result += `Last Schedule: ${cj.status.lastScheduleTime}\n`;
      }
      if (cj.status.lastSuccessfulTime) {
        result += `Last Success: ${cj.status.lastSuccessfulTime}\n`;
      }
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出ServiceAccount
async function listServiceAccounts(k8sClient, namespace = 'default') {
  try {
    const serviceAccounts = await getServiceAccounts(k8sClient, namespace);

    let result = `Service Accounts in namespace ${namespace}:\n\n`;

    serviceAccounts.forEach(sa => {
      result += `Name: ${sa.metadata.name}\n`;
      if (sa.secrets && sa.secrets.length > 0) {
        result += `Secrets: ${sa.secrets.map(s => s.name).join(', ')}\n`;
      }
      if (sa.imagePullSecrets && sa.imagePullSecrets.length > 0) {
        result += `Image Pull Secrets: ${sa.imagePullSecrets.map(s => s.name).join(', ')}\n`;
      }
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出CustomResourceDefinition
async function listCustomResourceDefinitions(k8sClient) {
  try {
    const crds = await getCustomResourceDefinitions(k8sClient);

    let result = 'Custom Resource Definitions:\n\n';

    crds.forEach(crd => {
      result += `Name: ${crd.metadata.name}\n`;
      result += `Group: ${crd.spec.group}\n`;
      result += `Version: ${crd.spec.versions.map(v => v.name).join(', ')}\n`;
      result += `Kind: ${crd.spec.names.kind}\n`;
      result += `Plural: ${crd.spec.names.plural}\n`;
      result += `Scope: ${crd.spec.scope}\n`;
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出ReplicaSet
async function listReplicaSets(k8sClient, namespace = 'default') {
  try {
    const replicasets = await getReplicaSets(k8sClient, namespace);
    let result = `ReplicaSets in namespace ${namespace}:\n\n`;

    replicasets.forEach(rs => {
      result += `Name: ${rs.metadata.name}\n`;
      result += `Replicas: ${rs.spec.replicas} / ${rs.status.readyReplicas || 0}\n`;
      result += `Owner: ${rs.metadata.ownerReferences?.[0]?.kind}/${rs.metadata.ownerReferences?.[0]?.name || 'none'}\n`;
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出Endpoints
async function listEndpoints(k8sClient, namespace = 'default') {
  try {
    const endpoints = await getEndpoints(k8sClient, namespace);
    let result = `Endpoints in namespace ${namespace}:\n\n`;

    endpoints.forEach(ep => {
      result += `Name: ${ep.metadata.name}\n`;
      if (ep.subsets && ep.subsets.length > 0) {
        ep.subsets.forEach(subset => {
          const addresses = subset.addresses?.map(a => a.ip).join(', ') || 'none';
          const ports = subset.ports?.map(p => `${p.port}/${p.protocol}`).join(', ') || 'none';
          result += `Addresses: ${addresses}\n`;
          result += `Ports: ${ports}\n`;
        });
      }
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出HorizontalPodAutoscaler
async function listHorizontalPodAutoscalers(k8sClient, namespace = 'default') {
  try {
    const hpas = await getHorizontalPodAutoscalers(k8sClient, namespace);
    let result = `HorizontalPodAutoscalers in namespace ${namespace}:\n\n`;

    hpas.forEach(hpa => {
      result += `Name: ${hpa.metadata.name}\n`;
      result += `Target: ${hpa.spec.scaleTargetRef.kind}/${hpa.spec.scaleTargetRef.name}\n`;
      result += `Min Replicas: ${hpa.spec.minReplicas}\n`;
      result += `Max Replicas: ${hpa.spec.maxReplicas}\n`;
      result += `Current Replicas: ${hpa.status.currentReplicas || 0}\n`;
      result += `Desired Replicas: ${hpa.status.desiredReplicas || 0}\n`;
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出PodDisruptionBudget
async function listPodDisruptionBudgets(k8sClient, namespace = 'default') {
  try {
    const pdbs = await getPodDisruptionBudgets(k8sClient, namespace);
    let result = `PodDisruptionBudgets in namespace ${namespace}:\n\n`;

    pdbs.forEach(pdb => {
      result += `Name: ${pdb.metadata.name}\n`;
      result += `Min Available: ${pdb.spec.minAvailable || 'not specified'}\n`;
      result += `Max Unavailable: ${pdb.spec.maxUnavailable || 'not specified'}\n`;
      result += `Current Healthy: ${pdb.status.currentHealthy || 0}\n`;
      result += `Desired Healthy: ${pdb.status.desiredHealthy || 0}\n`;
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出PriorityClass
async function listPriorityClasses(k8sClient) {
  try {
    const priorityClasses = await getPriorityClasses(k8sClient);
    let result = 'PriorityClasses:\n\n';

    priorityClasses.forEach(pc => {
      result += `Name: ${pc.metadata.name}\n`;
      result += `Value: ${pc.value}\n`;
      result += `Global Default: ${pc.globalDefault ? 'Yes' : 'No'}\n`;
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出Lease
async function listLeases(k8sClient, namespace = 'default') {
  try {
    const leases = await getLeases(k8sClient, namespace);
    let result = `Leases in namespace ${namespace}:\n\n`;

    leases.forEach(lease => {
      result += `Name: ${lease.metadata.name}\n`;
      result += `Holder Identity: ${lease.spec.holderIdentity || 'none'}\n`;
      result += `Lease Duration: ${lease.spec.leaseDurationSeconds || 'not specified'}s\n`;
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出RuntimeClass
async function listRuntimeClasses(k8sClient) {
  try {
    const runtimeClasses = await getRuntimeClasses(k8sClient);
    let result = 'RuntimeClasses:\n\n';

    runtimeClasses.forEach(rc => {
      result += `Name: ${rc.metadata.name}\n`;
      result += `Handler: ${rc.handler}\n`;
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出VolumeAttachment
async function listVolumeAttachments(k8sClient) {
  try {
    const attachments = await getVolumeAttachments(k8sClient);
    let result = 'VolumeAttachments:\n\n';

    attachments.forEach(va => {
      result += `Name: ${va.metadata.name}\n`;
      result += `PV Name: ${va.spec.source.persistentVolumeName || 'none'}\n`;
      result += `Node Name: ${va.spec.nodeName || 'none'}\n`;
      result += `Attached: ${va.status?.attached ? 'Yes' : 'No'}\n`;
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出CSIDriver
async function listCSIDrivers(k8sClient) {
  try {
    const drivers = await getCSIDrivers(k8sClient);
    let result = 'CSIDrivers:\n\n';

    drivers.forEach(driver => {
      result += `Name: ${driver.metadata.name}\n`;
      result += `Attach Required: ${driver.spec.attachRequired ? 'Yes' : 'No'}\n`;
      result += `Pod Info On Mount: ${driver.spec.podInfoOnMount ? 'Yes' : 'No'}\n`;
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出CSINode
async function listCSINodes(k8sClient) {
  try {
    const nodes = await getCSINodes(k8sClient);
    let result = 'CSINodes:\n\n';

    nodes.forEach(node => {
      result += `Name: ${node.metadata.name}\n`;
      if (node.spec.drivers && node.spec.drivers.length > 0) {
        result += 'Drivers:\n';
        node.spec.drivers.forEach(driver => {
          result += `  ${driver.name}: ${driver.nodeID}\n`;
        });
      }
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 列出CSIStorageCapacity
async function listCSIStorageCapacities(k8sClient, namespace = 'default') {
  try {
    const capacities = await getCSIStorageCapacities(k8sClient, namespace);
    let result = `CSIStorageCapacities in namespace ${namespace}:\n\n`;

    capacities.forEach(capacity => {
      result += `Name: ${capacity.metadata.name}\n`;
      result += `Storage Class: ${capacity.spec.storageClassName || 'none'}\n`;
      result += `Capacity: ${capacity.spec.capacity || 'not specified'}\n`;
      result += '\n';
    });

    return result;
  } catch (error) {
    return `Error: ${error.message}`;
  }
}

// 显示帮助信息
function showHelp() {
  return `Available commands:\n\n` +
    `nodes                    - List all nodes\n` +
    `pods [namespace]         - List pods (all namespaces if not specified)\n` +
    `deployments [namespace]  - List deployments (default namespace if not specified)\n` +
    `services [namespace]     - List services (default namespace if not specified)\n` +
    `configmaps [namespace]   - List configmaps (default namespace if not specified)\n` +
    `secrets [namespace]      - List secrets (default namespace if not specified)\n` +
    `ingresses [namespace]    - List ingresses (default namespace if not specified)\n` +
    `namespaces               - List all namespaces\n` +
    `cluster-health           - Check cluster health status\n` +
    `resource-usage           - Check cluster resource usage\n` +
    `logs <pod> [namespace] [container] [tailLines] - Get pod logs\n` +
    `analyze-logs <pod> [namespace] [container] - Analyze pod logs\n` +
    `events [namespace]       - List events (use 'all' for all namespaces)\n` +
    `analyze-events [namespace] - Analyze events (use 'all' for all namespaces)\n` +
    `resource-quotas [namespace] - List resource quotas (default namespace if not specified)\n` +
    `limit-ranges [namespace] - List limit ranges (default namespace if not specified)\n` +
    `node-affinity [namespace] - List node affinity configurations (use 'all' for all namespaces)\n` +
    `analyze-resources [namespace] - Analyze resource usage (use 'all' for all namespaces)\n` +
    `clusters                 - List all available clusters\n` +
    `current-cluster          - Show current cluster information\n` +
    `switch-cluster <cluster> - Switch to a different cluster\n` +
    `roles [namespace]        - List roles (default namespace if not specified)\n` +
    `cluster-roles            - List cluster roles\n` +
    `role-bindings [namespace] - List role bindings (default namespace if not specified)\n` +
    `cluster-role-bindings    - List cluster role bindings\n` +
    `analyze-rbac             - Analyze RBAC configuration\n` +
    `backup <name>            - Create a backup of the cluster\n` +
    `restore <file>           - Restore the cluster from a backup\n` +
    `list-backups             - List all available backups\n` +
    `delete-backup <file>     - Delete a backup\n` +
    `persistent-volumes       - List all persistent volumes\n` +
    `persistent-volume-claims [namespace] - List persistent volume claims (default namespace if not specified)\n` +
    `storage-classes          - List all storage classes\n` +
    `storage-analysis [namespace] - Analyze storage usage (default namespace if not specified)\n` +
    `daemonsets [namespace]    - List daemonsets (default namespace if not specified)\n` +
    `statefulsets [namespace]  - List statefulsets (default namespace if not specified)\n` +
    `jobs [namespace]          - List jobs (default namespace if not specified)\n` +
    `cronjobs [namespace]      - List cronjobs (default namespace if not specified)\n` +
    `serviceaccounts [namespace] - List serviceaccounts (default namespace if not specified)\n` +
    `crds                      - List custom resource definitions\n` +
    `replicasets [namespace]   - List replicasets (default namespace if not specified)\n` +
    `endpoints [namespace]     - List endpoints (default namespace if not specified)\n` +
    `hpas [namespace]          - List horizontal pod autoscalers (default namespace if not specified)\n` +
    `pdbs [namespace]          - List pod disruption budgets (default namespace if not specified)\n` +
    `priority-classes          - List priority classes\n` +
    `leases [namespace]        - List leases (default namespace if not specified)\n` +
    `runtime-classes           - List runtime classes\n` +
    `volume-attachments        - List volume attachments\n` +
    `csi-drivers               - List CSI drivers\n` +
    `csi-nodes                 - List CSI nodes\n` +
    `csi-capacities [namespace] - List CSI storage capacities (default namespace if not specified)\n` +
    `help                     - Show this help message\n` +
    `clear                    - Clear the console\n` +
    `ai [query]               - Ask AI for help with Kubernetes operations`;
}

module.exports = {
  handleCommand
};