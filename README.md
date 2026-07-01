# k8s-guardian (已归并至 klaw)

> ⚠️ **本仓库为遗留代码 (Legacy)，所有功能已迁移至 [klaw](../klaw)。**
>
> 以下 13 个模块已用 Go 重写，JavaScript 实现已替换为弃用桩：
>
> | JS 模块 | klaw 目标 |
> |---------|-----------|
> | `logs.js` | `internal/loganalysis` |
> | `rbac.js` | `internal/rbacanalysis` |
> | `alerts.js` | `internal/alerting` |
> | `backup.js` | `internal/backup` |
> | `multitenancy.js` | `internal/tenancy` |
> | `audit.js` | `internal/audit` |
> | `network.js` | `internal/networkanalysis` |
> | `storage.js` | `internal/storageanalysis` |
> | `events.js` | `internal/events` |
> | `health.js` | `internal/monitoring` |
> | `resource.js` | `internal/kubernetes` |
> | `ai.js` | `internal/diag/ai` |
> | `automation.js` | `internal/automation` |
>
> 新功能开发与问题修复请前往 klaw 仓库。

一个高质量的开源 Kubernetes 运维工具，提供命令行可视化界面和 AI 智能辅助功能。

## 项目简介

k8s-guardian 是一款专为 Kubernetes 集群运维设计的现代化命令行工具，通过直观的可视化界面和智能 AI 助手，帮助运维人员高效管理和监控 Kubernetes 集群。该工具集成了丰富的运维功能，包括集群监控、资源管理、日志分析、事件告警、备份恢复等，为 Kubernetes 运维提供一站式解决方案。

## 核心特性

### 🖥️ 可视化交互界面
- **终端可视化控制台**：基于 blessed 库构建的现代化终端 UI，提供类似浏览器控制台的交互体验
- **实时数据展示**：实时显示集群状态、资源使用情况和 Pod 信息
- **多面板布局**：集群信息、资源使用、Pod 列表等关键信息一目了然

### 🔗 Kubernetes 集群管理
- **多集群支持**：支持管理和切换多个 Kubernetes 集群
- **标准 kubeconfig**：兼容标准 kubeconfig 配置文件
- **全面的资源管理**：支持 Pod、Deployment、Service、ConfigMap、Secret、Ingress 等核心资源

### 🤖 AI 智能运维助手
- **多轮对话**：支持与 AI 助手进行多轮对话，获取专业的运维建议
- **智能诊断**：AI 助手能够分析集群问题并提供解决方案
- **操作指导**：提供详细的 Kubernetes 操作指导和最佳实践建议

### 📊 监控与分析
- **集群健康检查**：全面检查节点和 Pod 的健康状态
- **资源使用分析**：实时监控 CPU 和内存使用情况
- **日志分析**：自动分析 Pod 日志，识别错误和警告
- **事件监控**：实时监控集群事件，自动生成告警

### 🛡️ 安全与权限
- **RBAC 分析**：全面分析 Role、ClusterRole、RoleBinding、ClusterRoleBinding 配置
- **权限审计**：提供详细的权限分配和使用情况分析

### 💾 备份与恢复
- **集群备份**：支持备份集群配置和资源
- **一键恢复**：快速恢复集群到备份状态
- **备份管理**：查看和管理历史备份

### 🌐 网络与存储
- **网络策略分析**：分析 NetworkPolicy 和 Ingress 配置
- **存储管理**：管理 PersistentVolume、PersistentVolumeClaim 和 StorageClass
- **资源配额**：查看和管理 ResourceQuota 和 LimitRange

## 系统要求

- **Node.js**: >= 14.0.0
- **npm**: >= 6.0.0
- **Kubernetes**: >= 1.18.0
- **kubeconfig**: 已配置的 Kubernetes 集群访问配置

## 安装指南

### 方式一：从源码安装

```bash
# 克隆仓库
git clone https://github.com/kudig-io/k8s-guardian.git

# 进入项目目录
cd k8s-guardian

# 安装依赖
npm install

# 设置 CLI 工具可执行权限
chmod +x bin/cli.js
```

### 方式二：全局安装（推荐）

```bash
# 克隆仓库
git clone https://github.com/kudig-io/k8s-guardian.git

# 进入项目目录
cd k8s-guardian

# 安装依赖
npm install

# 全局安装
npm link
```

安装完成后，可以直接使用 `k8s-guardian` 命令。

## 快速开始

### 启动交互式控制台

```bash
# 使用 npm start 启动
npm start -- --start

# 或直接使用 CLI 工具
./bin/cli.js --start

# 如果已全局安装
k8s-guardian --start
```

### 启动 Web UI

k8s-guardian 提供了功能丰富的 Web UI 界面，支持通过浏览器访问和管理 Kubernetes 集群。

```bash
# 启动 Web UI 服务器
npm start -- --web

# 或直接使用 CLI 工具
./bin/cli.js --web

# 如果已全局安装
k8s-guardian --web
```

启动后，Web UI 将在 `http://localhost:8080` 运行。在浏览器中打开该地址即可访问。

**Web UI 功能特性：**

- **仪表盘**：实时显示集群状态、资源使用情况和关键指标
- **资源管理**：可视化管理 Pods、Deployments、Services 等资源
- **日志分析**：查看和分析 Pod 日志，支持智能分析功能
- **性能监控**：实时监控 CPU、内存、网络等性能指标
- **告警管理**：创建和管理自定义告警规则
- **自动化脚本**：配置和执行自动化运维脚本
- **多租户管理**：管理租户、用户和资源配额
- **安全审计**：查看审计日志、安全事件和合规报告

**端口配置：**

如需使用自定义端口，可以通过环境变量配置：

```bash
export WEB_UI_PORT=3000
npm start -- --web
```

### 基本使用

启动后，您将看到一个交互式控制台界面，包含以下面板：

- **Cluster Information**: 显示集群节点信息
- **Resource Usage**: 显示集群资源使用情况
- **Pods**: 显示 Pod 列表和状态
- **Command Input**: 命令输入框
- **AI**: AI 助手按钮

### 命令列表

#### 基础资源管理
- `nodes` - 列出所有节点
- `pods [namespace]` - 列出指定命名空间的 Pod（不指定则列出所有命名空间）
- `deployments [namespace]` - 列出指定命名空间的 Deployment
- `services [namespace]` - 列出指定命名空间的 Service
- `configmaps [namespace]` - 列出指定命名空间的 ConfigMap
- `secrets [namespace]` - 列出指定命名空间的 Secret
- `ingresses [namespace]` - 列出指定命名空间的 Ingress
- `namespaces` - 列出所有命名空间

#### 工作负载管理
- `daemonsets [namespace]` - 列出 DaemonSet
- `statefulsets [namespace]` - 列出 StatefulSet
- `jobs [namespace]` - 列出 Job
- `cronjobs [namespace]` - 列出 CronJob

#### 集群监控
- `cluster-health` - 检查集群健康状态
- `resource-usage` - 查看集群资源使用情况
- `events [namespace]` - 查看集群事件
- `analyze-events [namespace]` - 分析集群事件并生成告警

#### 日志管理
- `logs <pod-name> [namespace] [container] [tail-lines]` - 查看 Pod 日志
- `analyze-logs <pod-name> [namespace] [container]` - 分析 Pod 日志

#### 资源配额与限制
- `resource-quotas [namespace]` - 查看资源配额
- `limit-ranges [namespace]` - 查看限制范围
- `node-affinity [namespace]` - 查看节点亲和性配置
- `analyze-resources [namespace]` - 分析资源使用情况

#### 集群管理
- `clusters` - 列出所有集群
- `current-cluster` - 显示当前集群
- `switch-cluster <cluster-name>` - 切换集群

#### RBAC 管理
- `roles [namespace]` - 列出 Role
- `cluster-roles` - 列出 ClusterRole
- `role-bindings [namespace]` - 列出 RoleBinding
- `cluster-role-bindings` - 列出 ClusterRoleBinding
- `analyze-rbac` - 分析 RBAC 配置

#### 备份与恢复
- `backup <backup-name>` - 备份集群配置
- `restore <backup-file>` - 恢复集群配置
- `list-backups` - 列出所有备份
- `delete-backup <backup-file>` - 删除备份

#### 网络管理
- `network-policies [namespace]` - 列出 NetworkPolicy
- `ingress-classes` - 列出 IngressClass
- `network-analysis [namespace]` - 分析网络配置
- `network-traffic` - 查看网络流量分析

#### 存储管理
- `persistent-volumes` - 列出 PersistentVolume
- `persistent-volume-claims [namespace]` - 列出 PersistentVolumeClaim
- `storage-classes` - 列出 StorageClass
- `storage-analysis [namespace]` - 分析存储使用情况

#### 其他
- `serviceaccounts [namespace]` - 列出 ServiceAccount
- `crds` - 列出 CustomResourceDefinition
- `help` - 显示帮助信息
- `clear` - 清空控制台

#### AI 助手
- `ai <query>` - 向 AI 助手提问

### 使用示例

```bash
# 查看所有节点
> nodes

# 查看默认命名空间的 Pod
> pods

# 查看指定命名空间的 Pod
> pods kube-system

# 查看 Pod 日志
> logs my-pod default my-container 100

# 分析 Pod 日志
> analyze-logs my-pod default

# 查看集群健康状态
> cluster-health

# 查看资源使用情况
> resource-usage

# 分析集群事件
> analyze-events all

# 备份集群
> backup my-backup

# 恢复集群
> restore my-backup-2024-01-01T00-00-00-000Z.json

# 向 AI 助手提问
> ai 如何调试一个崩溃的 Pod？
```

## 配置说明

### AI 功能配置

要使用 AI 助手功能，需要配置 AI API 凭证：

1. 在项目根目录创建 `.env` 文件
2. 添加以下配置：

```env
# AI API 配置
AI_API_KEY=your-api-key-here
AI_API_URL=https://api.openai.com/v1/chat/completions
```

**注意**：请勿将 `.env` 文件提交到版本控制系统。

### 集群配置

k8s-guardian 使用标准的 kubeconfig 文件连接 Kubernetes 集群。默认情况下，它会读取 `~/.kube/config` 文件。

如需指定不同的 kubeconfig 文件，可以设置环境变量：

```bash
export KUBECONFIG=/path/to/your/kubeconfig
```

### 多集群管理

如果您的 kubeconfig 中包含多个集群，可以使用以下命令管理：

```bash
# 列出所有集群
> clusters

# 查看当前集群
> current-cluster

# 切换集群
> switch-cluster my-cluster
```

## 项目结构

```
k8s-guardian/
├── bin/
│   └── cli.js              # 命令行入口点
├── src/
│   ├── console.js          # 交互式控制台实现
│   ├── k8s.js              # Kubernetes 客户端和基础操作
│   ├── ai.js               # AI 助手实现
│   ├── commands.js         # 命令处理和路由
│   ├── health.js           # 集群健康检查
│   ├── logs.js             # 日志获取和分析
│   ├── events.js           # 事件监控和分析
│   ├── resource.js          # 资源配额和限制管理
│   ├── cluster.js          # 集群管理
│   ├── rbac.js             # RBAC 权限管理
│   ├── backup.js           # 备份和恢复
│   ├── network.js          # 网络策略分析
│   └── storage.js          # 存储管理
├── package.json            # 项目配置和依赖
├── README.md               # 项目文档
└── .env                    # 环境变量（可选，不提交）
```

## 技术栈

### 核心依赖

- **@kubernetes/client-node** (^0.20.0) - Kubernetes 官方 JavaScript 客户端
- **blessed** (^0.1.81) - 终端 UI 库
- **blessed-contrib** (^4.11.0) - 终端 UI 组件库
- **chalk** (^4.1.2) - 终端输出着色
- **commander** (^9.5.0) - 命令行参数解析
- **dotenv** (^16.0.3) - 环境变量加载
- **figlet** (^1.5.2) - ASCII 艺术字生成
- **inquirer** (^8.2.4) - 交互式命令行提示
- **axios** (^0.27.2) - HTTP 客户端

### 开发依赖

- **eslint** (^8.19.0) - 代码规范检查
- **eslint-config-standard** (^17.0.0) - ESLint 标准配置
- **eslint-plugin-import** (^2.26.0) - ES6 import/export 语法检查
- **eslint-plugin-n** (^15.2.4) - Node.js 代码规范
- **eslint-plugin-promise** (^6.0.0) - Promise 规范检查

## 开发指南

### 本地开发

```bash
# 克隆仓库
git clone https://github.com/kudig-io/k8s-guardian.git
cd k8s-guardian

# 安装依赖
npm install

# 启动开发模式（支持热重载）
npm run dev

# 运行代码检查
npm run lint
```

### 代码规范

项目使用 ESLint 进行代码规范检查，遵循 Standard 规范。

```bash
# 运行代码检查
npm run lint

# 自动修复可修复的问题
npm run lint -- --fix
```

### 贡献指南

我们欢迎任何形式的贡献！如果您想为项目做出贡献，请遵循以下步骤：

1. Fork 本仓库
2. 创建您的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交您的更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启一个 Pull Request

### 提交规范

请遵循语义化提交规范：

- `feat:` 新功能
- `fix:` 修复 bug
- `docs:` 文档更新
- `style:` 代码格式调整（不影响代码运行）
- `refactor:` 重构（既不是新增功能，也不是修复 bug）
- `perf:` 性能优化
- `test:` 增加测试
- `chore:` 构建过程或辅助工具的变动

## 常见问题

### Q: 如何连接到 Kubernetes 集群？

A: k8s-guardian 使用标准的 kubeconfig 文件。确保您的 `~/.kube/config` 文件已正确配置，或者设置 `KUBECONFIG` 环境变量指向您的配置文件。

### Q: AI 功能如何使用？

A: 首先需要在 `.env` 文件中配置 AI API 凭证，然后在控制台中输入 `ai <您的问题>` 即可与 AI 助手对话。

### Q: 如何查看特定命名空间的资源？

A: 大多数命令都支持命名空间参数，例如 `pods kube-system` 查看 kube-system 命名空间的 Pod。

### Q: 备份文件存储在哪里？

A: 备份文件默认存储在 `~/.k8s-guardian/backups/` 目录下。

### Q: 如何切换不同的 Kubernetes 集群？

A: 使用 `clusters` 命令查看所有可用集群，然后使用 `switch-cluster <cluster-name>` 切换到指定集群。

## 路线图

### v1.1.0（已完成）
- [x] 添加 Web UI 界面
- [x] 支持更多 Kubernetes 资源类型
- [x] 增强日志分析功能
- [x] 添加性能监控图表

### v1.2.0（已完成）
- [x] 支持自定义告警规则
- [x] 添加自动化运维脚本
- [x] 支持多租户管理
- [x] 增强安全审计功能

### v1.3.0（计划中）
- [ ] 支持更多合规标准（PCI DSS、HIPAA、SOC2）
- [ ] 增强自动化脚本功能
- [ ] 添加 Kubernetes 资源生命周期管理
- [ ] 支持自定义仪表盘和报表

### v2.0.0（长期规划）
- [ ] 分布式架构支持
- [ ] 插件系统
- [ ] 更多 AI 智能功能
- [ ] 企业级功能支持

## 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 致谢

感谢所有为 k8s-guardian 做出贡献的开发者！

特别感谢以下开源项目：

- [Kubernetes JavaScript Client](https://github.com/kubernetes-client/javascript)
- [blessed](https://github.com/chjj/blessed)
- [blessed-contrib](https://github.com/yaronn/blessed-contrib)

## 联系方式

- **项目主页**: https://github.com/kudig-io/k8s-guardian
- **问题反馈**: https://github.com/kudig-io/k8s-guardian/issues
- **讨论区**: https://github.com/kudig-io/k8s-guardian/discussions

## 免责声明

本工具仅供学习和开发使用。在生产环境中使用前，请充分测试并确保符合您的安全和合规要求。作者不对使用本工具造成的任何损失负责。
