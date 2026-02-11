const fs = require('fs');
const path = require('path');
const k8s = require('@kubernetes/client-node');

// 集群配置管理
class ClusterManager {
  constructor() {
    this.clusters = {};
    this.currentCluster = null;
    this.kubeconfigPath = path.join(process.env.HOME, '.kube', 'config');
  }

  // 加载集群配置
  loadClusters() {
    try {
      // 检查kubeconfig文件是否存在
      if (!fs.existsSync(this.kubeconfigPath)) {
        throw new Error(`kubeconfig file not found at ${this.kubeconfigPath}`);
      }

      // 加载kubeconfig
      const kc = new k8s.KubeConfig();
      kc.loadFromFile(this.kubeconfigPath);

      // 解析集群配置
      const config = kc.config;

      // 提取集群信息
      if (config.clusters) {
        config.clusters.forEach(cluster => {
          this.clusters[cluster.name] = {
            name: cluster.name,
            server: cluster.cluster.server,
            certificateAuthority: cluster.cluster['certificate-authority'] || cluster.cluster['certificate-authority-data']
          };
        });
      }

      // 提取用户信息
      if (config.users) {
        config.users.forEach(user => {
          Object.values(this.clusters).forEach(cluster => {
            if (!cluster.users) {
              cluster.users = [];
            }
            cluster.users.push(user.name);
          });
        });
      }

      // 提取上下文信息
      if (config.contexts) {
        config.contexts.forEach(context => {
          const clusterName = context.context.cluster;
          if (this.clusters[clusterName]) {
            if (!this.clusters[clusterName].contexts) {
              this.clusters[clusterName].contexts = [];
            }
            this.clusters[clusterName].contexts.push({
              name: context.name,
              user: context.context.user,
              namespace: context.context.namespace || 'default'
            });
          }
        });
      }

      // 设置当前集群
      if (config['current-context']) {
        const currentContext = config.contexts.find(c => c.name === config['current-context']);
        if (currentContext) {
          this.currentCluster = currentContext.context.cluster;
        }
      }

      return this.clusters;
    } catch (error) {
      throw new Error(`Failed to load clusters: ${error.message}`);
    }
  }

  // 获取所有集群
  getClusters() {
    if (Object.keys(this.clusters).length === 0) {
      this.loadClusters();
    }
    return this.clusters;
  }

  // 获取当前集群
  getCurrentCluster() {
    return this.currentCluster;
  }

  // 切换集群
  switchCluster(clusterName) {
    if (!this.clusters[clusterName]) {
      throw new Error(`Cluster ${clusterName} not found`);
    }

    this.currentCluster = clusterName;
    return this.currentCluster;
  }

  // 为指定集群创建客户端
  createClient(clusterName = this.currentCluster) {
    if (!clusterName || !this.clusters[clusterName]) {
      throw new Error(`Cluster ${clusterName} not found or not specified`);
    }

    // 创建kubeconfig
    const kc = new k8s.KubeConfig();
    kc.loadFromFile(this.kubeconfigPath);

    // 找到对应集群的上下文
    const config = kc.config;
    const context = config.contexts.find(c => c.context.cluster === clusterName);

    if (context) {
      kc.setCurrentContext(context.name);
    }

    // 创建客户端
    return {
      core: kc.makeApiClient(k8s.CoreV1Api),
      apps: kc.makeApiClient(k8s.AppsV1Api),
      batch: kc.makeApiClient(k8s.BatchV1Api),
      networking: kc.makeApiClient(k8s.NetworkingV1Api)
    };
  }

  // 添加集群
  addCluster(clusterConfig) {
    try {
      const { name, server, certificateAuthority, clientCertificate, clientKey, token } = clusterConfig;

      // 加载现有配置
      const kc = new k8s.KubeConfig();
      kc.loadFromFile(this.kubeconfigPath);

      const config = kc.config;

      // 添加集群
      config.clusters.push({
        name,
        cluster: {
          server,
          'certificate-authority': certificateAuthority
        }
      });

      // 添加用户
      const userName = `${name}-user`;
      config.users.push({
        name: userName,
        user: {}
      });

      if (clientCertificate && clientKey) {
        config.users[config.users.length - 1].user['client-certificate'] = clientCertificate;
        config.users[config.users.length - 1].user['client-key'] = clientKey;
      } else if (token) {
        config.users[config.users.length - 1].user.token = token;
      }

      // 添加上下文
      const contextName = `${name}-context`;
      config.contexts.push({
        name: contextName,
        context: {
          cluster: name,
          user: userName,
          namespace: 'default'
        }
      });

      // 保存配置
      fs.writeFileSync(this.kubeconfigPath, JSON.stringify(config, null, 2));

      // 重新加载集群
      this.loadClusters();

      return name;
    } catch (error) {
      throw new Error(`Failed to add cluster: ${error.message}`);
    }
  }

  // 删除集群
  removeCluster(clusterName) {
    try {
      // 加载现有配置
      const kc = new k8s.KubeConfig();
      kc.loadFromFile(this.kubeconfigPath);

      const config = kc.config;

      // 移除集群
      config.clusters = config.clusters.filter(c => c.name !== clusterName);

      // 移除相关用户和上下文
      const userNames = [];
      const contextNames = [];

      config.contexts.forEach(context => {
        if (context.context.cluster === clusterName) {
          userNames.push(context.context.user);
          contextNames.push(context.name);
        }
      });

      config.users = config.users.filter(u => !userNames.includes(u.name));
      config.contexts = config.contexts.filter(c => !contextNames.includes(c.name));

      // 保存配置
      fs.writeFileSync(this.kubeconfigPath, JSON.stringify(config, null, 2));

      // 重新加载集群
      this.loadClusters();

      // 如果删除的是当前集群，切换到第一个可用集群
      if (this.currentCluster === clusterName && Object.keys(this.clusters).length > 0) {
        this.currentCluster = Object.keys(this.clusters)[0];
      } else if (Object.keys(this.clusters).length === 0) {
        this.currentCluster = null;
      }

      return clusterName;
    } catch (error) {
      throw new Error(`Failed to remove cluster: ${error.message}`);
    }
  }
}

// 导出单例
const clusterManager = new ClusterManager();

// 获取所有集群
function getAllClusters() {
  clusterManager.loadClusters();
  return clusterManager.getClusters();
}

// 获取当前集群
function getCurrentCluster() {
  clusterManager.loadClusters();
  return clusterManager.getCurrentCluster();
}

// 切换集群
function switchCluster(clusterName) {
  clusterManager.loadClusters();
  return clusterManager.switchCluster(clusterName);
}

// 为指定集群创建客户端
function createClient(clusterName) {
  clusterManager.loadClusters();
  return clusterManager.createClient(clusterName);
}

// 添加集群
function addCluster(clusterConfig) {
  clusterManager.loadClusters();
  return clusterManager.addCluster(clusterConfig);
}

// 删除集群
function removeCluster(clusterName) {
  clusterManager.loadClusters();
  return clusterManager.removeCluster(clusterName);
}

module.exports = {
  ClusterManager,
  getAllClusters,
  getCurrentCluster,
  switchCluster,
  createClient,
  addCluster,
  removeCluster
};