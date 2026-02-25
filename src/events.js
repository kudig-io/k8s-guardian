const { connectK8s } = require('./k8s');

// 获取集群事件
async function getEvents(k8sClient, namespace = 'default', options = {}) {
  try {
    const { fieldSelector, limit, watch } = options;
    
    const params = {
      namespace,
      limit: limit || 50
    };

    if (fieldSelector) {
      params.fieldSelector = fieldSelector;
    }

    if (watch) {
      params.watch = true;
    }

    const response = await k8sClient.core.listNamespacedEvent(namespace, params);
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get events: ${error.message}`);
  }
}

// 获取所有命名空间的事件
async function getAllEvents(k8sClient, options = {}) {
  try {
    const { fieldSelector, limit, watch } = options;
    
    const params = {
      limit: limit || 100
    };

    if (fieldSelector) {
      params.fieldSelector = fieldSelector;
    }

    if (watch) {
      params.watch = true;
    }

    const response = await k8sClient.core.listEventForAllNamespaces(params);
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get all events: ${error.message}`);
  }
}

// 分析事件
function analyzeEvents(events) {
  try {
    const analysis = {
      totalEvents: events.length,
      byType: {},
      byReason: {},
      bySource: {},
      recentEvents: [],
      criticalEvents: []
    };

    // 按类型、原因和来源分析事件
    events.forEach(event => {
      // 按类型分析
      const type = event.type || 'Normal';
      analysis.byType[type] = (analysis.byType[type] || 0) + 1;

      // 按原因分析
      const reason = event.reason || 'Unknown';
      analysis.byReason[reason] = (analysis.byReason[reason] || 0) + 1;

      // 按来源分析
      const source = event.source?.component || 'Unknown';
      analysis.bySource[source] = (analysis.bySource[source] || 0) + 1;

      // 收集最近的事件
      if (analysis.recentEvents.length < 10) {
        analysis.recentEvents.push(event);
      }

      // 收集关键事件
      if (event.type === 'Warning' || event.type === 'Error') {
        analysis.criticalEvents.push(event);
      }
    });

    // 按时间排序最近的事件
    analysis.recentEvents.sort((a, b) => {
      const timeA = new Date(a.lastTimestamp || a.firstTimestamp);
      const timeB = new Date(b.lastTimestamp || b.firstTimestamp);
      return timeB - timeA;
    });

    // 按时间排序关键事件
    analysis.criticalEvents.sort((a, b) => {
      const timeA = new Date(a.lastTimestamp || a.firstTimestamp);
      const timeB = new Date(b.lastTimestamp || b.firstTimestamp);
      return timeB - timeA;
    });

    return analysis;
  } catch (error) {
    throw new Error(`Failed to analyze events: ${error.message}`);
  }
}

// 监控事件（模拟实时监控）
async function monitorEvents(k8sClient, callback, options = {}) {
  try {
    const { namespace, interval = 5000 } = options;
    let lastEventTime = new Date(0);

    setInterval(async () => {
      try {
        const events = namespace 
          ? await getEvents(k8sClient, namespace, { limit: 100 })
          : await getAllEvents(k8sClient, { limit: 100 });

        // 过滤出最新的事件
        const newEvents = events.filter(event => {
          const eventTime = new Date(event.lastTimestamp || event.firstTimestamp);
          return eventTime > lastEventTime;
        });

        if (newEvents.length > 0) {
          // 更新最后事件时间
          const latestEvent = newEvents.reduce((latest, event) => {
            const eventTime = new Date(event.lastTimestamp || event.firstTimestamp);
            const latestTime = new Date(latest.lastTimestamp || latest.firstTimestamp);
            return eventTime > latestTime ? event : latest;
          });
          lastEventTime = new Date(latestEvent.lastTimestamp || latestEvent.firstTimestamp);

          // 调用回调函数处理新事件
          callback(newEvents);
        }
      } catch (error) {
        console.error('Error monitoring events:', error.message);
      }
    }, interval);
  } catch (error) {
    throw new Error(`Failed to start event monitoring: ${error.message}`);
  }
}

// 生成事件告警
function generateAlerts(events) {
  try {
    const alerts = [];

    events.forEach(event => {
      if (event.type === 'Warning' || event.type === 'Error') {
        alerts.push({
          level: event.type === 'Error' ? 'Critical' : 'Warning',
          message: event.message || event.reason || 'Unknown event',
          source: event.source?.component || 'Unknown',
          involvedObject: {
            kind: event.involvedObject?.kind || 'Unknown',
            name: event.involvedObject?.name || 'Unknown',
            namespace: event.involvedObject?.namespace || 'default'
          },
          timestamp: event.lastTimestamp || event.firstTimestamp
        });
      }
    });

    return alerts;
  } catch (error) {
    throw new Error(`Failed to generate alerts: ${error.message}`);
  }
}

module.exports = {
  getEvents,
  getAllEvents,
  analyzeEvents,
  monitorEvents,
  generateAlerts
};