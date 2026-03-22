# Quantify E2E 测试基础设施对齐设计

## 背景

`apps/backend/` 的 E2E 测试基础设施经过 #496 改造后已成熟，包含临时数据库隔离、Redis 清理、环境校验工具、三类 API 客户端、并行执行等能力。`apps/quantify/` 的 E2E 基础设施尚未对齐，存在多项差距。

**核心约束：Quantify 是独立项目，可能单独移走，因此不共享任何 E2E 基础设施代码，所有改动完全自包含。**

## 决策记录

| 决策项 | 选择 | 理由 |
|--------|------|------|
| 数据库初始化 | `prisma migrate deploy` | 与 Backend 一致，更接近生产行为 |
| Redis 清理 | 需要 | Quantify 使用 Redis（Bull、缓存、消息总线） |
| `onBeforeInit` hook | 不加 | Quantify E2E 当前不需要 mock guards |
| API 客户端 | 拆成三个 | 语义清晰，与 Backend 一致 |
| Jest 并行度 | `maxWorkers: "50%"` | 提速，对齐 Backend |
| 环境校验工具 | 抽出独立文件 | 职责分离，结构一致 |

## 变更设计

### 1. `e2e/setup-e2e.ts` — 全局生命周期

#### 1.1 数据库初始化

- 将 `npx prisma db push` 替换为 `npx prisma migrate deploy`
- 保留 seed 逻辑（seed 失败非致命，仅警告）
- 临时数据库命名格式不变：`test_db_YYYYMMDDHHmmss_<hex>`

#### 1.2 Redis 清理

新增 Redis 清理逻辑，参照 Backend 实现但独立编写：

- **清理 key 模式**：
  - `e2e:{dbName}:cache:*`
  - `e2e:{dbName}:*`
  - `throttle:*:e2e:{dbName}::*`
- **清理方式**：使用 SCAN + DEL（避免阻塞 Redis）
- **历史清理**：启动时可选清理旧 key（`E2E_CLEANUP_OLD_RESOURCES=true`）
- **Redis 连接**：从 `QUANTIFY_REDIS_URL` 读取

#### 1.3 Teardown

- 保留现有数据库 teardown（`pg_terminate_backend` + `DROP DATABASE`）
- 新增 Redis key 清理步骤

### 2. `e2e/helpers/setup-e2e-env.ts` — 新增

从 `setup-e2e.ts` 抽出环境校验逻辑：

```typescript
// 校验 APP_ENV 是否为 e2e/test，缺失时自动设置
ensureE2eEnv(options?: { autoSet?: boolean }): void

// 注入环境变量默认值（不覆盖已有值）
ensureE2eDefaults(defaults: Record<string, string>): void
```

- 自动 `chdir` 到 monorepo root 保证 Prisma config 加载
- 校验 `QUANTIFY_DATABASE_URL` 包含 'e2e' 或 'test'

### 3. `e2e/fixtures/fixtures.ts` — API 客户端三分

#### 当前

```typescript
createApiClient(app: INestApplication, token?: string): ApiClient
```

#### 改为

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

### 4. `e2e/jest-e2e.json` — 并行度提升

```diff
- "maxWorkers": 1
+ "maxWorkers": "50%",
+ "workerIdleMemoryLimit": "512MB"
```

### 5. 现有测试文件适配

所有使用 `createApiClient(app, token)` 的测试文件需改为 `createAuthApiClient(app, token)`。涉及文件：

- `exchange-accounts/exchange-accounts.e2e-spec.ts`
- `strategy-subscriptions/strategy-subscriptions.e2e-spec.ts`
- `trading/trading.e2e-spec.ts`
- 其他传入 token 参数的测试文件

无 token 的调用（如 `createApiClient(app)`）无需改动。

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `e2e/setup-e2e.ts` | 修改 | migrate deploy + Redis 清理 |
| `e2e/helpers/setup-e2e-env.ts` | 新增 | 环境校验工具函数 |
| `e2e/fixtures/fixtures.ts` | 修改 | API 客户端拆为三个 |
| `e2e/jest-e2e.json` | 修改 | maxWorkers + workerIdleMemoryLimit |
| `e2e/*/\*.e2e-spec.ts` | 修改 | 适配新 API 客户端签名 |

## 风险评估

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| API 客户端签名变更 | 所有现有测试需更新 import/调用 | 全量搜索替换，逐文件验证 |
| `migrate deploy` 依赖完整迁移历史 | 迁移链断裂会导致 DB 初始化失败 | 实施前验证 Quantify migration 历史完整性 |
| 并行化暴露隐式状态依赖 | 测试间数据竞争导致偶发失败 | 逐步切换，先跑一轮并行确认稳定性 |
| Redis 清理逻辑与 Quantify key 模式不匹配 | 残留 key 污染后续测试 | 实施时确认 Quantify 实际使用的 Redis key 模式 |

## 不动的部分

- `e2e/helpers/supertest-compat.ts` — 已与 Backend 一致
- `e2e/tsconfig.json` — 保持现有
- 领域子目录结构 — 保持现有
- `createTestingApp()` 接口 — 不加 `onBeforeInit`
