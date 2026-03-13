# Quantify Message Bus Integration Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `apps/quantify/src/modules/message-bus` a first-class, working infrastructure module in `quantify`, including dependencies, Bull wiring, Prisma outbox schema, runtime-mode gating, and infrastructure-level verification.

**Architecture:** Keep the existing `Bull + Outbox + Redis dedupe + Cron dispatcher` structure, but adapt it to `quantify`'s actual Config, Redis, Prisma, and bootstrap contracts. Deliver infrastructure-only verification with a test topic / handler path and explicit offline-mode behavior for `build` and `swagger`.

**Tech Stack:** NestJS, Nx, TypeScript, Prisma 7, PostgreSQL, Redis, Bull, Jest

---

## File Structure

### Existing files to modify

- `apps/quantify/package.json`
  Responsibility: declare runtime and dev dependencies for `message-bus`, plus any script changes needed for verification.
- `apps/quantify/project.json`
  Responsibility: keep `swagger` / `build` / `test` targets aligned with the new offline-mode behavior.
- `apps/quantify/src/modules/app.module.ts`
  Responsibility: import `MessageBusModule` with the correct module ordering.
- `apps/quantify/src/config/configuration.ts`
  Responsibility: keep `messageBus` config namespace as the single source of runtime configuration.
- `apps/quantify/src/common/modules/redis.module.ts`
  Responsibility: remain the source of Redis connectivity reused by cache and Bull wiring.
- `apps/quantify/src/prisma/prisma.service.ts`
  Responsibility: keep Prisma online vs offline bootstrap behavior aligned with message-bus runtime gating.
- `apps/quantify/src/modules/message-bus/message-bus.module.ts`
  Responsibility: register Bull queue and export bus infrastructure providers.
- `apps/quantify/src/modules/message-bus/message-bus.service.ts`
  Responsibility: publish, publish-and-wait, queue job shaping, default mode behavior.
- `apps/quantify/src/modules/message-bus/runtime/message-bus.dedupe.service.ts`
  Responsibility: Redis-based dedupe on top of `CacheService`.
- `apps/quantify/src/modules/message-bus/outbox/outbox.module.ts`
  Responsibility: group repository, recorder, dispatcher, and any runtime gate providers.
- `apps/quantify/src/modules/message-bus/outbox/outbox.repository.ts`
  Responsibility: operate on `outboxMessage` schema with claim / retry / dead / cleanup semantics.
- `apps/quantify/src/modules/message-bus/outbox/outbox.service.ts`
  Responsibility: record reliable messages, including transaction-aware writes.
- `apps/quantify/src/modules/message-bus/outbox/outbox.dispatcher.ts`
  Responsibility: scheduled delivery loop, retry, dead-lettering, cleanup, and online/offline behavior.
- `apps/quantify/src/modules/message-bus/decorators/publish.decorator.ts`
  Responsibility: route reliable / volatile / handshake publishing through the finalized infrastructure contracts.
- `apps/quantify/src/modules/message-bus/decorators/message-handler.decorator.ts`
  Responsibility: align consumer behavior with Bull queue naming and test handler wiring.
- `apps/quantify/src/modules/message-bus/decorators/idempotent-consumer.decorator.ts`
  Responsibility: enforce dedupe semantics with the finalized runtime service.
- `apps/quantify/prisma/schema/*.prisma`
  Responsibility: add enum and model definitions for outbox storage.
- `apps/quantify/prisma/schema.prisma`
  Responsibility: remain the composed schema entrypoint after the outbox schema files are added.

### Files likely to create

- `apps/quantify/src/modules/message-bus/message-bus.constants.ts`
  Responsibility: hold environment / runtime gate constants if current files are getting mixed concerns.
- `apps/quantify/src/modules/message-bus/message-bus.runtime.ts`
  Responsibility: centralize "message bus runtime enabled?" logic so `swagger`, `build`, and tests share one rule.
- `apps/quantify/src/modules/message-bus/__tests__/message-bus.service.spec.ts`
  Responsibility: unit coverage for publish and handshake behavior.
- `apps/quantify/src/modules/message-bus/__tests__/message-bus.dedupe.service.spec.ts`
  Responsibility: unit coverage for dedupe locking behavior.
- `apps/quantify/src/modules/message-bus/outbox/__tests__/outbox.repository.spec.ts`
  Responsibility: repository-level status transition and cleanup coverage.
- `apps/quantify/src/modules/message-bus/outbox/__tests__/outbox.dispatcher.spec.ts`
  Responsibility: dispatcher retry, dead, and metrics behavior.
- `apps/quantify/src/modules/message-bus/testing/message-bus.test.controller.ts`
  Responsibility: optional infrastructure-only smoke entrypoint if HTTP-based smoke verification is chosen.
- `apps/quantify/src/modules/message-bus/testing/message-bus.test.consumer.ts`
  Responsibility: test-only consumer for volatile / reliable / handshake verification.
- `apps/quantify/src/modules/message-bus/testing/message-bus.testing.module.ts`
  Responsibility: isolate test-only bus wiring from production domain modules.
- `apps/quantify/src/modules/message-bus/README.md`
  Responsibility: document runtime variables, offline behavior, and infrastructure verification commands.
- `apps/quantify/prisma/migrations/20260313_add_outbox_message/`
  Responsibility: add `OutboxStatus` and `outboxMessage`.

### Files to inspect during execution

- `apps/quantify/src/common/services/cache.service.ts`
- `apps/quantify/src/common/services/redis.service.ts`
- `apps/quantify/src/common/modules/cache.module.ts`
- `apps/quantify/src/common/modules/redis.module.ts`
- `apps/quantify/src/main.ts`
- `apps/quantify/src/common/services/env.service.ts`
- `apps/quantify/src/config/quantify-env.ts`
- `apps/quantify/src/prisma/prisma.module.ts`

## Chunk 1: Dependency And Wiring Foundation

### Task 1: Add Bull dependencies to `quantify`

**Files:**
- Modify: `apps/quantify/package.json`

- [ ] **Step 1: Write the failing dependency check**

Run: `pnpm --filter @net/quantify exec node -e "require.resolve('@nestjs/bull'); require.resolve('bull')"`
Expected: FAIL with `Cannot find module '@nestjs/bull'` or `Cannot find module 'bull'`

- [ ] **Step 2: Add the minimal dependencies**

Update `apps/quantify/package.json` dependencies to include the queue stack:

```json
{
  "dependencies": {
    "@nestjs/bull": "^11.0.0",
    "bull": "^4.16.5"
  }
}
```

Do not add Bull packages to the workspace root if only `quantify` needs them.

- [ ] **Step 3: Install and lock the dependency graph**

Run: `pnpm install --filter @net/quantify...`
Expected: PASS with `@nestjs/bull` and `bull` added to the lockfile graph

- [ ] **Step 4: Re-run the dependency check**

Run: `pnpm --filter @net/quantify exec node -e "require.resolve('@nestjs/bull'); require.resolve('bull')"`
Expected: PASS with no output

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/package.json pnpm-lock.yaml
git commit -m "feat: add quantify message bus queue dependencies"
```

### Task 2: Normalize message-bus imports and queue module wiring

**Files:**
- Modify: `apps/quantify/src/modules/message-bus/message-bus.module.ts`
- Modify: `apps/quantify/src/modules/message-bus/message-bus.service.ts`
- Modify: `apps/quantify/src/modules/message-bus/runtime/message-bus.dedupe.service.ts`
- Modify: `apps/quantify/src/modules/message-bus/outbox/outbox.repository.ts`
- Modify: `apps/quantify/src/modules/message-bus/outbox/outbox.dispatcher.ts`
- Modify: `apps/quantify/src/modules/message-bus/outbox/outbox.service.ts`
- Modify: `apps/quantify/src/modules/message-bus/decorators/publish.decorator.ts`
- Modify: `apps/quantify/src/modules/message-bus/decorators/message-handler.decorator.ts`
- Modify: `apps/quantify/src/modules/message-bus/decorators/idempotent-consumer.decorator.ts`

- [ ] **Step 1: Write the failing compile check for current imports**

Run: `pnpm --filter @net/quantify run build`
Expected: FAIL with unresolved imports such as `@/cache/cache.service` or missing Bull setup errors

- [ ] **Step 2: Replace original-repo-only imports with `quantify` paths**

Use `quantify`-local imports consistently. The end state should look like:

```ts
import { CacheService } from '@/common/services/cache.service'
import { PrismaService } from '@/prisma/prisma.service'
import { EnvService } from '@/common/services/env.service'
```

Rules:

- Do not leave any `@/cache/...` imports behind
- Prefer existing `@/common/...` and `@/prisma/...` aliases already used by `quantify`
- Remove `.DS_Store` from the directory during implementation if it interferes with linting or search

- [ ] **Step 3: Register Bull queue in the module using the finalized constants**

Keep the module focused:

```ts
@Global()
@Module({
  imports: [
    BullModule.registerQueue({ name: MESSAGE_BUS_QUEUE }),
    OutboxModule,
  ],
  providers: [MessageBusService, MessageBusMetricsService, MessageBusDedupeService],
  exports: [MessageBusService, MessageBusMetricsService, MessageBusDedupeService, OutboxModule],
})
export class MessageBusModule {}
```

Do not add Redis connection creation logic directly inside `MessageBusModule`; that belongs in a dedicated Bull root config task.

- [ ] **Step 4: Verify the module-level compile moves forward**

Run: `pnpm --filter @net/quantify run build`
Expected: FAIL later on runtime gating or Prisma schema, but no longer on broken message-bus imports

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/message-bus
git commit -m "refactor: align quantify message bus imports and module wiring"
```

### Task 3: Add Bull root registration and application wiring

**Files:**
- Modify: `apps/quantify/src/modules/app.module.ts`
- Modify: `apps/quantify/src/common/modules/redis.module.ts`
- Modify: `apps/quantify/src/config/configuration.ts`
- Create: `apps/quantify/src/modules/message-bus/message-bus.runtime.ts`

- [ ] **Step 1: Write the failing bootstrap test expectation**

Add or identify a bootstrap test command target and run:

Run: `pnpm --filter @net/quantify exec jest --runInBand --passWithNoTests apps/quantify/src/modules/message-bus`
Expected: PASS or no tests. This establishes there is currently no bootstrap safety net.

Then run:

Run: `pnpm --filter @net/quantify run build`
Expected: FAIL or remain incomplete because Bull root connectivity is not yet configured

- [ ] **Step 2: Create a single runtime gate helper**

Add `apps/quantify/src/modules/message-bus/message-bus.runtime.ts` with one responsibility:

```ts
import { defaultEnvAccessor } from '@/common/env/env.accessor'

export function isMessageBusRuntimeEnabled(): boolean {
  if (defaultEnvAccessor.bool('SKIP_PRISMA_CONNECT', false)) return false
  return defaultEnvAccessor.bool('MESSAGEBUS_RUNTIME_ENABLED', true)
}
```

This helper becomes the only place that decides whether queue / dispatcher runtime should be live.

- [ ] **Step 3: Register Bull root config asynchronously**

Update `app.module.ts` to import Bull once, using the existing `REDIS_URL` contract:

```ts
BullModule.forRootAsync({
  useFactory: (env: EnvService) => {
    const url = env.getString('REDIS_URL')
    if (!url) {
      throw new Error('REDIS_URL is required for Bull queue initialization')
    }
    const parsed = new URL(url)
    return {
      redis: {
        host: parsed.hostname,
        port: Number(parsed.port || 6379),
        password: parsed.password || undefined,
        db: parsed.pathname ? Number(parsed.pathname.slice(1) || 0) : 0,
      },
    }
  },
  inject: [EnvService],
})
```

Do not duplicate this logic inside `MessageBusModule`.

- [ ] **Step 4: Import `MessageBusModule` in the correct place**

Insert `MessageBusModule` after the modules it depends on:

```ts
CacheModule,
TransactionEventsModule,
PrismaModule,
ScheduleModule.forRoot(),
MessageBusModule,
```

Keep the rest of the application order stable.

- [ ] **Step 5: Verify build reaches the next failure frontier**

Run: `pnpm --filter @net/quantify run build`
Expected: FAIL later on missing Prisma outbox schema or tests, not on Bull module registration or missing imports

- [ ] **Step 6: Commit**

```bash
git add apps/quantify/src/modules/app.module.ts apps/quantify/src/common/modules/redis.module.ts apps/quantify/src/config/configuration.ts apps/quantify/src/modules/message-bus/message-bus.runtime.ts
git commit -m "feat: wire quantify message bus infrastructure into app bootstrap"
```

## Chunk 2: Prisma Outbox Contract

### Task 4: Add failing Prisma contract check for outbox storage

**Files:**
- Modify: `apps/quantify/prisma/schema/*.prisma`
- Modify: `apps/quantify/prisma/schema.prisma`

- [ ] **Step 1: Prove the Prisma client lacks the outbox model**

Run: `pnpm --filter @net/quantify run prisma:generate`
Expected: PASS or FAIL depending on current schema, but generated client should not yet provide a working `outboxMessage` model for the repository assumptions

Then run:

Run: `rg -n "outboxMessage|OutboxStatus" apps/quantify/generated/prisma apps/quantify/src/prisma`
Expected: missing or inconsistent definitions relative to `outbox.repository.ts`

- [ ] **Step 2: Define the enum and model in schema files**

Add Prisma definitions with the exact repository contract:

```prisma
enum OutboxStatus {
  PENDING
  CLAIMED
  RETRY
  SENT
  DEAD
}

model OutboxMessage {
  id            BigInt       @id @default(autoincrement())
  topic         String
  type          String
  payload       Json
  status        OutboxStatus @default(PENDING)
  attempts      Int          @default(0)
  nextVisibleAt DateTime
  lockedBy      String?
  lockedAt      DateTime?
  lastError     String?
  dedupeKey     String?
  correlationId String?
  partitionKey  String?
  priority      Int?
  createdAt     DateTime     @default(now())
  updatedAt     DateTime     @updatedAt

  @@map("outbox_message")
  @@index([status, nextVisibleAt])
  @@index([lockedAt])
  @@index([createdAt])
  @@index([dedupeKey])
}
```

Align naming to the repository. If Prisma model casing must remain `OutboxMessage`, update repository access accordingly in the next task.

- [ ] **Step 3: Generate Prisma client and check model access**

Run: `pnpm --filter @net/quantify run prisma:generate`
Expected: PASS with the outbox model present in generated client

- [ ] **Step 4: Commit**

```bash
git add apps/quantify/prisma/schema apps/quantify/prisma/schema.prisma apps/quantify/generated/prisma
git commit -m "feat: add quantify outbox prisma contract"
```

### Task 5: Create and verify the migration

**Files:**
- Create: `apps/quantify/prisma/migrations/20260313_add_outbox_message/*`

- [ ] **Step 1: Generate the migration**

Run: `pnpm --filter @net/quantify exec prisma migrate dev --name add_outbox_message`
Expected: PASS with a new migration directory created

- [ ] **Step 2: Review the SQL for scope correctness**

The SQL must include:

```sql
CREATE TYPE "OutboxStatus" AS ENUM ('PENDING', 'CLAIMED', 'RETRY', 'SENT', 'DEAD');
CREATE TABLE "outbox_message" (...);
CREATE INDEX ... ON "outbox_message" ("status", "nextVisibleAt");
```

It must not alter unrelated business tables.

- [ ] **Step 3: Verify migration status is clean**

Run: `pnpm --filter @net/quantify exec prisma migrate status`
Expected: PASS with the new migration reported as applied for the local dev database

- [ ] **Step 4: Commit**

```bash
git add apps/quantify/prisma/migrations
git commit -m "feat: add quantify outbox database migration"
```

### Task 6: Align repository and recorder code to the finalized Prisma model

**Files:**
- Modify: `apps/quantify/src/modules/message-bus/outbox/outbox.repository.ts`
- Modify: `apps/quantify/src/modules/message-bus/outbox/outbox.service.ts`

- [ ] **Step 1: Write the failing repository-focused test**

Create a unit or integration test that expects create / claim / markSent to operate on the new Prisma model.

Minimal expectation:

```ts
it('stores and updates outbox rows through Prisma', async () => {
  const row = await repo.create({ topic: 'test.topic', type: 'test.type', payload: { ok: true } })
  expect(row.status).toBe(OutboxStatus.PENDING)
})
```

Run: `pnpm --filter @net/quantify exec jest apps/quantify/src/modules/message-bus/outbox/__tests__/outbox.repository.spec.ts --runInBand`
Expected: FAIL until repository model access matches the generated Prisma client

- [ ] **Step 2: Make repository access exact and type-correct**

Prefer typed access instead of broad `any` when Prisma output now supports the model:

```ts
return client.outboxMessage.create({
  data: {
    topic: data.topic,
    type: data.type,
    payload: data.payload as Prisma.InputJsonValue,
    status: OutboxStatus.PENDING,
    nextVisibleAt: data.deliverAt ?? new Date(),
  },
})
```

Keep `getClient(tx)` transaction-aware, but stop using `any` where the generated client now has concrete types.

- [ ] **Step 3: Re-run the repository test**

Run: `pnpm --filter @net/quantify exec jest apps/quantify/src/modules/message-bus/outbox/__tests__/outbox.repository.spec.ts --runInBand`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/quantify/src/modules/message-bus/outbox
git commit -m "refactor: align quantify outbox repository with prisma model"
```

## Chunk 3: Runtime Mode Gating

### Task 7: Gate message-bus runtime for `swagger` and other offline flows

**Files:**
- Modify: `apps/quantify/src/modules/message-bus/message-bus.module.ts`
- Modify: `apps/quantify/src/modules/message-bus/outbox/outbox.module.ts`
- Modify: `apps/quantify/src/modules/message-bus/outbox/outbox.dispatcher.ts`
- Modify: `apps/quantify/project.json`
- Modify: `apps/quantify/src/main.ts`
- Modify: `apps/quantify/src/prisma/prisma.service.ts`
- Modify: `apps/quantify/src/modules/message-bus/message-bus.runtime.ts`

- [ ] **Step 1: Write the failing offline verification**

Run: `nx run quantify:swagger`
Expected: FAIL or hang if Bull / Redis / dispatcher runtime still initializes in offline mode

- [ ] **Step 2: Make runtime gating explicit in providers**

Use one helper and branch provider behavior from it.

For example:

```ts
export function isMessageBusRuntimeEnabled(): boolean {
  if (defaultEnvAccessor.bool('SKIP_PRISMA_CONNECT', false)) return false
  return defaultEnvAccessor.bool('MESSAGEBUS_RUNTIME_ENABLED', true)
}
```

Then in runtime-aware services:

```ts
if (!isMessageBusRuntimeEnabled()) {
  this.logger.log('Message bus runtime disabled, skipping dispatcher tick')
  return
}
```

The same rule must govern:

- Bull root connection initialization
- queue registration if necessary
- dispatcher activity
- test-only bootstrap assumptions

- [ ] **Step 3: Keep offline DI resolvable**

The goal is not to remove `MessageBusModule` from the app in offline mode. The goal is:

- modules still import cleanly
- providers can still be constructed safely
- runtime side effects do not attempt network activity

If Bull cannot be safely constructed without a Redis connection, introduce a no-op provider path at module level for offline mode rather than letting `swagger` fail.

- [ ] **Step 4: Re-run offline verification**

Run: `nx run quantify:swagger`
Expected: PASS with the OpenAPI export produced and no Redis / Bull runtime crash

- [ ] **Step 5: Verify normal build still succeeds**

Run: `pnpm --filter @net/quantify run build`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/quantify/src/modules/message-bus apps/quantify/project.json apps/quantify/src/main.ts apps/quantify/src/prisma/prisma.service.ts
git commit -m "feat: add quantify message bus offline runtime gating"
```

### Task 8: Verify normal online bootstrap behavior

**Files:**
- Test: `apps/quantify/e2e` or a dedicated bootstrap test file

- [ ] **Step 1: Add a minimal bootstrap test**

Create a test that boots the Nest app with runtime enabled and asserts critical providers resolve:

```ts
it('boots with message bus infrastructure enabled', async () => {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile()

  expect(moduleRef.get(MessageBusService)).toBeDefined()
  expect(moduleRef.get(OutboxService)).toBeDefined()
})
```

- [ ] **Step 2: Run the bootstrap test**

Run: `pnpm --filter @net/quantify exec jest apps/quantify/e2e/message-bus/message-bus-bootstrap.e2e-spec.ts --runInBand`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add apps/quantify/e2e apps/quantify/src/modules/message-bus
git commit -m "test: add quantify message bus bootstrap coverage"
```

## Chunk 4: Infrastructure Verification

### Task 9: Add unit coverage for publish, handshake, and dedupe

**Files:**
- Create: `apps/quantify/src/modules/message-bus/__tests__/message-bus.service.spec.ts`
- Create: `apps/quantify/src/modules/message-bus/__tests__/message-bus.dedupe.service.spec.ts`

- [ ] **Step 1: Write the failing tests**

Add service-level tests like:

```ts
it('publishes a Bull job with the topic as the job name', async () => {
  await service.publish('test.topic', 'test.type', { ok: true }, { dedupeKey: 'a' })
  expect(queue.add).toHaveBeenCalledWith(
    'test.topic',
    expect.objectContaining({ type: 'test.type', topic: 'test.topic' }),
    expect.objectContaining({ jobId: 'test.topic:a' }),
  )
})

it('waits for a handshake completion marker', async () => {
  cache.get.mockResolvedValueOnce(undefined).mockResolvedValueOnce({ status: 'ok' })
  const result = await service.publishAndWait('test.topic', 'test.type', { ok: true })
  expect(result.result).toEqual({ status: 'ok' })
})
```

Run: `pnpm --filter @net/quantify exec jest apps/quantify/src/modules/message-bus/__tests__/message-bus.service.spec.ts apps/quantify/src/modules/message-bus/__tests__/message-bus.dedupe.service.spec.ts --runInBand`
Expected: FAIL

- [ ] **Step 2: Implement only the code needed to satisfy the tests**

Adjust `MessageBusService` and `MessageBusDedupeService` without broad refactors.

- [ ] **Step 3: Re-run the unit tests**

Run: `pnpm --filter @net/quantify exec jest apps/quantify/src/modules/message-bus/__tests__/message-bus.service.spec.ts apps/quantify/src/modules/message-bus/__tests__/message-bus.dedupe.service.spec.ts --runInBand`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/quantify/src/modules/message-bus/__tests__ apps/quantify/src/modules/message-bus/message-bus.service.ts apps/quantify/src/modules/message-bus/runtime/message-bus.dedupe.service.ts
git commit -m "test: cover quantify message bus publish and dedupe behavior"
```

### Task 10: Add dispatcher retry / dead / cleanup coverage

**Files:**
- Create: `apps/quantify/src/modules/message-bus/outbox/__tests__/outbox.dispatcher.spec.ts`
- Modify: `apps/quantify/src/modules/message-bus/outbox/outbox.dispatcher.ts`
- Modify: `apps/quantify/src/modules/message-bus/metrics/message-bus.metrics.service.ts`

- [ ] **Step 1: Write the failing dispatcher tests**

Add focused expectations:

```ts
it('marks a message dead after max attempts', async () => {
  repo.claimBatch.mockResolvedValue([message])
  bus.publish.mockRejectedValue(new Error('boom'))
  repo.incrementAttemptsAndGet.mockResolvedValue(6)
  await dispatcher.tick()
  expect(repo.markDead).toHaveBeenCalledWith(message.id, 'boom')
})

it('records dispatch latency for successful sends', async () => {
  repo.claimBatch.mockResolvedValue([message])
  bus.publish.mockResolvedValue('job-1')
  await dispatcher.tick()
  expect(metrics.recordOutboxDispatchLatency).toHaveBeenCalled()
})
```

Run: `pnpm --filter @net/quantify exec jest apps/quantify/src/modules/message-bus/outbox/__tests__/outbox.dispatcher.spec.ts --runInBand`
Expected: FAIL

- [ ] **Step 2: Tighten dispatcher logic to make tests deterministic**

Refine the implementation without changing the public contract:

- keep one runtime gate
- keep retry threshold exact
- keep cleanup cutoff deterministic enough for testing

- [ ] **Step 3: Re-run dispatcher tests**

Run: `pnpm --filter @net/quantify exec jest apps/quantify/src/modules/message-bus/outbox/__tests__/outbox.dispatcher.spec.ts --runInBand`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/quantify/src/modules/message-bus/outbox/__tests__/outbox.dispatcher.spec.ts apps/quantify/src/modules/message-bus/outbox/outbox.dispatcher.ts apps/quantify/src/modules/message-bus/metrics/message-bus.metrics.service.ts
git commit -m "test: cover quantify outbox dispatcher retry and cleanup behavior"
```

### Task 11: Add infrastructure-only smoke path for volatile, reliable, and handshake modes

**Files:**
- Create: `apps/quantify/src/modules/message-bus/testing/message-bus.test.consumer.ts`
- Create: `apps/quantify/src/modules/message-bus/testing/message-bus.testing.module.ts`
- Optional Create: `apps/quantify/src/modules/message-bus/testing/message-bus.test.controller.ts`
- Modify: `apps/quantify/src/modules/message-bus/message-bus.module.ts`
- Test: `apps/quantify/e2e`

- [ ] **Step 1: Write the failing smoke test**

The smoke path must stay infrastructure-only. A minimal HTTP-triggered test is acceptable if it avoids coupling to real business modules.

Example expectation:

```ts
it('verifies volatile, reliable, and handshake message flows', async () => {
  const res = await request(app.getHttpServer()).post('/api/v1/internal/message-bus/test')
  expect(res.body.volatile).toBe('queued')
  expect(res.body.reliable).toBe('recorded-and-dispatched')
  expect(res.body.handshake).toBe('acknowledged')
})
```

Run: `pnpm --filter @net/quantify exec jest apps/quantify/e2e/message-bus/message-bus-smoke.e2e-spec.ts --runInBand`
Expected: FAIL

- [ ] **Step 2: Add the smallest possible test-only consumer and entrypoint**

Keep it isolated:

- `message-bus.testing.module.ts` should only expose test wiring
- `message-bus.test.consumer.ts` should acknowledge handshake and record received payloads
- test controller, if used, should only exist in test builds or guarded internal routes

Do not reuse a business-domain controller for this verification.

- [ ] **Step 3: Re-run the smoke test**

Run: `pnpm --filter @net/quantify exec jest apps/quantify/e2e/message-bus/message-bus-smoke.e2e-spec.ts --runInBand`
Expected: PASS

- [ ] **Step 4: Run the full quantify verification set**

Run: `pnpm --filter @net/quantify run test`
Expected: PASS

Run: `pnpm --filter @net/quantify run build`
Expected: PASS

Run: `nx run quantify:swagger`
Expected: PASS

- [ ] **Step 5: Document the verification contract**

Add `apps/quantify/src/modules/message-bus/README.md` covering:

- runtime env vars
- offline mode behavior
- smoke verification commands
- what is intentionally out of scope for this phase

- [ ] **Step 6: Commit**

```bash
git add apps/quantify/src/modules/message-bus/testing apps/quantify/src/modules/message-bus/README.md apps/quantify/e2e
git commit -m "test: add quantify message bus infrastructure smoke verification"
```

## Chunk 5: Final Verification And Cleanup

### Task 12: Remove transient leftovers and lock the final contract

**Files:**
- Modify: `apps/quantify/src/modules/message-bus/*`
- Modify: `apps/quantify/src/modules/message-bus/**`

- [ ] **Step 1: Remove non-source artifacts and grep for bad imports**

Run: `find apps/quantify/src/modules/message-bus -name '.DS_Store' -delete`
Expected: PASS

Run: `rg -n "@/cache/|TODO|TBD|FIXME|original repo|legacy bus" apps/quantify/src/modules/message-bus`
Expected: no matches for bad imports or placeholder text

- [ ] **Step 2: Run targeted lint / test / build verification**

Run: `pnpm --filter @net/quantify exec eslint "src/modules/message-bus/**/*.ts" --config ../../eslint.config.js`
Expected: PASS

Run: `pnpm --filter @net/quantify run test`
Expected: PASS

Run: `pnpm --filter @net/quantify run build`
Expected: PASS

Run: `nx run quantify:swagger`
Expected: PASS

- [ ] **Step 3: Commit the final integrated result**

```bash
git add apps/quantify docs/superpowers/plans/2026-03-13-quantify-message-bus-integration.md
git commit -m "feat: integrate quantify message bus infrastructure"
```

## Local Plan Review

### Chunk 1 Review

Status: Approved

Notes:

- Scope stays on infrastructure, not business event adoption
- Task boundaries are atomic enough to execute with TDD

### Chunk 2 Review

Status: Approved

Notes:

- Prisma changes are isolated from runtime-mode and testing work
- Migration review step prevents unrelated schema drift

### Chunk 3 Review

Status: Approved

Notes:

- Offline mode is treated as a first-class contract, matching the spec
- DI-resolvable-but-runtime-disabled behavior is explicit

### Chunk 4 Review

Status: Approved

Notes:

- Verification covers volatile, reliable, handshake, dedupe, and cleanup as required by the spec
- Test-only wiring is isolated from business modules

### Chunk 5 Review

Status: Approved

Notes:

- Final grep and verification steps catch leftover original-repo assumptions
