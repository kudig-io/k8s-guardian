# k8s-guardian 项目工程化文档

> 本文档记录了 k8s-guardian 项目从基础结构到生产级工程化的完整过程。

## 📋 目录

- [工程化概述](#工程化概述)
- [改进详情](#改进详情)
  - [1. 代码质量工具](#1-代码质量工具)
  - [2. 测试框架](#2-测试框架)
  - [3. CI/CD 流水线](#3-cicd-流水线)
  - [4. 容器化支持](#4-容器化支持)
  - [5. Kubernetes 部署](#5-kubernetes-部署)
  - [6. 配置管理](#6-配置管理)
  - [7. 日志和监控](#7-日志和监控)
  - [8. 安全扫描](#8-安全扫描)
  - [9. 项目文档](#9-项目文档)
  - [10. 版本管理](#10-版本管理)
- [项目结构](#项目结构)
- [快速开始](#快速开始)
- [配置说明](#配置说明)
- [部署指南](#部署指南)

---

## 工程化概述

本次工程化改造将 k8s-guardian 从一个基础的 Kubernetes 运维工具转变为生产级项目，涵盖了代码质量、测试、CI/CD、容器化、Kubernetes 部署、监控、安全等各个方面。

### 改进前后对比

| 方面 | 改进前 | 改进后 |
|------|--------|--------|
| 代码质量 | 基础 ESLint | ESLint + Prettier + Husky + lint-staged + commitlint |
| 测试 | 无 | Jest 测试框架 + 覆盖率报告 |
| CI/CD | 无 | GitHub Actions 完整流水线 |
| 容器化 | 无 | Docker + docker-compose |
| 部署 | 无 | Helm Chart 完整配置 |
| 监控 | 无 | Prometheus + Grafana |
| 日志 | console.log | Winston 日志系统 |
| 安全 | 无 | npm audit + Snyk + CodeQL |
| 文档 | README | README + CHANGELOG + CONTRIBUTING + LICENSE |

---

## 改进详情

### 1. 代码质量工具

#### 1.1 ESLint 配置

**文件**: `.eslintrc.js`

```javascript
module.exports = {
  env: {
    node: true,
    es2021: true,
    jest: true
  },
  extends: ['standard'],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  rules: {
    'no-console': 'off',
    'prefer-promise-reject-errors': ['error', { allowEmptyReject: true }],
    'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    'comma-dangle': ['error', 'never'],
    'semi': ['error', 'never'],
    'quotes': ['error', 'single', { avoidEscape: true }],
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    'space-before-function-paren': ['error', {
      anonymous: 'always',
      named: 'never',
      asyncArrow: 'always'
    }]
  }
}
```

**功能**:
- JavaScript 代码规范检查
- 自动修复常见问题
- 集成 Standard 规范

#### 1.2 Prettier 配置

**文件**: `.prettierrc`

```json
{
  "semi": false,
  "singleQuote": true,
  "tabWidth": 2,
  "useTabs": false,
  "trailingComma": "none",
  "bracketSpacing": true,
  "arrowParens": "avoid",
  "printWidth": 100,
  "endOfLine": "lf"
}
```

**功能**:
- 统一代码格式
- 自动格式化
- 团队协作一致性

#### 1.3 Husky Git Hooks

**文件**: `.husky/pre-commit`

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

npm run precommit
```

**功能**:
- 提交前自动运行 lint-staged
- 确保代码质量
- 防止不合规代码提交

#### 1.4 Commitlint

**文件**: `commitlint.config.js`

```javascript
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat', 'fix', 'docs', 'style', 'refactor',
        'perf', 'test', 'build', 'ci', 'chore', 'revert'
      ]
    ]
  }
}
```

**功能**:
- 规范化提交信息
- 支持语义化版本
- 自动生成 CHANGELOG

#### 1.5 EditorConfig

**文件**: `.editorconfig`

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_size = 2
indent_style = space
insert_final_newline = true
trim_trailing_whitespace = true
```

**功能**:
- 跨编辑器配置统一
- 代码风格一致性

---

### 2. 测试框架

#### 2.1 Jest 配置

**文件**: `package.json` (jest 配置部分)

```json
{
  "jest": {
    "testEnvironment": "node",
    "coverageDirectory": "coverage",
    "collectCoverageFrom": [
      "src/**/*.js",
      "!src/**/*.test.js",
      "!src/**/__tests__/**"
    ],
    "coverageReporters": ["text", "lcov", "html"],
    "coverageThreshold": {
      "global": {
        "branches": 50,
        "functions": 50,
        "lines": 50,
        "statements": 50
      }
    }
  }
}
```

**功能**:
- 单元测试框架
- 代码覆盖率报告
- 测试阈值控制

#### 2.2 测试示例

**文件**: `src/__tests__/k8s.test.js`

```javascript
const k8s = require('@kubernetes/client-node')

jest.mock('@kubernetes/client-node')

describe('Kubernetes Client', () => {
  let k8sModule

  beforeEach(() => {
    jest.clearAllMocks()
    k8sModule = require('../src/k8s')
  })

  describe('connectK8s', () => {
    it('should connect to Kubernetes cluster successfully', async () => {
      const mockKubeConfig = {
        loadFromDefault: jest.fn(),
        makeApiClient: jest.fn(() => ({}))
      }

      k8s.KubeConfig.mockImplementation(() => mockKubeConfig)

      const result = await k8sModule.connectK8s()

      expect(mockKubeConfig.loadFromDefault).toHaveBeenCalled()
      expect(result).toBeDefined()
    })
  })
})
```

**测试命令**:
```bash
npm test              # 运行测试
npm run test:watch    # 监听模式
npm run test:ci       # CI 环境
```

---

### 3. CI/CD 流水线

#### 3.1 主 CI/CD 流水线

**文件**: `.github/workflows/ci-cd.yml`

**流程图**:
```
┌─────────────┐
│   Push/PR   │
└──────┬──────┘
       │
       ├─────────────────┐
       │                 │
       ▼                 ▼
┌─────────────┐   ┌─────────────┐
│    Lint     │   │   Security  │
│   Check     │   │    Scan     │
└──────┬──────┘   └──────┬──────┘
       │                 │
       └────────┬────────┘
                │
                ▼
         ┌─────────────┐
         │    Test     │
         └──────┬──────┘
                │
                ▼
         ┌─────────────┐
         │   Build     │
         │   Docker    │
         └──────┬──────┘
                │
       ┌────────┴────────┐
       │                 │
       ▼                 ▼
┌─────────────┐   ┌─────────────┐
│   Publish   │   │   Deploy    │
│    NPM      │   │     K8s     │
└─────────────┘   └─────────────┘
```

**主要功能**:
- **Lint**: 代码质量检查
- **Test**: 单元测试 + 覆盖率
- **Security Scan**: 安全扫描
- **Build**: Docker 镜像构建
- **Publish**: NPM 发布
- **Deploy**: Kubernetes 部署

#### 3.2 CodeQL 安全分析

**文件**: `.github/workflows/codeql-analysis.yml`

**功能**:
- 静态代码分析
- 安全漏洞检测
- 定期扫描（每周一）

#### 3.3 依赖审查

**文件**: `.github/workflows/dependency-review.yml`

**功能**:
- PR 依赖变更审查
- 漏洞检测
- 许可证检查

---

### 4. 容器化支持

#### 4.1 Dockerfile

**文件**: `Dockerfile`

```dockerfile
# Build stage
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY . .
RUN npm run lint && npm run test

# Production stage
FROM node:18-alpine AS production

WORKDIR /app

RUN addgroup -g 1001 -S nodejs && \
    adduser -S k8s-guardian -u 1001 -G nodejs

COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY --chown=k8s-guardian:nodejs . .

RUN mkdir -p logs && chown -R k8s-guardian:nodejs logs

USER k8s-guardian

EXPOSE 8080 9090

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

ENV NODE_ENV=production \
    LOG_LEVEL=info \
    METRICS_ENABLED=true

CMD ["node", "bin/cli.js", "--web"]
```

**特性**:
- 多阶段构建，优化镜像大小
- 非 root 用户运行
- 健康检查
- 生产环境优化

#### 4.2 Docker Compose

**文件**: `docker-compose.yml`

**服务**:
- **k8s-guardian**: 主应用
- **prometheus**: 监控系统
- **grafana**: 可视化面板

**使用**:
```bash
docker-compose up -d
```

#### 4.3 .dockerignore

**文件**: `.dockerignore`

优化构建上下文，排除不必要的文件。

---

### 5. Kubernetes 部署

#### 5.1 Helm Chart 结构

```
helm/k8s-guardian/
├── Chart.yaml              # Chart 元数据
├── values.yaml             # 默认配置
├── values-production.yaml  # 生产环境配置
└── templates/
    ├── _helpers.tpl        # 模板助手
    ├── configmap.yaml      # 配置映射
    ├── secret.yaml         # 密钥
    ├── deployment.yaml     # 部署
    ├── service.yaml        # 服务
    ├── ingress.yaml        # 入口
    ├── hpa.yaml           # 自动扩缩容
    ├── rbac.yaml          # 权限控制
    ├── pvc.yaml           # 持久化存储
    ├── serviceaccount.yaml # 服务账户
    ├── servicemonitor.yaml # Prometheus 监控
    └── prometheusrule.yaml # 告警规则
```

#### 5.2 部署配置

**values.yaml 主要配置**:

```yaml
replicaCount: 2

image:
  repository: ghcr.io/kudig-io/k8s-guardian
  pullPolicy: IfNotPresent

service:
  type: ClusterIP
  webPort: 80
  metricsPort: 9090

resources:
  limits:
    cpu: 500m
    memory: 512Mi
  requests:
    cpu: 250m
    memory: 256Mi

autoscaling:
  enabled: false
  minReplicas: 2
  maxReplicas: 10
  targetCPUUtilizationPercentage: 80

rbac:
  create: true

serviceMonitor:
  enabled: true

prometheusRules:
  enabled: true
```

#### 5.3 生产环境配置

**values-production.yaml**:

```yaml
replicaCount: 3

resources:
  limits:
    cpu: 1000m
    memory: 1Gi
  requests:
    cpu: 500m
    memory: 512Mi

autoscaling:
  enabled: true
  minReplicas: 3
  maxReplicas: 20

ingress:
  enabled: true
  className: nginx
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
```

#### 5.4 部署命令

```bash
# 安装
helm install k8s-guardian ./helm/k8s-guardian \
  --namespace k8s-guardian \
  --create-namespace

# 升级
helm upgrade k8s-guardian ./helm/k8s-guardian \
  --namespace k8s-guardian

# 生产环境
helm install k8s-guardian ./helm/k8s-guardian \
  --namespace k8s-guardian \
  --values ./helm/k8s-guardian/values-production.yaml
```

---

### 6. 配置管理

#### 6.1 环境变量模板

**文件**: `.env.example`

```bash
# AI API Configuration
AI_API_KEY=your-api-key-here
AI_API_URL=https://api.openai.com/v1/chat/completions
AI_MODEL=gpt-3.5-turbo

# Web Server Configuration
WEB_UI_PORT=8080
WEB_UI_HOST=0.0.0.0

# Logging Configuration
LOG_LEVEL=info
LOG_FORMAT=json

# Metrics Configuration
METRICS_ENABLED=true
METRICS_PORT=9090

# Security Configuration
RATE_LIMIT_ENABLED=true
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

#### 6.2 配置验证

**文件**: `src/config.js`

```javascript
const dotenv = require('dotenv')
const logger = require('./logger')

dotenv.config()

const config = {
  ai: {
    apiKey: process.env.AI_API_KEY || '',
    apiUrl: process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions',
    model: process.env.AI_MODEL || 'gpt-3.5-turbo'
  },
  web: {
    port: parseInt(process.env.WEB_UI_PORT) || 8080,
    host: process.env.WEB_UI_HOST || '0.0.0.0'
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    format: process.env.LOG_FORMAT || 'json'
  },
  metrics: {
    enabled: process.env.METRICS_ENABLED === 'true',
    port: parseInt(process.env.METRICS_PORT) || 9090
  }
}

function validateConfig () {
  const errors = []

  if (config.env === 'production') {
    if (!config.ai.apiKey) {
      logger.warn('AI_API_KEY is not set. AI features will be disabled.')
    }
  }

  if (config.web.port < 1 || config.web.port > 65535) {
    errors.push('WEB_UI_PORT must be between 1 and 65535')
  }

  if (errors.length > 0) {
    throw new Error(`Configuration validation failed: ${errors.join('; ')}`)
  }

  return true
}

module.exports = { config, validateConfig, getConfig }
```

---

### 7. 日志和监控

#### 7.1 Winston 日志系统

**文件**: `src/logger.js`

```javascript
const winston = require('winston')
const path = require('path')

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'k8s-guardian' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/error.log'),
      level: 'error'
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/combined.log')
    })
  ]
})

module.exports = logger
```

**日志级别**:
- `error`: 错误信息
- `warn`: 警告信息
- `info`: 一般信息
- `debug`: 调试信息

#### 7.2 Prometheus Metrics

**文件**: `src/metrics.js`

**指标类型**:

```javascript
const metrics = {
  // HTTP 请求计数
  httpRequestsTotal: new client.Counter({
    name: 'http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status_code']
  }),

  // HTTP 请求延迟
  httpRequestDuration: new client.Histogram({
    name: 'http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.1, 0.5, 1, 1.5, 2, 5]
  }),

  // K8s API 请求
  k8sApiRequestsTotal: new client.Counter({
    name: 'k8s_api_requests_total',
    help: 'Total number of Kubernetes API requests',
    labelNames: ['operation', 'resource_type', 'namespace']
  }),

  // 活跃 WebSocket 连接
  activeWebSockets: new client.Gauge({
    name: 'active_websockets',
    help: 'Number of active WebSocket connections'
  }),

  // 缓存命中率
  cacheHits: new client.Counter({
    name: 'cache_hits_total',
    help: 'Total number of cache hits'
  })
}
```

#### 7.3 Grafana Dashboard

**文件**: `monitoring/grafana/dashboards/k8s-guardian.json`

**面板内容**:
- HTTP 请求总数
- HTTP 请求延迟
- Kubernetes API 请求
- 活跃 WebSocket 连接
- 缓存命中率
- 告警触发统计

#### 7.4 Prometheus 配置

**文件**: `monitoring/prometheus.yml`

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'prometheus'
    static_configs:
      - targets: ['localhost:9090']

  - job_name: 'k8s-guardian'
    static_configs:
      - targets: ['k8s-guardian:9090']
    metrics_path: /metrics
```

---

### 8. 安全扫描

#### 8.1 npm audit

**命令**: `npm run audit`

**功能**:
- 依赖漏洞扫描
- 中等级别以上漏洞告警
- 自动化检查

#### 8.2 Snyk 集成

**CI/CD 集成**:

```yaml
- name: Run Snyk security scan
  uses: snyk/actions/node@master
  env:
    SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
```

**功能**:
- 实时漏洞数据库
- 自动修复建议
- 持续监控

#### 8.3 CodeQL 分析

**文件**: `.github/workflows/codeql-analysis.yml`

**功能**:
- 静态代码分析
- 安全漏洞检测
- SQL 注入、XSS 等检测

---

### 9. 项目文档

#### 9.1 CHANGELOG

**文件**: `CHANGELOG.md`

遵循 [Keep a Changelog](https://keepachangelog.com/) 格式：

```markdown
## [Unreleased]

### Added
- Production-ready project structure
- Comprehensive CI/CD pipeline
- Docker containerization support

## [1.0.0] - 2024-01-01

### Added
- Initial release of k8s-guardian
- Interactive CLI visualization
- AI-powered operations assistant
```

#### 9.2 CONTRIBUTING

**文件**: `CONTRIBUTING.md`

**内容**:
- 贡献流程
- 开发环境设置
- 代码规范
- 提交信息规范
- PR 流程

#### 9.3 LICENSE

**文件**: `LICENSE`

MIT License

```
MIT License

Copyright (c) 2024 kudig-io

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction...
```

---

### 10. 版本管理

#### 10.1 Semantic Release

**文件**: `.releaserc.json`

```json
{
  "version": "1.0.0",
  "release": {
    "branches": ["main"],
    "plugins": [
      "@semantic-release/commit-analyzer",
      "@semantic-release/release-notes-generator",
      "@semantic-release/changelog",
      "@semantic-release/npm",
      "@semantic-release/github",
      "@semantic-release/git"
    ]
  }
}
```

**功能**:
- 自动版本号管理
- 自动生成 CHANGELOG
- 自动发布到 NPM
- 自动创建 GitHub Release

#### 10.2 版本策略

- **主版本号 (MAJOR)**: 不兼容的 API 变更
- **次版本号 (MINOR)**: 向后兼容的功能新增
- **修订号 (PATCH)**: 向后兼容的问题修复

---

## 项目结构

```
k8s-guardian/
├── .github/
│   └── workflows/              # GitHub Actions 工作流
│       ├── ci-cd.yml          # 主 CI/CD 流水线
│       ├── codeql-analysis.yml # 代码安全分析
│       └── dependency-review.yml # 依赖审查
│
├── .husky/                     # Git hooks
│   ├── pre-commit             # 提交前检查
│   ├── pre-push               # 推送前检查
│   └── commit-msg             # 提交信息检查
│
├── bin/
│   └── cli.js                 # CLI 入口
│
├── helm/
│   └── k8s-guardian/          # Helm Chart
│       ├── templates/         # Kubernetes 模板
│       │   ├── _helpers.tpl
│       │   ├── configmap.yaml
│       │   ├── deployment.yaml
│       │   ├── hpa.yaml
│       │   ├── ingress.yaml
│       │   ├── prometheusrule.yaml
│       │   ├── pvc.yaml
│       │   ├── rbac.yaml
│       │   ├── secret.yaml
│       │   ├── service.yaml
│       │   ├── serviceaccount.yaml
│       │   └── servicemonitor.yaml
│       ├── Chart.yaml
│       ├── values.yaml
│       └── values-production.yaml
│
├── monitoring/                 # 监控配置
│   ├── grafana/
│   │   ├── dashboards/
│   │   │   ├── dashboard.yml
│   │   │   └── k8s-guardian.json
│   │   └── datasources/
│   │       └── prometheus.yml
│   └── prometheus.yml
│
├── src/
│   ├── __tests__/             # 测试文件
│   │   ├── k8s.test.js
│   │   ├── logger.test.js
│   │   └── web-server.test.js
│   ├── ai.js                  # AI 助手
│   ├── alerts.js              # 告警管理
│   ├── audit.js               # 安全审计
│   ├── automation.js          # 自动化脚本
│   ├── backup.js              # 备份恢复
│   ├── cluster.js             # 集群管理
│   ├── commands.js            # 命令处理
│   ├── config.js              # 配置管理
│   ├── console.js             # 控制台 UI
│   ├── events.js              # 事件监控
│   ├── health.js              # 健康检查
│   ├── k8s.js                 # K8s 客户端
│   ├── logger.js              # 日志系统
│   ├── logs.js                # 日志分析
│   ├── metrics.js             # Prometheus 指标
│   ├── multitenancy.js        # 多租户
│   ├── network.js             # 网络管理
│   ├── rbac.js                # RBAC 管理
│   ├── resource.js            # 资源管理
│   ├── storage.js             # 存储管理
│   └── web-server.js          # Web 服务器
│
├── web-ui/                     # Web UI
│   ├── app.js
│   ├── index.html
│   └── styles.css
│
├── .dockerignore               # Docker 忽略文件
├── .editorconfig               # 编辑器配置
├── .env.example                # 环境变量模板
├── .eslintrc.js                # ESLint 配置
├── .gitignore                  # Git 忽略文件
├── .npmignore                  # NPM 忽略文件
├── .prettierignore             # Prettier 忽略文件
├── .prettierrc                 # Prettier 配置
├── .releaserc.json             # Semantic Release 配置
├── CHANGELOG.md                # 变更日志
├── commitlint.config.js        # Commitlint 配置
├── CONTRIBUTING.md             # 贡献指南
├── docker-compose.yml          # Docker Compose 配置
├── Dockerfile                  # Docker 镜像构建
├── LICENSE                     # 许可证
├── Makefile                    # 常用命令
├── package.json                # 项目配置
└── README.md                   # 项目说明
```

---

## 快速开始

### 前置要求

- Node.js >= 16.0.0
- npm >= 8.0.0
- Docker (可选)
- Kubernetes 集群 (可选)
- kubectl (可选)
- Helm 3 (可选)

### 安装

```bash
# 克隆仓库
git clone https://github.com/kudig-io/k8s-guardian.git
cd k8s-guardian

# 安装依赖
make install
# 或
npm install

# 设置 Git hooks
npm run prepare
```

### 开发

```bash
# 启动开发服务器
make dev
# 或
npm run dev

# 运行测试
make test
# 或
npm test

# 代码检查
make lint
# 或
npm run lint

# 格式化代码
make format
# 或
npm run format
```

### Docker

```bash
# 构建镜像
make docker-build
# 或
docker build -t k8s-guardian:latest .

# 运行容器
make docker-run
# 或
docker run -p 8080:8080 -p 9090:9090 k8s-guardian:latest

# 使用 Docker Compose
make docker-compose-up
# 或
docker-compose up -d
```

### Kubernetes

```bash
# 安装 Helm Chart
make helm-install
# 或
helm install k8s-guardian ./helm/k8s-guardian \
  --namespace k8s-guardian \
  --create-namespace

# 升级
make helm-upgrade
# 或
helm upgrade k8s-guardian ./helm/k8s-guardian \
  --namespace k8s-guardian

# 生产环境部署
helm install k8s-guardian ./helm/k8s-guardian \
  --namespace k8s-guardian \
  --values ./helm/k8s-guardian/values-production.yaml
```

---

## 配置说明

### 环境变量

复制 `.env.example` 到 `.env` 并修改：

```bash
cp .env.example .env
```

**主要配置项**:

| 变量 | 说明 | 默认值 |
|------|------|--------|
| `AI_API_KEY` | AI API 密钥 | - |
| `AI_API_URL` | AI API 地址 | `https://api.openai.com/v1/chat/completions` |
| `WEB_UI_PORT` | Web UI 端口 | `8080` |
| `LOG_LEVEL` | 日志级别 | `info` |
| `METRICS_ENABLED` | 启用监控指标 | `true` |
| `METRICS_PORT` | 监控指标端口 | `9090` |

### NPM Scripts

| 命令 | 说明 |
|------|------|
| `npm start` | 启动应用 |
| `npm run dev` | 开发模式（热重载） |
| `npm test` | 运行测试 |
| `npm run test:watch` | 监听模式测试 |
| `npm run test:ci` | CI 环境测试 |
| `npm run lint` | 代码检查 |
| `npm run lint:fix` | 自动修复代码问题 |
| `npm run format` | 格式化代码 |
| `npm run format:check` | 检查代码格式 |
| `npm run audit` | 安全审计 |
| `npm run build` | 完整构建 |
| `npm run prepare` | 设置 Git hooks |

### Makefile 命令

| 命令 | 说明 |
|------|------|
| `make help` | 显示帮助信息 |
| `make install` | 安装依赖 |
| `make dev` | 启动开发服务器 |
| `make test` | 运行测试 |
| `make lint` | 代码检查 |
| `make format` | 格式化代码 |
| `make clean` | 清理构建产物 |
| `make build` | 完整构建 |
| `make docker-build` | 构建 Docker 镜像 |
| `make docker-run` | 运行 Docker 容器 |
| `make helm-install` | 安装 Helm Chart |
| `make helm-upgrade` | 升级 Helm Chart |
| `make docker-compose-up` | 启动 Docker Compose |
| `make docker-compose-down` | 停止 Docker Compose |

---

## 部署指南

### Docker 部署

1. **构建镜像**:
   ```bash
   docker build -t k8s-guardian:latest .
   ```

2. **运行容器**:
   ```bash
   docker run -d \
     --name k8s-guardian \
     -p 8080:8080 \
     -p 9090:9090 \
     -v ~/.kube:/home/k8s-guardian/.kube:ro \
     -e NODE_ENV=production \
     k8s-guardian:latest
   ```

3. **使用 Docker Compose**:
   ```bash
   docker-compose up -d
   ```

### Kubernetes 部署

1. **准备 Kubernetes 集群**

2. **配置 kubeconfig**

3. **安装 Helm Chart**:
   ```bash
   helm install k8s-guardian ./helm/k8s-guardian \
     --namespace k8s-guardian \
     --create-namespace \
     --set secrets.aiApiKey=YOUR_API_KEY
   ```

4. **验证部署**:
   ```bash
   kubectl get pods -n k8s-guardian
   kubectl get services -n k8s-guardian
   ```

5. **访问应用**:
   - ClusterIP: `http://k8s-guardian.k8s-guardian.svc.cluster.local`
   - Port Forward: `kubectl port-forward -n k8s-guardian svc/k8s-guardian 8080:80`

### 生产环境部署

1. **使用生产配置**:
   ```bash
   helm install k8s-guardian ./helm/k8s-guardian \
     --namespace k8s-guardian \
     --values ./helm/k8s-guardian/values-production.yaml
   ```

2. **配置 Ingress**:
   - 更新 `values-production.yaml` 中的域名
   - 配置 TLS 证书

3. **监控设置**:
   - Prometheus 已自动配置
   - 访问 Grafana: `http://grafana.example.com`

4. **日志收集**:
   - 日志输出到 `/app/logs/`
   - 配置日志收集器（如 Fluentd）

---

## 监控和告警

### Prometheus 指标

访问 `http://localhost:9090/metrics` 查看指标。

**主要指标**:
- `http_requests_total`: HTTP 请求总数
- `http_request_duration_seconds`: HTTP 请求延迟
- `k8s_api_requests_total`: K8s API 请求总数
- `active_websockets`: 活跃 WebSocket 连接数
- `cache_hits_total`: 缓存命中次数
- `alerts_triggered_total`: 触发的告警数

### Grafana Dashboard

1. 访问 Grafana: `http://localhost:3000`
2. 默认账号: `admin/admin`
3. 导入 Dashboard: 使用 `monitoring/grafana/dashboards/k8s-guardian.json`

### 告警规则

Helm Chart 自动配置以下告警:

- **K8sGuardianDown**: 应用宕机超过 5 分钟
- **K8sGuardianHighErrorRate**: 错误率超过 5%
- **K8sGuardianHighMemoryUsage**: 内存使用率超过 90%

---

## 故障排查

### 常见问题

1. **无法连接 Kubernetes 集群**
   - 检查 kubeconfig 配置
   - 验证 KUBECONFIG 环境变量
   - 确认网络连通性

2. **Docker 容器启动失败**
   - 检查端口占用
   - 查看容器日志: `docker logs k8s-guardian`
   - 验证环境变量配置

3. **测试失败**
   - 检查依赖安装: `npm install`
   - 清理缓存: `npm run clean`
   - 查看详细错误: `npm test -- --verbose`

4. **Helm 部署失败**
   - 检查 Kubernetes 版本兼容性
   - 验证 RBAC 权限
   - 查看 Pod 日志: `kubectl logs -n k8s-guardian <pod-name>`

### 日志查看

```bash
# Docker 日志
docker logs k8s-guardian

# Kubernetes 日志
kubectl logs -n k8s-guardian -l app.kubernetes.io/name=k8s-guardian

# 应用日志文件
tail -f logs/combined.log
tail -f logs/error.log
```

---

## 最佳实践

### 开发

1. **提交代码前**:
   ```bash
   npm run lint
   npm test
   npm run format:check
   ```

2. **提交信息规范**:
   ```
   feat: 添加新功能
   fix: 修复 bug
   docs: 文档更新
   test: 测试相关
   chore: 构建/工具相关
   ```

3. **分支管理**:
   - `main`: 生产分支
   - `develop`: 开发分支
   - `feature/*`: 功能分支
   - `hotfix/*`: 热修复分支

### 生产

1. **资源限制**: 根据实际负载调整 resources
2. **自动扩缩容**: 启用 HPA
3. **监控告警**: 配置告警通知渠道
4. **备份策略**: 定期备份关键数据
5. **安全扫描**: 定期运行安全审计

---

## 维护

### 依赖更新

```bash
# 检查过期依赖
npm outdated

# 更新依赖
npm update

# 安全审计
npm audit
npm audit fix
```

### 版本发布

发布流程由 CI/CD 自动处理:

1. 合并 PR 到 `main` 分支
2. CI/CD 自动运行测试
3. Semantic Release 自动发布
4. 自动更新 CHANGELOG
5. 自动创建 GitHub Release
6. 自动发布到 NPM

### 数据备份

```bash
# Kubernetes 资源备份
kubectl get all -n k8s-guardian -o yaml > backup.yaml

# 持久化数据备份
kubectl exec -n k8s-guardian <pod-name> -- tar czf - /app/backups > backup.tar.gz
```

---

## 性能优化

### 应用优化

1. **启用缓存**: 设置 `CACHE_ENABLED=true`
2. **调整日志级别**: 生产环境使用 `info` 或 `warn`
3. **资源限制**: 合理设置 CPU 和内存限制

### Kubernetes 优化

1. **资源请求和限制**: 根据实际使用调整
2. **HPA 配置**: 设置合适的扩缩容策略
3. **节点亲和性**: 将 Pod 调度到合适的节点

### 监控优化

1. **指标采集间隔**: 调整 Prometheus scrape_interval
2. **数据保留**: 配置合适的数据保留时间
3. **告警阈值**: 根据实际情况调整告警阈值

---

## 安全建议

1. **密钥管理**:
   - 使用 Kubernetes Secrets
   - 定期轮换密钥
   - 不要在代码中硬编码密钥

2. **网络安全**:
   - 启用 NetworkPolicy
   - 使用 TLS 加密通信
   - 配置 RBAC 权限

3. **镜像安全**:
   - 使用最小化基础镜像
   - 定期扫描镜像漏洞
   - 非 root 用户运行

4. **审计日志**:
   - 启用 Kubernetes 审计日志
   - 记录关键操作
   - 定期审查日志

---

## 贡献指南

请参考 [CONTRIBUTING.md](CONTRIBUTING.md) 了解如何为项目做出贡献。

---

## 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件。

---

## 联系方式

- **项目主页**: https://github.com/kudig-io/k8s-guardian
- **问题反馈**: https://github.com/kudig-io/k8s-guardian/issues
- **讨论区**: https://github.com/kudig-io/k8s-guardian/discussions

---

**最后更新**: 2024-01-01  
**文档版本**: 1.0.0
