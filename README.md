# net-monorepo

基于 Nx 的 Monorepo 项目，当前包含 4 个主要应用：

- `apps/backend`：NestJS 主后端 API，默认端口 `3000`
- `apps/front`：Next.js 用户端，默认端口 `3001`
- `apps/admin-front`：Next.js 管理端，默认端口 `3500`
- `apps/quantify`：NestJS 量化/策略服务，默认端口 `3010`

共享包与基础设施：

- `packages/shared`：跨端常量、类型、工具与脚本引擎能力
- `packages/api-contracts`：由 backend / quantify OpenAPI 生成的 Zod 模型与 HTTP Client
- `packages/config`：环境变量加载与校验
- `dx/config`：统一开发命令、环境分层与环境策略
- `ruler/`：仓库开发规范、架构说明与协作约束

## 运行时基线

- Node.js `>=20.19.0`
- pnpm `10.28.2`
- 包管理器声明：`pnpm@10.28.2`

## 快速开始

安装依赖：

```bash
dx install
```

启动主开发栈（backend/front/admin）：

```bash
dx start all
```

单独启动：

```bash
dx start backend --dev
dx start front --dev
dx start admin --dev
dx start quantify --dev
```

如果需要完整 PM2 服务栈（含 `quantify`）与端口/缓存清理，可使用：

```bash
dx start stack
```

## 数据库初始化

后端首次初始化：

```bash
dx db format
dx db generate
dx db migrate --dev --name init_schema
dx db seed --dev
```

Quantify 首次初始化：

```bash
dx db format quantify --dev
dx db generate quantify --dev
dx db migrate quantify --dev --name init_schema
dx db seed quantify --dev
```

说明：

- 开发环境执行 `dx db migrate --dev --name <name>` 时必须显式提供迁移名，避免 Prisma 进入交互式流程
- 部署与 CI 应统一使用 `dx db deploy --<env>`，不要在非开发环境执行 `migrate dev`
- `quantify` 使用独立数据库与 Redis 配置，关键变量前缀为 `QUANTIFY_`

## 环境变量策略

仓库环境由 `packages/config` 与 `dx/config/env-policy.jsonc` 统一约束：

- 禁止创建根目录 `.env` 与 `.env.local`
- 允许提交 `.env.<env>`
- 真实敏感值只放 `.env.<env>.local`
- 当前受支持环境：`development`、`staging`、`production`、`test`、`e2e`

核心运行变量：

- `backend`：`DATABASE_URL`、`REDIS_URL`、`APP_SECRET`、`JWT_SECRET`
- `quantify`：`QUANTIFY_DATABASE_URL`、`QUANTIFY_REDIS_URL`、`QUANTIFY_APP_SECRET`、`QUANTIFY_JWT_SECRET`
- `front/admin`：通过 `NEXT_PUBLIC_*` 等变量注入运行时配置

## 常用命令

所有命令都从仓库根目录执行，并优先通过 `dx` 调用：

```bash
dx lint
dx build backend --dev
dx build quantify --dev
dx build front --dev
dx build admin --dev
dx build all --dev
dx build contracts --dev

dx test e2e backend apps/backend/e2e/<file-or-dir>
dx test e2e quantify apps/quantify/e2e/<file-or-dir>
dx test e2e quantify apps/quantify/e2e/health
dx test unit front
dx test unit admin
dx test unit backend
dx test unit quantify

dx cache clear
```

补充说明：

- `dx lint` 当前是全仓 lint 入口
- DX 升级后，`quantify` 的 E2E 属于 guarded target，必须传测试路径；推荐最小校验命令：`dx test e2e quantify apps/quantify/e2e/health`
- 前端项目支持 `dx test unit front` / `dx test unit admin`；如需聚焦单个文件，可直接在对应 app 目录下执行 `jest --config ... <file> -t "<case>"`
- 后端 DTO / OpenAPI 变更后，需要执行 `dx build contracts --dev`

## 当前架构概览

- `backend` 聚焦用户、认证、市场数据、配置、鲸鱼预警与数据同步
- `quantify` 聚焦账户、指标、回测、策略订阅、策略实例、交易与 message bus
- `front` 面向用户侧行情、账户、AI 量化与通知体验
- `admin-front` 面向后台配置、审核与运维管理

## 文档入口

- `ruler/development.md`：开发流程与命令系统
- `ruler/architecture.md`：仓库架构与技术栈
- `ruler/conventions.md`：代码规范与约束
- `ruler/git-workflow.md`：Git 与 GitHub 规范
- `ruler/linus-thinking.md`：设计与决策原则
