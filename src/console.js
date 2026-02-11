const blessed = require('blessed');
const contrib = require('blessed-contrib');
const chalk = require('chalk');
const { connectK8s } = require('./k8s');
const { handleAIChat } = require('./ai');
const { handleCommand } = require('./commands');

// 启动交互式控制台
function startConsole(options) {
  // 创建屏幕
  const screen = blessed.screen({
    smartCSR: true,
    title: 'k8s-guardian Console'
  });

  // 创建布局
  const grid = new contrib.grid({ rows: 12, cols: 12, screen: screen });

  // 创建集群信息面板
  const clusterInfo = grid.set(0, 0, 3, 6, blessed.box({
    label: 'Cluster Information',
    border: { type: 'line' },
    style: { border: { fg: 'cyan' } }
  }));

  // 创建资源使用面板
  const resourceUsage = grid.set(0, 6, 3, 6, blessed.box({
    label: 'Resource Usage',
    border: { type: 'line' },
    style: { border: { fg: 'green' } }
  }));

  // 创建Pod列表面板
  const podList = grid.set(3, 0, 6, 12, blessed.list({
    label: 'Pods',
    border: { type: 'line' },
    style: { border: { fg: 'yellow' } },
    tags: true,
    vi: true
  }));

  // 创建命令输入面板
  const commandInput = grid.set(9, 0, 3, 11, blessed.textbox({
    label: 'Command Input',
    border: { type: 'line' },
    style: { border: { fg: 'magenta' } },
    inputOnFocus: true
  }));

  // 创建AI助手按钮
  const aiButton = grid.set(9, 11, 3, 1, blessed.button({
    label: 'AI',
    border: { type: 'line' },
    style: {
      border: { fg: 'blue' },
      bg: 'blue',
      fg: 'white',
      hover: { bg: 'cyan' }
    }
  }));

  // 初始化k8s连接
  async function initK8s() {
    try {
      const k8sClient = await connectK8s();
      
      // 获取集群信息
      const clusterInfoData = await k8sClient.core.listNode();
      clusterInfo.setContent(`Nodes: ${clusterInfoData.body.items.length}\n`);
      
      // 获取Pod列表
      const podsData = await k8sClient.core.listPodForAllNamespaces();
      const podItems = podsData.body.items.map(pod => {
        return `{cyan-fg}${pod.metadata.name}{/} - {green-fg}${pod.status.phase}{/}`;
      });
      podList.setItems(podItems);
      
      screen.render();
    } catch (error) {
      clusterInfo.setContent(`Error: ${error.message}`);
      screen.render();
    }
  }

  // 处理命令输入
  commandInput.key('enter', async function() {
    const command = this.getValue();
    this.clearValue();
    
    // 处理命令
    if (command.startsWith('ai ')) {
      const aiQuery = command.substring(3);
      const response = await handleAIChat(aiQuery);
      podList.addItem(`{magenta-fg}AI: ${response}{/}`);
    } else if (command === 'clear') {
      podList.setItems([]);
    } else {
      // 处理k8s命令
      podList.addItem(`{blue-fg}> ${command}{/}`);
      try {
        const k8sClient = await connectK8s();
        const result = await handleCommand(command, k8sClient);
        podList.addItem(`{green-fg}${result}{/}`);
      } catch (error) {
        podList.addItem(`{red-fg}Error: ${error.message}{/}`);
      }
    }
    
    screen.render();
  });

  // 处理AI按钮点击
  aiButton.on('press', function() {
    podList.addItem(`{magenta-fg}AI Assistant activated. Type 'ai <question>' to chat.{/}`);
    screen.render();
  });

  // 退出处理
  screen.key(['q', 'C-c'], function() {
    return process.exit(0);
  });

  // 初始化
  initK8s();
  screen.render();
}

module.exports = {
  startConsole
};