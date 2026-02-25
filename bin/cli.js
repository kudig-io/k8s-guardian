#!/usr/bin/env node

const { program } = require('commander');
const figlet = require('figlet');
const chalk = require('chalk');
const path = require('path');

// 显示欢迎信息
console.log(chalk.green(figlet.textSync('k8s-guardian', { horizontalLayout: 'full' })));
console.log(chalk.blue('A high-quality Kubernetes运维 tool with CLI visualization and AI capabilities\n'));

// 命令行配置
program
  .version('1.1.0')
  .description('Kubernetes运维工具')
  .option('-s, --start', '启动交互式控制台')
  .option('-w, --web [port]', '启动 Web UI 服务器')
  .option('-c, --cluster <name>', '指定集群名称')
  .option('-n, --namespace <name>', '指定命名空间');

// 解析命令行参数
program.parse(process.argv);
const options = program.opts();

// 启动 Web UI 服务器
if (options.web) {
  const port = typeof options.web === 'string' ? parseInt(options.web) : 3000;
  const { startWebServer } = require('../src/web-server');
  startWebServer(port);
} else if (options.start) {
  const { startConsole } = require('../src/console');
  startConsole(options);
} else {
  program.help();
}