# 架构与技术栈

## 项目结构（Monorepo）

```
apps/
├── backend/      # NestJS API（端口 3000）
├── front/        # Next.js 用户端（端口 3001）
└── admin-front/  # Next.js 管理端（端口 3500）

packages/
├── shared/       # @ai/shared：跨端类型、ErrorCode、工具方法
├── api-contracts/ # @ai/api-contracts：openapi-zod-client 生成的 Zod 模型 + HTTP 客户端
└── config/       # @net/config：dotenv + zod 环境加载器

dx/
└── config/       # dx 配置（commands/env-layers/env-policy）
```

## 技术栈（以仓库 `package.json` 为准）

- 后端：NestJS 11.1.x + Prisma 7.0.x + PostgreSQL + Redis + Passport/JWT + Swagger/OpenAPI
- 用户端：Next.js 15.4.x + React 18.2 + Redux Toolkit + shadcn/ui + TailwindCSS 4
- 管理端：Next.js 15.4.x + React 19.0 + Ant Design 5.26 + Zustand
- 工具链：Nx 19.8.x + TypeScript 5.9.2 + ESLint @antfu 4.x + Prettier 3.6.x + pnpm 10.x

## 后端模块索引（`apps/backend/src/modules/*`）

- 身份与用户：`auth` / `user` / `admin`
- 市场与行情：`markets` / `kline` / `aggregated-orderbook` / `aggregated-liquidation` / `open-interest` / `liquidation-heatmap`
- 数据同步：`data-sync` / `crypto-stock-quotes` / `whale-alert` / `whale-holdings` / `whale-tracking`
- 配置与元信息：`settings` / `meta` / `exchange-config` / `trades-config` / `orderbook-config`
- 基础设施：`health`

## 约定速记

- Prisma schema：`apps/backend/prisma/schema/*.prisma`
- 分页 DTO：`BasePaginationRequestDto`
- 固定端口：backend=3000, front=3001, admin=3500
