# 开发规范与约束

## 1) 输出与命令

- 输出语言：中文
- 运行时基线：Node.js `>=20.19.0`，pnpm `10.28.2`
- 命令入口：本地与 CI 统一走 `dx`（所有命令从仓库根目录执行）
- dx 安装：`pnpm add -g @ranger1/dx@latest`
- pnpm 规则：允许 `pnpm install`；允许仓库脚本内部/`dx` 内部使用 `pnpm --filter ...`；日常开发禁止绕过 `dx` 直接执行 build/start/db/test/lint 流程
- 环境文件：禁止创建根目录 `.env` / `.env.local`（存在会直接报错）；禁止提交任何 `.env.*.local`
- 环境模板：允许提交 `.env.<env>`（支持 `development|staging|production|test|e2e`，且必须使用占位符 `__SET_IN_env.local__`，真实值仅放在 `.env.<env>.local`）
- dx 环境策略：`dx/config/env-policy.jsonc` 为必需（新增/调整环境变量时必须同步）

## 2) 代码风格与类型

- 2 空格缩进、LF；ESLint @antfu + Prettier；TypeScript 严格模式
- 禁止裸 `any`；必要时用 `unknown`/泛型/类型守卫；类型断言缩到最小作用域

## 3) 路径与共享包

- 优先使用路径别名（如 `@ai/shared`、`@/*`），避免跨模块相对路径
- `@ai/shared` 只放纯函数/常量/类型（禁止框架/Node 专属依赖）

## 4) NestJS/Prisma 约定

- 后端分层：controller 处理请求与鉴权；业务进 service；DTO/验证用装饰器
- 当前用户：`@CurrentUser('id') userId`；需要多字段用 `@CurrentUser() user: AuthenticatedUser`
- Prisma schema：`apps/backend/prisma/schema/*.prisma`
- Prisma 工作流：改 schema -> `dx db format` -> `dx db generate` -> `dx db migrate --dev --name <name>`（仅创建迁移）-> `dx db deploy --<env>`（应用迁移）
- 后端 DTO/API 变更后：执行 `dx build contracts --dev` 更新 `@ai/api-contracts`

## 5) 事务规范（Issue #465）

- 事务边界：只允许在 controller/Resolver 使用 `@Transaction()`；service/repository/subscriber 禁用
- 外部副作用：事务中禁止直接做外部 I/O；统一用 `TransactionEventsService.afterCommit(() => ...)`
- 流式接口（SSE/stream）：禁止开启事务

## 6) 测试约定

- 主要门禁：后端 E2E（`apps/backend/e2e/`），默认按文件/目录逐个运行，避免无参全量执行（仅在必要时全量）
- 命令：`dx test e2e backend`（全量）或 `dx test e2e backend <file-or-dir> [-t "case name"]`（推荐，按影响范围执行）
- 单测现状：后端维护 Jest spec（典型：`apps/backend/src/modules/**/exceptions/*.spec.ts`）；常规流程不要求全量跑单测，按需按文件运行

## 7) 错误处理（统一错误码）

- 所有业务异常必须是 `DomainException` 或其子类，并携带 `ErrorCode`（位于 `@ai/shared`）
- 禁止：`BadRequestException('字符串')` / `HttpException` 无 code
- 新增异常：
  - 增加错误码：`packages/shared/src/constants/error-codes.ts`
  - 新增异常类：`apps/backend/src/modules/<module>/exceptions/*.exception.ts`
  - 新增 spec：`apps/backend/src/modules/<module>/exceptions/*.exception.spec.ts`

## 8) 变更风险评估（写在 PR/说明里即可）

- API/数据是否破坏性
- 兼容性如何保证（Never break userspace）
- 高风险变更给出证据（测试结果/回滚点）
