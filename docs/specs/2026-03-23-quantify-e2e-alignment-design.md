# Quantify E2E 测试基础设施对齐设计

## 背景

`apps/backend/` 的 E2E 测试基础设施经过 #496 改造后已成熟，包含临时数据库隔离、Redis 清理、环境校验工具、三类 API 客户端、并行执行等能力。`apps/quantify/` 的 E2E 基础设施尚未对齐，存在多项差距。

**核心约束：Quantify 是独立项目，可能单独移走，因此不共享任何 E2E 基础设施代码，所有改动完全自包含。**

## 决策记录

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 数据库初始化 | 保留 `prisma db push` | Quantify 无 migration history，`migrate deploy` 不可行 |
| Redis 清理 | 需要 | Quantify 使用 Redis（Bull、缓存、消息总线） |
| `onBeforeInit` hook | 不加 | Quantify E2E 当前不需要 mock guards |
| API 客户端 | 拆成三个 | 语义清晰，与 Backend 一致 |
| Jest 并行度 | `maxWorkers: "50%"` | 提速，对齐 Backend |
| 环境校验工具 | 抽出独立文件 | 职责分离，结构一致 |
| psql 依赖 | 迁移到 Node.js `pg` client | 消除系统 psql 依赖，CI 兼容性更好 |

## 变更设计

### 1. `e2e/setup-e2e.ts` — 全局生命周期

#### 1.1 数据库初始化

- 保留 `npx prisma db push`（Quantify 无 migration history，与 Backend 此处有意差异）
- 保留 seed 逻辑（seed 失败非致命，仅警告）
- 临时数据库命名格式不变：`test_db_YYYYMMDDHHmmss_<hex>`

#### 1.2 psql → Node.js `pg` client

当前 `setup-e2e.ts` 使用 shell `psql` 命令（`execSync` + `PGPASSWORD=...`），存在系统依赖问题：

- 迁移为 Node.js `pg` 包 + `execFileSync`，与 Backend 的 `executePgCommand` 模式一致
- 消除 `psql` 系统依赖，提升 CI 兼容性（Docker/GitHub Actions 无需预装 psql）
- 涉及函数：`executePsqlCommand` → 重写为基于 `pg` 的 `executePgCommand`

#### 1.3 Redis 清理

新增 Redis 清理逻辑，参照 Backend 实现但独立编写：

- **清理 key 模式**：
  - `e2e:{dbName}:cache:*`
  - `e2e:{dbName}:*`
  - `throttle:*:e2e:{dbName}::*`
- **清理方式**：使用 SCAN + DEL（避免阻塞 Redis）
- **历史清理**：启动时可选清理旧 key（`E2E_CLEANUP_OLD_RESOURCES=true`，统一命名，替换当前的 `E2E_CLEANUP_OLD_DB`）
- **Redis 连接**：读取 `process.env.REDIS_URL`（注意：`QUANTIFY_REDIS_URL` 经 `quantify-env.ts` 映射后解析为 `REDIS_URL`，setup 阶段需在 `applyQuantifyEnvOverrides()` 之后读取，或直接读 `REDIS_URL`）

#### 1.4 Teardown

- 保留现有数据库 teardown（`pg_terminate_backend` + `DROP DATABASE`），改用 `pg` client
- 新增 Redis key 清理步骤
- 修复：teardown 应同时恢复 `QUANTIFY_DATABASE_URL` 和 `QUANTIFY_E2E_DATABASE_URL`（当前仅恢复 `DATABASE_URL`）

#### 1.5 超时设置

- 移除 `setup-e2e.ts` 中的 `jest.setTimeout(30000)`，统一由 `jest-e2e.json` 的 `testTimeout: 60000` 控制（消除冲突）

### 2. `e2e/helpers/setup-e2e-env.ts` — 新增

从 `setup-e2e.ts` 抽出环境校验逻辑：

```typescript
// 校验 APP_ENV 是否为 e2e/test，缺失时自动设置
ensureE2eEnv(options?: { strict?: boolean; label?: string }): void

// 注入环境变量默认值（不覆盖已有值）
ensureE2eDefaults(defaults: Record<string, string>): void
```

- 签名与 Backend 对齐（`strict` + `label` 选项）
- 自动 `chdir` 到 monorepo root 保证 Prisma config 加载
- 校验 `DATABASE_URL`（经 `QUANTIFY_DATABASE_URL` 映射后）包含 'e2e' 或 'test'

### 3. `e2e/fixtures/fixtures.ts` — API 客户端三分 + 清理死代码

#### 3.1 API 客户端拆分

当前：

```typescript
createApiClient(app: INestApplication, token?: string): ApiClient
```

改为：

```typescript
// 公开请求，自动加 /api/v1 前缀
createApiClient(app: INestApplication): ApiClient

// 带 Authorization: Bearer header
createAuthApiClient(app: INestApplication, token: string): ApiClient

// 无前缀，用于 /health、/metrics 等
createRawClient(app: INestApplication): ApiClient
```

- `ApiClient` 接口保持不变（get/post/put/patch/delete）
- `buildApiUrl()` 和 `generateRandomString()` 不变
- `createTestingApp()` 接口不变（不加 `onBeforeInit`）

#### 3.2 移除死代码

- 移除 `cleanupTestData()` — no-op 占位，临时 DB 隔离使 per-table 清理不必要
- 移除 `ensurePrismaTablesExist()` — no-op 占位，`prisma db push` 已保证 schema 同步

### 4. `e2e/jest-e2e.json` — 并行度提升

```diff
- "maxWorkers": 1
+ "maxWorkers": "50%",
+ "workerIdleMemoryLimit": "512MB"
```

### 5. 现有测试文件适配

经审计，当前 **零个测试文件** 传 token 给 `createApiClient`。所有调用均为 `createApiClient(app)`（无第二参数），因此 API 客户端签名变更 **零迁移工作量**。`createAuthApiClient` 和 `createRawClient` 是为未来测试预备的能力。

完整的 `createApiClient` 调用文件清单（10 个 spec 文件）：

- `ai/ai.e2e-spec.ts`
- `backtesting/backtesting.e2e-spec.ts`
- `cache/redis-cache.e2e-spec.ts`
- `exchange-accounts/exchange-accounts.e2e-spec.ts`
- `health/health.e2e-spec.ts`
- `llm-strategy-codegen/llm-strategy-codegen.e2e-spec.ts`
- `market-data/market-data.e2e-spec.ts`
- `strategy-signals/strategy-signals.e2e-spec.ts`
- `strategy-subscriptions/strategy-subscriptions.e2e-spec.ts`
- `trading/trading.e2e-spec.ts`

所有文件仅需确认 import 路径不变（`createApiClient` 名称和签名兼容）。

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `e2e/setup-e2e.ts` | 修改 | psql→pg client + Redis 清理 + 超时修复 + env 恢复修复 |
| `e2e/helpers/setup-e2e-env.ts` | 新增 | 环境校验工具函数（从 setup-e2e.ts 抽出） |
| `e2e/fixtures/fixtures.ts` | 修改 | API 客户端三分 + 移除死代码 |
| `e2e/jest-e2e.json` | 修改 | maxWorkers + workerIdleMemoryLimit |

## 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| psql→pg client 迁移 | DB 操作行为可能有细微差异 | 参照 Backend 已验证的 `executePgCommand` 实现 |
| 并行化暴露隐式状态依赖 | 测试间数据竞争导致偶发失败 | 逐步切换，先跑一轮并行确认稳定性 |
| Redis 清理逻辑与 Quantify key 模式不匹配 | 残留 key 污染后续测试 | 实施时确认 Quantify 实际使用的 Redis key 前缀 |
| `E2E_CLEANUP_OLD_DB` → `E2E_CLEANUP_OLD_RESOURCES` 重命名 | CI 脚本中如有引用需同步更新 | 检查 CI 配置和文档 |

## 不动的部分

- `e2e/helpers/supertest-compat.ts` — 已与 Backend 一致
- `e2e/tsconfig.json` — 保持现有
- 领域子目录结构 — 保持现有
- `createTestingApp()` 接口 — 不加 `onBeforeInit`（有意差异，未来需要时再加）
- 现有 10 个测试文件内容 — `createApiClient(app)` 签名兼容，无需改动

## 与 Backend 的有意差异

| 差异项 | Backend | Quantify | 原因 |
|--------|---------|----------|------|
| DB 初始化 | `prisma migrate deploy` | `prisma db push` | Quantify 无 migration history |
| `onBeforeInit` | 支持 | 不支持 | 当前无 guard mock 需求 |
| `createTestingApp` options | 含 `envDefaults`、`onBeforeInit` | 仅 `imports`、`globalPrefix`、`onAppInit` | 按需对齐，不过度设计 |
