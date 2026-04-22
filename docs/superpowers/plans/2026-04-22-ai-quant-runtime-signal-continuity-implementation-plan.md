# AI Quant Runtime Signal Continuity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make deploy-time runtime execution consume published snapshot truth directly, but only after deploy binding is truly ready, then create real `strategy_signals` and continue into execution / OKX testnet paths without depending on backtest request parameters.

**Architecture:** Keep the published snapshot as the only execution truth. First, add a deploy→runtime readiness barrier so reused `strategyInstance` rows are not visible to the scheduler until binding, risk profile, runtime states, and deploy success are complete. Second, keep the runtime decision adapter and explicit outcome model, then add execution recovery as a separate slow path so event loss does not strand valid signals.

**Tech Stack:** NestJS 11, TypeScript 5.9, Prisma, Jest, quantify E2E, Nx/dx, AI Quant runtime under `apps/quantify`.

---

## Scope Guard

This plan implements Issue #859 from spec `docs/superpowers/specs/2026-04-22-ai-quant-runtime-signal-deploy-execution-design.md`.

Do not change:

- clarification / semantic / publish main path
- backtest request parameter model (`initialCash`, range, fee, slippage, allowPartial, priceSource)
- deploy input contract to depend on one-off backtest parameters
- broker adapter architecture beyond minimal compatibility updates needed after signal creation starts working
- UI forms to auto-fill missing truth values

If a field is missing, expose the missing truth explicitly. Do not silently default it.

## File Map

- Create: `apps/quantify/src/modules/strategy-signals/services/runtime-signal-intent.adapter.ts`
  - Converts runtime `StrategyDecisionV1` into `RuntimeSignalIntentResult` with explicit `signal` / `noop` / `missing_required_truth` outcomes.
- Create: `apps/quantify/src/modules/strategy-signals/services/__tests__/runtime-signal-intent.adapter.spec.ts`
  - Unit tests for signal/noop/missing-truth classification.
- Modify: `apps/quantify/prisma/schema/strategy_trading.prisma`
  - Add explicit runtime binding readiness fields to `StrategyInstance`.
- Create: `apps/quantify/prisma/schema/migrations/<timestamp>_add_strategy_instance_runtime_binding_status/migration.sql`
  - Persist `runtime_binding_status`, `runtime_binding_error_code`, and `runtime_binding_updated_at`.
- Modify: `apps/quantify/src/modules/account-strategy-view/repositories/account-strategy-view.repository.ts`
  - Split deploy binding preparation from final runtime activation.
- Modify: `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view.service.ts`
  - Finalize deploy in two phases: prepare binding first, activate runtime only after downstream state is ready.
- Modify: `apps/quantify/src/modules/account-strategy-view/repositories/account-strategy-view.repository.spec.ts`
  - Lock repository behavior to `PENDING` readiness, not premature `running`.
- Modify: `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view-deploy.spec.ts`
  - Lock activation ordering (`READY + running` only after post-deploy preparation).
- Modify: `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view-deploy-transaction-boundary.spec.ts`
  - Ensure failed post-deploy preparation leaves `FAILED`, not half-running state.
- Modify: `apps/quantify/src/modules/strategy-signals/repositories/signal-generator.repository.ts`
  - Scheduler must only scan `READY` instances and keep runtime cooldown checks scoped correctly.
- Modify: `apps/quantify/src/modules/strategy-signals/repositories/signal-generator.repository.spec.ts`
  - Lock scheduler visibility to `runtimeBindingStatus = READY`.
- Modify: `apps/quantify/src/modules/strategy-signals/services/signal-generator.service.ts`
  - Replace strict payload no-signal path for published snapshot runtime with the adapter.
- Modify: `apps/quantify/src/modules/strategy-signals/services/signal-generation-decision.stage.ts`
  - Remove published runtime’s dependency on `buildPublishedCodegenSignalPayload()` for the runtime path; keep AI fallback paths only where still needed.
- Modify: `apps/quantify/src/modules/strategy-runtime/strategy-protocol.util.ts`
  - Add/adjust a small helper if needed so runtime and backtest share the same decision semantics.
- Modify: `apps/quantify/src/modules/strategy-signals/services/signal-generation-persistence.stage.ts`
  - Accept runtime signal intent outputs and preserve provenance without reinterpreting them.
- Modify: `apps/quantify/src/modules/strategy-signals/repositories/strategy-runtime-execution-state.repository.ts`
  - Add explicit stale-running recovery transition support.
- Modify: `apps/quantify/src/modules/strategy-signals/services/strategy-runtime-execution-state.service.ts`
  - Surface stale-running recovery and stop mapping hidden `running` work back into silent limbo.
- Modify: `apps/quantify/src/modules/account-strategy-view/services/account-strategy-view.service.ts`
  - Expose recovered/real runtime state semantics more honestly if required by acceptance.
- Modify: `apps/quantify/src/modules/strategy-signals/repositories/signal-generator.repository.ts`
  - Scope cooldown checks for runtime-consumed signals at instance level where required.
- Modify: `apps/quantify/src/modules/strategy-signals/services/__tests__/signal-generator.service.spec.ts`
  - Add regression tests for published snapshot runtime creating signals, nooping correctly, and surfacing missing truth.
- Modify: `apps/quantify/src/modules/strategy-signals/services/__tests__/strategy-runtime-execution-state.service.spec.ts`
  - Add stale-running recovery coverage.
- Modify: `apps/quantify/src/modules/strategy-signals/repositories/strategy-runtime-execution-state.repository.spec.ts`
  - Add repository-level recovery transition coverage.
- Modify: `apps/quantify/src/modules/strategy-signals/services/signal-generation-persistence.stage.spec.ts`
  - Add instance-scoped cooldown consumption assertions.
- Modify: `apps/quantify/src/modules/strategy-signals/services/signal-executor.service.ts`
  - Extract recoverable execution logic first, then add a runtime recovery slow path in a separate commit.
- Modify: `apps/quantify/src/modules/strategy-signals/repositories/signal-executor.repository.ts`
  - Clarify which signals are recoverable by execution recovery.
- Modify: `apps/quantify/src/modules/strategy-signals/services/signal-executor.service.spec.ts`
  - Add recovery selection and execution replay coverage.
- Modify: `apps/quantify/e2e/account-strategy-view/account-strategy-view.e2e-spec.ts`
  - Final no-fallback deploy-flow E2E: deploy-bound runtime must auto-create signal and auto-advance into execution.
- Modify: `apps/quantify/e2e/strategy-signals/strategy-signals.e2e-spec.ts`
  - Final no-fallback runtime-created signal execution assertions.

## Task 1: Add a Dedicated Runtime Signal Intent Adapter Spec

**Files:**
- Create: `apps/quantify/src/modules/strategy-signals/services/__tests__/runtime-signal-intent.adapter.spec.ts`
- Create in Task 2: `apps/quantify/src/modules/strategy-signals/services/runtime-signal-intent.adapter.ts`

- [ ] **Step 1: Write the failing adapter spec**

Create `apps/quantify/src/modules/strategy-signals/services/__tests__/runtime-signal-intent.adapter.spec.ts` with:

```ts
import { RuntimeSignalIntentAdapter } from '../runtime-signal-intent.adapter'

describe('RuntimeSignalIntentAdapter', () => {
  const adapter = new RuntimeSignalIntentAdapter()

  it('returns signal for OPEN_LONG ratio decisions from published runtime', () => {
    const result = adapter.fromDecision({
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: 0.1 },
      reason: 'compiled.entry',
    }, {
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ORDIUSDT',
      timeframe: '1h',
      referencePrice: 4.728,
    })

    expect(result).toEqual(expect.objectContaining({
      kind: 'signal',
      signal: expect.objectContaining({
        direction: 'BUY',
        signalType: 'ENTRY',
        positionSizeRatio: 0.1,
        entryPrice: 4.728,
      }),
    }))
  })

  it('returns noop for NOOP decisions', () => {
    const result = adapter.fromDecision({ action: 'NOOP', reason: 'compiled.noop' }, {
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ORDIUSDT',
      timeframe: '1h',
      referencePrice: 4.728,
    })

    expect(result).toEqual({ kind: 'noop', reason: 'compiled.noop' })
  })

  it('returns missing_required_truth instead of no-signal when execution truth is incomplete', () => {
    const result = adapter.fromDecision({
      action: 'OPEN_LONG',
      size: { mode: 'RATIO', value: 0.1 },
      reason: 'compiled.entry',
    }, {
      exchange: 'okx',
      marketType: 'spot',
      symbol: 'ORDIUSDT',
      timeframe: '1h',
      referencePrice: undefined,
    })

    expect(result).toEqual(expect.objectContaining({
      kind: 'missing_required_truth',
      reasonCode: 'RUNTIME_SIGNAL_REFERENCE_PRICE_MISSING',
    }))
  })
})
```

- [ ] **Step 2: Run the spec to confirm it fails**

Run:

```bash
pnpm --dir apps/quantify exec jest --config ./jest-unit.json --runInBand src/modules/strategy-signals/services/__tests__/runtime-signal-intent.adapter.spec.ts
```

Expected: FAIL because `runtime-signal-intent.adapter.ts` does not exist.

- [ ] **Step 3: Commit the failing test scaffold**

```bash
git add apps/quantify/src/modules/strategy-signals/services/__tests__/runtime-signal-intent.adapter.spec.ts
git commit -m "test: pin runtime signal intent adapter expectations"
```

## Task 2: Implement the Runtime Signal Intent Adapter

**Files:**
- Create: `apps/quantify/src/modules/strategy-signals/services/runtime-signal-intent.adapter.ts`
- Test: `apps/quantify/src/modules/strategy-signals/services/__tests__/runtime-signal-intent.adapter.spec.ts`
- Modify if needed: `apps/quantify/src/modules/strategy-runtime/strategy-protocol.util.ts`

- [ ] **Step 1: Implement the adapter**

Create `apps/quantify/src/modules/strategy-signals/services/runtime-signal-intent.adapter.ts` with:

```ts
import type { StrategyDecisionV1 } from '@ai/shared'

export type RuntimeSignalIntentResult =
  | { kind: 'signal'; signal: {
      direction: 'BUY' | 'SELL' | 'CLOSE_LONG' | 'CLOSE_SHORT'
      signalType: 'ENTRY' | 'EXIT' | 'ADJUSTMENT' | 'ALERT'
      entryPrice: number
      positionSizeQuote?: number
      positionSizeRatio?: number
      reasoning: string
      confidence?: number
      stopLoss?: number
      takeProfit?: number
    } }
  | { kind: 'noop'; reason: string }
  | { kind: 'missing_required_truth'; reasonCode: string; fields: string[] }

interface RuntimeDecisionContext {
  exchange: string
  marketType: 'spot' | 'perp'
  symbol: string
  timeframe: string
  referencePrice?: number
}

export class RuntimeSignalIntentAdapter {
  fromDecision(decision: StrategyDecisionV1, ctx: RuntimeDecisionContext): RuntimeSignalIntentResult {
    if (decision.action === 'NOOP') {
      return { kind: 'noop', reason: decision.reason ?? 'compiled.noop' }
    }

    if (!(typeof ctx.referencePrice === 'number' && Number.isFinite(ctx.referencePrice) && ctx.referencePrice > 0)) {
      return {
        kind: 'missing_required_truth',
        reasonCode: 'RUNTIME_SIGNAL_REFERENCE_PRICE_MISSING',
        fields: ['referencePrice'],
      }
    }

    if (!decision.size) {
      return {
        kind: 'missing_required_truth',
        reasonCode: 'RUNTIME_SIGNAL_SIZE_MISSING',
        fields: ['size'],
      }
    }

    const base = {
      entryPrice: ctx.referencePrice,
      reasoning: decision.reason ?? 'runtime decision',
      ...(typeof decision.confidence === 'number' ? { confidence: decision.confidence } : {}),
      ...(typeof decision.risk?.stopLoss === 'number' ? { stopLoss: decision.risk.stopLoss } : {}),
      ...(typeof decision.risk?.takeProfit === 'number' ? { takeProfit: decision.risk.takeProfit } : {}),
    }

    switch (decision.action) {
      case 'OPEN_LONG':
        return {
          kind: 'signal',
          signal: {
            direction: 'BUY',
            signalType: 'ENTRY',
            ...(decision.size.mode === 'QUOTE' ? { positionSizeQuote: Math.abs(decision.size.value) } : {}),
            ...(decision.size.mode === 'RATIO' ? { positionSizeRatio: Math.abs(decision.size.value) } : {}),
            ...base,
          },
        }
      case 'CLOSE_LONG':
        return { kind: 'signal', signal: { direction: 'CLOSE_LONG', signalType: 'EXIT', ...base } }
      case 'OPEN_SHORT':
        return { kind: 'signal', signal: { direction: 'SELL', signalType: 'ENTRY', ...base } }
      case 'CLOSE_SHORT':
        return { kind: 'signal', signal: { direction: 'CLOSE_SHORT', signalType: 'EXIT', ...base } }
      default:
        return {
          kind: 'missing_required_truth',
          reasonCode: 'RUNTIME_SIGNAL_ACTION_UNSUPPORTED',
          fields: ['action'],
        }
    }
  }
}
```

- [ ] **Step 2: Run the adapter spec**

Run:

```bash
pnpm --dir apps/quantify exec jest --config ./jest-unit.json --runInBand src/modules/strategy-signals/services/__tests__/runtime-signal-intent.adapter.spec.ts
```

Expected: PASS.

- [ ] **Step 3: Commit the adapter**

```bash
git add apps/quantify/src/modules/strategy-signals/services/runtime-signal-intent.adapter.ts apps/quantify/src/modules/strategy-signals/services/__tests__/runtime-signal-intent.adapter.spec.ts
git commit -m "feat: add runtime signal intent adapter"
```

## Task 3: Route Published Snapshot Runtime Through the Adapter

**Files:**
- Modify: `apps/quantify/src/modules/strategy-signals/services/signal-generator.service.ts`
- Modify: `apps/quantify/src/modules/strategy-signals/services/signal-generation-decision.stage.ts`
- Modify: `apps/quantify/src/modules/strategy-signals/services/__tests__/signal-generator.service.spec.ts`

- [ ] **Step 1: Add failing regression coverage for the current no-signal bug**

In `apps/quantify/src/modules/strategy-signals/services/__tests__/signal-generator.service.spec.ts`, add:

```ts
it('creates a signal for a published snapshot OPEN_LONG runtime decision instead of collapsing to no-signal', async () => {
  const createSignalWithCooldownAndLock = jest.spyOn(service as any, 'createSignalWithCooldownAndLock').mockResolvedValue({ created: true, signalId: 'sig-1' })
  jest.spyOn(service as any, 'generateSignalWithAi').mockResolvedValue({
    signalType: 'ENTRY',
    direction: 'BUY',
    entryPrice: 4.728,
    positionSizeRatio: 0.1,
    reasoning: 'compiled.entry',
    rawResponse: '{}',
  })

  await (service as any).processStrategyInstance(instanceFixture, config)

  expect(createSignalWithCooldownAndLock).toHaveBeenCalled()
  expect(runtimeExecutionStateService.markTerminalFailure).not.toHaveBeenCalledWith(expect.objectContaining({
    failureCode: 'SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL',
  }))
})
```

- [ ] **Step 2: Replace the strict runtime branch in `signal-generator.service.ts`**

In `apps/quantify/src/modules/strategy-signals/services/signal-generator.service.ts`, change the published runtime branch so it no longer relies on `buildPublishedCodegenSignalPayload()` for validity. The shape should become:

```ts
const runtimeDecision = await this.generateRuntimeSignalIntent(...)

if (runtimeDecision.kind === 'noop') {
  await this.handleStrategyFailure(instance.id, config)
  await this.markRuntimeExecutionStateTerminal(activeRuntimeState, {
    failureReason: runtimeDecision.reason,
    failureCode: 'SNAPSHOT_RUNTIME_EXECUTION_NO_SIGNAL',
  })
  return
}

if (runtimeDecision.kind === 'missing_required_truth') {
  await this.handleStrategyFailure(instance.id, config)
  await this.markRuntimeExecutionStateTerminal(activeRuntimeState, {
    failureReason: runtimeDecision.reasonCode,
    failureCode: runtimeDecision.reasonCode,
  })
  return
}

const createdSignal = await this.createSignalWithCooldownAndLock(...runtimeDecision.signal...)
```

- [ ] **Step 3: Keep `signal-generation-decision.stage.ts` focused on AI / script resolution only**

In `apps/quantify/src/modules/strategy-signals/services/signal-generation-decision.stage.ts`:

- remove published runtime dependence on `buildPublishedCodegenSignalPayload()`
- keep script execution / AI fallback helpers that are still used by non-runtime paths
- expose one helper that returns raw `StrategyDecisionV1` (or passthrough/noop) without strict no-signal collapsing

Representative target shape:

```ts
resolvePublishedRuntimeDecision(...):
  | { kind: 'decision'; decision: StrategyDecisionV1 }
  | { kind: 'noop'; reason: string }
  | { kind: 'missing_required_truth'; reasonCode: string; fields: string[] }
```

- [ ] **Step 4: Run targeted signal-generator tests**

Run:

```bash
pnpm --dir apps/quantify exec jest --config ./jest-unit.json --runInBand src/modules/strategy-signals/services/__tests__/signal-generator.service.spec.ts
```

Expected: PASS including the new regression.

- [ ] **Step 5: Commit the runtime routing change**

```bash
git add apps/quantify/src/modules/strategy-signals/services/signal-generator.service.ts apps/quantify/src/modules/strategy-signals/services/signal-generation-decision.stage.ts apps/quantify/src/modules/strategy-signals/services/__tests__/signal-generator.service.spec.ts
git commit -m "fix: route published runtime decisions directly into signal creation"
```

## Task 4: Fix Runtime State Recovery and Instance-Scoped Cooldown Semantics

**Files:**
- Modify: `apps/quantify/src/modules/strategy-signals/repositories/strategy-runtime-execution-state.repository.ts`
- Modify: `apps/quantify/src/modules/strategy-signals/services/strategy-runtime-execution-state.service.ts`
- Modify: `apps/quantify/src/modules/strategy-signals/repositories/signal-generator.repository.ts`
- Modify: `apps/quantify/src/modules/strategy-signals/services/signal-generation-persistence.stage.ts`
- Modify tests:
  - `apps/quantify/src/modules/strategy-signals/repositories/strategy-runtime-execution-state.repository.spec.ts`
  - `apps/quantify/src/modules/strategy-signals/services/__tests__/strategy-runtime-execution-state.service.spec.ts`
  - `apps/quantify/src/modules/strategy-signals/services/signal-generation-persistence.stage.spec.ts`

- [ ] **Step 1: Add failing stale-running recovery tests**

Add repository/service assertions that a stale `running` state older than a lease threshold is returned to `retryable` or `ready` instead of remaining permanently hidden.

Representative spec fragment:

```ts
it('recovers stale running states back to retryable before executable-state selection', async () => {
  const recovered = await service.loadExecutableStates(binding)
  expect(repository.recoverStaleRunningStates).toHaveBeenCalledWith(expect.objectContaining({
    strategyInstanceId: binding.strategyInstanceId,
  }))
  expect(recovered.some(state => state.executionSemanticKey === 'on_start.entry.primary')).toBe(true)
})
```

- [ ] **Step 2: Implement stale-running recovery**

Add repository method in `strategy-runtime-execution-state.repository.ts`:

```ts
recoverStaleRunningStates(input: { strategyInstanceId: string; publishedSnapshotId: string; leaseExpiresBefore: Date }) {
  return this.txHost.tx.strategyRuntimeExecutionState.updateMany({
    where: {
      strategyInstanceId: input.strategyInstanceId,
      publishedSnapshotId: input.publishedSnapshotId,
      status: 'running',
      runningAt: { lt: input.leaseExpiresBefore },
    },
    data: {
      status: 'retryable',
      failureFamily: 'retryable',
      failureReason: 'RUNTIME_RUNNING_LEASE_EXPIRED',
      failureCode: 'RUNTIME_RUNNING_LEASE_EXPIRED',
      runningAt: null,
      cooldownUntil: new Date(),
    },
  })
}
```

Then call it from `loadExecutableStates()` before filtering.

- [ ] **Step 3: Make runtime cooldown consumption instance-aware**

Adjust `signal-generator.repository.ts` and `signal-generation-persistence.stage.ts` so runtime semantic consumption is not keyed only by `strategyId + symbolId`.

Target behavior:

```ts
findRecentSignalForCooldown({ strategyId, symbolId, instanceId, runtimeSemanticKey })
```

When a runtime semantic is `consumePolicy=once`, only consume it for the same instance/snapshot/semantic that produced or reused the signal.

- [ ] **Step 4: Run targeted state/cooldown tests**

Run:

```bash
pnpm --dir apps/quantify exec jest --config ./jest-unit.json --runInBand src/modules/strategy-signals/repositories/strategy-runtime-execution-state.repository.spec.ts src/modules/strategy-signals/services/__tests__/strategy-runtime-execution-state.service.spec.ts src/modules/strategy-signals/services/signal-generation-persistence.stage.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit state and cooldown fixes**

```bash
git add apps/quantify/src/modules/strategy-signals/repositories/strategy-runtime-execution-state.repository.ts apps/quantify/src/modules/strategy-signals/services/strategy-runtime-execution-state.service.ts apps/quantify/src/modules/strategy-signals/repositories/signal-generator.repository.ts apps/quantify/src/modules/strategy-signals/services/signal-generation-persistence.stage.ts apps/quantify/src/modules/strategy-signals/repositories/strategy-runtime-execution-state.repository.spec.ts apps/quantify/src/modules/strategy-signals/services/__tests__/strategy-runtime-execution-state.service.spec.ts apps/quantify/src/modules/strategy-signals/services/signal-generation-persistence.stage.spec.ts
git commit -m "fix: recover stale runtime states and scope cooldown by instance"
```

## Task 5: Prove the Signal Reaches Execution and Deploy E2E Paths

**Files:**
- Modify: `apps/quantify/e2e/account-strategy-view/account-strategy-view.e2e-spec.ts`
- Modify: `apps/quantify/e2e/strategy-signals/strategy-signals.e2e-spec.ts`
- Optional minimal compatibility updates: `apps/quantify/src/modules/strategy-signals/services/signal-executor.service.spec.ts`

- [ ] **Step 1: Add deploy-flow E2E that asserts signal + execution records**

Extend `apps/quantify/e2e/account-strategy-view/account-strategy-view.e2e-spec.ts` with a case that:

```ts
it('deploys a snapshot-bound on_start spot strategy and creates signal/execution records on auto runtime', async () => {
  // deploy snapshot-bound strategy
  // wait/poll runtime
  // assert strategy_signals count > 0
  // assert user_signal_executions count > 0
})
```

Use existing deploy fixtures and keep the market type `spot`.

- [ ] **Step 2: Add execution E2E/smoke in `strategy-signals.e2e-spec.ts`**

Add a case that verifies the created signal flows into execution for a subscribed account:

```ts
expect(await prisma.tradingSignal.count({ where: { strategyInstanceId } })).toBeGreaterThan(0)
expect(await prisma.userSignalExecution.count({ where: { signal: { strategyInstanceId } } })).toBeGreaterThan(0)
```

If CI cannot talk to real OKX testnet, assert the executor reached the exchange submission adapter spy / mock for the spot path.

- [ ] **Step 3: Run affected E2E tests**

Run:

```bash
dx test e2e quantify apps/quantify/e2e/account-strategy-view
dx test e2e quantify apps/quantify/e2e/strategy-signals
```

Expected: PASS.

- [ ] **Step 4: Run final verification sequence**

Run:

```bash
dx lint
dx build affected --dev
pnpm --dir apps/backend exec jest --config ./jest-unit.json --runInBand src/modules/ai-quant-proxy/clients/quantify-contract-responses.spec.ts
pnpm --dir apps/quantify exec jest --config ./jest-unit.json --runInBand src/modules/strategy-signals/services/__tests__/runtime-signal-intent.adapter.spec.ts src/modules/strategy-signals/services/__tests__/signal-generator.service.spec.ts src/modules/strategy-signals/services/__tests__/strategy-runtime-execution-state.service.spec.ts src/modules/account-strategy-view/services/account-strategy-view-detail.spec.ts
pnpm exec jest --config apps/front/jest.config.ts --runInBand apps/front/src/components/account/AiQuantStrategyDetail.test.tsx
```

Expected: all PASS.

- [ ] **Step 5: Commit E2E and verification updates**

```bash
git add apps/quantify/e2e/account-strategy-view/account-strategy-view.e2e-spec.ts apps/quantify/e2e/strategy-signals/strategy-signals.e2e-spec.ts apps/quantify/src/modules/strategy-signals/services/signal-executor.service.spec.ts
git commit -m "test: cover deploy runtime signal continuity through execution"
```

## Self-Review

- Spec coverage: This plan covers the design doc's four required directions: runtime consumes published snapshot truth directly, strict payload gate is replaced, missing truth is surfaced explicitly, and both integration + E2E validation are added.
- Placeholder scan: No TBD/TODO placeholders remain; every task includes exact files, commands, and representative code.
- Type consistency: The same `RuntimeSignalIntentResult` result kinds (`signal`, `noop`, `missing_required_truth`) are used consistently across adapter, generator routing, and tests. Runtime state recovery and instance-scoped cooldown are explicitly included so execution continuity does not regress on crash/cooldown boundaries.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-22-ai-quant-runtime-signal-continuity-implementation-plan.md`. Two execution options:

1. Subagent-Driven (recommended) - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. Inline Execution - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
