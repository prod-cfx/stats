# Grid Runtime OKX Rate Limit Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make grid runtime order submission reuse instrument constraints, submit planned orders in bounded cycles, and treat OKX rate limits as retryable without breaking existing execution paths.

**Architecture:** Keep the first phase local and backward compatible. `TradingExecutionService.prepareIntent()` gains optional preloaded constraints while old callers still fetch constraints internally; `GridOrderSyncService` becomes responsible for one-cycle grid submission policy, retryable rate-limit detection, order rollback to `PLANNED`, and runtime event logging.

**Tech Stack:** NestJS services, TypeScript, Jest unit tests, Prisma-backed repository methods already exposed through `GridRuntimeRepository`, repository commands via `dx`.

---

## File Structure

- Modify: `apps/quantify/src/modules/trading-execution/types/trading-execution.types.ts`
  - Adds the reusable `TradingExecutionPrepareOptions` type.
- Modify: `apps/quantify/src/modules/trading-execution/services/trading-execution.service.ts`
  - Adds optional constraints support to `prepareIntent()`.
- Modify: `apps/quantify/src/modules/trading-execution/services/trading-execution.service.spec.ts`
  - Locks old and new `prepareIntent()` behavior.
- Modify: `apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.ts`
  - Adds bounded submission, preloaded constraints, retryable rate-limit handling, and event append.
- Modify: `apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.spec.ts`
  - Covers one constraints fetch per cycle, per-cycle submission limit, retryable OKX 50011 handling, and non-rate-limit reconciliation behavior.

## Task 1: Trading Execution Preloaded Constraints

**Files:**
- Modify: `apps/quantify/src/modules/trading-execution/types/trading-execution.types.ts`
- Modify: `apps/quantify/src/modules/trading-execution/services/trading-execution.service.ts`
- Test: `apps/quantify/src/modules/trading-execution/services/trading-execution.service.spec.ts`

- [ ] **Step 1: Add failing tests for old and preloaded constraints paths**

Add these tests inside `describe('TradingExecutionService', () => { ... })` in `apps/quantify/src/modules/trading-execution/services/trading-execution.service.spec.ts` after the first `prepares an intent...` test:

```ts
  it('fetches constraints when preparing without preloaded constraints', async () => {
    const tradingService = createTradingServiceMock()
    const service = createService(tradingService)

    const result = await service.prepareIntent(intent)

    expect(result.status).toBe('prepared')
    expect(tradingService.getInstrumentConstraints).toHaveBeenCalledTimes(1)
    expect(tradingService.getInstrumentConstraints).toHaveBeenCalledWith(
      'user-1',
      'okx',
      'perp',
      'BTC/USDT:PERP',
      'exchange-account-1',
    )
  })

  it('uses preloaded constraints when preparing an intent', async () => {
    const tradingService = createTradingServiceMock()
    const service = createService(tradingService)

    const result = await service.prepareIntent(intent, { constraints })

    expect(result.status).toBe('prepared')
    if (result.status !== 'prepared') throw new Error('expected prepared result')
    expect(tradingService.getInstrumentConstraints).not.toHaveBeenCalled()
    expect(result.constraints).toBe(constraints)
    expect(result.normalized.clientOrderId).toEqual(expect.stringMatching(/^g[A-Za-z0-9]+$/u))
    expect(result.normalized.request).toEqual(expect.objectContaining({
      symbol: 'BTC/USDT:PERP',
      marketType: 'perp',
      side: 'buy',
      type: 'limit',
      amount: 0.1,
      price: 79200,
      clientOrderId: result.normalized.clientOrderId,
    }))
  })
```

- [ ] **Step 2: Run the focused unit suite and verify the new test fails**

Run:

```bash
dx test unit quantify
```

Expected: the new `uses preloaded constraints when preparing an intent` test fails with a TypeScript or runtime error because `prepareIntent()` does not accept the options argument yet.

- [ ] **Step 3: Add the prepare options type**

In `apps/quantify/src/modules/trading-execution/types/trading-execution.types.ts`, add this interface after `export type TradingExecutionConstraints = UnifiedInstrumentConstraints`:

```ts
export interface TradingExecutionPrepareOptions {
  constraints?: TradingExecutionConstraints
}
```

- [ ] **Step 4: Implement optional constraints in TradingExecutionService**

In `apps/quantify/src/modules/trading-execution/services/trading-execution.service.ts`, update the type import:

```ts
  TradingExecutionPrepareOptions,
```

Change the `prepareIntent` signature and constraints loading block to:

```ts
  async prepareIntent(intent: OrderIntent, options: TradingExecutionPrepareOptions = {}): Promise<TradingExecutionPrepareResult> {
    const shape = this.admissionGate.evaluateIntentShape(intent)
    if (shape.ok === false) {
      return { status: 'rejected', intent, reason: shape.reason }
    }

    let constraints: TradingExecutionConstraints
    if (options.constraints) {
      constraints = options.constraints
    }
    else {
      try {
        constraints = await this.tradingService.getInstrumentConstraints(
          intent.userId,
          intent.exchangeId,
          intent.marketType,
          intent.symbol,
          intent.exchangeAccountId ?? undefined,
        )
      }
      catch (error) {
        return { status: 'waiting_constraints', intent, reason: this.errorReason(error), error }
      }
    }
```

Leave the rest of `prepareIntent()` unchanged, starting from `let clientOrderId: string`.

- [ ] **Step 5: Run the focused unit suite and verify it passes**

Run:

```bash
dx test unit quantify
```

Expected: all quantify unit tests pass, including both new `TradingExecutionService` tests.

- [ ] **Step 6: Commit Task 1**

Run:

```bash
git add apps/quantify/src/modules/trading-execution/types/trading-execution.types.ts apps/quantify/src/modules/trading-execution/services/trading-execution.service.ts apps/quantify/src/modules/trading-execution/services/trading-execution.service.spec.ts
git commit -F - <<'MSG'
fix: reuse preloaded trading execution constraints

变更说明：
- 为 prepareIntent 增加向后兼容的预加载 constraints 参数
- 覆盖旧路径继续查约束与新路径复用约束的单测

Refs: #955
MSG
```

Expected: commit succeeds.

## Task 2: Grid Submission Constraints Reuse and Per-Cycle Limit

**Files:**
- Modify: `apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.ts`
- Test: `apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.spec.ts`

- [ ] **Step 1: Add failing tests for one-cycle constraints reuse and submission limit**

In `apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.spec.ts`, add this test after `submits planned limit orders to the exchange before sync matching`:

```ts
  it('reuses instrument constraints and limits planned submissions per sync cycle', async () => {
    const repository = createRepository()
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: 'planned-order-1',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
        price: { toString: () => '94' },
      }),
      createOrder({
        id: 'planned-order-2',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
        price: { toString: () => '95' },
      }),
      createOrder({
        id: 'planned-order-3',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
        price: { toString: () => '96' },
      }),
      createOrder({
        id: 'planned-order-4',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
        price: { toString: () => '97' },
      }),
    ])
    const tradingService = createTradingService()
    tradingService.getOpenOrders.mockResolvedValue([])
    tradingService.getClosedOrders.mockResolvedValue([])
    const service = createService(repository, tradingService)

    await service.syncInstance('grid-1')

    expect(tradingService.getInstrumentConstraints).toHaveBeenCalledTimes(1)
    expect(repository.markOrderSubmitting).toHaveBeenCalledTimes(3)
    expect(tradingService.placeOrder).toHaveBeenCalledTimes(3)
    expect(repository.markOrderSubmitting.mock.calls.map(call => call[0].id)).toEqual([
      'planned-order-1',
      'planned-order-2',
      'planned-order-3',
    ])
  })
```

- [ ] **Step 2: Run the focused unit suite and verify the new test fails**

Run:

```bash
dx test unit quantify
```

Expected: the new grid test fails because the current code fetches constraints for every order and submits all four planned orders.

- [ ] **Step 3: Add bounded submission constants and imports**

In `apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.ts`, extend the types import from trading core:

```ts
import type { ExchangeId, MarketType, UnifiedInstrumentConstraints, UnifiedOrder } from '@/modules/trading/core/types'
```

Add these constants below `LOCAL_STATUSES_WITH_POSSIBLE_LIVE_EXCHANGE_ORDER`:

```ts
const DEFAULT_GRID_ORDER_SUBMISSIONS_PER_SYNC = 3
const GRID_ORDER_SUBMISSIONS_PER_SYNC_BY_EXCHANGE: Partial<Record<ExchangeId, number>> = {
  okx: 3,
}
```

- [ ] **Step 4: Load constraints once and limit planned orders**

Replace the beginning of `submitPlannedOrders()` in `apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.ts` with:

```ts
    const plannedOrders = this.filterSubmittablePlannedOrders(orders)
      .slice(0, this.resolveSubmissionLimit(exchangeId))
    if (plannedOrders.length === 0) return

    const constraints = await this.loadSubmissionConstraints(instance, exchangeId, marketType)
    if (!constraints) return

    for (const order of plannedOrders) {
      const intent = this.buildOrderIntent(instance, exchangeId, marketType, order)
      const prepared = await this.tradingExecution.prepareIntent(intent, { constraints })
```

This replaces the existing first three lines:

```ts
    const plannedOrders = this.filterSubmittablePlannedOrders(orders)
    for (const order of plannedOrders) {
      const intent = this.buildOrderIntent(instance, exchangeId, marketType, order)
      const prepared = await this.tradingExecution.prepareIntent(intent)
```

- [ ] **Step 5: Add helper methods for submission limit and constraints loading**

Add these private methods after `filterSubmittablePlannedOrders()`:

```ts
  private resolveSubmissionLimit(exchangeId: ExchangeId): number {
    return GRID_ORDER_SUBMISSIONS_PER_SYNC_BY_EXCHANGE[exchangeId] ?? DEFAULT_GRID_ORDER_SUBMISSIONS_PER_SYNC
  }

  private async loadSubmissionConstraints(
    instance: RuntimeInstance,
    exchangeId: ExchangeId,
    marketType: MarketType,
  ): Promise<UnifiedInstrumentConstraints | null> {
    try {
      return await this.tradingService.getInstrumentConstraints(
        instance.userId,
        exchangeId,
        marketType,
        instance.symbol,
        instance.exchangeAccountId,
      )
    }
    catch (error) {
      await this.txEvents.withAfterCommit(async () =>
        this.stateMachine.markReconcileRequired(instance.id, 'order_constraints_unavailable', {
          exchangeId,
          marketType,
          symbol: instance.symbol,
          error: this.serializeError(error),
        }))
      return null
    }
  }
```

This keeps non-rate-limit constraint-load failures conservative until Task 3 adds retryable rate-limit handling.

- [ ] **Step 6: Run the focused unit suite and verify it passes**

Run:

```bash
dx test unit quantify
```

Expected: all quantify unit tests pass, including the new grid constraints reuse and submission limit test.

- [ ] **Step 7: Commit Task 2**

Run:

```bash
git add apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.ts apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.spec.ts
git commit -F - <<'MSG'
fix: bound grid order submissions per sync

变更说明：
- 网格同步每轮只拉取一次合约约束并复用到 planned order 准备阶段
- 限制单轮 planned order 提交数量，降低 OKX 限频压力

Refs: #955
MSG
```

Expected: commit succeeds.

## Task 3: Retryable OKX Rate Limit Handling

**Files:**
- Modify: `apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.ts`
- Test: `apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.spec.ts`

- [ ] **Step 1: Add failing test for OKX 50011 during submit**

In `apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.spec.ts`, add this test near the existing submit failure tests:

```ts
  it('keeps runtime running and restores planned order when OKX rate limits submission', async () => {
    const repository = createRepository()
    repository.listOrders.mockResolvedValue([
      createOrder({
        id: 'planned-order-1',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
      }),
      createOrder({
        id: 'planned-order-2',
        clientOrderId: null,
        exchangeOrderId: null,
        status: 'PLANNED',
      }),
    ])
    const tradingService = createTradingService()
    tradingService.getOpenOrders.mockResolvedValue([])
    tradingService.getClosedOrders.mockResolvedValue([])
    tradingService.placeOrder.mockRejectedValue(new Error('OKX order creation failed: OKX error 50011: Too Many Requests'))
    const stateMachine = createStateMachine()
    const service = createService(repository, tradingService, stateMachine)

    await service.syncInstance('grid-1')

    const submittedClientOrderId = repository.markOrderSubmitting.mock.calls[0]?.[0]?.clientOrderId
    expect(repository.markOrderSubmitting).toHaveBeenCalledTimes(1)
    expect(repository.markOrderPlanned).toHaveBeenCalledWith({
      id: 'planned-order-1',
      rawPayload: expect.objectContaining({
        source: 'grid_order_sync',
        execution: expect.objectContaining({
          status: 'rate_limited',
          clientOrderId: submittedClientOrderId,
          reason: 'OKX order creation failed: OKX error 50011: Too Many Requests',
        }),
      }),
    })
    expect(repository.appendEvent).toHaveBeenCalledWith({
      gridRuntimeInstanceId: 'grid-1',
      eventType: 'runtime_rate_limited',
      severity: 'warn',
      status: 'RUNNING',
      message: 'OKX order creation failed: OKX error 50011: Too Many Requests',
      payload: expect.objectContaining({
        orderId: 'planned-order-1',
        clientOrderId: submittedClientOrderId,
        exchangeId: 'okx',
        marketType: 'spot',
        symbol: 'BTC/USDT',
      }),
    })
    expect(stateMachine.markReconcileRequired).not.toHaveBeenCalled()
    expect(tradingService.placeOrder).toHaveBeenCalledTimes(1)
  })
```

- [ ] **Step 2: Add repository mock support for appendEvent**

In `createRepository()` in `apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.spec.ts`, add:

```ts
    appendEvent: jest.fn().mockResolvedValue({ id: 'event-1' }),
```

Place it after `updateInstanceLastSyncAt`.

- [ ] **Step 3: Run the focused unit suite and verify the new test fails**

Run:

```bash
dx test unit quantify
```

Expected: the new test fails because submit failures still mark `RECONCILE_REQUIRED` and do not append `runtime_rate_limited`.

- [ ] **Step 4: Add retryable rate-limit helpers**

In `apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.ts`, add these private methods after `loadSubmissionConstraints()`:

```ts
  private isRetryableRateLimitFailure(error: unknown, reason?: string): boolean {
    const candidates = [
      reason,
      error instanceof Error ? error.message : null,
      this.getErrorString(error, 'code'),
      this.getErrorString(error, 'name'),
    ].filter((value): value is string => typeof value === 'string' && value.length > 0)

    return candidates.some((value) => {
      const normalized = value.toLowerCase()
      return normalized.includes('50011')
        || normalized.includes('too many requests')
        || normalized.includes('rate limit')
        || normalized.includes('ratelimiterror')
    })
  }

  private getErrorString(error: unknown, key: string): string | null {
    if (typeof error !== 'object' || error === null || !(key in error)) return null
    const value = (error as Record<string, unknown>)[key]
    return typeof value === 'string' ? value : null
  }

  private async handleRetryableRateLimit(input: {
    instance: RuntimeInstance
    order?: RuntimeOrder
    clientOrderId?: string | null
    exchangeId: ExchangeId
    marketType: MarketType
    reason: string
    error: unknown
  }): Promise<void> {
    const payload = this.toJsonValue({
      source: 'grid_order_sync',
      execution: {
        status: 'rate_limited',
        orderId: input.order?.id ?? null,
        clientOrderId: input.clientOrderId ?? null,
        exchangeId: input.exchangeId,
        marketType: input.marketType,
        symbol: input.instance.symbol,
        reason: input.reason,
        error: this.serializeError(input.error),
      },
    })

    if (input.order && input.clientOrderId) {
      await this.txEvents.withAfterCommit(async () =>
        this.repository.markOrderPlanned({
          id: input.order!.id,
          rawPayload: payload,
        }))
    }

    await this.txEvents.withAfterCommit(async () =>
      this.repository.appendEvent({
        gridRuntimeInstanceId: input.instance.id,
        eventType: 'runtime_rate_limited',
        severity: 'warn',
        status: 'RUNNING',
        message: input.reason,
        payload,
      }))
  }
```

- [ ] **Step 5: Handle rate-limit constraint loading**

Update the `catch` block in `loadSubmissionConstraints()` to:

```ts
    catch (error) {
      const reason = error instanceof Error ? error.message : String(error)
      if (this.isRetryableRateLimitFailure(error, reason)) {
        await this.handleRetryableRateLimit({
          instance,
          exchangeId,
          marketType,
          reason,
          error,
        })
        return null
      }

      await this.txEvents.withAfterCommit(async () =>
        this.stateMachine.markReconcileRequired(instance.id, 'order_constraints_unavailable', {
          exchangeId,
          marketType,
          symbol: instance.symbol,
          error: this.serializeError(error),
        }))
      return null
    }
```

- [ ] **Step 6: Handle rate-limit prepare and submit failures**

In `submitPlannedOrders()`, replace the `prepared.status !== 'prepared'` block with:

```ts
      if (prepared.status !== 'prepared') {
        if (this.isRetryableRateLimitFailure('error' in prepared ? prepared.error : null, prepared.reason)) {
          await this.handleRetryableRateLimit({
            instance,
            order,
            clientOrderId: null,
            exchangeId,
            marketType,
            reason: prepared.reason,
            error: 'error' in prepared ? prepared.error : null,
          })
          return
        }

        await this.txEvents.withAfterCommit(async () =>
          this.stateMachine.markReconcileRequired(instance.id, 'order_submit_failed', {
            orderId: order.id,
            status: prepared.status,
            reason: prepared.reason,
            normalized: 'normalized' in prepared ? this.toJsonValue(prepared.normalized) : null,
            error: 'error' in prepared ? this.serializeError(prepared.error) : null,
          }))
        return
      }
```

In the `submitted.status !== 'submitted'` block, add this check before the current `markReconcileRequired` call:

```ts
      if (submitted.status !== 'submitted') {
        if (this.isRetryableRateLimitFailure('error' in submitted ? submitted.error : null, submitted.reason)) {
          await this.handleRetryableRateLimit({
            instance,
            order,
            clientOrderId,
            exchangeId,
            marketType,
            reason: submitted.reason,
            error: 'error' in submitted ? submitted.error : null,
          })
          return
        }

        await this.txEvents.withAfterCommit(async () =>
```

Keep the existing `markReconcileRequired` payload below that line unchanged.

- [ ] **Step 7: Run the focused unit suite and verify it passes**

Run:

```bash
dx test unit quantify
```

Expected: all quantify unit tests pass, including the new OKX 50011 retryable handling test.

- [ ] **Step 8: Commit Task 3**

Run:

```bash
git add apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.ts apps/quantify/src/modules/grid-runtime/services/grid-order-sync.service.spec.ts
git commit -F - <<'MSG'
fix: keep grid runtime running on OKX rate limits

变更说明：
- 将 OKX 50011/Too Many Requests 识别为可重试限频
- 限频时回退当前订单到 PLANNED 并记录 runtime_rate_limited 事件
- 保留非限频失败进入 RECONCILE_REQUIRED 的保守路径

Refs: #955
MSG
```

Expected: commit succeeds.

## Task 4: Regression Verification and Final Commit State

**Files:**
- Read: `docs/superpowers/specs/2026-05-04-grid-runtime-rate-limit-design.md`
- Verify: changed files from Tasks 1-3

- [ ] **Step 1: Run lint**

Run:

```bash
dx lint
```

Expected: lint passes.

- [ ] **Step 2: Run quantify unit tests**

Run:

```bash
dx test unit quantify
```

Expected: all quantify unit tests pass.

- [ ] **Step 3: Build quantify**

Run:

```bash
dx build quantify --dev
```

Expected: quantify builds successfully.

- [ ] **Step 4: Review git status**

Run:

```bash
git status --short --branch
```

Expected: branch is `codex/docs/955-grid-runtime-rate-limit-design` or the active implementation branch, and the working tree is clean.

- [ ] **Step 5: Summarize implementation evidence**

Prepare a final note with:

```text
Implemented:
- TradingExecutionService can reuse preloaded constraints while preserving old callers.
- Grid runtime sync fetches constraints once per cycle and submits at most 3 planned orders.
- OKX 50011/Too Many Requests leaves runtime RUNNING, restores the current order to PLANNED, and records runtime_rate_limited.

Verified:
- dx lint
- dx test unit quantify
- dx build quantify --dev
```

Expected: the summary only claims commands that actually passed.
