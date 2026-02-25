const fs = require('fs');
const path = require('path');
const { connectK8s } = require('./k8s');

let tenants = [];
let tenantUsers = [];

const TENANTS_FILE = path.join(__dirname, '../config/tenants.json');
const TENANT_USERS_FILE = path.join(__dirname, '../config/tenant-users.json');

function loadTenants() {
  try {
    if (fs.existsSync(TENANTS_FILE)) {
      const data = fs.readFileSync(TENANTS_FILE, 'utf8');
      tenants = JSON.parse(data);
    } else {
      tenants = getDefaultTenants();
      saveTenants();
    }
    return tenants;
  } catch (error) {
    console.error('Failed to load tenants:', error.message);
    tenants = getDefaultTenants();
    return tenants;
  }
}

function saveTenants() {
  try {
    const dir = path.dirname(TENANTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TENANTS_FILE, JSON.stringify(tenants, null, 2));
  } catch (error) {
    console.error('Failed to save tenants:', error.message);
  }
}

function loadTenantUsers() {
  try {
    if (fs.existsSync(TENANT_USERS_FILE)) {
      const data = fs.readFileSync(TENANT_USERS_FILE, 'utf8');
      tenantUsers = JSON.parse(data);
    }
    return tenantUsers;
  } catch (error) {
    console.error('Failed to load tenant users:', error.message);
    tenantUsers = [];
    return tenantUsers;
  }
}

function saveTenantUsers() {
  try {
    const dir = path.dirname(TENANT_USERS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TENANT_USERS_FILE, JSON.stringify(tenantUsers, null, 2));
  } catch (error) {
    console.error('Failed to save tenant users:', error.message);
  }
}

function getDefaultTenants() {
  return [
    {
      id: 'default',
      name: 'Default',
      description: '默认租户',
      namespaces: ['default', 'kube-system', 'kube-public'],
      resourceQuotas: {
        cpu: '10',
        memory: '20Gi',
        pods: '100',
        services: '50',
        persistentVolumeClaims: '20'
      },
      networkPolicies: {
        enabled: true,
        defaultDeny: false
      },
      rbac: {
        enabled: true,
        defaultRole: 'view'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ];
}

async function createTenant(tenantData) {
  const k8sClient = await connectK8s();
  
  const tenant = {
    id: generateTenantId(),
    name: tenantData.name,
    description: tenantData.description || '',
    namespaces: tenantData.namespaces || [],
    resourceQuotas: tenantData.resourceQuotas || {
      cpu: '4',
      memory: '8Gi',
      pods: '50',
      services: '20',
      persistentVolumeClaims: '10'
    },
    networkPolicies: tenantData.networkPolicies || {
      enabled: true,
      defaultDeny: true
    },
    rbac: tenantData.rbac || {
      enabled: true,
      defaultRole: 'edit'
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  for (const namespace of tenant.namespaces) {
    await ensureNamespace(k8sClient, namespace);
    await createResourceQuota(k8sClient, namespace, tenant.id, tenant.resourceQuotas);
    if (tenant.networkPolicies.enabled && tenant.networkPolicies.defaultDeny) {
      await createDefaultNetworkPolicy(k8sClient, namespace, tenant.id);
    }
    if (tenant.rbac.enabled) {
      await createTenantRBAC(k8sClient, namespace, tenant.id, tenant.rbac.defaultRole);
    }
  }

  tenants.push(tenant);
  saveTenants();
  
  return tenant;
}

async function updateTenant(tenantId, updates) {
  const index = tenants.findIndex(t => t.id === tenantId);
  if (index === -1) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  const oldTenant = tenants[index];
  tenants[index] = {
    ...tenants[index],
    ...updates,
    id: tenantId,
    updatedAt: new Date().toISOString()
  };

  saveTenants();
  return tenants[index];
}

async function deleteTenant(tenantId) {
  const index = tenants.findIndex(t => t.id === tenantId);
  if (index === -1) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  const tenant = tenants[index];
  const k8sClient = await connectK8s();

  for (const namespace of tenant.namespaces) {
    try {
      await deleteTenantResources(k8sClient, namespace, tenantId);
    } catch (error) {
      console.error(`Failed to delete resources in namespace ${namespace}:`, error.message);
    }
  }

  const deleted = tenants.splice(index, 1)[0];
  
  const userIndex = tenantUsers.findIndex(u => u.tenantId === tenantId);
  if (userIndex !== -1) {
    tenantUsers.splice(userIndex, 1);
    saveTenantUsers();
  }

  saveTenants();
  return deleted;
}

function getTenants(options = {}) {
  let result = [...tenants];

  if (options.name) {
    result = result.filter(t => t.name.includes(options.name));
  }

  if (options.namespace) {
    result = result.filter(t => t.namespaces.includes(options.namespace));
  }

  return result;
}

function getTenant(tenantId) {
  return tenants.find(t => t.id === tenantId);
}

function generateTenantId() {
  return `tenant-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function ensureNamespace(k8sClient, namespace) {
  try {
    await k8sClient.core.readNamespace(namespace);
  } catch (error) {
    if (error.statusCode === 404) {
      await k8sClient.core.createNamespace({
        metadata: {
          name: namespace,
          labels: {
            'managed-by': 'k8s-guardian'
          }
        }
      });
    } else {
      throw error;
    }
  }
}

async function createResourceQuota(k8sClient, namespace, tenantId, quotas) {
  const quotaName = `${tenantId}-quota`;
  
  try {
    await k8sClient.core.createNamespacedResourceQuota(namespace, {
      metadata: {
        name: quotaName,
        labels: {
          tenant: tenantId,
          'managed-by': 'k8s-guardian'
        }
      },
      spec: {
        hard: {
          'requests.cpu': quotas.cpu,
          'requests.memory': quotas.memory,
          'limits.cpu': quotas.cpu,
          'limits.memory': quotas.memory,
          'pods': quotas.pods,
          'services': quotas.services,
          'persistentvolumeclaims': quotas.persistentVolumeClaims
        }
      }
    });
  } catch (error) {
    if (error.statusCode !== 409) {
      throw error;
    }
  }
}

async function createDefaultNetworkPolicy(k8sClient, namespace, tenantId) {
  const policyName = `${tenantId}-default-deny`;
  
  try {
    await k8sClient.networking.createNamespacedNetworkPolicy(namespace, {
      metadata: {
        name: policyName,
        labels: {
          tenant: tenantId,
          'managed-by': 'k8s-guardian'
        }
      },
      spec: {
        podSelector: {},
        policyTypes: ['Ingress', 'Egress']
      }
    });
  } catch (error) {
    if (error.statusCode !== 409) {
      throw error;
    }
  }
}

async function createTenantRBAC(k8sClient, namespace, tenantId, defaultRole) {
  const roleName = `${tenantId}-role`;
  const roleBindingName = `${tenantId}-binding`;
  
  try {
    await k8sClient.rbac.createNamespacedRole(namespace, {
      metadata: {
        name: roleName,
        labels: {
          tenant: tenantId,
          'managed-by': 'k8s-guardian'
        }
      },
      rules: [
        {
          apiGroups: [''],
          resources: ['pods', 'services', 'configmaps', 'secrets'],
          verbs: defaultRole === 'admin' ? ['*'] : ['get', 'list', 'watch']
        },
        {
          apiGroups: ['apps'],
          resources: ['deployments', 'replicasets'],
          verbs: defaultRole === 'admin' ? ['*'] : ['get', 'list', 'watch']
        }
      ]
    });

    await k8sClient.rbac.createNamespacedRoleBinding(namespace, {
      metadata: {
        name: roleBindingName,
        labels: {
          tenant: tenantId,
          'managed-by': 'k8s-guardian'
        }
      },
      subjects: [{
        kind: 'ServiceAccount',
        name: 'default',
        namespace: namespace
      }],
      roleRef: {
        kind: 'Role',
        name: roleName,
        apiGroup: 'rbac.authorization.k8s.io'
      }
    });
  } catch (error) {
    if (error.statusCode !== 409) {
      throw error;
    }
  }
}

async function deleteTenantResources(k8sClient, namespace, tenantId) {
  const quotaName = `${tenantId}-quota`;
  const policyName = `${tenantId}-default-deny`;
  const roleName = `${tenantId}-role`;
  const roleBindingName = `${tenantId}-binding`;

  try {
    await k8sClient.core.deleteNamespacedResourceQuota(quotaName, namespace);
  } catch (error) {
    if (error.statusCode !== 404) {
      console.error(`Failed to delete resource quota ${quotaName}:`, error.message);
    }
  }

  try {
    await k8sClient.networking.deleteNamespacedNetworkPolicy(policyName, namespace);
  } catch (error) {
    if (error.statusCode !== 404) {
      console.error(`Failed to delete network policy ${policyName}:`, error.message);
    }
  }

  try {
    await k8sClient.rbac.deleteNamespacedRoleBinding(roleBindingName, namespace);
  } catch (error) {
    if (error.statusCode !== 404) {
      console.error(`Failed to delete role binding ${roleBindingName}:`, error.message);
    }
  }

  try {
    await k8sClient.rbac.deleteNamespacedRole(roleName, namespace);
  } catch (error) {
    if (error.statusCode !== 404) {
      console.error(`Failed to delete role ${roleName}:`, error.message);
    }
  }
}

async function addTenantUser(tenantId, userData) {
  const tenant = getTenant(tenantId);
  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  const user = {
    id: generateUserId(),
    tenantId,
    username: userData.username,
    email: userData.email || '',
    role: userData.role || 'viewer',
    namespaces: userData.namespaces || tenant.namespaces,
    createdAt: new Date().toISOString()
  };

  tenantUsers.push(user);
  saveTenantUsers();
  
  return user;
}

async function updateTenantUser(userId, updates) {
  const index = tenantUsers.findIndex(u => u.id === userId);
  if (index === -1) {
    throw new Error(`User not found: ${userId}`);
  }

  tenantUsers[index] = {
    ...tenantUsers[index],
    ...updates,
    id: userId
  };

  saveTenantUsers();
  return tenantUsers[index];
}

async function deleteTenantUser(userId) {
  const index = tenantUsers.findIndex(u => u.id === userId);
  if (index === -1) {
    throw new Error(`User not found: ${userId}`);
  }

  const deleted = tenantUsers.splice(index, 1)[0];
  saveTenantUsers();
  return deleted;
}

function getTenantUsers(options = {}) {
  let users = [...tenantUsers];

  if (options.tenantId) {
    users = users.filter(u => u.tenantId === options.tenantId);
  }

  if (options.role) {
    users = users.filter(u => u.role === options.role);
  }

  if (options.username) {
    users = users.filter(u => u.username.includes(options.username));
  }

  return users;
}

function getTenantUser(userId) {
  return tenantUsers.find(u => u.id === userId);
}

function generateUserId() {
  return `user-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function getTenantUsage(tenantId) {
  const tenant = getTenant(tenantId);
  if (!tenant) {
    throw new Error(`Tenant not found: ${tenantId}`);
  }

  const k8sClient = await connectK8s();
  const usage = {
    tenantId,
    tenantName: tenant.name,
    namespaces: {},
    totals: {
      pods: 0,
      cpuRequests: 0,
      cpuLimits: 0,
      memoryRequests: 0,
      memoryLimits: 0,
      services: 0,
      persistentVolumeClaims: 0
    },
    quotas: tenant.resourceQuotas
  };

  for (const namespace of tenant.namespaces) {
    try {
      const pods = await k8sClient.core.listNamespacedPod(namespace);
      const services = await k8sClient.core.listNamespacedService(namespace);
      const pvcs = await k8sClient.core.listNamespacedPersistentVolumeClaim(namespace);

      let namespaceUsage = {
        pods: pods.body.items.length,
        cpuRequests: 0,
        cpuLimits: 0,
        memoryRequests: 0,
        memoryLimits: 0,
        services: services.body.items.length,
        persistentVolumeClaims: pvcs.body.items.length
      };

      pods.body.items.forEach(pod => {
        pod.spec.containers.forEach(container => {
          const requests = container.resources?.requests || {};
          const limits = container.resources?.limits || {};

          namespaceUsage.cpuRequests += parseResource(requests.cpu || '0');
          namespaceUsage.cpuLimits += parseResource(limits.cpu || '0');
          namespaceUsage.memoryRequests += parseMemory(requests.memory || '0');
          namespaceUsage.memoryLimits += parseMemory(limits.memory || '0');
        });
      });

      usage.namespaces[namespace] = namespaceUsage;

      usage.totals.pods += namespaceUsage.pods;
      usage.totals.cpuRequests += namespaceUsage.cpuRequests;
      usage.totals.cpuLimits += namespaceUsage.cpuLimits;
      usage.totals.memoryRequests += namespaceUsage.memoryRequests;
      usage.totals.memoryLimits += namespaceUsage.memoryLimits;
      usage.totals.services += namespaceUsage.services;
      usage.totals.persistentVolumeClaims += namespaceUsage.persistentVolumeClaims;
    } catch (error) {
      console.error(`Failed to get usage for namespace ${namespace}:`, error.message);
    }
  }

  return usage;
}

function parseResource(value) {
  if (typeof value !== 'string') return 0;
  if (value.endsWith('m')) {
    return parseFloat(value) / 1000;
  }
  return parseFloat(value) || 0;
}

function parseMemory(value) {
  if (typeof value !== 'string') return 0;
  
  const units = {
    'Ki': 1024,
    'Mi': 1024 * 1024,
    'Gi': 1024 * 1024 * 1024,
    'Ti': 1024 * 1024 * 1024 * 1024
  };

  for (const [unit, multiplier] of Object.entries(units)) {
    if (value.endsWith(unit)) {
      return parseFloat(value) * multiplier;
    }
  }

  return parseFloat(value) || 0;
}

function getTenantStatistics() {
  const stats = {
    totalTenants: tenants.length,
    totalUsers: tenantUsers.length,
    totalNamespaces: 0,
    usersByRole: {},
    tenantsByStatus: {}
  };

  tenants.forEach(tenant => {
    stats.totalNamespaces += tenant.namespaces.length;
  });

  tenantUsers.forEach(user => {
    stats.usersByRole[user.role] = (stats.usersByRole[user.role] || 0) + 1;
  });

  return stats;
}

loadTenants();
loadTenantUsers();

module.exports = {
  loadTenants,
  saveTenants,
  createTenant,
  updateTenant,
  deleteTenant,
  getTenants,
  getTenant,
  addTenantUser,
  updateTenantUser,
  deleteTenantUser,
  getTenantUsers,
  getTenantUser,
  getTenantUsage,
  getTenantStatistics,
  getDefaultTenants
};
