const { getNodes, getPods, getAllPods } = require('./k8s');

// 检查集群健康状态
async function checkClusterHealth(k8sClient) {
  try {
    const healthStatus = {
      nodes: await checkNodesHealth(k8sClient),
      pods: await checkPodsHealth(k8sClient),
      overall: 'Unknown'
    };

    // 计算整体健康状态
    const allNodesHealthy = healthStatus.nodes.every(node => node.status === 'Healthy');
    const healthyPodsRatio = healthStatus.pods.healthy / (healthStatus.pods.total || 1);

    if (allNodesHealthy && healthyPodsRatio > 0.9) {
      healthStatus.overall = 'Healthy';
    } else if (healthyPodsRatio > 0.7) {
      healthStatus.overall = 'Degraded';
    } else {
      healthStatus.overall = 'Unhealthy';
    }

    return healthStatus;
  } catch (error) {
    throw new Error(`Failed to check cluster health: ${error.message}`);
  }
}

// 检查节点健康状态
async function checkNodesHealth(k8sClient) {
  try {
    const nodes = await getNodes(k8sClient);
    return nodes.map(node => {
      const readyCondition = node.status.conditions.find(c => c.type === 'Ready');
      const memoryPressure = node.status.conditions.find(c => c.type === 'MemoryPressure');
      const diskPressure = node.status.conditions.find(c => c.type === 'DiskPressure');
      const pidPressure = node.status.conditions.find(c => c.type === 'PIDPressure');
      const networkUnavailable = node.status.conditions.find(c => c.type === 'NetworkUnavailable');

      let status = 'Healthy';
      if (readyCondition && readyCondition.status !== 'True') {
        status = 'Unhealthy';
      } else if (
        (memoryPressure && memoryPressure.status === 'True') ||
        (diskPressure && diskPressure.status === 'True') ||
        (pidPressure && pidPressure.status === 'True') ||
        (networkUnavailable && networkUnavailable.status === 'True')
      ) {
        status = 'Degraded';
      }

      return {
        name: node.metadata.name,
        status,
        conditions: {
          ready: readyCondition ? readyCondition.status : 'Unknown',
          memoryPressure: memoryPressure ? memoryPressure.status : 'Unknown',
          diskPressure: diskPressure ? diskPressure.status : 'Unknown',
          pidPressure: pidPressure ? pidPressure.status : 'Unknown',
          networkUnavailable: networkUnavailable ? networkUnavailable.status : 'Unknown'
        }
      };
    });
  } catch (error) {
    throw new Error(`Failed to check nodes health: ${error.message}`);
  }
}

// 检查Pod健康状态
async function checkPodsHealth(k8sClient) {
  try {
    const pods = await getAllPods(k8sClient);
    const healthyPods = pods.filter(pod => pod.status.phase === 'Running' || pod.status.phase === 'Succeeded');

    return {
      total: pods.length,
      healthy: healthyPods.length,
      unhealthy: pods.length - healthyPods.length,
      details: pods.map(pod => ({
        name: pod.metadata.name,
        namespace: pod.metadata.namespace,
        status: pod.status.phase,
        node: pod.spec.nodeName
      }))
    };
  } catch (error) {
    throw new Error(`Failed to check pods health: ${error.message}`);
  }
}

// 获取集群资源使用情况
async function getClusterResourceUsage(k8sClient) {
  try {
    const nodes = await getNodes(k8sClient);
    
    let totalCPU = 0;
    let totalMemory = 0;
    let usedCPU = 0;
    let usedMemory = 0;

    nodes.forEach(node => {
      const allocatable = node.status.allocatable;
      const capacity = node.status.capacity;

      // 计算总资源
      if (allocatable.cpu) {
        totalCPU += parseResourceValue(allocatable.cpu);
      }
      if (allocatable.memory) {
        totalMemory += parseResourceValue(allocatable.memory);
      }

      // 注意：实际使用情况需要从metrics-server获取，这里暂时使用容量减去可分配量作为已使用量
      // 实际生产环境中应该使用metrics-server API
      if (capacity.cpu && allocatable.cpu) {
        usedCPU += parseResourceValue(capacity.cpu) - parseResourceValue(allocatable.cpu);
      }
      if (capacity.memory && allocatable.memory) {
        usedMemory += parseResourceValue(capacity.memory) - parseResourceValue(allocatable.memory);
      }
    });

    return {
      cpu: {
        total: totalCPU,
        used: usedCPU,
        usagePercent: totalCPU > 0 ? (usedCPU / totalCPU) * 100 : 0
      },
      memory: {
        total: totalMemory,
        used: usedMemory,
        usagePercent: totalMemory > 0 ? (usedMemory / totalMemory) * 100 : 0
      }
    };
  } catch (error) {
    throw new Error(`Failed to get cluster resource usage: ${error.message}`);
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
  checkClusterHealth,
  checkNodesHealth,
  checkPodsHealth,
  getClusterResourceUsage
};