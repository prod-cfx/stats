# 架构与技术栈

## 项目结构（Monorepo）

```text
apps/
├── backend/       # NestJS 主后端 API（3000）
├── front/         # Next.js 用户端（3001）
├── admin-front/   # Next.js 管理端（3500）
└── quantify/      # NestJS 量化/策略服务（3010）

packages/
├── shared/        # @ai/shared：跨端常量、类型、工具、脚本引擎
├── api-contracts/ # @ai/api-contracts：由 backend OpenAPI 生成的 Zod 模型 + HTTP Client
└── config/        # @net/config：dotenv + zod 环境加载与校验

dx/
└── config/        # dx 命令、环境分层、环境策略
```

## 技术栈（以当前仓库 `package.json` / 各 app `package.json` 为准）

- 运行时基线：Node.js `>=20.19.0`，pnpm `10.28.2`
- Monorepo / 构建编排：Nx `19.8.14`
- 语言与工程化：TypeScript `5.9.2`、ESLint `9.32.x`、Prettier `3.6.2`
- 后端主服务：NestJS `11.1.x`、Prisma `7.4.2`、PostgreSQL、Redis、Swagger/OpenAPI、Socket.IO
- 用户端：Next.js `16.1.6`、React `19.2.4`、Redux Toolkit、Radix UI、Tailwind CSS 4
- 管理端：Next.js `16.1.6`、React `19.2.4`、Ant Design `5.26.7`、Zustand
- 量化服务：NestJS `11.1.x`、Prisma `7.4.2`、Bull、策略/回测/消息总线相关模块

## 应用边界

### `apps/backend`

面向主站与管理端提供统一 API，负责：

- 用户认证、授权、角色与后台账户
- 市场行情与聚合数据接口
- 数据同步任务与配置中心
- 鲸鱼预警、通知投递与指标
- OpenAPI 导出，供 `packages/api-contracts` 生成客户端

主要模块（`apps/backend/src/modules/*`）：

- 身份与用户：`auth`、`user`、`admin`
- 市场与行情：`markets`、`kline`、`aggregated-orderbook`、`aggregated-liquidation`、`open-interest`、`liquidation-heatmap`、`polymarket`
- 数据同步：`data-sync`、`crypto-stock-quotes`、`whale-alert`、`whale-holdings`、`whale-tracking`
- 通知与配置：`whale-notification`、`settings`、`meta`、`exchange-config`、`trades-config`、`orderbook-config`
- 基础设施：`health`

### `apps/quantify`

独立的量化/策略服务，当前承担：

- 账户与交易所账户管理
- 市场数据、指标、仓位与交易能力
- 回测、策略模板、策略订阅、策略实例
- LLM 策略生成与相关 AI 能力
- message bus 与 outbox 相关基础设施

主要模块（`apps/quantify/src/modules/*`）：

- 账户与配置：`accounts`、`exchange-accounts`、`settings`
- 数据与分析：`market-data`、`indicators`、`backtesting`
- 策略系统：`strategy-templates`、`strategy-subscriptions`、`strategy-instances`、`strategy-signals`
- AI / LLM：`ai`、`llm-strategies`、`llm-strategy-codegen`、`llm-strategy-subscriptions`
- 交易与基础设施：`positions`、`trading`、`message-bus`、`health`

### `apps/front`

面向终端用户的 Next.js 应用，消费 `backend` API，当前已包含：

- 行情与交易可视化页面
- 用户认证与 Telegram 登录/绑定流程
- 鲸鱼预警相关交互
- AI Quant 相关页面与前端状态管理

### `apps/admin-front`

面向运营/管理侧的 Next.js 应用，消费 `backend` API，承担：

- 后台权限与用户管理
- 配置项与系统数据维护
- 运营与审核类管理界面

## 共享包职责

- `packages/shared`
  - 只放跨端可复用的纯函数、常量、类型与脚本引擎等通用能力
  - 通过 `./node` 暴露 Node 专属导出，供服务端按需使用
- `packages/api-contracts`
  - 由 `backend:swagger` + `scripts/generate-backend-contracts.mjs` 生成
  - 为前端与管理端提供类型安全的接口模型与客户端
- `packages/config`
  - 封装环境变量加载、展开与 zod 校验
  - 与 `dx/config/env-policy.jsonc` 一起构成环境治理边界

## 数据与合约

- Backend Prisma Schema：`apps/backend/prisma/schema/*.prisma`
- Quantify Prisma Schema：`apps/quantify/prisma/schema/*.prisma`
- Backend OpenAPI 导出：`apps/backend/src/swagger/export-openapi.ts`
- Quantify OpenAPI 导出：`apps/quantify/src/swagger/export-openapi.ts`
- 合约生成产物：`packages/api-contracts/src/generated/backend.ts`

说明：

- 当前 `api-contracts` 主要由 `backend` OpenAPI 驱动，`quantify` 已具备单独导出 OpenAPI 的能力，但尚未接入同一份前端合约产物

## 命令与运行形态

- 日常开发命令统一通过 `dx` 入口执行
- `dx start all` 当前启动 `backend`、`front`、`admin`
- `quantify` 通过 `dx start quantify --dev` 单独启动，或使用 `dx start stack` 纳入 PM2 服务栈
- 构建可直接按目标执行：`dx build backend --dev`、`dx build quantify --dev`、`dx build front --dev`、`dx build admin --dev`

## 关键约定速记

- 分页基类：`apps/backend/src/common/dto/base.pagination.request.dto.ts`、`apps/backend/src/common/dto/base.pagination.response.dto.ts`
- 统一错误码：`packages/shared/src/constants/error-codes.ts`
- 统一业务异常基类：`apps/backend/src/common/exceptions/domain.exception.ts`
- 固定端口：backend=`3000`，front=`3001`，admin=`3500`，quantify=`3010`
