const { connectK8s } = require('./k8s');

// 获取Role列表
async function getRoles(k8sClient, namespace = 'default') {
  try {
    const response = await k8sClient.rbac.listNamespacedRole(namespace);
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get roles: ${error.message}`);
  }
}

// 获取ClusterRole列表
async function getClusterRoles(k8sClient) {
  try {
    const response = await k8sClient.rbac.listClusterRole();
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get cluster roles: ${error.message}`);
  }
}

// 获取RoleBinding列表
async function getRoleBindings(k8sClient, namespace = 'default') {
  try {
    const response = await k8sClient.rbac.listNamespacedRoleBinding(namespace);
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get role bindings: ${error.message}`);
  }
}

// 获取ClusterRoleBinding列表
async function getClusterRoleBindings(k8sClient) {
  try {
    const response = await k8sClient.rbac.listClusterRoleBinding();
    return response.body.items;
  } catch (error) {
    throw new Error(`Failed to get cluster role bindings: ${error.message}`);
  }
}

// 分析RBAC配置
function analyzeRBAC(roles, clusterRoles, roleBindings, clusterRoleBindings) {
  try {
    const analysis = {
      totalRoles: roles.length,
      totalClusterRoles: clusterRoles.length,
      totalRoleBindings: roleBindings.length,
      totalClusterRoleBindings: clusterRoleBindings.length,
      rolesByNamespace: {},
      clusterRolesByPrefix: {},
      bindingsBySubject: {},
      bindingsByRole: {}
    };

    // 分析Role
    roles.forEach(role => {
      const namespace = role.metadata.namespace || 'default';
      if (!analysis.rolesByNamespace[namespace]) {
        analysis.rolesByNamespace[namespace] = [];
      }
      analysis.rolesByNamespace[namespace].push(role.metadata.name);
    });

    // 分析ClusterRole
    clusterRoles.forEach(clusterRole => {
      const prefix = clusterRole.metadata.name.split('-')[0];
      if (!analysis.clusterRolesByPrefix[prefix]) {
        analysis.clusterRolesByPrefix[prefix] = [];
      }
      analysis.clusterRolesByPrefix[prefix].push(clusterRole.metadata.name);
    });

    // 分析RoleBinding
    roleBindings.forEach(binding => {
      const namespace = binding.metadata.namespace || 'default';
      binding.subjects.forEach(subject => {
        const subjectKey = `${subject.kind}:${subject.name}`;
        if (!analysis.bindingsBySubject[subjectKey]) {
          analysis.bindingsBySubject[subjectKey] = [];
        }
        analysis.bindingsBySubject[subjectKey].push({
          type: 'RoleBinding',
          name: binding.metadata.name,
          namespace,
          role: binding.roleRef.name,
          roleKind: binding.roleRef.kind
        });
      });

      const roleKey = `${binding.roleRef.kind}:${binding.roleRef.name}`;
      if (!analysis.bindingsByRole[roleKey]) {
        analysis.bindingsByRole[roleKey] = [];
      }
      analysis.bindingsByRole[roleKey].push({
        type: 'RoleBinding',
        name: binding.metadata.name,
        namespace,
        subjects: binding.subjects.map(s => `${s.kind}:${s.name}`)
      });
    });

    // 分析ClusterRoleBinding
    clusterRoleBindings.forEach(binding => {
      binding.subjects.forEach(subject => {
        const subjectKey = `${subject.kind}:${subject.name}`;
        if (!analysis.bindingsBySubject[subjectKey]) {
          analysis.bindingsBySubject[subjectKey] = [];
        }
        analysis.bindingsBySubject[subjectKey].push({
          type: 'ClusterRoleBinding',
          name: binding.metadata.name,
          role: binding.roleRef.name,
          roleKind: binding.roleRef.kind
        });
      });

      const roleKey = `${binding.roleRef.kind}:${binding.roleRef.name}`;
      if (!analysis.bindingsByRole[roleKey]) {
        analysis.bindingsByRole[roleKey] = [];
      }
      analysis.bindingsByRole[roleKey].push({
        type: 'ClusterRoleBinding',
        name: binding.metadata.name,
        subjects: binding.subjects.map(s => `${s.kind}:${s.name}`)
      });
    });

    return analysis;
  } catch (error) {
    throw new Error(`Failed to analyze RBAC: ${error.message}`);
  }
}

// 获取权限详情
async function getRoleDetails(k8sClient, roleName, namespace = 'default') {
  try {
    const response = await k8sClient.rbac.readNamespacedRole(roleName, namespace);
    return response.body;
  } catch (error) {
    throw new Error(`Failed to get role details: ${error.message}`);
  }
}

// 获取ClusterRole详情
async function getClusterRoleDetails(k8sClient, clusterRoleName) {
  try {
    const response = await k8sClient.rbac.readClusterRole(clusterRoleName);
    return response.body;
  } catch (error) {
    throw new Error(`Failed to get cluster role details: ${error.message}`);
  }
}

// 获取RoleBinding详情
async function getRoleBindingDetails(k8sClient, roleBindingName, namespace = 'default') {
  try {
    const response = await k8sClient.rbac.readNamespacedRoleBinding(roleBindingName, namespace);
    return response.body;
  } catch (error) {
    throw new Error(`Failed to get role binding details: ${error.message}`);
  }
}

// 获取ClusterRoleBinding详情
async function getClusterRoleBindingDetails(k8sClient, clusterRoleBindingName) {
  try {
    const response = await k8sClient.rbac.readClusterRoleBinding(clusterRoleBindingName);
    return response.body;
  } catch (error) {
    throw new Error(`Failed to get cluster role binding details: ${error.message}`);
  }
}

module.exports = {
  getRoles,
  getClusterRoles,
  getRoleBindings,
  getClusterRoleBindings,
  analyzeRBAC,
  getRoleDetails,
  getClusterRoleDetails,
  getRoleBindingDetails,
  getClusterRoleBindingDetails
};