# 架构与技术栈

## 一、项目结构（Nx Monorepo）

```
apps/
├── backend/      # NestJS 11.1.5 + Prisma 7.0.1，REST API，监听 3000
├── front/        # Next.js 15.4.7 App Router，面向终端用户，监听 3001
└── admin-front/  # Next.js 15.4.6 + React 19 管理后台，监听 3500

packages/
├── shared/        # @ai/shared：跨端类型、ErrorCode、工具方法
├── api-contracts/ # @ai/api-contracts：openapi-zod-client 生成的 Zod 模型 + HTTP 客户端
└── config/        # @net/config：dotenv + zod 环境加载器（所有入口统一调用）

scripts/           # DX CLI（./scripts/dx）、env 校验、start-dev 桥接
ruler/             # AI 协作规范（当前目录）
docs/、docker/     # 流程/部署参考
```

- Nx (`nx.json` + `project.json`) 负责任务编排
- OpenAPI 通过 `./scripts/dx build contracts` 产出 `packages/api-contracts/src/generated/backend.ts`
- 命令系统和环境变量规范见 `conventions.md` 和 `development.md`

---

## 二、统一技术栈

| 层/模块 | 技术 | 说明 |
| --- | --- | --- |
| 后端 | NestJS 11.1.5、Prisma 7.0.1、PostgreSQL、ioredis、nestjs-cls、winston | REST + Swagger，CLS 事务封装，winston 控制 `LOG_LEVEL/LOG_CONTEXT_FILTER` |
| 前端（front） | Next.js 15.4.7、React 18.2.0、Redux Toolkit 2.6.1、shadcn/ui、Radix、TailwindCSS 4.0.6 | App Router + server actions，所有 API 走 `@ai/api-contracts` 封装的 `lib/api.ts` |
| 管理端（admin-front） | Next.js 15.4.6、React 19.0.0、Ant Design 5.26.7、Zustand 5.0.7 | 采用最新 React 19 流水线，API 入口同样集中在 `src/lib/api.ts` |
| 集成 | Resend（邮件）、ws（WebSocket）、ethers（区块链）、hyperliquid | 外部服务集成 |
| 开发工具 | Nx 19.8.14、TypeScript 5.9.2、ESLint @antfu 4.10.1、Prettier 3.6.2、husky/lint-staged | 所有命令通过 `./scripts/dx` 统一入口执行 |

---

## 三、后端核心模块

### 3.1 访问控制与系统治理

- `auth`：JWT、RBAC、`@CurrentUser` 解构、刷新 Token、登录限制
- `admin`：后台用户/角色/菜单 API，依赖 `RequireAuth` + `AppResource` 鉴权
- `settings`：站点配置 CRUD、系统级 toggle，与 Prisma `SystemSetting` 表联动
- `user`：用户管理

### 3.2 业务模块

- `markets`：市场数据聚合
- `crypto-stock-quotes`：加密货币与股票行情
- `open-interest`：持仓量数据
- `liquidation-heatmap`：清算热力图
- `whale-alert`：大户监控
- `data-sync`：数据同步任务
- `exchange-config`/`orderbook-config`/`trades-config`：交易所配置

### 3.3 基础设施

- `health`：`/health` 探针，包含数据库/缓存状态
- `common`：EnvService、事务拦截器、DomainException、`TransactionEventsService`
- `config`：环境配置
- Prisma 集成：`apps/backend/prisma/schema/*.prisma` + `prisma/seed.ts`

---

## 四、跨层工具与依赖

- **共享类型**：`packages/shared` 暴露 ErrorCode、DTO、货币/时间工具，禁止引用框架或 Node-only 依赖
- **环境加载**：`packages/config` 暴露 `loadEnvironment()`，入口文件必须在创建 Nest/Next App 之前调用
- **API 合约链路**：后端构建 → OpenAPI JSON → `packages/api-contracts/src/generated/backend.ts` → 前后端 `aiBackendClient`
- **测试与命令**：见 `conventions.md`「测试约定」和 `development.md`「命令系统」

---

## 五、延伸阅读

- `@ruler/conventions.md`：代码规范、事务/模块约束。
- `@ruler/development.md`：命令系统、测试流程、种子数据处理。
- `@ruler/git-workflow.md`：Issue/分支/提交规范。
- `@ruler/linus-thinking.md`：Linus 风格决策框架。

以上仅覆盖宏观架构，如需执行层面的细化规则，请继续查阅对应文档。
