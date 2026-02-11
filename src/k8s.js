const k8s = require('@kubernetes/client-node');

// 连接到k8s集群
function connectK8s() {
  return new Promise((resolve, reject) => {
    try {
      // 使用默认的kubeconfig
      const kc = new k8s.KubeConfig();
      kc.loadFromDefault();

      // 创建客户端
      const k8sClient = {
        core: kc.makeApiClient(k8s.CoreV1Api),
        apps: kc.makeApiClient(k8s.AppsV1Api),
        batch: kc.makeApiClient(k8s.BatchV1Api),
        batchV1beta1: kc.makeApiClient(k8s.BatchV1beta1Api),
        networking: kc.makeApiClient(k8s.NetworkingV1Api),
        rbac: kc.makeApiClient(k8s.RbacAuthorizationV1Api),
        apiextensions: kc.makeApiClient(k8s.ApiextensionsV1Api),
        storage: kc.makeApiClient(k8s.StorageV1Api),
        autoscaling: kc.makeApiClient(k8s.AutoscalingV2Api),
        policy: kc.makeApiClient(k8s.PolicyV1Api),
        scheduling: kc.makeApiClient(k8s.SchedulingV1Api),
        coordination: kc.makeApiClient(k8s.CoordinationV1Api),
        node: kc.makeApiClient(k8s.NodeV1Api)
      };

      resolve(k8sClient);
    } catch (error) {
      reject(new Error(`Failed to connect to Kubernetes cluster: ${error.message}`));
    }
  });
}

// 获取集群节点信息
async function getNodes(k8sClient) {
  try {
    const response = await k8sClient.core.listNode();
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get nodes: ${error.message}`);
  }
}

// 获取Pod列表
async function getPods(k8sClient, namespace = 'default') {
  try {
    const response = await k8sClient.core.listNamespacedPod(namespace);
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get pods: ${error.message}`);
  }
}

// 获取所有命名空间的Pod
async function getAllPods(k8sClient) {
  try {
    const response = await k8sClient.core.listPodForAllNamespaces();
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get all pods: ${error.message}`);
  }
}

// 获取Deployment列表
async function getDeployments(k8sClient, namespace = 'default') {
  try {
    const response = await k8sClient.apps.listNamespacedDeployment(namespace);
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get deployments: ${error.message}`);
  }
}

// 获取Service列表
async function getServices(k8sClient, namespace = 'default') {
  try {
    const response = await k8sClient.core.listNamespacedService(namespace);
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get services: ${error.message}`);
  }
}

// 获取ConfigMap列表
async function getConfigMaps(k8sClient, namespace = 'default') {
  try {
    const response = await k8sClient.core.listNamespacedConfigMap(namespace);
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get configmaps: ${error.message}`);
  }
}

// 获取Secret列表
async function getSecrets(k8sClient, namespace = 'default') {
  try {
    const response = await k8sClient.core.listNamespacedSecret(namespace);
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get secrets: ${error.message}`);
  }
}

// 获取Ingress列表
async function getIngresses(k8sClient, namespace = 'default') {
  try {
    const response = await k8sClient.networking.listNamespacedIngress(namespace);
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get ingresses: ${error.message}`);
  }
}

// 获取所有命名空间
async function getNamespaces(k8sClient) {
  try {
    const response = await k8sClient.core.listNamespace();
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get namespaces: ${error.message}`);
  }
}

// 获取DaemonSet列表
async function getDaemonSets(k8sClient, namespace = 'default') {
  try {
    const response = await k8sClient.apps.listNamespacedDaemonSet(namespace);
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get daemonsets: ${error.message}`);
  }
}

// 获取StatefulSet列表
async function getStatefulSets(k8sClient, namespace = 'default') {
  try {
    const response = await k8sClient.apps.listNamespacedStatefulSet(namespace);
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get statefulsets: ${error.message}`);
  }
}

// 获取Job列表
async function getJobs(k8sClient, namespace = 'default') {
  try {
    const response = await k8sClient.batch.listNamespacedJob(namespace);
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get jobs: ${error.message}`);
  }
}

// 获取CronJob列表
async function getCronJobs(k8sClient, namespace = 'default') {
  try {
    const response = await k8sClient.batchV1beta1.listNamespacedCronJob(namespace);
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get cronjobs: ${error.message}`);
  }
}

// 获取ServiceAccount列表
async function getServiceAccounts(k8sClient, namespace = 'default') {
  try {
    const response = await k8sClient.core.listNamespacedServiceAccount(namespace);
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get serviceaccounts: ${error.message}`);
  }
}

// 获取CustomResourceDefinition列表
async function getCustomResourceDefinitions(k8sClient) {
  try {
    const response = await k8sClient.apiextensions.listCustomResourceDefinition();
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get customresourcedefinitions: ${error.message}`);
  }
}

// 获取ReplicaSet列表
async function getReplicaSets(k8sClient, namespace = 'default') {
  try {
    const response = await k8sClient.apps.listNamespacedReplicaSet(namespace);
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get replicasets: ${error.message}`);
  }
}

// 获取Endpoints列表
async function getEndpoints(k8sClient, namespace = 'default') {
  try {
    const response = await k8sClient.core.listNamespacedEndpoints(namespace);
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get endpoints: ${error.message}`);
  }
}

// 获取HorizontalPodAutoscaler列表
async function getHorizontalPodAutoscalers(k8sClient, namespace = 'default') {
  try {
    const response = await k8sClient.autoscaling.listNamespacedHorizontalPodAutoscaler(namespace);
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get horizontalpodautoscalers: ${error.message}`);
  }
}

// 获取PodDisruptionBudget列表
async function getPodDisruptionBudgets(k8sClient, namespace = 'default') {
  try {
    const response = await k8sClient.policy.listNamespacedPodDisruptionBudget(namespace);
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get poddisruptionbudgets: ${error.message}`);
  }
}

// 获取PriorityClass列表
async function getPriorityClasses(k8sClient) {
  try {
    const response = await k8sClient.scheduling.listPriorityClass();
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get priorityclasses: ${error.message}`);
  }
}

// 获取Lease列表
async function getLeases(k8sClient, namespace = 'default') {
  try {
    const response = await k8sClient.coordination.listNamespacedLease(namespace);
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get leases: ${error.message}`);
  }
}

// 获取RuntimeClass列表
async function getRuntimeClasses(k8sClient) {
  try {
    const response = await k8sClient.node.listRuntimeClass();
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get runtimeclasses: ${error.message}`);
  }
}

// 获取VolumeAttachment列表
async function getVolumeAttachments(k8sClient) {
  try {
    const response = await k8sClient.storage.listVolumeAttachment();
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get volumeattachments: ${error.message}`);
  }
}

// 获取CSIDriver列表
async function getCSIDrivers(k8sClient) {
  try {
    const response = await k8sClient.storage.listCSIDriver();
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get csidrivers: ${error.message}`);
  }
}

// 获取CSINode列表
async function getCSINodes(k8sClient) {
  try {
    const response = await k8sClient.storage.listCSINode();
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get csinodes: ${error.message}`);
  }
}

// 获取CSIStorageCapacity列表
async function getCSIStorageCapacities(k8sClient, namespace = 'default') {
  try {
    const response = await k8sClient.storage.listNamespacedCSIStorageCapacity(namespace);
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get csistoragecapacities: ${error.message}`);
  }
}

module.exports = {
  connectK8s,
  getNodes,
  getPods,
  getAllPods,
  getDeployments,
  getServices,
  getConfigMaps,
  getSecrets,
  getIngresses,
  getNamespaces,
  getDaemonSets,
  getStatefulSets,
  getJobs,
  getCronJobs,
  getServiceAccounts,
  getCustomResourceDefinitions,
  getReplicaSets,
  getEndpoints,
  getHorizontalPodAutoscalers,
  getPodDisruptionBudgets,
  getPriorityClasses,
  getLeases,
  getRuntimeClasses,
  getVolumeAttachments,
  getCSIDrivers,
  getCSINodes,
  getCSIStorageCapacities
};