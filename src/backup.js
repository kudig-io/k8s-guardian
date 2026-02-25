const fs = require('fs');
const path = require('path');
const { connectK8s } = require('./k8s');

// 备份和恢复管理
class BackupManager {
  constructor() {
    this.backupDir = path.join(process.env.HOME, '.k8s-guardian', 'backups');
    this.ensureBackupDir();
  }

  // 确保备份目录存在
  ensureBackupDir() {
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
  }

  // 备份集群配置
  async backupCluster(k8sClient, backupName) {
    try {
      const backupData = {
        metadata: {
          name: backupName,
          timestamp: new Date().toISOString(),
          version: '1.0'
        },
        resources: {
          namespaces: [],
          pods: [],
          deployments: [],
          services: [],
          configmaps: [],
          secrets: [],
          ingresses: [],
          roles: [],
          roleBindings: [],
          clusterRoles: [],
          clusterRoleBindings: []
        }
      };

      // 备份命名空间
      const namespaces = await k8sClient.core.listNamespace();
      backupData.resources.namespaces = namespaces.body.items;

      // 备份每个命名空间中的资源
      for (const namespace of namespaces.body.items) {
        const ns = namespace.metadata.name;

        // 备份Pod
        const pods = await k8sClient.core.listNamespacedPod(ns);
        backupData.resources.pods.push(...pods.body.items);

        // 备份Deployment
        const deployments = await k8sClient.apps.listNamespacedDeployment(ns);
        backupData.resources.deployments.push(...deployments.body.items);

        // 备份Service
        const services = await k8sClient.core.listNamespacedService(ns);
        backupData.resources.services.push(...services.body.items);

        // 备份ConfigMap
        const configmaps = await k8sClient.core.listNamespacedConfigMap(ns);
        backupData.resources.configmaps.push(...configmaps.body.items);

        // 备份Secret
        const secrets = await k8sClient.core.listNamespacedSecret(ns);
        backupData.resources.secrets.push(...secrets.body.items);

        // 备份Ingress
        const ingresses = await k8sClient.networking.listNamespacedIngress(ns);
        backupData.resources.ingresses.push(...ingresses.body.items);

        // 备份Role
        const roles = await k8sClient.rbac.listNamespacedRole(ns);
        backupData.resources.roles.push(...roles.body.items);

        // 备份RoleBinding
        const roleBindings = await k8sClient.rbac.listNamespacedRoleBinding(ns);
        backupData.resources.roleBindings.push(...roleBindings.body.items);
      }

      // 备份ClusterRole
      const clusterRoles = await k8sClient.rbac.listClusterRole();
      backupData.resources.clusterRoles = clusterRoles.body.items;

      // 备份ClusterRoleBinding
      const clusterRoleBindings = await k8sClient.rbac.listClusterRoleBinding();
      backupData.resources.clusterRoleBindings = clusterRoleBindings.body.items;

      // 保存备份文件
      const backupFileName = `${backupName}-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      const backupFilePath = path.join(this.backupDir, backupFileName);
      fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2));

      return {
        name: backupName,
        file: backupFileName,
        path: backupFilePath,
        timestamp: backupData.metadata.timestamp,
        resourcesCount: this.countResources(backupData.resources)
      };
    } catch (error) {
      throw new Error(`Failed to backup cluster: ${error.message}`);
    }
  }

  // 恢复集群配置
  async restoreCluster(k8sClient, backupFile) {
    try {
      // 读取备份文件
      const backupFilePath = path.join(this.backupDir, backupFile);
      if (!fs.existsSync(backupFilePath)) {
        throw new Error(`Backup file not found: ${backupFile}`);
      }

      const backupData = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));

      // 恢复资源
      const restoreResults = {
        namespaces: 0,
        pods: 0,
        deployments: 0,
        services: 0,
        configmaps: 0,
        secrets: 0,
        ingresses: 0,
        roles: 0,
        roleBindings: 0,
        clusterRoles: 0,
        clusterRoleBindings: 0,
        errors: []
      };

      // 恢复命名空间
      for (const namespace of backupData.resources.namespaces) {
        try {
          await k8sClient.core.createNamespace(namespace);
          restoreResults.namespaces++;
        } catch (error) {
          restoreResults.errors.push(`Failed to restore namespace ${namespace.metadata.name}: ${error.message}`);
        }
      }

      // 恢复Deployment
      for (const deployment of backupData.resources.deployments) {
        try {
          await k8sClient.apps.createNamespacedDeployment(deployment.metadata.namespace, deployment);
          restoreResults.deployments++;
        } catch (error) {
          restoreResults.errors.push(`Failed to restore deployment ${deployment.metadata.name}: ${error.message}`);
        }
      }

      // 恢复Service
      for (const service of backupData.resources.services) {
        try {
          await k8sClient.core.createNamespacedService(service.metadata.namespace, service);
          restoreResults.services++;
        } catch (error) {
          restoreResults.errors.push(`Failed to restore service ${service.metadata.name}: ${error.message}`);
        }
      }

      // 恢复ConfigMap
      for (const configmap of backupData.resources.configmaps) {
        try {
          await k8sClient.core.createNamespacedConfigMap(configmap.metadata.namespace, configmap);
          restoreResults.configmaps++;
        } catch (error) {
          restoreResults.errors.push(`Failed to restore configmap ${configmap.metadata.name}: ${error.message}`);
        }
      }

      // 恢复Secret
      for (const secret of backupData.resources.secrets) {
        try {
          await k8sClient.core.createNamespacedSecret(secret.metadata.namespace, secret);
          restoreResults.secrets++;
        } catch (error) {
          restoreResults.errors.push(`Failed to restore secret ${secret.metadata.name}: ${error.message}`);
        }
      }

      // 恢复Ingress
      for (const ingress of backupData.resources.ingresses) {
        try {
          await k8sClient.networking.createNamespacedIngress(ingress.metadata.namespace, ingress);
          restoreResults.ingresses++;
        } catch (error) {
          restoreResults.errors.push(`Failed to restore ingress ${ingress.metadata.name}: ${error.message}`);
        }
      }

      // 恢复Role
      for (const role of backupData.resources.roles) {
        try {
          await k8sClient.rbac.createNamespacedRole(role.metadata.namespace, role);
          restoreResults.roles++;
        } catch (error) {
          restoreResults.errors.push(`Failed to restore role ${role.metadata.name}: ${error.message}`);
        }
      }

      // 恢复RoleBinding
      for (const roleBinding of backupData.resources.roleBindings) {
        try {
          await k8sClient.rbac.createNamespacedRoleBinding(roleBinding.metadata.namespace, roleBinding);
          restoreResults.roleBindings++;
        } catch (error) {
          restoreResults.errors.push(`Failed to restore roleBinding ${roleBinding.metadata.name}: ${error.message}`);
        }
      }

      // 恢复ClusterRole
      for (const clusterRole of backupData.resources.clusterRoles) {
        try {
          await k8sClient.rbac.createClusterRole(clusterRole);
          restoreResults.clusterRoles++;
        } catch (error) {
          restoreResults.errors.push(`Failed to restore clusterRole ${clusterRole.metadata.name}: ${error.message}`);
        }
      }

      // 恢复ClusterRoleBinding
      for (const clusterRoleBinding of backupData.resources.clusterRoleBindings) {
        try {
          await k8sClient.rbac.createClusterRoleBinding(clusterRoleBinding);
          restoreResults.clusterRoleBindings++;
        } catch (error) {
          restoreResults.errors.push(`Failed to restore clusterRoleBinding ${clusterRoleBinding.metadata.name}: ${error.message}`);
        }
      }

      return restoreResults;
    } catch (error) {
      throw new Error(`Failed to restore cluster: ${error.message}`);
    }
  }

  // 列出所有备份
  listBackups() {
    try {
      const files = fs.readdirSync(this.backupDir);
      const backups = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(this.backupDir, file);
          const stats = fs.statSync(filePath);
          
          try {
            const backupData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            backups.push({
              file: file,
              name: backupData.metadata.name,
              timestamp: backupData.metadata.timestamp,
              size: stats.size,
              resourcesCount: this.countResources(backupData.resources)
            });
          } catch (error) {
            // Skip invalid backup files
            console.error(`Invalid backup file: ${file}`, error.message);
          }
        }
      }

      return backups.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      throw new Error(`Failed to list backups: ${error.message}`);
    }
  }

  // 删除备份
  deleteBackup(backupFile) {
    try {
      const backupFilePath = path.join(this.backupDir, backupFile);
      if (!fs.existsSync(backupFilePath)) {
        throw new Error(`Backup file not found: ${backupFile}`);
      }

      fs.unlinkSync(backupFilePath);
      return `Backup ${backupFile} deleted successfully`;
    } catch (error) {
      throw new Error(`Failed to delete backup: ${error.message}`);
    }
  }

  // 计算资源数量
  countResources(resources) {
    let count = 0;
    for (const key in resources) {
      if (Array.isArray(resources[key])) {
        count += resources[key].length;
      }
    }
    return count;
  }
}

// 导出单例
const backupManager = new BackupManager();

// 备份集群
async function backupCluster(k8sClient, backupName) {
  return backupManager.backupCluster(k8sClient, backupName);
}

// 恢复集群
async function restoreCluster(k8sClient, backupFile) {
  return backupManager.restoreCluster(k8sClient, backupFile);
}

// 列出所有备份
function listBackups() {
  return backupManager.listBackups();
}

// 删除备份
function deleteBackup(backupFile) {
  return backupManager.deleteBackup(backupFile);
}

module.exports = {
  BackupManager,
  backupCluster,
  restoreCluster,
  listBackups,
  deleteBackup
};