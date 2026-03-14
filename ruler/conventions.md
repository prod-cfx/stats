# 开发规范与约束

## 1) 输出与命令

- 输出语言：中文
- 运行时基线：Node.js `>=20.19.0`，pnpm `10.28.2`
- 命令入口：本地与 CI 统一走 `dx`，所有命令从仓库根目录执行
- dx 安装：`pnpm add -g @ranger1/dx@latest`
- pnpm 规则：允许 `pnpm install`；允许仓库脚本内部或 `dx` 内部使用 `pnpm --filter ...`；日常开发不要绕过 `dx` 直接执行 build/start/db/test/lint
- 构建策略：直接构建目标应用或包，不要手工按依赖链逐个构建；优先使用 `dx build <target> --dev|--prod`

## 2) 环境文件与配置策略

- 禁止创建根目录 `.env` / `.env.local`
- 禁止提交任何 `.env.*.local`
- 允许提交 `.env.<env>`，支持 `development|staging|production|test|e2e`
- `.env.<env>` 中敏感值占位统一使用 `__SET_IN_env.local__`
- 真实敏感值仅放在 `.env.<env>.local`
- `dx/config/env-policy.jsonc` 为必需文件；新增或调整环境变量时必须同步更新
- `quantify` 使用独立环境变量前缀，核心变量包括：`QUANTIFY_DATABASE_URL`、`QUANTIFY_REDIS_URL`、`QUANTIFY_APP_SECRET`、`QUANTIFY_JWT_SECRET`

## 3) 代码风格与类型

- 2 空格缩进、LF
- ESLint 使用 `@antfu/eslint-config`，格式化使用 Prettier
- TypeScript 默认严格模式
- 禁止裸 `any`；优先使用 `unknown`、泛型、类型守卫或更精确的联合类型
- 类型断言缩到最小作用域，不要用大范围 `as`

## 4) 路径与共享包

- 优先使用路径别名，如 `@ai/shared`、`@net/config`、`@/*`
- 避免跨模块深层相对路径
- `@ai/shared` 只放跨端可复用的纯函数、常量、类型与通用能力
- 需要 Node 专属实现时，优先放在 `@ai/shared/node` 或服务端应用内部，不要把 Node 依赖混入通用前端导出

## 5) NestJS / Prisma 约定

- Controller 负责请求解析、鉴权与响应装配；业务逻辑放在 Service
- DTO / 校验统一使用 class-validator / class-transformer 装饰器
- 当前用户：单字段优先 `@CurrentUser('id') userId`；多字段使用 `@CurrentUser() user: AuthenticatedUser`
- Backend Prisma Schema：`apps/backend/prisma/schema/*.prisma`
- Quantify Prisma Schema：`apps/quantify/prisma/schema/*.prisma`
- Prisma 工作流：
  - 改 schema
  - `dx db format`
  - `dx db generate`
  - `dx db migrate --dev --name <name>`
  - 非开发环境使用 `dx db deploy --<env>`
- Quantify 数据库命令使用对应目标：`dx db format quantify --dev`、`dx db generate quantify --dev`、`dx db migrate quantify --dev --name <name>`、`dx db deploy quantify --<env>`
- Backend DTO / OpenAPI 变更后，执行 `dx build contracts --dev` 更新 `@ai/api-contracts`

## 6) 事务规范

- 事务边界只允许放在 controller / resolver，使用 `@Transaction()`
- service / repository / subscriber 中禁止自行声明事务边界
- 事务内禁止直接做外部 I/O
- 事务提交后的外部副作用统一挂到 `TransactionEventsService.afterCommit(() => ...)`
- SSE / stream 等长连接或流式接口禁止开启事务

## 7) 分页、异常与接口契约

- 分页请求 DTO 继承 `BasePaginationRequestDto`
- 分页响应 DTO / 返回结构复用 `BasePaginationResponseDto`
- 所有业务异常必须使用 `DomainException` 或其子类，并带 `ErrorCode`
- 禁止直接抛仅带字符串的 `BadRequestException` / `HttpException`
- 新增错误码时同步修改 `packages/shared/src/constants/error-codes.ts`
- 新增领域异常时放入对应模块 `exceptions/*.exception.ts`，并补充对应 spec

## 8) 测试约定

- 主门禁优先级：后端与 Quantify 的 E2E / 单测，高于前端零散测试
- Backend E2E：`dx test e2e backend <file-or-dir> [-t "case name"]`
- Quantify E2E：`dx test e2e quantify <file-or-dir>`
- Backend 单测：`dx test unit backend`
- Quantify 单测：`dx test unit quantify`
- 避免无参全量跑大型 E2E；优先按影响范围逐文件、逐目录执行
- 前端与管理端在 Nx 中存在 `test` / `type-check` 目标，但当前统一规范仍未把它们纳入默认提交门禁

## 9) 前端与日志约定

- 构建期日志等级：Next.js 使用 `NEXT_PUBLIC_LOG_LEVEL`
- 运行期临时覆盖：`localStorage.logLevel`
- 前端运行配置优先通过 `NEXT_PUBLIC_*` 变量暴露，不要把服务端私密变量直接带入浏览器
- Web 应用固定端口：front=`3001`，admin=`3500`

## 10) 变更风险评估

- 说明 API / 数据结构是否存在破坏性变更
- 说明兼容性如何保证，遵循 Never break userspace
- 高风险改动需要给出证据，如测试结果、回滚点、迁移策略
