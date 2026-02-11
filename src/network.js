const { connectK8s } = require('./k8s');

// 获取NetworkPolicy列表
async function getNetworkPolicies(k8sClient, namespace = 'default') {
  try {
    const response = await k8sClient.networking.listNamespacedNetworkPolicy(namespace);
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get network policies: ${error.message}`);
  }
}

// 获取IngressClass列表
async function getIngressClasses(k8sClient) {
  try {
    const response = await k8sClient.networking.listIngressClass();
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get ingress classes: ${error.message}`);
  }
}

// 获取Service列表（扩展网络相关信息）
async function getNetworkServices(k8sClient, namespace = 'default') {
  try {
    const response = await k8sClient.core.listNamespacedService(namespace);
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get services: ${error.message}`);
  }
}

// 分析网络配置
function analyzeNetworkConfig(networkPolicies, services, ingresses) {
  try {
    const analysis = {
      totalNetworkPolicies: networkPolicies.length,
      totalServices: services.length,
      totalIngresses: ingresses.length,
      networkPoliciesByNamespace: {},
      servicesByType: {},
      ingressesByHost: {},
      exposedServices: []
    };

    // 分析NetworkPolicy
    networkPolicies.forEach(policy => {
      const namespace = policy.metadata.namespace || 'default';
      if (!analysis.networkPoliciesByNamespace[namespace]) {
        analysis.networkPoliciesByNamespace[namespace] = [];
      }
      analysis.networkPoliciesByNamespace[namespace].push(policy.metadata.name);
    });

    // 分析Service
    services.forEach(service => {
      const type = service.spec.type || 'ClusterIP';
      if (!analysis.servicesByType[type]) {
        analysis.servicesByType[type] = [];
      }
      analysis.servicesByType[type].push(service.metadata.name);

      // 识别暴露的服务
      if (service.spec.type === 'LoadBalancer' || service.spec.type === 'NodePort') {
        analysis.exposedServices.push({
          name: service.metadata.name,
          namespace: service.metadata.namespace,
          type: service.spec.type,
          ports: service.spec.ports || []
        });
      }
    });

    // 分析Ingress
    ingresses.forEach(ingress => {
      if (ingress.spec.rules) {
        ingress.spec.rules.forEach(rule => {
          const host = rule.host || '*';
          if (!analysis.ingressesByHost[host]) {
            analysis.ingressesByHost[host] = [];
          }
          analysis.ingressesByHost[host].push(ingress.metadata.name);
        });
      }
    });

    return analysis;
  } catch (error) {
    throw new Error(`Failed to analyze network config: ${error.message}`);
  }
}

// 获取网络流量分析（模拟）
function getNetworkTrafficAnalysis() {
  // 模拟网络流量分析数据
  return {
    totalRequests: 12500,
    successfulRequests: 11875,
    failedRequests: 625,
    requestRate: "42 requests/sec",
    averageResponseTime: "120ms",
    topServices: [
      { name: "frontend", requests: 4500, errorRate: 2.5 },
      { name: "backend", requests: 3200, errorRate: 1.8 },
      { name: "api", requests: 2800, errorRate: 3.2 },
      { name: "database", requests: 2000, errorRate: 0.5 }
    ]
  };
}

module.exports = {
  getNetworkPolicies,
  getIngressClasses,
  getNetworkServices,
  analyzeNetworkConfig,
  getNetworkTrafficAnalysis
};