# Quantify E2E 测试基础设施对齐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `apps/quantify/e2e/` 的测试基础设施对齐 `apps/backend/e2e/` 的成熟模式，同时保持完全独立（不共享代码），因为 Quantify 可能单独拆分为独立仓库。

**Architecture:** 四个文件变更：(1) `setup-e2e.ts` 重写 psql→pg client + 新增 Redis 清理 + 环境变量修复；(2) 新增 `helpers/setup-e2e-env.ts` 环境校验工具；(3) `fixtures/fixtures.ts` API 客户端三分 + 死代码清理；(4) `jest-e2e.json` 并行度提升。

**Tech Stack:** Jest, NestJS Testing, Supertest, PostgreSQL (`pg` npm package), Redis (`ioredis`), Prisma 7

**Prerequisites:**
- `pg` 和 `ioredis` 已在 `apps/quantify/package.json` dependencies 中（已验证）
- 实施前需创建 GitHub Issue，所有 commit 引用新 Issue 编号（非 #496，#496 已合并）

**Spec:** `docs/specs/2026-03-23-quantify-e2e-alignment-design.md`

**Reference (Backend):**
- `apps/backend/e2e/setup-e2e.ts` — pg client + Redis 清理的参考实现
- `apps/backend/e2e/helpers/setup-e2e-env.ts` — 环境校验工具参考
- `apps/backend/e2e/fixtures/fixtures.ts` — API 客户端三分参考

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/quantify/e2e/helpers/setup-e2e-env.ts` | Create | 环境校验 (`ensureE2eEnv`, `ensureE2eDefaults`) |
| `apps/quantify/e2e/setup-e2e.ts` | Rewrite | 全局生命周期：temp DB + Redis 清理 + teardown |
| `apps/quantify/e2e/fixtures/fixtures.ts` | Modify | API 客户端三分 + 移除死代码 |
| `apps/quantify/e2e/jest-e2e.json` | Modify | 并行度提升 |

---

### Task 1: 新增 `helpers/setup-e2e-env.ts`

**Files:**
- Create: `apps/quantify/e2e/helpers/setup-e2e-env.ts`
- Reference: `apps/backend/e2e/helpers/setup-e2e-env.ts`

- [ ] **Step 1: 创建 `setup-e2e-env.ts`**

参照 Backend `apps/backend/e2e/helpers/setup-e2e-env.ts`，独立编写 Quantify 版本。关键差异：`chdir` 路径需从 `helpers/` 上溯 4 级到 monorepo root（与 Backend 一致，因为目录深度相同）。

```typescript
// apps/quantify/e2e/helpers/setup-e2e-env.ts
import { resolve } from 'node:path'

/**
 * 确保 E2E 测试运行在 APP_ENV=e2e 环境下。
 *
 * - 非 strict 模式：仅在 APP_ENV 未设置时注入 'e2e'，容忍其他值
 * - strict 模式：注入 'e2e' 后拒绝非 'e2e' 值（fail-fast）
 * - 自动 chdir 到 monorepo 根目录，使 ConfigModule/Prisma 能正确加载 .env.e2e
 */
export function ensureE2eEnv(
  options: { strict?: boolean; label?: string } = {},
): void {
  const { strict = false, label = 'E2E' } = options

  if (!process.env.APP_ENV) {
    process.env.APP_ENV = 'e2e'
  }

  if (strict && process.env.APP_ENV !== 'e2e') {
    throw new Error(
      `${label} must run with APP_ENV="e2e" to avoid touching non-test databases, current: ${process.env.APP_ENV}`,
    )
  }

  // helpers/ 在 apps/quantify/e2e/helpers/，需上溯 4 级到 monorepo 根目录
  process.chdir(resolve(__dirname, '../../../..'))
}

/**
 * 为 E2E 测试提供环境变量默认值（仅在未设置时注入）。
 */
export function ensureE2eDefaults(
  defaults: Record<string, string>,
): void {
  for (const [key, value] of Object.entries(defaults)) {
    if (!process.env[key]) {
      process.env[key] = value
    }
  }
}
```

- [ ] **Step 2: 验证文件创建**

Run: `ls -la apps/quantify/e2e/helpers/setup-e2e-env.ts`
Expected: file exists

- [ ] **Step 3: Commit**

```bash
git add apps/quantify/e2e/helpers/setup-e2e-env.ts
git commit -F - <<'MSG'
refactor(quantify/e2e): 新增 setup-e2e-env 环境校验工具

从 setup-e2e.ts 抽出环境校验逻辑，与 backend E2E 结构对齐。
提供 ensureE2eEnv() 和 ensureE2eDefaults() 两个工具函数。

Refs: #496
MSG
```

---

### Task 2: 重写 `setup-e2e.ts` — psql→pg client + Redis 清理

**Files:**
- Modify: `apps/quantify/e2e/setup-e2e.ts` (全文重写，445 行 → ~540 行)
- Reference: `apps/backend/e2e/setup-e2e.ts` (整体结构参考)
- Reference: `apps/quantify/src/config/quantify-env.ts` (`applyQuantifyEnvOverrides` 函数)

这是最大的改动。将当前基于 `execSync` + shell `psql` 的实现，重写为基于 `execFileSync` + Node.js `pg` 客户端的实现，同时新增 Redis 清理逻辑。

- [ ] **Step 1: 重写 `setup-e2e.ts`**

完整重写文件。核心变更点：

**1) 顶部：调用 `applyQuantifyEnvOverrides()` + `ensureE2eEnv()`**

在任何 `process.env` 读取之前：(a) 调用 `applyQuantifyEnvOverrides()` 完成 `QUANTIFY_*` → 通用变量映射；(b) 调用 `ensureE2eEnv({ strict: true })` 替换当前 inline 的 `APP_ENV` 检查。这样当前 `setup-e2e.ts:358-376` 的 DATABASE_URL 安全校验保留，但 APP_ENV 校验委托给新的 helper。

```typescript
import { execFileSync } from 'node:child_process'
import * as crypto from 'node:crypto'
import * as path from 'node:path'
import { applyQuantifyEnvOverrides } from '../src/config/quantify-env'
import { ensureE2eEnv } from './helpers/setup-e2e-env'

// 在读取任何环境变量前，完成 QUANTIFY_* → 通用变量映射
applyQuantifyEnvOverrides()
// 确保 APP_ENV=e2e，并 chdir 到 monorepo root
ensureE2eEnv({ strict: true, label: 'Quantify E2E' })
```

**2) `executePsqlCommand` → `executePgCommand`**

参照 Backend `apps/backend/e2e/setup-e2e.ts:89-135`，使用 `execFileSync` + `require('pg')` 内联 Node.js 脚本替换 shell psql。关键实现：

```typescript
const quantifyDir = path.resolve(__dirname, '..')

function executePgCommand(connectionUrl: string, sql: string, silent = false): string {
  try {
    const pgScript = `
      const { Client } = require('pg')
      ;(async () => {
        const [connectionString, sqlCmd] = process.argv.slice(1)
        const client = new Client({ connectionString })
        await client.connect()
        const result = await client.query(sqlCmd)
        if (result.rows && result.rows.length > 0) {
          if (result.fields.length === 1) {
            const fieldName = result.fields[0].name
            for (const row of result.rows) {
              const value = row[fieldName]
              if (value !== null && value !== undefined) {
                console.log(String(value))
              } else {
                console.log('')
              }
            }
          } else {
            console.log(JSON.stringify(result.rows))
          }
        }
        await client.end()
      })().catch(async (error) => {
        try {
          if (error && error.message) {
            console.error(error.message)
          } else {
            console.error(String(error))
          }
        } finally {
          process.exit(1)
        }
      })
    `
    return execFileSync(process.execPath, ['-e', pgScript, connectionUrl, sql], {
      stdio: silent ? 'pipe' : 'inherit',
      encoding: 'utf-8',
      cwd: quantifyDir,
    })
  } catch (error) {
    throw new Error(`执行 PostgreSQL 命令失败: ${error instanceof Error ? error.message : error}`)
  }
}
```

**3) `buildDatabaseUrl` 签名对齐 Backend**

当前 Quantify 版本用 5 个参数拼装 URL，改为 Backend 模式（`baseUrl` + `database`）：

```typescript
function buildDatabaseUrl(baseUrl: string, database: string): string {
  const url = new URL(baseUrl)
  url.pathname = `/${database}`
  return url.toString()
}
```

同步修改 `parseDatabaseUrl` 返回 `originalUrl` 字段（与 Backend 一致）。

**4) 新增 `cleanupRedisKeys` 函数**

参照 Backend `apps/backend/e2e/setup-e2e.ts:258-309`，独立编写：

```typescript
function cleanupRedisKeys(dbName: string): void {
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) {
    logVerbose('[E2E teardown] 未配置 REDIS_URL，跳过 Redis 清理')
    return
  }

  const prefixes = [
    `e2e:${dbName}:cache:*`,
    `e2e:${dbName}:*`,
    `throttle:*:e2e:${dbName}::*`,
  ]

  const cleanScript = `
    const Redis = require('ioredis')
    ;(async () => {
      const [connectionUrl, ...patterns] = process.argv.slice(1)
      const redis = new Redis(connectionUrl, { lazyConnect: true, maxRetriesPerRequest: 1 })
      await redis.connect()
      let totalDeleted = 0
      for (const pattern of patterns) {
        let cursor = '0'
        do {
          const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200)
          cursor = nextCursor
          if (keys.length > 0) {
            await redis.del(...keys)
            totalDeleted += keys.length
          }
        } while (cursor !== '0')
      }
      console.log('[E2E teardown] Redis 清理完成: 删除 ' + totalDeleted + ' 个 keys')
      await redis.quit()
    })().catch(async (err) => {
      console.error('[E2E teardown] Redis 清理失败(忽略):', err.message || err)
      process.exit(0)
    })
  `

  try {
    execFileSync(process.execPath, ['-e', cleanScript, redisUrl, ...prefixes], {
      stdio: 'inherit',
      cwd: quantifyDir,
      timeout: 10000,
    })
  } catch (error) {
    console.warn('[E2E teardown] Redis 清理异常(忽略):', error instanceof Error ? error.message : error)
  }
}
```

**5) 新增 `cleanupOldRedisKeys` 函数**

参照 Backend `apps/backend/e2e/setup-e2e.ts:315-381`，独立编写。与 Backend 逻辑一致：根据 key 中的 `test_db_` 时间戳判断年龄，仅清理超龄 key。

**6) 主入口变更**

- `E2E_CLEANUP_OLD_DB` 重命名为 `E2E_CLEANUP_OLD_RESOURCES`
- 在 `cleanupOldDatabases` 之后调用 `cleanupOldRedisKeys(24)`
- `setupTestDatabase` 保留 `prisma db push`（不改为 `migrate deploy`），改用 `execFileSync('npx', ['prisma', 'db', 'push'], ...)` 和 `execFileSync('npx', ['prisma', 'db', 'seed'], ...)`（与 Backend 一致，避免 shell 注入风险）
- 数据库初始化成功后才设置 `process.env.DATABASE_URL`（与 Backend 一致）
- 同时设置 `process.env.QUANTIFY_DATABASE_URL` 和 `process.env.QUANTIFY_E2E_DATABASE_URL`

**7) Teardown 变更**

- 新增 Redis key 清理（在数据库清理前调用 `cleanupRedisKeys`）
- 恢复 `QUANTIFY_DATABASE_URL` 和 `QUANTIFY_E2E_DATABASE_URL`（当前遗漏）
- Best-effort 等待 200ms（与 Backend 一致）
- 保存 `originalDatabaseUrl` 为 `urlParams.originalUrl`（非 `baseUrl`）

**8) 移除尾部 `jest.setTimeout(30000)`**

由 `jest-e2e.json` 的 `testTimeout: 60000` 统一控制。

- [ ] **Step 2: 验证语法**

Run: `cd /Users/a1/work/stats && npx tsc --noEmit --project apps/quantify/e2e/tsconfig.json 2>&1 | head -30`

如果 tsconfig 不支持独立编译，可用 lint 代替：
Run: `dx lint`
Expected: 无新增 error

- [ ] **Step 3: 运行 health E2E 验证基础设施正常**

Run: `dx test e2e quantify apps/quantify/e2e/health`
Expected: health 测试通过

- [ ] **Step 4: Commit**

```bash
git add apps/quantify/e2e/setup-e2e.ts
git commit -F - <<'MSG'
refactor(quantify/e2e): 重写 setup-e2e — psql→pg client + Redis 清理

- executePsqlCommand → executePgCommand (Node.js pg 客户端，消除 psql 系统依赖)
- 新增 cleanupRedisKeys / cleanupOldRedisKeys (SCAN+DEL 清理 E2E Redis keys)
- 顶部调用 applyQuantifyEnvOverrides() 确保 QUANTIFY_* 映射
- E2E_CLEANUP_OLD_DB → E2E_CLEANUP_OLD_RESOURCES
- teardown 恢复 QUANTIFY_DATABASE_URL / QUANTIFY_E2E_DATABASE_URL
- 移除 jest.setTimeout(30000)，由 jest-e2e.json 统一控制

Refs: #496
MSG
```

---

### Task 3: 重构 `fixtures/fixtures.ts` — API 客户端三分 + 死代码清理

**Files:**
- Modify: `apps/quantify/e2e/fixtures/fixtures.ts:79-273`
- Reference: `apps/backend/e2e/fixtures/fixtures.ts:162-221` (三客户端参考)

- [ ] **Step 1: 重构 API 客户端**

将当前 `createApiClient(app, token?)` 拆为三个函数，参照 Backend `apps/backend/e2e/fixtures/fixtures.ts:166-221`：

```typescript
// 内部构建器（私有）
function buildPrefixedClient(server: HttpServer, token?: string): ApiClient {
  const applyAuth = (req: SupertestAgent): SupertestAgent => {
    if (token)
      req.set('Authorization', `Bearer ${token}`)
    return req
  }

  const createMethod = (method: HttpMethod) => (path: string) => {
    return applyAuth(
      supertestRequest(server)[method](buildApiUrl(path)) as SupertestAgent,
    )
  }

  return {
    get: createMethod('get'),
    post: createMethod('post'),
    put: createMethod('put'),
    patch: createMethod('patch'),
    delete: createMethod('delete'),
  }
}

function buildRawClient(server: HttpServer): ApiClient {
  const createMethod = (method: HttpMethod) => (path: string) => {
    return supertestRequest(server)[method](path) as SupertestAgent
  }

  return {
    get: createMethod('get'),
    post: createMethod('post'),
    put: createMethod('put'),
    patch: createMethod('patch'),
    delete: createMethod('delete'),
  }
}

/** 公开请求客户端（自动添加 API 前缀） */
export function createApiClient(app: INestApplication): ApiClient {
  return buildPrefixedClient(app.getHttpServer())
}

/** 带认证的请求客户端（自动添加 API 前缀 + Bearer token） */
export function createAuthApiClient(app: INestApplication, token: string): ApiClient {
  return buildPrefixedClient(app.getHttpServer(), token)
}

/** 原始请求客户端（不添加 API 前缀，用于 /health、/metrics 等） */
export function createRawClient(app: INestApplication): ApiClient {
  return buildRawClient(app.getHttpServer())
}
```

注意：`createApiClient` 签名从 `(app, token?)` 变为 `(app)`。当前零个测试文件传 token，因此不需要更新调用方。

- [ ] **Step 2: 移除死代码**

删除 `cleanupTestData` 函数（`fixtures.ts:221-253`）和 `ensurePrismaTablesExist` 函数（`fixtures.ts:260-273`）。两者均为 no-op 占位，临时 DB 隔离使它们不必要。

- [ ] **Step 3: 验证现有测试不受影响**

Run: `dx test e2e quantify apps/quantify/e2e/health`
Expected: health 测试仍然通过

- [ ] **Step 4: Commit**

```bash
git add apps/quantify/e2e/fixtures/fixtures.ts
git commit -F - <<'MSG'
refactor(quantify/e2e): API 客户端三分 + 移除死代码

- createApiClient(app, token?) → createApiClient(app) + createAuthApiClient(app, token) + createRawClient(app)
- 移除 cleanupTestData / ensurePrismaTablesExist (no-op 占位)

Refs: #496
MSG
```

---

### Task 4: 修改 `jest-e2e.json` — 并行度提升

**Files:**
- Modify: `apps/quantify/e2e/jest-e2e.json:28`

- [ ] **Step 1: 更新 Jest 配置**

```diff
-  "maxWorkers": 1,
+  "maxWorkers": "50%",
+  "workerIdleMemoryLimit": "512MB",
```

- [ ] **Step 2: Commit**

```bash
git add apps/quantify/e2e/jest-e2e.json
git commit -F - <<'MSG'
refactor(quantify/e2e): Jest 并行度提升至 50%

- maxWorkers: 1 → "50%"
- 新增 workerIdleMemoryLimit: "512MB"

Refs: #496
MSG
```

---

### Task 5: 全量 E2E 验证

- [ ] **Step 1: 运行全量 Quantify E2E**

Run: `dx test e2e quantify apps/quantify/e2e/health`
Expected: PASS

如果 health 通过，继续跑更多测试验证并行稳定性：
Run: `dx test e2e quantify apps/quantify/e2e/`
Expected: 全部通过或仅有已知的外部依赖跳过（如 AI API key 未配置）

- [ ] **Step 2: 如果并行出现偶发失败，回退 `maxWorkers` 到 1**

如果出现测试间数据竞争导致的失败，将 `jest-e2e.json` 的 `maxWorkers` 改回 `1`，记录失败测试文件名，后续单独修复隔离问题。

- [ ] **Step 3: Lint 检查**

Run: `dx lint`
Expected: 无新增 error

---

### Task 6: 构建验证

- [ ] **Step 1: 构建 Quantify**

Run: `dx build quantify --dev`
Expected: 构建成功（E2E 基础设施不参与构建，但确认无副作用）

- [ ] **Step 2: 最终 Commit（如有修复）**

如果前面步骤中有任何修复，统一提交。
