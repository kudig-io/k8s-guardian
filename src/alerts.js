const fs = require('fs');
const path = require('path');

let alertRules = [];
let alertHistory = [];
let activeAlerts = new Map();

const ALERT_RULES_FILE = path.join(__dirname, '../config/alert-rules.json');
const ALERT_HISTORY_FILE = path.join(__dirname, '../data/alert-history.json');

function loadAlertRules() {
  try {
    if (fs.existsSync(ALERT_RULES_FILE)) {
      const data = fs.readFileSync(ALERT_RULES_FILE, 'utf8');
      alertRules = JSON.parse(data);
    } else {
      alertRules = getDefaultAlertRules();
      saveAlertRules();
    }
    return alertRules;
  } catch (error) {
    console.error('Failed to load alert rules:', error.message);
    alertRules = getDefaultAlertRules();
    return alertRules;
  }
}

function saveAlertRules() {
  try {
    const dir = path.dirname(ALERT_RULES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(ALERT_RULES_FILE, JSON.stringify(alertRules, null, 2));
  } catch (error) {
    console.error('Failed to save alert rules:', error.message);
  }
}

function loadAlertHistory() {
  try {
    if (fs.existsSync(ALERT_HISTORY_FILE)) {
      const data = fs.readFileSync(ALERT_HISTORY_FILE, 'utf8');
      alertHistory = JSON.parse(data);
    }
    return alertHistory;
  } catch (error) {
    console.error('Failed to load alert history:', error.message);
    alertHistory = [];
    return alertHistory;
  }
}

function saveAlertHistory() {
  try {
    const dir = path.dirname(ALERT_HISTORY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(ALERT_HISTORY_FILE, JSON.stringify(alertHistory, null, 2));
  } catch (error) {
    console.error('Failed to save alert history:', error.message);
  }
}

function getDefaultAlertRules() {
  return [
    {
      id: 'pod-crash-looping',
      name: 'Pod 崩溃循环',
      description: '检测 Pod 是否处于崩溃循环状态',
      enabled: true,
      severity: 'critical',
      condition: {
        type: 'pod',
        field: 'restartCount',
        operator: '>',
        threshold: 5,
        timeWindow: '5m'
      },
      actions: ['log', 'notify']
    },
    {
      id: 'high-cpu-usage',
      name: '高 CPU 使用率',
      description: '检测 Pod CPU 使用率是否过高',
      enabled: true,
      severity: 'warning',
      condition: {
        type: 'pod',
        field: 'cpuUsage',
        operator: '>',
        threshold: 80,
        timeWindow: '5m'
      },
      actions: ['log', 'notify']
    },
    {
      id: 'high-memory-usage',
      name: '高内存使用率',
      description: '检测 Pod 内存使用率是否过高',
      enabled: true,
      severity: 'warning',
      condition: {
        type: 'pod',
        field: 'memoryUsage',
        operator: '>',
        threshold: 85,
        timeWindow: '5m'
      },
      actions: ['log', 'notify']
    },
    {
      id: 'node-not-ready',
      name: '节点不可用',
      description: '检测节点是否处于不可用状态',
      enabled: true,
      severity: 'critical',
      condition: {
        type: 'node',
        field: 'ready',
        operator: '==',
        threshold: false,
        timeWindow: '1m'
      },
      actions: ['log', 'notify']
    },
    {
      id: 'disk-pressure',
      name: '磁盘压力',
      description: '检测节点是否存在磁盘压力',
      enabled: true,
      severity: 'warning',
      condition: {
        type: 'node',
        field: 'diskPressure',
        operator: '==',
        threshold: true,
        timeWindow: '1m'
      },
      actions: ['log', 'notify']
    },
    {
      id: 'pod-pending',
      name: 'Pod 长时间 Pending',
      description: '检测 Pod 是否长时间处于 Pending 状态',
      enabled: true,
      severity: 'warning',
      condition: {
        type: 'pod',
        field: 'age',
        operator: '>',
        threshold: 600,
        timeWindow: '10m'
      },
      actions: ['log']
    },
    {
      id: 'failed-events',
      name: '失败事件',
      description: '检测集群中的失败事件',
      enabled: true,
      severity: 'warning',
      condition: {
        type: 'event',
        field: 'type',
        operator: '==',
        threshold: 'Warning',
        timeWindow: '5m'
      },
      actions: ['log', 'notify']
    },
    {
      id: 'image-pull-backoff',
      name: '镜像拉取失败',
      description: '检测镜像拉取失败的情况',
      enabled: true,
      severity: 'error',
      condition: {
        type: 'event',
        field: 'reason',
        operator: 'contains',
        threshold: 'BackOff',
        timeWindow: '5m'
      },
      actions: ['log', 'notify']
    }
  ];
}

function addAlertRule(rule) {
  const newRule = {
    id: rule.id || generateRuleId(),
    name: rule.name,
    description: rule.description || '',
    enabled: rule.enabled !== false,
    severity: rule.severity || 'info',
    condition: rule.condition,
    actions: rule.actions || ['log'],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  alertRules.push(newRule);
  saveAlertRules();
  return newRule;
}

function updateAlertRule(ruleId, updates) {
  const index = alertRules.findIndex(r => r.id === ruleId);
  if (index === -1) {
    throw new Error(`Alert rule not found: ${ruleId}`);
  }

  alertRules[index] = {
    ...alertRules[index],
    ...updates,
    id: ruleId,
    updatedAt: new Date().toISOString()
  };

  saveAlertRules();
  return alertRules[index];
}

function deleteAlertRule(ruleId) {
  const index = alertRules.findIndex(r => r.id === ruleId);
  if (index === -1) {
    throw new Error(`Alert rule not found: ${ruleId}`);
  }

  const deleted = alertRules.splice(index, 1)[0];
  saveAlertRules();
  return deleted;
}

function getAlertRules(options = {}) {
  let rules = [...alertRules];

  if (options.enabled !== undefined) {
    rules = rules.filter(r => r.enabled === options.enabled);
  }

  if (options.severity) {
    rules = rules.filter(r => r.severity === options.severity);
  }

  return rules;
}

function getAlertRule(ruleId) {
  return alertRules.find(r => r.id === ruleId);
}

function generateRuleId() {
  return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function evaluateAlertRule(rule, data) {
  if (!rule.enabled) {
    return null;
  }

  const { condition } = rule;
  let value = null;

  if (condition.type === 'pod') {
    value = getPodValue(data, condition.field);
  } else if (condition.type === 'node') {
    value = getNodeValue(data, condition.field);
  } else if (condition.type === 'event') {
    value = getEventValue(data, condition.field);
  } else {
    return null;
  }

  if (value === null || value === undefined) {
    return null;
  }

  let triggered = false;

  switch (condition.operator) {
    case '>':
      triggered = value > condition.threshold;
      break;
    case '<':
      triggered = value < condition.threshold;
      break;
    case '>=':
      triggered = value >= condition.threshold;
      break;
    case '<=':
      triggered = value <= condition.threshold;
      break;
    case '==':
      triggered = value === condition.threshold;
      break;
    case '!=':
      triggered = value !== condition.threshold;
      break;
    case 'contains':
      triggered = String(value).includes(condition.threshold);
      break;
    case 'not-contains':
      triggered = !String(value).includes(condition.threshold);
      break;
    default:
      return null;
  }

  if (triggered) {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      value,
      threshold: condition.threshold,
      operator: condition.operator,
      triggeredAt: new Date().toISOString()
    };
  }

  return null;
}

function getPodValue(pod, field) {
  switch (field) {
    case 'restartCount':
      return pod.status?.containerStatuses?.reduce((sum, c) => sum + (c.restartCount || 0), 0) || 0;
    case 'cpuUsage':
      return pod.metrics?.cpu || 0;
    case 'memoryUsage':
      return pod.metrics?.memory || 0;
    case 'phase':
      return pod.status?.phase;
    case 'age':
      const creationTime = new Date(pod.metadata?.creationTimestamp);
      return Math.floor((Date.now() - creationTime.getTime()) / 1000);
    default:
      return null;
  }
}

function getNodeValue(node, field) {
  switch (field) {
    case 'ready':
      return node.status?.conditions?.find(c => c.type === 'Ready')?.status === 'True';
    case 'diskPressure':
      return node.status?.conditions?.find(c => c.type === 'DiskPressure')?.status === 'True';
    case 'memoryPressure':
      return node.status?.conditions?.find(c => c.type === 'MemoryPressure')?.status === 'True';
    case 'pidPressure':
      return node.status?.conditions?.find(c => c.type === 'PIDPressure')?.status === 'True';
    case 'networkUnavailable':
      return node.status?.conditions?.find(c => c.type === 'NetworkUnavailable')?.status === 'True';
    case 'cpuUsage':
      return node.metrics?.cpu || 0;
    case 'memoryUsage':
      return node.metrics?.memory || 0;
    default:
      return null;
  }
}

function getEventValue(event, field) {
  switch (field) {
    case 'type':
      return event.type;
    case 'reason':
      return event.reason;
    case 'message':
      return event.message;
    default:
      return null;
  }
}

function triggerAlert(alert) {
  const alertKey = `${alert.ruleId}-${alert.value}`;
  
  if (activeAlerts.has(alertKey)) {
    return null;
  }

  activeAlerts.set(alertKey, {
    ...alert,
    acknowledged: false,
    resolved: false
  });

  const rule = getAlertRule(alert.ruleId);
  const alertRecord = {
    id: generateAlertId(),
    ...alert,
    ruleDescription: rule?.description || '',
    actions: rule?.actions || [],
    acknowledged: false,
    resolved: false,
    createdAt: new Date().toISOString()
  };

  alertHistory.unshift(alertRecord);
  
  if (alertHistory.length > 1000) {
    alertHistory = alertHistory.slice(0, 1000);
  }
  
  saveAlertHistory();

  rule?.actions?.forEach(action => {
    executeAlertAction(action, alertRecord);
  });

  return alertRecord;
}

function generateAlertId() {
  return `alert-record-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function executeAlertAction(action, alert) {
  switch (action) {
    case 'log':
      console.log(`[ALERT] ${alert.severity.toUpperCase()}: ${alert.ruleName}`, alert);
      break;
    case 'notify':
      console.log(`[NOTIFICATION] Alert triggered: ${alert.ruleName}`);
      break;
    case 'webhook':
      console.log(`[WEBHOOK] Sending alert to webhook: ${alert.ruleName}`);
      break;
    case 'email':
      console.log(`[EMAIL] Sending alert email: ${alert.ruleName}`);
      break;
    default:
      console.log(`[UNKNOWN ACTION] ${action}`);
  }
}

function acknowledgeAlert(alertId) {
  const alert = alertHistory.find(a => a.id === alertId);
  if (alert) {
    alert.acknowledged = true;
    alert.acknowledgedAt = new Date().toISOString();
    saveAlertHistory();
    return alert;
  }
  return null;
}

function resolveAlert(alertId) {
  const alert = alertHistory.find(a => a.id === alertId);
  if (alert) {
    alert.resolved = true;
    alert.resolvedAt = new Date().toISOString();
    saveAlertHistory();
    
    const alertKey = `${alert.ruleId}-${alert.value}`;
    activeAlerts.delete(alertKey);
    
    return alert;
  }
  return null;
}

function getAlertHistory(options = {}) {
  let history = [...alertHistory];

  if (options.severity) {
    history = history.filter(a => a.severity === options.severity);
  }

  if (options.acknowledged !== undefined) {
    history = history.filter(a => a.acknowledged === options.acknowledged);
  }

  if (options.resolved !== undefined) {
    history = history.filter(a => a.resolved === options.resolved);
  }

  if (options.limit) {
    history = history.slice(0, options.limit);
  }

  return history;
}

function getActiveAlerts() {
  return Array.from(activeAlerts.values());
}

function evaluateAlerts(data) {
  const triggeredAlerts = [];
  
  alertRules.forEach(rule => {
    const alert = evaluateAlertRule(rule, data);
    if (alert) {
      const alertRecord = triggerAlert(alert);
      if (alertRecord) {
        triggeredAlerts.push(alertRecord);
      }
    }
  });

  return triggeredAlerts;
}

function getAlertStatistics() {
  const stats = {
    total: alertHistory.length,
    active: activeAlerts.size,
    bySeverity: {
      critical: 0,
      error: 0,
      warning: 0,
      info: 0
    },
    byStatus: {
      acknowledged: 0,
      resolved: 0,
      pending: 0
    },
    recent24h: 0
  };

  const now = Date.now();
  const dayAgo = now - (24 * 60 * 60 * 1000);

  alertHistory.forEach(alert => {
    stats.bySeverity[alert.severity] = (stats.bySeverity[alert.severity] || 0) + 1;

    if (alert.acknowledged) {
      stats.byStatus.acknowledged++;
    } else if (alert.resolved) {
      stats.byStatus.resolved++;
    } else {
      stats.byStatus.pending++;
    }

    if (new Date(alert.createdAt).getTime() > dayAgo) {
      stats.recent24h++;
    }
  });

  return stats;
}

function exportAlertRules(format = 'json') {
  switch (format) {
    case 'json':
      return JSON.stringify(alertRules, null, 2);
    case 'yaml':
      return JSON.stringify(alertRules, null, 2);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

function importAlertRules(data, format = 'json') {
  let rules;
  
  try {
    if (format === 'json') {
      rules = JSON.parse(data);
    } else {
      throw new Error(`Unsupported import format: ${format}`);
    }

    if (!Array.isArray(rules)) {
      throw new Error('Invalid alert rules data: expected an array');
    }

    rules.forEach(rule => {
      if (!rule.id) {
        rule.id = generateRuleId();
      }
    });

    alertRules = rules;
    saveAlertRules();
    
    return { imported: rules.length, rules };
  } catch (error) {
    throw new Error(`Failed to import alert rules: ${error.message}`);
  }
}

loadAlertRules();
loadAlertHistory();

module.exports = {
  loadAlertRules,
  saveAlertRules,
  addAlertRule,
  updateAlertRule,
  deleteAlertRule,
  getAlertRules,
  getAlertRule,
  evaluateAlertRule,
  triggerAlert,
  acknowledgeAlert,
  resolveAlert,
  getAlertHistory,
  getActiveAlerts,
  evaluateAlerts,
  getAlertStatistics,
  exportAlertRules,
  importAlertRules,
  getDefaultAlertRules
};
