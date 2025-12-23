# 开发规范与约束

## 一、输出与命令约束

- ✅ **输出语言**：所有对外/对用户回复统一使用中文。
- ⛔ **禁用包管理器命令**：**绝对禁止**使用 `pnpm`、`npm`、`yarn`、`npx` 等包管理器命令。所有操作必须通过 `./scripts/dx` 执行。
- ✅ **命令入口**：默认使用 `./scripts/dx <command>`，该 CLI 会注入 `.env.<env>(.local)`、执行端口清理与危险操作确认；只有在 `dx` 明确不支持且用户明确要求时，才可调用 `pnpm nx ...`。
- ✅ **工作目录**：所有命令从仓库根目录执行，依赖 Nx `project.json` 相对路径。
- ✅ **环境校验**：`./scripts/dx` 自带 env 校验，无需手动运行 check-env。
- ⛔ **环境变量**：禁止提交 `.env*.local`，敏感值放本地；`.env` 根文件如果存在将被 CLI 判为错误。
- ⛔ **文件存储**：遵循 `apps/backend/src/config/s3.config.ts`，所有文件需走 S3/R2；禁止写入宿主磁盘。
- ⛔ **控制器职责**：Controller 做请求解析、鉴权、DTO 校验；业务逻辑放 Service 层。

---

## 二、代码风格

- Prettier（`prettier.config.js`）：2 空格、100 列、单引号、无分号、Tailwind 排序。
- ESLint：`@antfu/eslint-config` + React + TypeScript，CI 必须 `./scripts/dx lint` 通过；`lint-staged` 会自动跑 `prettier` + `eslint --fix`。
- TypeScript：`tsconfig.base.json` 开启装饰器、严格模块解析；`skipLibCheck` 仅限外部依赖。

---

## 三、路径映射

- `@ai/shared` / `@ai/shared/*`：跨端常量、ErrorCode、DTO、纯函数；禁止依赖 Nest/React/Node-only 包。
- `@ai/api-contracts`：Zod schema + HTTP 客户端；前后端通过它共享 API 类型。
- `@net/config`：统一加载 `.env`，`apps/backend/src/main.ts` 已接入；新增入口（Next `next.config.js`、脚本等）必须在创建应用前调用 `loadEnvironment()`。
- `@/*`：仅后端使用，指向 `apps/backend/src`。

---

## 四、类型约束

- `@typescript-eslint/no-explicit-any` 在全局关闭，但领域代码仍需避免裸 `any`；只能在桥接第三方 SDK、测试桩或 `openapi-zod-client` 生成代码附近使用，并附带最小范围包裹。
- 公共 API、DTO、Service 返回值必须提供精确类型；如需部分字段可选，优先写 DTO + Zod schema。
- 类型断言需限制作用域，避免传播到调用层；使用 type guard/泛型/`unknown` 替代。

---

## 五、架构原则

### 5.1 NestJS 后端

- 模块结构：`controller` + `service` + `dto` + `exceptions` + `repositories`；所有模块经 `AppModule` 注册。
- 控制器处理请求、鉴权、参数校验，繁重逻辑移入 service/repository。
- Swagger 必须覆盖新的 DTO（`@ApiOkResponse` / `@ApiCreatedResponse`）；`nx run backend:swagger` 输出结果是 `./scripts/dx contracts` 的输入。
- 统一用户上下文：`@CurrentUser('id')` 获取 `userId`；仅在必须访问 `req/res` 时使用 `@Req()`。

### 5.2 Prisma 使用

- Schema 文件：`apps/backend/prisma/schema.prisma`；迁移生成在 `apps/backend/prisma/migrations/`。
- 工作流：修改 schema → `./scripts/dx db format` → `./scripts/dx db generate` → `./scripts/dx db migrate --dev --name <migration>`。
- 种子脚本：`apps/backend/prisma/seed.ts`（初始化角色、管理员、菜单、AI Provider Key）；运行 `./scripts/dx db seed --dev` 需要预先配置 `UNIAPI_API_KEY` 等变量。
- Schema 引导：使用枚举（如 `ExchangeId`、`AdminMenuType`）替代硬编码字符串；`@map` 统一数据库列命名。

### 5.3 前端约定

- `apps/front`：Next.js 15.4.7 App Router + React 18.2，Redux Toolkit 状态管理；全局 API 封装在 `src/lib/api.ts`，只引用 `@ai/api-contracts` 导出的 `aiBackendClient`。
- `apps/admin-front`：Next.js 15.4.6 + React 19，Ant Design 5 + Zustand；同样通过 `src/lib/api.ts` 统一请求，严禁在页面中手写 `fetch`。
- UI 组件：用户端使用 shadcn/ui + Radix + Tailwind；管理端使用 AntD 主题；全局样式分别位于 `apps/front/src/app/globals.css` 与 `apps/admin-front/src/app/globals.css`。
- 环境变量：Next 需要 `NEXT_PUBLIC_API_BASE_URL`、`APP_ENV`，可选 `NEXT_PUBLIC_LOG_LEVEL`（仅在 `apps/front/scripts/check-env.js` 做合法性提示）。

### 5.4 事务管理（CLS + Prisma）

- 事务入口：只允许在 HTTP 控制器上使用 `@Transaction()`；装饰器注入 `TransactionInterceptor`，自动将 `PrismaService.runInTransaction` 与 `nestjs-cls` 结合。
- Service/Repository 通过 `this.prisma.runInTransaction` 获取当前事务客户端；禁止在这些层面显式开启/提交事务。
- 非 HTTP 场景（消息、定时任务）使用 `ClsService.run(() => prisma.runInTransaction(...))`。
- 流式接口/SSE 不包事务；外部副作用在事务结束后由 `TransactionEventsService.afterCommit()` 触发。

### 5.5 模块依赖与关键模式

- 核心依赖：`PrismaModule`、`ConfigModule`、`CacheModule`（Redis）必须在使用方模块的 `imports` 中声明。
- 认证集成：模块通过依赖 `AuthModule` 并使用 `@RequireAuth()` + RBAC 装饰器（`ReadAny(AppResource.X)`）限制访问。
- 跨模块通信：通过 Nest DI 注入导出的 service，禁止直接实例化或者跨目录引用内部实现。
- API 合约：任何调整 DTO/Controller 必须运行 `./scripts/dx contracts` 并提交 `packages/api-contracts` 改动。

### 5.6 快速参考

- **分页 DTO**：继承 `apps/backend/src/common/dto/base.pagination.request.dto.ts` 中的 `BasePaginationRequestDto`。
- **固定端口**：backend=3000、front=3001、admin-front=3500（`scripts/config/commands.json` 亦会自动清理端口）。
- **ENV 优先级**：`.env.<env>.local` > `.env.<env>`；`packages/config` 已内置校验。

---

## 六、环境管理

- `.env.example` 仅存放占位符（统一 `__SET_IN_env.local__`）。
- `.env.<env>` 可提交的非敏感配置；`.env.<env>.local` 存放个人密钥（gitignored）。
- `packages/config/loadEnvironment()` 已在 Nest `bootstrap` 中调用；Next.js 配置（`apps/front/next.config.js`、`apps/admin-front/next.config.js`）也会在导出前执行同一 helper。新增入口务必复用该模式，禁止绕过直接访问 `process.env`。

---

## 七、测试约定

- 重点维护 `apps/backend/e2e/`；单位测试目标仍在 scaffold 状态。
- 运行方式：`./scripts/dx test e2e backend [file] [-t "case"]`；命令支持按文件+`-t` 精准筛选。
- main 分支提交、PR 创建必须完成受影响用例回归；CI via `./scripts/dx prcheck --prod` 会复跑。

---

## 八、安全规范

- API 默认开启 JWT + RBAC（`nest-access-control`），公开接口需显式标注匿名访问。
- 限流使用 `@nestjs/throttler`，输入校验使用 `class-validator` / `class-transformer`。
- 文件/对象存储必须走 S3/R2（参考 `apps/backend/src/config/s3.config.ts`），禁止写入本地磁盘。
- 环境变量通过 `packages/config` 强校验；缺失变量在 `./scripts/dx` 阶段即失败。

---

## 九、错误处理规范

- ErrorCode 枚举位于 `@ai/shared/constants/error-codes.ts`；前后端共享。
- 自定义业务异常继承 `DomainException`，禁止直接抛出 `BadRequestException('字符串')`。
- 创建新异常：新增 ErrorCode → 在模块 `exceptions/` 目录创建异常类 → 添加最少的单元测试（可在同目录 `.spec.ts`）→ 前端增加本地化消息。
- 响应结构：`{ status, error: { code, args, requestId }, timestamp, path }`，不要返回未结构化字符串。

---

> 以上规则若与运行代码冲突，以当前仓库实现为准，若需例外必须在 PR 描述中说明理由。
