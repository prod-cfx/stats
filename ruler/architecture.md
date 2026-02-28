# 架构与技术栈

## 项目结构（Monorepo）

```
apps/
├── backend/       # NestJS API（端口 3000）
├── front/         # Next.js 用户端（端口 3001）
└── admin-front/   # Next.js 管理端（端口 3500）

packages/
├── shared/        # @ai/shared：跨端类型、ErrorCode、工具方法（含 ./node 导出）
├── api-contracts/ # @ai/api-contracts：由后端 OpenAPI 生成的 Zod 模型 + HTTP 客户端
└── config/        # @net/config：dotenv + zod 环境加载与校验

dx/
└── config/        # dx 命令、环境分层、环境策略（commands/env-layers/env-policy）
```

## 技术栈（以当前仓库 `package.json` / 各 app `package.json` 为准）

- 运行时基线：Node.js `>=20.19.0`，pnpm `10.28.2`
- 后端：NestJS `11.1.5` + Prisma `7.0.1` + PostgreSQL + Redis + Passport/JWT + Swagger/OpenAPI + WebSocket
- 用户端：Next.js `16.1.6` + React `19.2.4` + Redux Toolkit + Radix UI + TailwindCSS 4
- 管理端：Next.js `16.1.6` + React `19.2.4` + Ant Design `5.26.7` + Zustand
- 工具链：Nx `19.8.14` + TypeScript `5.9.2` + ESLint `9.32.x`（@antfu/eslint-config `4.10.x`）+ Prettier `3.6.2`

## 后端模块索引（`apps/backend/src/modules/*`）

- 身份与用户：`auth` / `user` / `admin`
- 市场与行情：`markets` / `kline` / `aggregated-orderbook` / `aggregated-liquidation` / `open-interest` / `liquidation-heatmap` / `polymarket`
- 数据同步：`data-sync` / `crypto-stock-quotes` / `whale-alert` / `whale-holdings` / `whale-tracking`
- 配置与元信息：`settings` / `meta` / `exchange-config` / `trades-config` / `orderbook-config`
- 基础设施：`health`

## 约定速记

- Prisma schema：`apps/backend/prisma/schema/*.prisma`
- 分页 DTO：`apps/backend/src/common/dto/base.pagination.request.dto.ts`
- 合约生成产物：`packages/api-contracts/src/generated/backend.ts`
- 固定端口：backend=`3000`，front=`3001`，admin=`3500`
