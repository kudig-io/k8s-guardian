const fs = require('fs');
const path = require('path');

let auditLogs = [];
let securityEvents = [];
let complianceReports = [];

const AUDIT_LOGS_FILE = path.join(__dirname, '../data/audit-logs.json');
const SECURITY_EVENTS_FILE = path.join(__dirname, '../data/security-events.json');
const COMPLIANCE_REPORTS_FILE = path.join(__dirname, '../data/compliance-reports.json');

function loadAuditLogs() {
  try {
    if (fs.existsSync(AUDIT_LOGS_FILE)) {
      const data = fs.readFileSync(AUDIT_LOGS_FILE, 'utf8');
      auditLogs = JSON.parse(data);
    }
    return auditLogs;
  } catch (error) {
    console.error('Failed to load audit logs:', error.message);
    auditLogs = [];
    return auditLogs;
  }
}

function saveAuditLogs() {
  try {
    const dir = path.dirname(AUDIT_LOGS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(AUDIT_LOGS_FILE, JSON.stringify(auditLogs, null, 2));
  } catch (error) {
    console.error('Failed to save audit logs:', error.message);
  }
}

function loadSecurityEvents() {
  try {
    if (fs.existsSync(SECURITY_EVENTS_FILE)) {
      const data = fs.readFileSync(SECURITY_EVENTS_FILE, 'utf8');
      securityEvents = JSON.parse(data);
    }
    return securityEvents;
  } catch (error) {
    console.error('Failed to load security events:', error.message);
    securityEvents = [];
    return securityEvents;
  }
}

function saveSecurityEvents() {
  try {
    const dir = path.dirname(SECURITY_EVENTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SECURITY_EVENTS_FILE, JSON.stringify(securityEvents, null, 2));
  } catch (error) {
    console.error('Failed to save security events:', error.message);
  }
}

function loadComplianceReports() {
  try {
    if (fs.existsSync(COMPLIANCE_REPORTS_FILE)) {
      const data = fs.readFileSync(COMPLIANCE_REPORTS_FILE, 'utf8');
      complianceReports = JSON.parse(data);
    }
    return complianceReports;
  } catch (error) {
    console.error('Failed to load compliance reports:', error.message);
    complianceReports = [];
    return complianceReports;
  }
}

function saveComplianceReports() {
  try {
    const dir = path.dirname(COMPLIANCE_REPORTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(COMPLIANCE_REPORTS_FILE, JSON.stringify(complianceReports, null, 2));
  } catch (error) {
    console.error('Failed to save compliance reports:', error.message);
  }
}

function logAuditEvent(event) {
  const auditLog = {
    id: generateAuditId(),
    timestamp: new Date().toISOString(),
    eventType: event.eventType || 'unknown',
    category: event.category || 'general',
    severity: event.severity || 'info',
    source: event.source || 'system',
    user: event.user || 'system',
    action: event.action,
    resource: event.resource || {},
    result: event.result || 'success',
    details: event.details || {},
    ipAddress: event.ipAddress || null,
    userAgent: event.userAgent || null
  };

  auditLogs.unshift(auditLog);
  
  if (auditLogs.length > 10000) {
    auditLogs = auditLogs.slice(0, 10000);
  }
  
  saveAuditLogs();
  
  return auditLog;
}

function generateAuditId() {
  return `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getAuditLogs(options = {}) {
  let logs = [...auditLogs];

  if (options.eventType) {
    logs = logs.filter(l => l.eventType === options.eventType);
  }

  if (options.category) {
    logs = logs.filter(l => l.category === options.category);
  }

  if (options.severity) {
    logs = logs.filter(l => l.severity === options.severity);
  }

  if (options.user) {
    logs = logs.filter(l => l.user === options.user);
  }

  if (options.startTime) {
    logs = logs.filter(l => new Date(l.timestamp) >= new Date(options.startTime));
  }

  if (options.endTime) {
    logs = logs.filter(l => new Date(l.timestamp) <= new Date(options.endTime));
  }

  if (options.limit) {
    logs = logs.slice(0, options.limit);
  }

  return logs;
}

function getAuditLog(logId) {
  return auditLogs.find(l => l.id === logId);
}

function createSecurityEvent(event) {
  const securityEvent = {
    id: generateSecurityEventId(),
    timestamp: new Date().toISOString(),
    type: event.type || 'unknown',
    severity: event.severity || 'medium',
    title: event.title,
    description: event.description || '',
    source: event.source || 'system',
    affectedResources: event.affectedResources || [],
    remediation: event.remediation || '',
    status: 'open',
    acknowledged: false,
    acknowledgedBy: null,
    acknowledgedAt: null,
    resolved: false,
    resolvedBy: null,
    resolvedAt: null,
    metadata: event.metadata || {}
  };

  securityEvents.unshift(securityEvent);
  
  if (securityEvents.length > 5000) {
    securityEvents = securityEvents.slice(0, 5000);
  }
  
  saveSecurityEvents();
  
  return securityEvent;
}

function generateSecurityEventId() {
  return `sec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function getSecurityEvents(options = {}) {
  let events = [...securityEvents];

  if (options.type) {
    events = events.filter(e => e.type === options.type);
  }

  if (options.severity) {
    events = events.filter(e => e.severity === options.severity);
  }

  if (options.status) {
    events = events.filter(e => e.status === options.status);
  }

  if (options.acknowledged !== undefined) {
    events = events.filter(e => e.acknowledged === options.acknowledged);
  }

  if (options.startTime) {
    events = events.filter(e => new Date(e.timestamp) >= new Date(options.startTime));
  }

  if (options.endTime) {
    events = events.filter(e => new Date(e.timestamp) <= new Date(options.endTime));
  }

  if (options.limit) {
    events = events.slice(0, options.limit);
  }

  return events;
}

function getSecurityEvent(eventId) {
  return securityEvents.find(e => e.id === eventId);
}

function acknowledgeSecurityEvent(eventId, acknowledgedBy) {
  const event = securityEvents.find(e => e.id === eventId);
  if (!event) {
    throw new Error(`Security event not found: ${eventId}`);
  }

  event.acknowledged = true;
  event.acknowledgedBy = acknowledgedBy;
  event.acknowledgedAt = new Date().toISOString();
  
  saveSecurityEvents();
  
  return event;
}

function resolveSecurityEvent(eventId, resolvedBy) {
  const event = securityEvents.find(e => e.id === eventId);
  if (!event) {
    throw new Error(`Security event not found: ${eventId}`);
  }

  event.resolved = true;
  event.resolvedBy = resolvedBy;
  event.resolvedAt = new Date().toISOString();
  event.status = 'resolved';
  
  saveSecurityEvents();
  
  return event;
}

async function generateComplianceReport(reportType = 'basic') {
  const { connectK8s } = require('./k8s');
  const k8sClient = await connectK8s();
  
  const report = {
    id: generateReportId(),
    timestamp: new Date().toISOString(),
    reportType,
    status: 'completed',
    summary: {},
    findings: [],
    score: 0
  };

  try {
    const findings = [];

    const pods = await k8sClient.core.listPodForAllNamespaces();
    const nodes = await k8sClient.core.listNode();
    const namespaces = await k8sClient.core.listNamespace();
    const secrets = await k8sClient.core.listSecretForAllNamespaces();
    const roles = await k8sClient.rbac.listRoleForAllNamespaces();
    const clusterRoles = await k8sClient.rbac.listClusterRole();
    const roleBindings = await k8sClient.rbac.listRoleBindingForAllNamespaces();
    const clusterRoleBindings = await k8sClient.rbac.listClusterRoleBinding();
    const networkPolicies = await k8sClient.networking.listNetworkPolicyForAllNamespaces();

    findings.push(...checkPodSecurity(pods.body.items));
    findings.push(...checkNodeSecurity(nodes.body.items));
    findings.push(...checkNamespaceSecurity(namespaces.body.items));
    findings.push(...checkSecretSecurity(secrets.body.items));
    findings.push(...checkRBACSecurity(roles.body.items, clusterRoles.body.items, roleBindings.body.items, clusterRoleBindings.body.items));
    findings.push(...checkNetworkSecurity(networkPolicies.body.items));

    report.findings = findings;
    report.summary = {
      totalFindings: findings.length,
      criticalFindings: findings.filter(f => f.severity === 'critical').length,
      highFindings: findings.filter(f => f.severity === 'high').length,
      mediumFindings: findings.filter(f => f.severity === 'medium').length,
      lowFindings: findings.filter(f => f.severity === 'low').length,
      infoFindings: findings.filter(f => f.severity === 'info').length
    };

    report.score = calculateComplianceScore(findings);
  } catch (error) {
    report.status = 'failed';
    report.error = error.message;
  }

  complianceReports.unshift(report);
  
  if (complianceReports.length > 100) {
    complianceReports = complianceReports.slice(0, 100);
  }
  
  saveComplianceReports();
  
  return report;
}

function generateReportId() {
  return `report-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function checkPodSecurity(pods) {
  const findings = [];

  pods.forEach(pod => {
    const namespace = pod.metadata.namespace;
    const podName = pod.metadata.name;

    if (!pod.spec.securityContext) {
      findings.push({
        category: 'pod-security',
        severity: 'medium',
        title: 'Pod 缺少安全上下文',
        description: `Pod ${namespace}/${podName} 没有配置安全上下文`,
        resource: { type: 'pod', namespace, name: podName },
        recommendation: '为 Pod 配置安全上下文，设置 runAsNonRoot: true 和 readOnlyRootFilesystem: true'
      });
    }

    if (pod.spec.securityContext && !pod.spec.securityContext.runAsNonRoot) {
      findings.push({
        category: 'pod-security',
        severity: 'high',
        title: 'Pod 未设置为非 root 用户运行',
        description: `Pod ${namespace}/${podName} 允许以 root 用户运行`,
        resource: { type: 'pod', namespace, name: podName },
        recommendation: '设置 securityContext.runAsNonRoot: true'
      });
    }

    pod.spec.containers.forEach(container => {
      if (!container.securityContext) {
        findings.push({
          category: 'pod-security',
          severity: 'medium',
          title: '容器缺少安全上下文',
          description: `容器 ${container.name} 在 Pod ${namespace}/${podName} 中没有配置安全上下文`,
          resource: { type: 'container', namespace, pod: podName, name: container.name },
          recommendation: '为容器配置安全上下文'
        });
      }

      if (container.securityContext && container.securityContext.privileged) {
        findings.push({
          category: 'pod-security',
          severity: 'critical',
          title: '容器以特权模式运行',
          description: `容器 ${container.name} 在 Pod ${namespace}/${podName} 以特权模式运行`,
          resource: { type: 'container', namespace, pod: podName, name: container.name },
          recommendation: '禁用特权模式，设置 securityContext.privileged: false'
        });
      }

      if (container.resources && !container.resources.limits) {
        findings.push({
          category: 'resource-limits',
          severity: 'medium',
          title: '容器未设置资源限制',
          description: `容器 ${container.name} 在 Pod ${namespace}/${podName} 中没有设置资源限制`,
          resource: { type: 'container', namespace, pod: podName, name: container.name },
          recommendation: '为容器设置 CPU 和内存限制'
        });
      }
    });
  });

  return findings;
}

function checkNodeSecurity(nodes) {
  const findings = [];

  nodes.forEach(node => {
    const nodeName = node.metadata.name;

    const taints = node.spec.taints || [];
    if (taints.length === 0) {
      findings.push({
        category: 'node-security',
        severity: 'low',
        title: '节点没有配置污点',
        description: `节点 ${nodeName} 没有配置污点，可能被任意 Pod 调度`,
        resource: { type: 'node', name: nodeName },
        recommendation: '考虑为节点配置适当的污点以限制 Pod 调度'
      });
    }

    const labels = node.metadata.labels || {};
    if (!labels['kubernetes.io/role']) {
      findings.push({
        category: 'node-security',
        severity: 'info',
        title: '节点缺少角色标签',
        description: `节点 ${nodeName} 缺少角色标签`,
        resource: { type: 'node', name: nodeName },
        recommendation: '为节点添加适当的角色标签'
      });
    }
  });

  return findings;
}

function checkNamespaceSecurity(namespaces) {
  const findings = [];

  namespaces.forEach(ns => {
    const nsName = ns.metadata.name;

    const labels = ns.metadata.labels || {};
    if (!labels['name'] && !labels['app.kubernetes.io/name']) {
      findings.push({
        category: 'namespace-security',
        severity: 'low',
        title: '命名空间缺少标签',
        description: `命名空间 ${nsName} 缺少描述性标签`,
        resource: { type: 'namespace', name: nsName },
        recommendation: '为命名空间添加描述性标签以便于管理'
      });
    }

    if (nsName === 'default') {
      findings.push({
        category: 'namespace-security',
        severity: 'info',
        title: '使用默认命名空间',
        description: '检测到使用默认命名空间',
        resource: { type: 'namespace', name: nsName },
        recommendation: '避免在默认命名空间中部署应用，创建专用的命名空间'
      });
    }
  });

  return findings;
}

function checkSecretSecurity(secrets) {
  const findings = [];

  secrets.forEach(secret => {
    const namespace = secret.metadata.namespace;
    const secretName = secret.metadata.name;

    if (secret.type === 'Opaque') {
      const dataKeys = Object.keys(secret.data || {});
      if (dataKeys.length > 0) {
        findings.push({
          category: 'secret-security',
          severity: 'medium',
          title: '使用 Opaque 类型的 Secret',
          description: `Secret ${namespace}/${secretName} 使用 Opaque 类型`,
          resource: { type: 'secret', namespace, name: secretName },
          recommendation: '考虑使用 Kubernetes 内置的 Secret 类型（如 kubernetes.io/tls）以获得更好的安全性'
        });
      }
    }

    if (secret.metadata.annotations && secret.metadata.annotations['kubectl.kubernetes.io/last-applied-configuration']) {
      findings.push({
        category: 'secret-security',
        severity: 'medium',
        title: 'Secret 配置保存在注解中',
        description: `Secret ${namespace}/${secretName} 的配置保存在注解中`,
        resource: { type: 'secret', namespace, name: secretName },
        recommendation: '避免将 Secret 配置保存在注解中，使用 etcd 加密'
      });
    }
  });

  return findings;
}

function checkRBACSecurity(roles, clusterRoles, roleBindings, clusterRoleBindings) {
  const findings = [];

  clusterRoleBindings.forEach(crb => {
    crb.subjects.forEach(subject => {
      if (subject.kind === 'Group' && subject.name === 'system:authenticated') {
        findings.push({
          category: 'rbac-security',
          severity: 'critical',
          title: 'ClusterRoleBinding 绑定到所有认证用户',
          description: `ClusterRoleBinding ${crb.metadata.name} 绑定到所有认证用户`,
          resource: { type: 'clusterrolebinding', name: crb.metadata.name },
          recommendation: '避免将 ClusterRoleBinding 绑定到 system:authenticated 组，使用更具体的用户或组'
        });
      }

      if (subject.kind === 'Group' && subject.name === 'system:unauthenticated') {
        findings.push({
          category: 'rbac-security',
          severity: 'critical',
          title: 'ClusterRoleBinding 绑定到所有未认证用户',
          description: `ClusterRoleBinding ${crb.metadata.name} 绑定到所有未认证用户`,
          resource: { type: 'clusterrolebinding', name: crb.metadata.name },
          recommendation: '避免将 ClusterRoleBinding 绑定到 system:unauthenticated 组'
        });
      }
    });
  });

  clusterRoles.forEach(cr => {
    cr.rules.forEach(rule => {
      if (rule.verbs && rule.verbs.includes('*')) {
        findings.push({
          category: 'rbac-security',
          severity: 'high',
          title: 'ClusterRole 包含通配符权限',
          description: `ClusterRole ${cr.metadata.name} 包含通配符权限`,
          resource: { type: 'clusterrole', name: cr.metadata.name },
          recommendation: '避免使用通配符权限，使用具体的权限列表'
        });
      }

      if (rule.resources && rule.resources.includes('*')) {
        findings.push({
          category: 'rbac-security',
          severity: 'high',
          title: 'ClusterRole 包含通配符资源',
          description: `ClusterRole ${cr.metadata.name} 包含通配符资源`,
          resource: { type: 'clusterrole', name: cr.metadata.name },
          recommendation: '避免使用通配符资源，使用具体的资源列表'
        });
      }
    });
  });

  return findings;
}

function checkNetworkSecurity(networkPolicies) {
  const findings = [];

  const namespacesWithPolicies = new Set();
  networkPolicies.forEach(np => {
    namespacesWithPolicies.add(np.metadata.namespace);
  });

  const { connectK8s } = require('./k8s');
  connectK8s().then(k8sClient => {
    k8sClient.core.listNamespace().then(nsList => {
      nsList.body.items.forEach(ns => {
        if (!namespacesWithPolicies.has(ns.metadata.name) && ns.metadata.name !== 'kube-system') {
          findings.push({
            category: 'network-security',
            severity: 'medium',
            title: '命名空间缺少网络策略',
            description: `命名空间 ${ns.metadata.name} 没有配置网络策略`,
            resource: { type: 'namespace', name: ns.metadata.name },
            recommendation: '为命名空间配置网络策略以限制 Pod 间通信'
          });
        }
      });
    });
  });

  return findings;
}

function calculateComplianceScore(findings) {
  if (findings.length === 0) {
    return 100;
  }

  const severityWeights = {
    critical: 50,
    high: 20,
    medium: 10,
    low: 5,
    info: 1
  };

  let totalWeight = 0;
  findings.forEach(finding => {
    totalWeight += severityWeights[finding.severity] || 0;
  });

  const maxPossibleScore = findings.length * 50;
  const score = Math.max(0, 100 - (totalWeight / maxPossibleScore * 100));

  return Math.round(score);
}

function getComplianceReports(options = {}) {
  let reports = [...complianceReports];

  if (options.reportType) {
    reports = reports.filter(r => r.reportType === options.reportType);
  }

  if (options.status) {
    reports = reports.filter(r => r.status === options.status);
  }

  if (options.limit) {
    reports = reports.slice(0, options.limit);
  }

  return reports;
}

function getComplianceReport(reportId) {
  return complianceReports.find(r => r.id === reportId);
}

function getAuditStatistics() {
  const stats = {
    totalLogs: auditLogs.length,
    byEventType: {},
    bySeverity: {},
    byCategory: {},
    byUser: {},
    recent24h: 0,
    recent7d: 0
  };

  const now = Date.now();
  const dayAgo = now - (24 * 60 * 60 * 1000);
  const weekAgo = now - (7 * 24 * 60 * 60 * 1000);

  auditLogs.forEach(log => {
    stats.byEventType[log.eventType] = (stats.byEventType[log.eventType] || 0) + 1;
    stats.bySeverity[log.severity] = (stats.bySeverity[log.severity] || 0) + 1;
    stats.byCategory[log.category] = (stats.byCategory[log.category] || 0) + 1;
    stats.byUser[log.user] = (stats.byUser[log.user] || 0) + 1;

    const logTime = new Date(log.timestamp).getTime();
    if (logTime > dayAgo) {
      stats.recent24h++;
    }
    if (logTime > weekAgo) {
      stats.recent7d++;
    }
  });

  return stats;
}

function getSecurityStatistics() {
  const stats = {
    totalEvents: securityEvents.length,
    openEvents: securityEvents.filter(e => e.status === 'open').length,
    acknowledgedEvents: securityEvents.filter(e => e.acknowledged).length,
    resolvedEvents: securityEvents.filter(e => e.resolved).length,
    byType: {},
    bySeverity: {},
    recent24h: 0,
    recent7d: 0
  };

  const now = Date.now();
  const dayAgo = now - (24 * 60 * 60 * 1000);
  const weekAgo = now - (7 * 24 * 60 * 60 * 1000);

  securityEvents.forEach(event => {
    stats.byType[event.type] = (stats.byType[event.type] || 0) + 1;
    stats.bySeverity[event.severity] = (stats.bySeverity[event.severity] || 0) + 1;

    const eventTime = new Date(event.timestamp).getTime();
    if (eventTime > dayAgo) {
      stats.recent24h++;
    }
    if (eventTime > weekAgo) {
      stats.recent7d++;
    }
  });

  return stats;
}

loadAuditLogs();
loadSecurityEvents();
loadComplianceReports();

module.exports = {
  logAuditEvent,
  getAuditLogs,
  getAuditLog,
  getAuditStatistics,
  createSecurityEvent,
  getSecurityEvents,
  getSecurityEvent,
  acknowledgeSecurityEvent,
  resolveSecurityEvent,
  getSecurityStatistics,
  generateComplianceReport,
  getComplianceReports,
  getComplianceReport
};
