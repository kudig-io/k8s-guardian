const { connectK8s } = require('./k8s');

// 获取PersistentVolume列表
async function getPersistentVolumes(k8sClient) {
  try {
    const response = await k8sClient.core.listPersistentVolume();
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get persistent volumes: ${error.message}`);
  }
}

// 获取PersistentVolumeClaim列表
async function getPersistentVolumeClaims(k8sClient, namespace = 'default') {
  try {
    const response = await k8sClient.core.listNamespacedPersistentVolumeClaim(namespace);
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get persistent volume claims: ${error.message}`);
  }
}

// 获取StorageClass列表
async function getStorageClasses(k8sClient) {
  try {
    const response = await k8sClient.storage.listStorageClass();
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get storage classes: ${error.message}`);
  }
}

// 分析存储配置
function analyzeStorageConfig(persistentVolumes, persistentVolumeClaims, storageClasses) {
  try {
    const analysis = {
      totalPersistentVolumes: persistentVolumes.length,
      totalPersistentVolumeClaims: persistentVolumeClaims.length,
      totalStorageClasses: storageClasses.length,
      pvByStatus: {},
      pvcByStatus: {},
      pvByStorageClass: {},
      storageCapacity: {
        total: 0,
        used: 0,
        available: 0
      },
      storageClassesByProvisioner: {}
    };

    // 分析PersistentVolume
    persistentVolumes.forEach(pv => {
      const status = pv.status.phase || 'Unknown';
      if (!analysis.pvByStatus[status]) {
        analysis.pvByStatus[status] = [];
      }
      analysis.pvByStatus[status].push(pv.metadata.name);

      const storageClass = pv.spec.storageClassName || 'default';
      if (!analysis.pvByStorageClass[storageClass]) {
        analysis.pvByStorageClass[storageClass] = [];
      }
      analysis.pvByStorageClass[storageClass].push(pv.metadata.name);

      // 计算存储容量
      if (pv.spec.capacity && pv.spec.capacity.storage) {
        const capacity = parseStorageCapacity(pv.spec.capacity.storage);
        analysis.storageCapacity.total += capacity;
        if (status === 'Bound') {
          analysis.storageCapacity.used += capacity;
        } else {
          analysis.storageCapacity.available += capacity;
        }
      }
    });

    // 分析PersistentVolumeClaim
    persistentVolumeClaims.forEach(pvc => {
      const status = pvc.status.phase || 'Unknown';
      if (!analysis.pvcByStatus[status]) {
        analysis.pvcByStatus[status] = [];
      }
      analysis.pvcByStatus[status].push(pvc.metadata.name);
    });

    // 分析StorageClass
    storageClasses.forEach(sc => {
      const provisioner = sc.provisioner || 'Unknown';
      if (!analysis.storageClassesByProvisioner[provisioner]) {
        analysis.storageClassesByProvisioner[provisioner] = [];
      }
      analysis.storageClassesByProvisioner[provisioner].push(sc.metadata.name);
    });

    return analysis;
  } catch (error) {
    throw new Error(`Failed to analyze storage config: ${error.message}`);
  }
}

// 解析存储容量字符串
function parseStorageCapacity(capacityStr) {
  const match = capacityStr.match(/^(\d+)([KMGT]i?)$/);
  if (!match) {
    return 0;
  }
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  switch (unit) {
    case 'k':
    case 'ki':
      return value * 1024;
    case 'm':
    case 'mi':
      return value * 1024 * 1024;
    case 'g':
    case 'gi':
      return value * 1024 * 1024 * 1024;
    case 't':
    case 'ti':
      return value * 1024 * 1024 * 1024 * 1024;
    default:
      return value;
  }
}

// 获取存储使用情况分析
async function getStorageUsageAnalysis(k8sClient, namespace = 'default') {
  try {
    const persistentVolumes = await getPersistentVolumes(k8sClient);
    const persistentVolumeClaims = await getPersistentVolumeClaims(k8sClient, namespace);
    const storageClasses = await getStorageClasses(k8sClient);
    
    return analyzeStorageConfig(persistentVolumes, persistentVolumeClaims, storageClasses);
  } catch (error) {
    throw new Error(`Failed to get storage usage analysis: ${error.message}`);
  }
}

module.exports = {
  getPersistentVolumes,
  getPersistentVolumeClaims,
  getStorageClasses,
  analyzeStorageConfig,
  getStorageUsageAnalysis
};
