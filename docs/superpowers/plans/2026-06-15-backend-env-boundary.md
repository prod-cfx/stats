# Backend Env Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route backend Redis environment decisions through `EnvService` and lock production `process.env` access behind an allowlist test.

**Architecture:** Keep `EnvService` as the single Nest injectable wrapper for environment decisions that need `ConfigService`. `RedisService` will consume `EnvService` instead of reading `process.env` directly, while `export-openapi.ts` keeps its startup-script sentinel write with an explicit boundary comment.

**Tech Stack:** NestJS 11, Jest, TypeScript, existing `dx` commands.

---

## Files

- Modify: `apps/backend/src/common/services/env.service.ts` — add named helpers for Redis/swagger sentinel reads.
- Modify: `apps/backend/src/common/services/redis.service.ts` — inject `EnvService` and remove direct `process.env` reads.
- Modify: `apps/backend/src/common/services/redis.service.spec.ts` — TDD coverage for `EnvService`-backed Redis mock decisions.
- Create: `apps/backend/src/common/env/process-env-boundary.spec.ts` — static allowlist test for backend source `process.env` usage.
- Modify: `apps/backend/src/swagger/export-openapi.ts` — clarify allowed startup boundary comment.

## Task 1: EnvService Helpers And Redis Wiring

- [ ] **Step 1: Write failing RedisService test**

Change `apps/backend/src/common/services/redis.service.spec.ts` so `RedisService` receives an `EnvService` mock. Add test case proving `SKIP_REDIS_CONNECT` is read through `envService.shouldSkipRedisConnect()` rather than `process.env`.

```ts
function createEnvService(values: {
  isTest?: boolean
  isE2E?: boolean
  shouldSkipRedisConnect?: boolean
}) {
  return {
    isTest: jest.fn(() => values.isTest ?? false),
    isE2E: jest.fn(() => values.isE2E ?? false),
    shouldSkipRedisConnect: jest.fn(() => values.shouldSkipRedisConnect ?? false),
  }
}
```

Expected constructor calls become `new RedisService(configService, logger, envService as never)`. The new test must set `shouldSkipRedisConnect: true` and no longer mutate `process.env.SKIP_REDIS_CONNECT`.

- [ ] **Step 2: Run focused test and verify RED**

Run: `dx test unit backend apps/backend/src/common/services/redis.service.spec.ts`

Expected: TypeScript/Jest failure because `RedisService` constructor does not accept `EnvService` and helper methods do not exist.

- [ ] **Step 3: Implement minimal EnvService helpers**

Add to `apps/backend/src/common/services/env.service.ts`:

```ts
  isSwaggerExport(): boolean {
    return this.getBoolean('BACKEND_SWAGGER_EXPORT', false) === true
  }

  shouldSkipRedisConnect(): boolean {
    return this.getBoolean('SKIP_REDIS_CONNECT', false) === true || this.isSwaggerExport()
  }
```

- [ ] **Step 4: Wire RedisService to EnvService**

In `apps/backend/src/common/services/redis.service.ts`, import `EnvService`, inject it after logger, and change `shouldUseMockClient()` to:

```ts
    if (this.envService.shouldSkipRedisConnect()) {
      return true
    }

    if (this.configService.get<boolean>('USE_MOCK_DATA', false)) {
      return true
    }

    return this.envService.isTest() || this.envService.isE2E()
```

- [ ] **Step 5: Verify RedisService GREEN**

Run: `dx test unit backend apps/backend/src/common/services/redis.service.spec.ts`

Expected: PASS.

## Task 2: Static Process Env Boundary Test

- [ ] **Step 1: Write failing boundary test**

Create `apps/backend/src/common/env/process-env-boundary.spec.ts`. Use Node `fs`/`path` to scan `apps/backend/src/**/*.ts`, skip `.spec.ts`, `.e2e-spec.ts`, and allow only:

- `apps/backend/src/common/env/env.accessor.ts`
- `apps/backend/src/common/services/env.service.ts`
- `apps/backend/src/swagger/export-openapi.ts`

Assert all other source files have no `process.env`.

- [ ] **Step 2: Run boundary test and verify RED**

Run: `dx test unit backend apps/backend/src/common/env/process-env-boundary.spec.ts`

Expected before Redis fix: failure including `apps/backend/src/common/services/redis.service.ts`.

- [ ] **Step 3: Keep boundary test after Redis fix**

No production change should be needed after Task 1. The test should pass once Redis no longer reads `process.env`.

- [ ] **Step 4: Verify boundary GREEN**

Run: `dx test unit backend apps/backend/src/common/env/process-env-boundary.spec.ts`

Expected: PASS.

## Task 3: Export Boundary Comment And Full Verification

- [ ] **Step 1: Clarify swagger export boundary**

In `apps/backend/src/swagger/export-openapi.ts`, add a short comment above `process.env.BACKEND_SWAGGER_EXPORT = 'true'` saying this is an allowed startup-script boundary consumed through `EnvService`/env accessors by runtime code.

- [ ] **Step 2: Run required verification in parallel**

Run in parallel:

```bash
dx lint
dx build backend --dev
dx test unit backend apps/backend/src/common/services/redis.service.spec.ts apps/backend/src/common/env/process-env-boundary.spec.ts
```

Expected: all exit 0.

## Commit

Use heredoc commit message after verification:

```bash
git add -A
git commit -F - <<'MSG'
chore: tighten backend env access boundary

变更说明：
- Redis mock-mode environment checks now flow through EnvService instead of direct process.env reads.
- Added static backend source boundary test for direct process.env usage.

Refs: #2478
MSG
```
