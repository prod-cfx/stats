# Quantify 工程接入设计

日期：2026-03-12

## 背景

`apps/quantify` 已迁入当前 monorepo，但工程接入尚未完成。当前主要问题：

- `apps/quantify/package.json` 仍使用 `@net/backend`
- `apps/quantify/project.json` 仍通过 `pnpm --filter @net/backend` 执行
- `dx` 命令体系尚未识别 `quantify`
- `dx/config/env-policy.jsonc` 尚未定义 `quantify` target
- `quantify` 需要保持独立进程、独立端口、独立数据库连接串

本设计只覆盖工程接入范围：应用身份、环境变量、`dx` 命令、Prisma、测试、文档。

## 目标

- `quantify` 作为独立 app 接入 monorepo
- `quantify` 保持独立端口 `3010`
- `quantify` 保持独立数据库连接串
- 统一通过 `dx` 执行 `quantify` 的启动、构建、测试、数据库操作
- `backend` 仅预留 `QUANTIFY_BASE_URL`，不实现调用代码

## 非目标

- 不实现 `backend -> quantify` HTTP client
- 不实施部署流程改造
- 不设计服务间鉴权
- 不扩展消息队列、异步任务或额外拆分

## 推荐方案

采用最小工程接入方案，风格对齐 [net](/Users/zengmengdan/net)：

- `dx` 保持唯一入口
- `env-policy` 直接新增 `quantify` target
- `quantify` 只补独立 app 所需最小配置
- 不引入额外抽象层，不做过度动态规则

## 设计

### 1. 应用身份

固定参数：

- package name：`@net/quantify`
- Nx project name：`quantify`
- 默认端口：`3010`
- 健康检查路径：`/api/v1/health`
- Swagger 标题：`Quantify API`
- 日志 service name：`quantify`

约束：

- `quantify` 相关脚本、target、过滤器不得再引用 `@net/backend`
- 开发者对外只使用 `dx` 命令，不以 `pnpm --filter` / `nx` 作为公开入口
- 必须重写 [project.json](/Users/zengmengdan/coinfulx-new/stats/apps/quantify/project.json) 的关键字段：
  - `name`
  - `sourceRoot`
  - `tags`
  - `targets.build.options.command`
  - `targets.dev.options.command`
  - `targets.start.options.command`
  - `targets.test.options.command`
  - `targets.lint.options.lintFilePatterns`
  - `targets.swagger.options.cwd`（如保留）
  - `outputs`

### 2. 环境变量

沿用根级 `.env.<env>` / `.env.<env>.local` 体系，并在 `env-policy` 中新增 `quantify` target。

repo 级最小白名单变量：

- `QUANTIFY_PORT`
- `QUANTIFY_DATABASE_URL`
- `QUANTIFY_REDIS_URL`
- `QUANTIFY_APP_SECRET`
- `QUANTIFY_JWT_SECRET`
- `QUANTIFY_BASE_URL`

规则：

- 只允许以上白名单做 `QUANTIFY_* -> 标准变量` 映射
- 映射目标固定为：
  - `QUANTIFY_PORT -> PORT`
  - `QUANTIFY_DATABASE_URL -> DATABASE_URL`
  - `QUANTIFY_REDIS_URL -> REDIS_URL`
  - `QUANTIFY_APP_SECRET -> APP_SECRET`
  - `QUANTIFY_JWT_SECRET -> JWT_SECRET`
- `QUANTIFY_BASE_URL` 不映射，仅作为 `backend` 预留配置
- `dx launcher` 是唯一映射与服务级校验入口
- `packages/config` 只负责通用 env 文件加载与基础格式校验
- `quantify` runtime 只读取标准变量，不直接读取 `QUANTIFY_*`

实现边界固定如下：

- 配置入口：`dx/config/commands.json` 与 `dx/config/env-policy.jsonc`
- 代码入口：新增 [quantify-launcher.cjs](/Users/zengmengdan/coinfulx-new/stats/scripts/dx/quantify-launcher.cjs)，负责 `quantify` 的 env 解析与命令包装
- 复用原则：`start quantify`、`db * quantify`、`test * quantify` 都必须调用同一套 `resolveQuantifyEnv()` 逻辑

环境处理时序固定如下：

1. `packages/config` 加载 `.env.<env>` 与 `.env.<env>.local`
2. `dx launcher` 校验 `QUANTIFY_*` 白名单变量
3. `dx launcher` 执行 `QUANTIFY_* -> 标准变量` 映射
4. `quantify` 进程按标准变量启动

值语义：

- `undefined`、空字符串、纯空白字符串都视为未设置
- 若同名标准变量与 `QUANTIFY_*` 同时存在，以非空的 `QUANTIFY_*` 映射值优先
- 若 `QUANTIFY_*` 为空，不得覆盖已有标准变量
- 出现未声明的 `QUANTIFY_*` 变量时一律忽略，不告警、不失败、不参与映射

最小契约：

| 变量 | owner | 要求 |
|---|---|---|
| `QUANTIFY_DATABASE_URL` | quantify | required |
| `QUANTIFY_REDIS_URL` | quantify | required |
| `QUANTIFY_PORT` | quantify | optional，默认 `3010` |
| `QUANTIFY_APP_SECRET` | quantify | required |
| `QUANTIFY_JWT_SECRET` | quantify | required |
| `QUANTIFY_BASE_URL` | backend | optional，默认值仅存在于 backend config，开发环境为 `http://localhost:3010` |

错误处理矩阵：

| 触发条件 | 报错信息 | 退出码 | 位置 |
|---|---|---|---|
| `QUANTIFY_DATABASE_URL` 缺失 | `quantify database url is required` | `1` | `dx launcher` |
| `QUANTIFY_DATABASE_URL` 非 postgres URL | `quantify database url must be postgres` | `1` | `dx launcher` |
| `QUANTIFY_DATABASE_URL` 与 `DATABASE_URL` 相同 | `quantify database must not equal backend database` | `1` | `dx launcher` |
| `QUANTIFY_REDIS_URL` 缺失 | `quantify redis url is required` | `1` | `dx launcher` |
| `QUANTIFY_REDIS_URL` 非 redis URL | `quantify redis url must be redis` | `1` | `dx launcher` |
| `QUANTIFY_PORT` 非法 | `quantify port must be a valid tcp port` | `1` | `dx launcher` |
| `QUANTIFY_BASE_URL` 非法 | `quantify base url must be absolute http(s) url` | `1` | backend env validation |
| 映射后 `APP_SECRET` / `JWT_SECRET` 缺失 | `<name> is required for quantify` | `1` | `dx launcher` |

### 3. `dx` 命令

`dx` 是唯一受支持入口。新增最小命令面：

- `dx start quantify --dev`
- `dx build quantify --dev`
- `dx build quantify --prod`
- `dx test unit quantify`
- `dx test e2e quantify <file>`
- `dx db format quantify`
- `dx db generate quantify`
- `dx db migrate quantify --dev --name <name>`
- `dx db seed quantify --dev`
- `dx db seed quantify --e2e`
- `dx db reset quantify --dev`
- `dx db reset quantify --e2e`

硬约束：

- `dx start all` 不自动包含 `quantify`
- `dx test e2e quantify <file>` 中 `<file>` 必填
- `dx db reset quantify` 只允许 `dev` / `e2e`
- 不提供 `dx db reset quantify --staging|--prod`
- 兼容性要求：现有 `dx db format`、`dx db generate` 默认仍指向 backend；`dx db format quantify`、`dx db generate quantify` 为增量扩展，不破坏旧用法
- `dx` 命令必须与 [package.json](/Users/zengmengdan/coinfulx-new/stats/apps/quantify/package.json) 脚本对齐，至少包含：
  - `dev`
  - `start`
  - `build`
  - `prisma:format`
  - `prisma:generate`
  - `prisma:migrate:dev`
  - `prisma:db:seed`
  - `prisma:db:reset`
  - `test:unit`
  - `test:e2e`

### 4. Prisma 与数据库

- `quantify` 保持独立 Prisma generate / migrate / seed 流程
- `quantify` 只使用映射后的 `DATABASE_URL`
- 串库保护在 `dx launcher` 中统一执行
- `seed` 必须幂等

### 5. 测试与 CI

最小验证链：

- `dx lint`
- `dx build quantify --dev`
- `dx test unit quantify`
- `dx test e2e quantify apps/quantify/e2e/health/health.e2e-spec.ts`

CI 最小接入：

- job 名称：`quantify-verify`
- 触发文件：
  - `apps/quantify/**`
  - `packages/shared/**`
  - `packages/config/**`
  - `dx/config/**`
  - `nx.json`
  - `package.json`
  - `pnpm-lock.yaml`
  - `dx/config/env-policy.jsonc`
- 与现有 backend / front 校验并行执行
- 实现方式：`quantify-verify` always-run，但首步先做 path-filter；未命中时输出 `skipped: no quantify-related changes` 并退出 `0`
- 命中触发条件时，`quantify-verify` 是 required check

### 6. 文档

- 增加 `quantify` 独立开发文档入口
- 文档覆盖端口、数据库、seed、测试命令
- 明确 `backend` 侧只预留 `QUANTIFY_BASE_URL`

## 工作项

### A. 应用身份治理

- 修改 `apps/quantify/package.json` 包名为 `@net/quantify`
- 修改 `apps/quantify/project.json` 中错误过滤目标
- 修正 `quantify` 的端口、Swagger 名称、日志 service name
- 清理 `apps/quantify` 中遗留的 `@net/backend` 关键引用

验收：

- `dx build quantify --dev` 成功
- `dx start quantify --dev` 成功
- 全仓无 `apps/quantify` 误指向 `@net/backend` 的关键命令引用

### B. 环境变量接入

- 在 `env-policy` 中新增 `quantify` target
- 增加最小白名单变量与服务级校验
- 增加 `backend` 侧 `QUANTIFY_BASE_URL`
- 实现 `dx launcher` 的单一映射入口

验收：

- `dx start quantify --dev` 可独立校验并启动
- `dx start backend --dev` 不受 `quantify` 私有变量影响
- `curl -f http://127.0.0.1:3010/api/v1/health` 返回 `200`

### C. Prisma 与数据库接入

- 接入 `quantify` 独立 `db format/generate/migrate/seed/reset`
- 在 `dx launcher` 中加入串库保护
- 约束 `db reset` 仅限 `dev/e2e`

验收：

- `dx db generate quantify` 成功
- `dx db migrate quantify --dev --name init_quantify` 成功
- `dx db seed quantify --dev` 成功
- 当 `QUANTIFY_DATABASE_URL` 与 `DATABASE_URL` 相同，命令直接失败并输出 `quantify database must not equal backend database`

### D. 测试与 CI 接入

- 新增 `quantify` 的 unit / e2e `dx` 入口
- 接入 `quantify-verify` job
- 固定 smoke e2e 为 [health.e2e-spec.ts](/Users/zengmengdan/coinfulx-new/stats/apps/quantify/e2e/health/health.e2e-spec.ts)

验收：

- `dx test unit quantify` 成功
- `dx test e2e quantify apps/quantify/e2e/health/health.e2e-spec.ts` 成功
- 命中触发文件时，CI 产生 required check `quantify-verify`

### E. 文档补齐

- 增加 [quantify-development.md](/Users/zengmengdan/coinfulx-new/stats/docs/quantify-development.md)
- 写清本地启动、数据库、seed、测试入口

验收：

- 按文档执行 `dx start quantify --dev`
- 按文档执行 `dx db generate quantify`
- 以上命令均成功

## 里程碑

1. 身份治理
2. 环境变量接入
3. Prisma 与数据库接入
4. 测试与 CI 接入
5. 文档补齐

## 完成后状态

- `backend`：主业务服务，仅预留 `QUANTIFY_BASE_URL`
- `quantify`：独立 AI 量化服务，拥有独立端口、独立数据库、独立 `dx` 命令入口

二者共享 monorepo 基础设施，但保持运行时边界独立。
