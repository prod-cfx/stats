# 开发规范与约束

## 1) 输出与命令

- 输出语言：中文
- 命令入口：本地与 CI 统一走 `dx`（从仓库根目录执行）
- pnpm 规则：允许 `pnpm install`；允许仓库预置的 `pnpm *:ci`（CI/脚本用途）；除此之外禁止人工直接用 pnpm 执行 build/start/db/migrate（`dx` 内部封装调用 pnpm 属于允许场景）
- 构建约定：直接运行目标 `dx build <target> --<env>`；依赖与缓存由 Nx 负责，不做手工“按依赖顺序逐个编译”
- 环境文件：禁止提交任何 `.env.*.local`；禁止创建根目录 `.env`（存在会直接报错）

## 2) 代码风格与类型

- 2 空格缩进、LF；ESLint @antfu + Prettier；TypeScript 严格模式
- 禁止裸 `any`；必要时用 `unknown`/泛型/类型守卫；类型断言缩到最小作用域

## 3) 路径与共享包

- 优先使用路径别名（如 `@ai/shared`、`@ai/api-contracts`、`@/*`），避免跨模块相对路径
- `@ai/shared` 只放纯函数/常量/类型（禁止框架/Node 专属依赖）
- `@ai/api-contracts` 提供 Zod schemas 和 Zodios 类型安全客户端；前端 HTTP 请求统一通过 `lib/api/` 下的模块函数调用，禁止直接 `fetch/axios` 访问后端

## 4) NestJS/Prisma 约定

- 后端三层架构：**Controller → Service → Repository**
  - **Controller**：处理 HTTP 请求、鉴权、DTO 验证；调用 Service；声明事务边界（`@Transactional()` / `@TransactionalWithAfterCommit()`）
  - **Service**：业务逻辑；只注入 Repository（禁止注入 `PrismaService` 或直接访问数据库）；通过 Repository 完成所有数据操作
  - **Repository**：封装 Prisma 数据访问；注入 `PrismaService` + `TransactionHost<TransactionalAdapterPrisma>`；通过 `getClient()` 获取当前事务客户端（`txHost.tx`），自动参与事务
- 禁止跨层调用：Controller 不直接调用 Repository；Service 不直接使用 Prisma client
- 当前用户：`@CurrentUser('id') userId`；需要多字段用 `@CurrentUser() user: AuthenticatedUser`
- Prisma schema：`apps/backend/prisma/schema/*.prisma`
- Prisma 工作流：改 schema -> `dx db format` -> `dx db generate` -> `dx db migrate --dev --name <name>`（仅创建迁移）-> `dx db deploy --dev|--e2e|--prod`（应用迁移）

## 5) 事务规范（Issue #465）

**基础设施组件（`nestjs-cls` + `@nestjs-cls/transactional`）：**

| 组件 | 位置 | 职责 |
|------|------|------|
| `ClsModule` | `common/cls.module.ts` | 全局 CLS 上下文，挂载 `TransactionalAdapterPrisma` |
| `@Transactional()` | `@nestjs-cls/transactional` | 开启事务，纯持久化场景 |
| `@TransactionalWithAfterCommit()` | `common/decorators/` | 开启事务 + 标记 `NEEDS_AFTER_COMMIT` 元数据 |
| `AfterCommitInterceptor` | `common/interceptors/` | HTTP 响应后排空 afterCommit 任务队列（RxJS `tap()`） |
| `TransactionEventsService` | `common/services/` | 管理 afterCommit 回调队列；为非 HTTP 场景提供 `withAfterCommit()` |

**各层事务职责：**

- **Controller 层 — 声明事务边界：**
  - `@Transactional()` — 无 afterCommit 需求的方法
  - `@TransactionalWithAfterCommit()` — 调用链中使用了 `txEvents.afterCommit()` 的方法
  - 注意：使用了 `@Transactional()` 的 controller 方法不会触发 `AfterCommitInterceptor`，若其 service 调用链中存在 `txEvents.afterCommit()` 回调则不会被执行
- **Service 层 — 事务透明参与：**
  - 大多数 Service 是事务无感知的，直接调用 Repository
  - 允许的传播声明：
    - `@Transactional(Propagation.Mandatory)` — 声明"必须在事务中被调用"，否则运行时报错
    - `@Transactional(Propagation.Supports)` — 有事务就加入，无事务也正常执行
  - 禁止 Service 使用 Required / RequiresNew / Nested 等自行创建事务的传播类型
- **Repository 层 — 自动参与事务：**
  - 通过 `txHost.tx` 获取当前事务客户端（推荐封装 `getClient()` 方法）
  - 禁止直接使用 `prisma.$transaction()`，统一走 `TransactionHost` 抽象

**外部副作用：**
- 事务中禁止直接做外部 I/O（发消息、调第三方等）
- 统一用 `txEvents.afterCommit()` 延迟到事务提交后执行

**非 HTTP 场景（Subscriber / Scheduler / 后台任务）：**
- Subscriber（Bull Job）：使用 `txEvents.withAfterCommit()` 包裹处理逻辑
- Scheduler（Cron）：使用 `cls.run()` + `txHost.withTransaction()` 手动创建 CLS 作用域和事务
- 禁止在非 HTTP 场景使用 `@Transactional()` 装饰器（无 HTTP 生命周期，拦截器不会触发）

**流式接口（SSE/stream）：**
- 禁止加事务装饰器（`AfterCommitInterceptor` 使用 RxJS `tap()`，会在首次事件发射时提前排空队列）

## 6) 测试约定

- 主要门禁：后端 E2E（Jest，`apps/backend/e2e/`），优先按文件/目录指定运行，减少不必要的测试时间
- 后端命令：`dx test e2e backend <file-or-dir> [-t "case name"]`
- E2E 并行：已支持多 worker 并行执行（`maxWorkers: 8`）。每个 worker 自动创建独立的 PostgreSQL 数据库和隔离的 Redis keyspace，互不干扰。测试结束后自动清理；异常终止的残留在下次启动时按 24 小时过期策略回收
- 前端单测：`apps/front` 与 `apps/admin-front` 统一使用 Vitest，统一入口为 `dx test unit front` / `dx test unit admin`
- 日常增量验证：按改动范围执行 `dx test unit front`、`dx test unit admin`；避免无差别全量测试
- 后端单测现状：仓库存在并维护 Jest spec（典型：`apps/backend/src/modules/**/exceptions/*.spec.ts`）；常规流程不要求全量跑单测，按需按文件运行即可

## 7) 错误处理（统一错误码）

- 所有业务异常必须是 `DomainException` 或其子类，并携带 `ErrorCode`（位于 `@ai/shared`）
- 禁止：`BadRequestException('字符串')` / `HttpException` 无 code
- 新增异常：
  - 增加错误码：`packages/shared/src/constants/error-codes.ts`
  - 新增异常类：`apps/backend/src/modules/<module>/exceptions/*.exception.ts`
  - 新增 spec：`apps/backend/src/modules/<module>/exceptions/*.exception.spec.ts`

## 8) 前端目录与命名规范（Issue #3610）

**文件命名：**
- `.tsx` 组件文件：PascalCase（如 `ChatPanel.tsx`、`CharacterCard.tsx`）
- `.ts` 非组件文件（工具、常量、类型）：kebab-case（如 `sort-mappings.ts`、`announcement-popup.storage.ts`）
- `.ts` hooks 文件：camelCase（如 `useChat.ts`、`useConfigTest.ts`）

**目录命名：**
- `components/` 下子目录统一用**单数**按业务域划分（如 `character/`，禁止 `characters/`）
- 禁止在 `components/` 根目录散放文件；按业务域归入子目录

**ui/ 目录约定：**
- `ui/` 仅存放 shadcn 原生组件，保持 kebab-case（如 `button.tsx`、`dialog.tsx`）
- 自定义业务 UI 组件放到对应业务域目录（如 `components/character/`），不放 `ui/`

**Provider 归集：**
- 全局 Provider 统一放 `components/provider/`
- 业务 Provider 就近放置在所属业务域目录

**常量归集：**
- 应用级常量统一放 `constants/` 目录
- 禁止在 `lib/` 或 `components/` 内新建常量文件

**hooks 归集：**
- 通用 hooks 放 `hooks/`
- store 模块 hooks 放 `store/modules/*/hooks.ts`
- 业务 hooks 就近放在组件目录

**barrel 导出：**
- 高频消费目录（`ui/`、`auth/`、`character/` 等）添加 `index.ts` 统一导出

## 9) 变更风险评估（写在 PR/说明里即可）

- API/数据是否破坏性
- 兼容性如何保证（Never break userspace）
- 高风险变更给出证据（测试结果/回滚点）
