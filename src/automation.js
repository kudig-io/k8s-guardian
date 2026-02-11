const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const cron = require('node-cron');

let automationScripts = [];
let scriptHistory = [];
let scheduledTasks = new Map();

const SCRIPTS_FILE = path.join(__dirname, '../config/automation-scripts.json');
const SCRIPT_HISTORY_FILE = path.join(__dirname, '../data/script-history.json');

function loadAutomationScripts() {
  try {
    if (fs.existsSync(SCRIPTS_FILE)) {
      const data = fs.readFileSync(SCRIPTS_FILE, 'utf8');
      automationScripts = JSON.parse(data);
    } else {
      automationScripts = getDefaultAutomationScripts();
      saveAutomationScripts();
    }
    return automationScripts;
  } catch (error) {
    console.error('Failed to load automation scripts:', error.message);
    automationScripts = getDefaultAutomationScripts();
    return automationScripts;
  }
}

function saveAutomationScripts() {
  try {
    const dir = path.dirname(SCRIPTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SCRIPTS_FILE, JSON.stringify(automationScripts, null, 2));
  } catch (error) {
    console.error('Failed to save automation scripts:', error.message);
  }
}

function loadScriptHistory() {
  try {
    if (fs.existsSync(SCRIPT_HISTORY_FILE)) {
      const data = fs.readFileSync(SCRIPT_HISTORY_FILE, 'utf8');
      scriptHistory = JSON.parse(data);
    }
    return scriptHistory;
  } catch (error) {
    console.error('Failed to load script history:', error.message);
    scriptHistory = [];
    return scriptHistory;
  }
}

function saveScriptHistory() {
  try {
    const dir = path.dirname(SCRIPT_HISTORY_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(SCRIPT_HISTORY_FILE, JSON.stringify(scriptHistory, null, 2));
  } catch (error) {
    console.error('Failed to save script history:', error.message);
  }
}

function getDefaultAutomationScripts() {
  return [
    {
      id: 'cleanup-evicted-pods',
      name: '清理已驱逐的 Pod',
      description: '自动清理所有处于 Evicted 状态的 Pod',
      enabled: true,
      type: 'builtin',
      script: 'cleanup-evicted-pods',
      schedule: '0 */6 * * *',
      timeout: 300,
      parameters: {
        dryRun: false,
        namespaces: []
      }
    },
    {
      id: 'restart-crashing-pods',
      name: '重启崩溃的 Pod',
      description: '自动重启崩溃循环的 Pod',
      enabled: false,
      type: 'builtin',
      script: 'restart-crashing-pods',
      schedule: '*/5 * * * *',
      timeout: 300,
      parameters: {
        restartThreshold: 5,
        namespaces: []
      }
    },
    {
      id: 'scale-deployment',
      name: '扩展 Deployment',
      description: '根据 CPU/内存使用率自动扩展 Deployment',
      enabled: false,
      type: 'builtin',
      script: 'scale-deployment',
      schedule: '*/2 * * * *',
      timeout: 300,
      parameters: {
        cpuThreshold: 80,
        memoryThreshold: 85,
        maxReplicas: 10,
        namespaces: []
      }
    },
    {
      id: 'cleanup-old-images',
      name: '清理旧镜像',
      description: '清理节点上的旧 Docker 镜像',
      enabled: false,
      type: 'builtin',
      script: 'cleanup-old-images',
      schedule: '0 2 * * *',
      timeout: 600,
      parameters: {
        keepDays: 7,
        nodes: []
      }
    },
    {
      id: 'backup-configmaps',
      name: '备份 ConfigMaps',
      description: '定期备份所有 ConfigMaps',
      enabled: false,
      type: 'builtin',
      script: 'backup-configmaps',
      schedule: '0 3 * * *',
      timeout: 300,
      parameters: {
        backupPath: '/tmp/k8s-backup/configmaps',
        namespaces: []
      }
    },
    {
      id: 'check-node-health',
      name: '检查节点健康',
      description: '定期检查节点健康状态并报告',
      enabled: true,
      type: 'builtin',
      script: 'check-node-health',
      schedule: '*/10 * * * *',
      timeout: 300,
      parameters: {
        alertOnNotReady: true,
        alertOnPressure: true
      }
    },
    {
      id: 'rotate-logs',
      name: '日志轮转',
      description: '轮转和清理旧的日志文件',
      enabled: false,
      type: 'builtin',
      script: 'rotate-logs',
      schedule: '0 4 * * *',
      timeout: 600,
      parameters: {
        retentionDays: 30,
        namespaces: []
      }
    },
    {
      id: 'update-image-tags',
      name: '更新镜像标签',
      description: '批量更新 Deployment 中的镜像标签',
      enabled: false,
      type: 'builtin',
      script: 'update-image-tags',
      schedule: '',
      timeout: 300,
      parameters: {
        deployments: [],
        newTag: 'latest'
      }
    }
  ];
}

function addAutomationScript(script) {
  const newScript = {
    id: script.id || generateScriptId(),
    name: script.name,
    description: script.description || '',
    enabled: script.enabled !== false,
    type: script.type || 'custom',
    script: script.script,
    schedule: script.schedule || '',
    timeout: script.timeout || 300,
    parameters: script.parameters || {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  automationScripts.push(newScript);
  saveAutomationScripts();

  if (newScript.enabled && newScript.schedule) {
    scheduleScript(newScript);
  }

  return newScript;
}

function updateAutomationScript(scriptId, updates) {
  const index = automationScripts.findIndex(s => s.id === scriptId);
  if (index === -1) {
    throw new Error(`Automation script not found: ${scriptId}`);
  }

  const oldScript = automationScripts[index];
  automationScripts[index] = {
    ...automationScripts[index],
    ...updates,
    id: scriptId,
    updatedAt: new Date().toISOString()
  };

  saveAutomationScripts();

  if (oldScript.schedule) {
    unscheduleScript(scriptId);
  }

  if (automationScripts[index].enabled && automationScripts[index].schedule) {
    scheduleScript(automationScripts[index]);
  }

  return automationScripts[index];
}

function deleteAutomationScript(scriptId) {
  const index = automationScripts.findIndex(s => s.id === scriptId);
  if (index === -1) {
    throw new Error(`Automation script not found: ${scriptId}`);
  }

  const deleted = automationScripts.splice(index, 1)[0];
  saveAutomationScripts();
  unscheduleScript(scriptId);
  return deleted;
}

function getAutomationScripts(options = {}) {
  let scripts = [...automationScripts];

  if (options.enabled !== undefined) {
    scripts = scripts.filter(s => s.enabled === options.enabled);
  }

  if (options.type) {
    scripts = scripts.filter(s => s.type === options.type);
  }

  return scripts;
}

function getAutomationScript(scriptId) {
  return automationScripts.find(s => s.id === scriptId);
}

function generateScriptId() {
  return `script-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

function scheduleScript(script) {
  if (scheduledTasks.has(script.id)) {
    return;
  }

  const task = cron.schedule(script.schedule, async () => {
    await executeScript(script.id, 'scheduled');
  }, {
    scheduled: false
  });

  scheduledTasks.set(script.id, task);
  task.start();
}

function unscheduleScript(scriptId) {
  const task = scheduledTasks.get(scriptId);
  if (task) {
    task.stop();
    task.destroy();
    scheduledTasks.delete(scriptId);
  }
}

async function executeScript(scriptId, trigger = 'manual', parameters = {}) {
  const script = getAutomationScript(scriptId);
  if (!script) {
    throw new Error(`Script not found: ${scriptId}`);
  }

  const executionId = generateExecutionId();
  const startTime = new Date();
  
  const execution = {
    id: executionId,
    scriptId,
    scriptName: script.name,
    trigger,
    parameters: { ...script.parameters, ...parameters },
    status: 'running',
    output: '',
    error: null,
    startTime: startTime.toISOString(),
    endTime: null,
    duration: null
  };

  try {
    let result;
    
    if (script.type === 'builtin') {
      result = await executeBuiltinScript(script, execution);
    } else if (script.type === 'custom') {
      result = await executeCustomScript(script, execution);
    } else {
      throw new Error(`Unknown script type: ${script.type}`);
    }

    execution.status = 'success';
    execution.output = result.output || '';
  } catch (error) {
    execution.status = 'failed';
    execution.error = error.message;
    execution.output = error.stack || '';
  }

  const endTime = new Date();
  execution.endTime = endTime.toISOString();
  execution.duration = Math.floor((endTime - startTime) / 1000);

  scriptHistory.unshift(execution);
  
  if (scriptHistory.length > 1000) {
    scriptHistory = scriptHistory.slice(0, 1000);
  }
  
  saveScriptHistory();

  return execution;
}

function generateExecutionId() {
  return `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

async function executeBuiltinScript(script, execution) {
  const { connectK8s } = require('./k8s');
  const k8sClient = await connectK8s();

  switch (script.script) {
    case 'cleanup-evicted-pods':
      return await cleanupEvictedPods(k8sClient, script.parameters);
    case 'restart-crashing-pods':
      return await restartCrashingPods(k8sClient, script.parameters);
    case 'scale-deployment':
      return await scaleDeployment(k8sClient, script.parameters);
    case 'cleanup-old-images':
      return await cleanupOldImages(script.parameters);
    case 'backup-configmaps':
      return await backupConfigMaps(k8sClient, script.parameters);
    case 'check-node-health':
      return await checkNodeHealth(k8sClient, script.parameters);
    case 'rotate-logs':
      return await rotateLogs(k8sClient, script.parameters);
    case 'update-image-tags':
      return await updateImageTags(k8sClient, script.parameters);
    default:
      throw new Error(`Unknown builtin script: ${script.script}`);
  }
}

async function executeCustomScript(script, execution) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Script execution timeout after ${script.timeout} seconds`));
    }, script.timeout * 1000);

    const child = spawn('bash', ['-c', script.script], {
      env: { ...process.env, ...execution.parameters }
    });

    let output = '';
    let error = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      error += data.toString();
    });

    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code === 0) {
        resolve({ output: output || error });
      } else {
        reject(new Error(`Script exited with code ${code}: ${error}`));
      }
    });

    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

async function cleanupEvictedPods(k8sClient, parameters) {
  const { getAllPods } = require('./k8s');
  const pods = await getAllPods(k8sClient);
  
  const evictedPods = pods.filter(pod => 
    pod.status.phase === 'Failed' && 
    pod.status.reason === 'Evicted'
  );

  if (parameters.dryRun) {
    return { 
      output: `Dry run: Would delete ${evictedPods.length} evicted pods`,
      pods: evictedPods.map(p => p.metadata.name)
    };
  }

  const deleted = [];
  for (const pod of evictedPods) {
    try {
      await k8sClient.core.deleteNamespacedPod(
        pod.metadata.name,
        pod.metadata.namespace
      );
      deleted.push(pod.metadata.name);
    } catch (error) {
      console.error(`Failed to delete pod ${pod.metadata.name}:`, error.message);
    }
  }

  return { 
    output: `Successfully deleted ${deleted.length} evicted pods`,
    deleted
  };
}

async function restartCrashingPods(k8sClient, parameters) {
  const { getAllPods } = require('./k8s');
  const pods = await getAllPods(k8sClient);
  
  const crashingPods = pods.filter(pod => {
    const restartCount = pod.status.containerStatuses?.reduce((sum, c) => sum + (c.restartCount || 0), 0) || 0;
    return restartCount >= parameters.restartThreshold;
  });

  const restarted = [];
  for (const pod of crashingPods) {
    try {
      await k8sClient.core.deleteNamespacedPod(
        pod.metadata.name,
        pod.metadata.namespace
      );
      restarted.push(pod.metadata.name);
    } catch (error) {
      console.error(`Failed to restart pod ${pod.metadata.name}:`, error.message);
    }
  }

  return { 
    output: `Successfully restarted ${restarted.length} crashing pods`,
    restarted
  };
}

async function scaleDeployment(k8sClient, parameters) {
  const { getDeployments } = require('./k8s');
  const deployments = await getDeployments(k8sClient, 'default');
  
  const scaled = [];
  for (const deployment of deployments) {
    const currentReplicas = deployment.spec.replicas || 1;
    
    if (currentReplicas >= parameters.maxReplicas) {
      continue;
    }

    const newReplicas = currentReplicas + 1;
    
    try {
      await k8sClient.apps.patchNamespacedDeployment(
        deployment.metadata.name,
        deployment.metadata.namespace,
        { spec: { replicas: newReplicas } },
        undefined,
        undefined,
        undefined,
        undefined,
        { 'content-type': 'application/merge-patch+json' }
      );
      scaled.push({
        name: deployment.metadata.name,
        namespace: deployment.metadata.namespace,
        oldReplicas: currentReplicas,
        newReplicas
      });
    } catch (error) {
      console.error(`Failed to scale deployment ${deployment.metadata.name}:`, error.message);
    }
  }

  return { 
    output: `Successfully scaled ${scaled.length} deployments`,
    scaled
  };
}

async function cleanupOldImages(parameters) {
  return { 
    output: `Cleanup old images (keep ${parameters.keepDays} days) - requires node access`,
    note: 'This script requires SSH access to nodes'
  };
}

async function backupConfigMaps(k8sClient, parameters) {
  const { getConfigMaps } = require('./k8s');
  const configmaps = await getConfigMaps(k8sClient, 'default');
  
  const backupDir = parameters.backupPath;
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const backedUp = [];
  for (const cm of configmaps) {
    const backupFile = path.join(backupDir, `${cm.metadata.name}.json`);
    fs.writeFileSync(backupFile, JSON.stringify(cm, null, 2));
    backedUp.push(cm.metadata.name);
  }

  return { 
    output: `Successfully backed up ${backedUp.length} ConfigMaps to ${backupDir}`,
    backedUp,
    backupPath: backupDir
  };
}

async function checkNodeHealth(k8sClient, parameters) {
  const { getNodes } = require('./k8s');
  const nodes = await getNodes(k8sClient);
  
  const issues = [];
  for (const node of nodes) {
    const readyCondition = node.status.conditions?.find(c => c.type === 'Ready');
    
    if (readyCondition?.status !== 'True' && parameters.alertOnNotReady) {
      issues.push({
        node: node.metadata.name,
        issue: 'Node not ready',
        condition: readyCondition
      });
    }

    const pressureConditions = node.status.conditions?.filter(c => 
      c.type.includes('Pressure') && c.status === 'True'
    );

    if (pressureConditions.length > 0 && parameters.alertOnPressure) {
      issues.push({
        node: node.metadata.name,
        issue: 'Node under pressure',
        conditions: pressureConditions
      });
    }
  }

  return { 
    output: `Node health check complete. Found ${issues.length} issues`,
    issues,
    healthyNodes: nodes.length - issues.length
  };
}

async function rotateLogs(k8sClient, parameters) {
  return { 
    output: `Log rotation (retention: ${parameters.retentionDays} days) - requires log access`,
    note: 'This script requires access to log storage'
  };
}

async function updateImageTags(k8sClient, parameters) {
  const { getDeployments } = require('./k8s');
  const deployments = await getDeployments(k8sClient, 'default');
  
  const updated = [];
  for (const deployment of deployments) {
    const containers = deployment.spec.template.spec.containers;
    let changed = false;

    for (const container of containers) {
      if (container.image && container.image.includes(':')) {
        const [image, tag] = container.image.split(':');
        container.image = `${image}:${parameters.newTag}`;
        changed = true;
      }
    }

    if (changed) {
      try {
        await k8sClient.apps.patchNamespacedDeployment(
          deployment.metadata.name,
          deployment.metadata.namespace,
          { spec: { template: { spec: { containers } } } },
          undefined,
          undefined,
          undefined,
          undefined,
          { 'content-type': 'application/merge-patch+json' }
        );
        updated.push(deployment.metadata.name);
      } catch (error) {
        console.error(`Failed to update deployment ${deployment.metadata.name}:`, error.message);
      }
    }
  }

  return { 
    output: `Successfully updated image tags for ${updated.length} deployments`,
    updated,
    newTag: parameters.newTag
  };
}

function getScriptHistory(options = {}) {
  let history = [...scriptHistory];

  if (options.scriptId) {
    history = history.filter(h => h.scriptId === options.scriptId);
  }

  if (options.status) {
    history = history.filter(h => h.status === options.status);
  }

  if (options.limit) {
    history = history.slice(0, options.limit);
  }

  return history;
}

function getScriptExecution(executionId) {
  return scriptHistory.find(h => h.id === executionId);
}

function getScriptStatistics() {
  const stats = {
    totalScripts: automationScripts.length,
    enabledScripts: automationScripts.filter(s => s.enabled).length,
    scheduledTasks: scheduledTasks.size,
    totalExecutions: scriptHistory.length,
    successfulExecutions: scriptHistory.filter(h => h.status === 'success').length,
    failedExecutions: scriptHistory.filter(h => h.status === 'failed').length,
    runningExecutions: scriptHistory.filter(h => h.status === 'running').length,
    byScript: {},
    recent24h: 0
  };

  const now = Date.now();
  const dayAgo = now - (24 * 60 * 60 * 1000);

  scriptHistory.forEach(exec => {
    if (!stats.byScript[exec.scriptId]) {
      stats.byScript[exec.scriptId] = {
        name: exec.scriptName,
        total: 0,
        success: 0,
        failed: 0
      };
    }

    stats.byScript[exec.scriptId].total++;
    if (exec.status === 'success') {
      stats.byScript[exec.scriptId].success++;
    } else if (exec.status === 'failed') {
      stats.byScript[exec.scriptId].failed++;
    }

    if (new Date(exec.startTime).getTime() > dayAgo) {
      stats.recent24h++;
    }
  });

  return stats;
}

function startAllScheduledTasks() {
  automationScripts.forEach(script => {
    if (script.enabled && script.schedule) {
      scheduleScript(script);
    }
  });
}

function stopAllScheduledTasks() {
  scheduledTasks.forEach((task, scriptId) => {
    task.stop();
    task.destroy();
  });
  scheduledTasks.clear();
}

loadAutomationScripts();
loadScriptHistory();

module.exports = {
  loadAutomationScripts,
  saveAutomationScripts,
  addAutomationScript,
  updateAutomationScript,
  deleteAutomationScript,
  getAutomationScripts,
  getAutomationScript,
  executeScript,
  getScriptHistory,
  getScriptExecution,
  getScriptStatistics,
  startAllScheduledTasks,
  stopAllScheduledTasks,
  getDefaultAutomationScripts
};
