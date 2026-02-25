const { connectK8s } = require('./k8s');

// 获取资源配额
async function getResourceQuotas(k8sClient, namespace = 'default') {
  try {
    const response = await k8sClient.core.listNamespacedResourceQuota(namespace);
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get resource quotas: ${error.message}`);
  }
}

// 获取限制范围
async function getLimitRanges(k8sClient, namespace = 'default') {
  try {
    const response = await k8sClient.core.listNamespacedLimitRange(namespace);
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get limit ranges: ${error.message}`);
  }
}

// 获取节点亲和性和反亲和性配置
async function getNodeAffinity(k8sClient, namespace = 'default') {
  try {
    const pods = await k8sClient.core.listNamespacedPod(namespace);
    return pods.body.items.map(pod => {
      return {
        name: pod.metadata.name,
        nodeSelector: pod.spec.nodeSelector || {},
        affinity: pod.spec.affinity || {},
        tolerations: pod.spec.tolerations || []
      };
    });
  } catch (error) {
    throw new Error(`Failed to get node affinity: ${error.message}`);
  }
}

// 获取所有命名空间的节点亲和性配置
async function getAllNodeAffinity(k8sClient) {
  try {
    const pods = await k8sClient.core.listPodForAllNamespaces();
    return pods.body.items.map(pod => {
      return {
        name: pod.metadata.name,
        namespace: pod.metadata.namespace,
        nodeSelector: pod.spec.nodeSelector || {},
        affinity: pod.spec.affinity || {},
        tolerations: pod.spec.tolerations || []
      };
    });
  } catch (error) {
    throw new Error(`Failed to get all node affinity: ${error.message}`);
  }
}

// 分析资源使用情况
function analyzeResourceUsage(pods) {
  try {
    const analysis = {
      totalPods: pods.length,
      podsByNode: {},
      resourceRequests: {
        cpu: 0,
        memory: 0
      },
      resourceLimits: {
        cpu: 0,
        memory: 0
      }
    };

    pods.forEach(pod => {
      // 按节点分析
      const nodeName = pod.spec.nodeName || 'Unknown';
      analysis.podsByNode[nodeName] = (analysis.podsByNode[nodeName] || 0) + 1;

      // 分析资源请求和限制
      if (pod.spec.containers) {
        pod.spec.containers.forEach(container => {
          if (container.resources) {
            // 分析资源请求
            if (container.resources.requests) {
              if (container.resources.requests.cpu) {
                analysis.resourceRequests.cpu += parseResourceValue(container.resources.requests.cpu);
              }
              if (container.resources.requests.memory) {
                analysis.resourceRequests.memory += parseResourceValue(container.resources.requests.memory);
              }
            }

            // 分析资源限制
            if (container.resources.limits) {
              if (container.resources.limits.cpu) {
                analysis.resourceLimits.cpu += parseResourceValue(container.resources.limits.cpu);
              }
              if (container.resources.limits.memory) {
                analysis.resourceLimits.memory += parseResourceValue(container.resources.limits.memory);
              }
            }
          }
        });
      }
    });

    return analysis;
  } catch (error) {
    throw new Error(`Failed to analyze resource usage: ${error.message}`);
  }
}

// 解析资源值（如"4000m" CPU或"16Gi"内存）
function parseResourceValue(value) {
  if (typeof value !== 'string') {
    return 0;
  }

  // 处理CPU值（如"4000m"或"4"）
  if (value.endsWith('m')) {
    return parseFloat(value) / 1000;
  }

  // 处理内存值（如"16Gi"或"16384Mi"）
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
      'Gi': 1024 * 1024 * 1024,
      'T': 1024 * 1024 * 1024 * 1024,
      'Ti': 1024 * 1024 * 1024 * 1024,
      'P': 1024 * 1024 * 1024 * 1024 * 1024,
      'Pi': 1024 * 1024 * 1024 * 1024 * 1024
    };
    return base * (units[unit] || 1);
  }

  // 尝试直接解析为数字
  const parsed = parseFloat(value);
  return isNaN(parsed) ? 0 : parsed;
}

module.exports = {
  getResourceQuotas,
  getLimitRanges,
  getNodeAffinity,
  getAllNodeAffinity,
  analyzeResourceUsage
};