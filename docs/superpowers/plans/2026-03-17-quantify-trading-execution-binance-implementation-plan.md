# Quantify Trading Execution Binance Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a product-grade automatic execution loop for `Binance spot + Binance perp` in `apps/quantify`, with explicit execution states, stable ledger application, and reconciliation-ready compensation semantics.

**Architecture:** Evolve the current `strategy-signals -> trading -> positions/accounts -> position-sync` path into a clear execution pipeline. Keep `signal-executor` as the orchestrator, keep `trading` as the broker adapter layer, keep `positions/accounts` as the local ledger, and demote `position-sync` to compensation only. The first slice is Binance-focused, but all new interfaces must separate Binance-specific logic from reusable execution framework logic.

**Tech Stack:** NestJS 11, Prisma 7, PostgreSQL, TypeScript 5, Jest, Nx/dx, class-validator, existing `quantify` E2E harness

---

## File Map

### Existing files expected to change

- `apps/quantify/prisma/schema/strategy_trading.prisma`
  Responsibility: execution/ledger schema and enums
- `apps/quantify/src/modules/strategy-signals/services/signal-executor.service.ts`
  Responsibility: execution orchestration
- `apps/quantify/src/modules/strategy-signals/repositories/signal-execution.repository.ts`
  Responsibility: execution persistence API
- `apps/quantify/src/modules/trading/trading.service.ts`
  Responsibility: broker-facing application service
- `apps/quantify/src/modules/trading/core/types.ts`
  Responsibility: shared trading contracts
- `apps/quantify/src/modules/trading/exchanges/binance-client.ts`
  Responsibility: Binance spot/perp adapter
- `apps/quantify/src/modules/positions/positions.service.ts`
  Responsibility: local position/trade ledger application
- `apps/quantify/src/modules/positions/dto/record-trade.dto.ts`
  Responsibility: local trade recording contract
- `apps/quantify/src/modules/positions/position-sync.service.ts`
  Responsibility: reconciliation and compensation
- `apps/quantify/src/modules/accounts/accounts.service.ts`
  Responsibility: balance/equity/PnL ledger updates
- `apps/quantify/src/modules/exchange-accounts/exchange-accounts.controller.ts`
  Responsibility: exchange account API boundary
- `apps/quantify/src/modules/accounts/accounts.controller.ts`
  Responsibility: strategy account API boundary
- `apps/quantify/src/modules/positions/positions.controller.ts`
  Responsibility: position API boundary
- `apps/quantify/e2e/trading/trading.e2e-spec.ts`
  Responsibility: broker adapter E2E
- `apps/quantify/e2e/strategy-signals/strategy-signals.e2e-spec.ts`
  Responsibility: signal generation/execution E2E
- `apps/quantify/e2e/exchange-accounts/exchange-accounts.e2e-spec.ts`
  Responsibility: exchange account behavior E2E

### New files to create

- `apps/quantify/src/modules/trading/core/execution-stage.ts`
  Responsibility: shared execution stage constants/types
- `apps/quantify/src/modules/trading/core/symbol-normalizer.ts`
  Responsibility: normalize internal symbol <-> exchange symbol semantics
- `apps/quantify/src/modules/trading/core/symbol-normalizer.spec.ts`
  Responsibility: unit coverage for symbol normalization
- `apps/quantify/src/modules/strategy-signals/services/signal-executor.service.spec.ts`
  Responsibility: orchestrator-focused unit tests for staged execution
- `apps/quantify/e2e/trading/binance-execution.e2e-spec.ts`
  Responsibility: full `signal -> execution -> ledger` Binance execution loop
- `apps/quantify/e2e/trading/binance-reconciliation.e2e-spec.ts`
  Responsibility: compensation/reconciliation behavior

### Optional split files if `signal-executor.service.ts` grows further

- `apps/quantify/src/modules/strategy-signals/services/execution-precheck.service.ts`
- `apps/quantify/src/modules/strategy-signals/services/execution-ledger.service.ts`

Only create these if the existing file becomes too large to modify safely.

## Implementation Rules

- Start from an issue branch, not `main`.
- Follow TDD: failing test first, then minimal implementation, then full verification.
- Prefer `dx` commands for repo-standard verification.
- Keep Binance-specific logic in `trading` or symbol helpers, not inside `signal-executor`.
- Do not let reconciliation become the primary business path again.

## Chunk 1: Execution Contract and Binance Main Path

### Task 1: Create issue branch and capture clean baseline

**Files:**
- Modify: none
- Test: none

- [ ] **Step 1: Create or confirm issue ID for this implementation**

Use the repository workflow requirement before editing code.

Expected: a valid issue number such as `#4xx`.

- [ ] **Step 2: Create the working branch from `main`**

Run:

```bash
git switch -c codex/fix/<issue-id>-quantify-binance-execution
```

Expected: branch created from latest `main`.

- [ ] **Step 3: Capture clean baseline**

Run:

```bash
git status --short --branch
dx lint
dx build quantify --dev
```

Expected:

- `git status` shows only the new branch header
- `dx lint` passes
- `dx build quantify --dev` passes

- [ ] **Step 4: Commit nothing yet**

Do not commit until the first real code/test slice exists.

### Task 2: Add explicit execution stage contract

**Files:**
- Create: `apps/quantify/src/modules/trading/core/execution-stage.ts`
- Modify: `apps/quantify/prisma/schema/strategy_trading.prisma`
- Modify: `apps/quantify/src/modules/strategy-signals/repositories/signal-execution.repository.ts`
- Modify: `apps/quantify/src/modules/trading/core/types.ts`
- Test: `apps/quantify/src/modules/strategy-signals/services/signal-executor.service.spec.ts`

- [ ] **Step 1: Write the failing repository/orchestrator test**

Add a test that expects execution metadata to capture stage transitions:

```ts
expect(execution.metadata).toMatchObject({
  stage: 'PRECHECK_PASSED',
  stageHistory: expect.arrayContaining([
    expect.objectContaining({ stage: 'RESOLVED_ACCOUNT' }),
  ]),
})
```

- [ ] **Step 2: Run the focused test to confirm failure**

Run:

```bash
dx test unit quantify
```

Expected: FAIL because the stage contract does not exist yet.

- [ ] **Step 3: Define execution stage constants and helper type**

Add `execution-stage.ts` with a narrow, reusable contract:

```ts
export const EXECUTION_STAGES = [
  'RESOLVED_ACCOUNT',
  'PRECHECK_PASSED',
  'ORDER_SUBMITTED',
  'ORDER_ACKED',
  'LEDGER_APPLIED',
  'RECONCILE_REQUIRED',
  'COMPLETED',
] as const

export type ExecutionStage = (typeof EXECUTION_STAGES)[number]
```

- [ ] **Step 4: Extend schema-facing execution metadata shape**

Keep `ExecutionStatus` enum unchanged for now, but plan for metadata like:

```ts
type ExecutionMetadata = {
  stage?: ExecutionStage
  stageHistory?: Array<{ stage: ExecutionStage; at: string; note?: string }>
  exchangeAccountId?: string | null
  orderRequest?: Record<string, unknown>
  orderResponse?: Record<string, unknown>
  ledgerApplied?: boolean
  reconcileRequired?: boolean
}
```

- [ ] **Step 5: Update `SignalExecutionRepository` helpers**

Add repository methods or payload support to:

- append stage history
- persist `exchangeAccountId`
- persist request/response snapshots
- mark ledger application success/failure separately

- [ ] **Step 6: Re-run unit tests**

Run:

```bash
dx test unit quantify
```

Expected: PASS for the new execution-stage assertions.

- [ ] **Step 7: Commit the execution contract slice**

```bash
git add apps/quantify/prisma/schema/strategy_trading.prisma \
  apps/quantify/src/modules/trading/core/execution-stage.ts \
  apps/quantify/src/modules/trading/core/types.ts \
  apps/quantify/src/modules/strategy-signals/repositories/signal-execution.repository.ts \
  apps/quantify/src/modules/strategy-signals/services/signal-executor.service.spec.ts
git commit -F - <<'MSG'
feat: add quantify execution stage contract

- add staged execution metadata contract
- prepare signal execution persistence for ledger-aware flow

Refs: #<issue-id>
MSG
```

### Task 3: Normalize symbol semantics for Binance spot and perp

**Files:**
- Create: `apps/quantify/src/modules/trading/core/symbol-normalizer.ts`
- Create: `apps/quantify/src/modules/trading/core/symbol-normalizer.spec.ts`
- Modify: `apps/quantify/src/modules/trading/exchanges/binance-client.ts`
- Modify: `apps/quantify/src/modules/positions/positions.service.ts`
- Modify: `apps/quantify/src/modules/positions/dto/record-trade.dto.ts`
- Test: `apps/quantify/src/modules/trading/core/symbol-normalizer.spec.ts`
- Test: `apps/quantify/e2e/trading/trading.e2e-spec.ts`

- [ ] **Step 1: Write failing normalization tests**

Add tests for the expected canonical format:

```ts
expect(normalizeExecutionSymbol('BTCUSDT', 'spot', 'binance')).toBe('BTC/USDT')
expect(normalizeExecutionSymbol('BTCUSDT', 'perp', 'binance')).toBe('BTC/USDT:PERP')
expect(normalizeLedgerSymbol('BTC/USDT:PERP')).toBe('BTCUSDT')
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
dx test unit quantify
```

Expected: FAIL because normalizers do not exist.

- [ ] **Step 3: Implement the normalizer**

Create a focused helper with no Nest dependencies:

```ts
export function normalizeExecutionSymbol(
  raw: string,
  marketType: 'spot' | 'perp',
  exchangeId: 'binance',
): string

export function normalizeLedgerSymbol(raw: string): string
```

- [ ] **Step 4: Route Binance adapter through the helper**

Replace ad hoc conversions in `binance-client.ts` with the shared helper.

- [ ] **Step 5: Route local ledger writes through the helper**

Ensure `positions.service.ts` and execution call sites always store ledger symbols intentionally rather than incidentally.

- [ ] **Step 6: Tighten DTO examples and validation comments**

Update `record-trade.dto.ts` examples so the difference between ledger symbol and execution symbol is explicit.

- [ ] **Step 7: Re-run unit and trading E2E**

Run:

```bash
dx test unit quantify
dx test e2e quantify apps/quantify/e2e/trading/trading.e2e-spec.ts
```

Expected:

- unit tests PASS
- trading adapter E2E PASS

- [ ] **Step 8: Commit the symbol slice**

```bash
git add apps/quantify/src/modules/trading/core/symbol-normalizer.ts \
  apps/quantify/src/modules/trading/core/symbol-normalizer.spec.ts \
  apps/quantify/src/modules/trading/exchanges/binance-client.ts \
  apps/quantify/src/modules/positions/positions.service.ts \
  apps/quantify/src/modules/positions/dto/record-trade.dto.ts \
  apps/quantify/e2e/trading/trading.e2e-spec.ts
git commit -F - <<'MSG'
fix: unify quantify binance execution symbols

- add shared symbol normalization helpers
- align Binance adapter and local ledger symbol handling

Refs: #<issue-id>
MSG
```

### Task 4: Refactor `signal-executor` into staged Binance execution

**Files:**
- Modify: `apps/quantify/src/modules/strategy-signals/services/signal-executor.service.ts`
- Modify: `apps/quantify/src/modules/strategy-signals/repositories/signal-execution.repository.ts`
- Modify: `apps/quantify/src/modules/trading/trading.service.ts`
- Test: `apps/quantify/src/modules/strategy-signals/services/signal-executor.service.spec.ts`
- Test: `apps/quantify/e2e/trading/binance-execution.e2e-spec.ts`

- [ ] **Step 1: Write failing orchestrator tests**

Cover these cases:

- duplicate execution is skipped
- Binance account is resolved and persisted
- order request/response snapshots are stored
- `ORDER_ACKED` happens before ledger application

- [ ] **Step 2: Run tests to confirm failure**

Run:

```bash
dx test unit quantify
```

Expected: FAIL on missing staged behavior.

- [ ] **Step 3: Refactor orchestrator flow in small steps**

Keep one orchestration path:

```ts
resolveAccount()
runPrecheck()
createPendingExecution()
submitOrder()
ackExecution()
applyLedger()
finalizeExecution()
```

Do not move Binance-specific request shaping into this file.

- [ ] **Step 4: Persist exchange account and request/response snapshots**

Make `SignalExecutionRepository` own this persistence logic instead of hand-editing Prisma payloads throughout the service.

- [ ] **Step 5: Add focused Binance execution E2E**

Create `apps/quantify/e2e/trading/binance-execution.e2e-spec.ts` that proves:

- a signal selects a Binance account
- a Binance order is placed
- a `UserSignalExecution` record is created with staged metadata

- [ ] **Step 6: Run unit + focused E2E**

Run:

```bash
dx test unit quantify
dx test e2e quantify apps/quantify/e2e/trading/binance-execution.e2e-spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the orchestrator slice**

```bash
git add apps/quantify/src/modules/strategy-signals/services/signal-executor.service.ts \
  apps/quantify/src/modules/strategy-signals/repositories/signal-execution.repository.ts \
  apps/quantify/src/modules/trading/trading.service.ts \
  apps/quantify/src/modules/strategy-signals/services/signal-executor.service.spec.ts \
  apps/quantify/e2e/trading/binance-execution.e2e-spec.ts
git commit -F - <<'MSG'
feat: stage quantify binance signal execution

- refactor signal execution into explicit stages
- persist Binance account and order snapshots per execution

Refs: #<issue-id>
MSG
```

## Chunk 2: Ledger Safety, Reconciliation, API Boundary, and Verification

### Task 5: Make ledger application explicit and compensation-aware

**Files:**
- Modify: `apps/quantify/src/modules/positions/positions.service.ts`
- Modify: `apps/quantify/src/modules/accounts/accounts.service.ts`
- Modify: `apps/quantify/src/modules/strategy-signals/services/signal-executor.service.ts`
- Modify: `apps/quantify/src/modules/strategy-signals/repositories/signal-execution.repository.ts`
- Test: `apps/quantify/src/modules/strategy-signals/services/signal-executor.service.spec.ts`
- Test: `apps/quantify/e2e/trading/binance-execution.e2e-spec.ts`

- [ ] **Step 1: Write failing tests for “exchange success, ledger failure”**

Target behavior:

```ts
expect(execution.status).toBe('FAILED')
expect(execution.metadata).toMatchObject({
  stage: 'RECONCILE_REQUIRED',
  reconcileRequired: true,
  ledgerApplied: false,
})
```

- [ ] **Step 2: Run tests to confirm failure**

Run:

```bash
dx test unit quantify
```

Expected: FAIL because the service currently logs and moves on.

- [ ] **Step 3: Refactor local ledger application into an explicit step**

Do not let `recordTrade()` failures disappear into logs. Capture them and stamp the execution record.

- [ ] **Step 4: Preserve transaction boundaries**

Keep transaction creation in controller/orchestrator-approved boundaries only. Do not introduce new service-level long-lived transactions that include exchange I/O.

- [ ] **Step 5: Re-run unit and E2E**

Run:

```bash
dx test unit quantify
dx test e2e quantify apps/quantify/e2e/trading/binance-execution.e2e-spec.ts
```

Expected: PASS with explicit compensation metadata.

- [ ] **Step 6: Commit the ledger slice**

```bash
git add apps/quantify/src/modules/positions/positions.service.ts \
  apps/quantify/src/modules/accounts/accounts.service.ts \
  apps/quantify/src/modules/strategy-signals/services/signal-executor.service.ts \
  apps/quantify/src/modules/strategy-signals/repositories/signal-execution.repository.ts \
  apps/quantify/src/modules/strategy-signals/services/signal-executor.service.spec.ts \
  apps/quantify/e2e/trading/binance-execution.e2e-spec.ts
git commit -F - <<'MSG'
fix: mark quantify ledger failures for reconciliation

- stop swallowing local ledger failures after exchange success
- stamp executions as reconciliation-required

Refs: #<issue-id>
MSG
```

### Task 6: Re-scope `position-sync` as compensation only

**Files:**
- Modify: `apps/quantify/src/modules/positions/position-sync.service.ts`
- Modify: `apps/quantify/src/modules/positions/position-sync-scheduler.service.ts`
- Modify: `apps/quantify/src/modules/strategy-signals/services/signal-executor.service.ts`
- Test: `apps/quantify/e2e/trading/binance-reconciliation.e2e-spec.ts`

- [ ] **Step 1: Write failing reconciliation tests**

Cover:

- exchange has a position but local ledger missed it
- local ledger has a position but exchange does not
- reconciliation writes a difference log

- [ ] **Step 2: Run focused reconciliation test to confirm failure**

Run:

```bash
dx test e2e quantify apps/quantify/e2e/trading/binance-reconciliation.e2e-spec.ts
```

Expected: FAIL because compensation semantics are not explicit enough.

- [ ] **Step 3: Refactor sync terminology and metadata**

Keep repair behavior if needed, but stamp every repair as compensation:

```ts
metadata: {
  compensationSource: 'position-reconciliation',
  originalExecutionId: '<id-or-null>',
}
```

- [ ] **Step 4: Prevent sync from looking like a primary execution path**

Update logs, comments, and persisted metadata so operators can tell the difference between:

- primary trade execution
- reconciliation-created repair

- [ ] **Step 5: Re-run reconciliation E2E**

Run:

```bash
dx test e2e quantify apps/quantify/e2e/trading/binance-reconciliation.e2e-spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the reconciliation slice**

```bash
git add apps/quantify/src/modules/positions/position-sync.service.ts \
  apps/quantify/src/modules/positions/position-sync-scheduler.service.ts \
  apps/quantify/src/modules/strategy-signals/services/signal-executor.service.ts \
  apps/quantify/e2e/trading/binance-reconciliation.e2e-spec.ts
git commit -F - <<'MSG'
refactor: scope quantify position sync to compensation

- clarify reconciliation-only semantics
- preserve repair logs distinct from primary execution

Refs: #<issue-id>
MSG
```

### Task 7: Mark service-only API boundaries for the transition phase

**Files:**
- Modify: `apps/quantify/src/modules/exchange-accounts/exchange-accounts.controller.ts`
- Modify: `apps/quantify/src/modules/accounts/accounts.controller.ts`
- Modify: `apps/quantify/src/modules/positions/positions.controller.ts`
- Modify: `apps/quantify/e2e/exchange-accounts/exchange-accounts.e2e-spec.ts`
- Modify: `apps/quantify/e2e/trading/binance-execution.e2e-spec.ts`

- [ ] **Step 1: Write a failing boundary test**

Add coverage that documents the current transition rule:

- service-to-service requests may still carry explicit `userId`
- the endpoints are internal-only, not public browser endpoints

- [ ] **Step 2: Run targeted E2E to verify failure**

Run:

```bash
dx test e2e quantify apps/quantify/e2e/exchange-accounts/exchange-accounts.e2e-spec.ts
```

Expected: FAIL until the controller contract is explicit.

- [ ] **Step 3: Add internal boundary markers**

At minimum:

- update Swagger summaries/descriptions
- centralize “internal service API” wording
- avoid introducing new public-style endpoints that depend on raw `userId`

If the codebase already has an internal auth guard pattern, use it. If not, stop at contract-level marking in this slice.

- [ ] **Step 4: Re-run focused E2E**

Run:

```bash
dx test e2e quantify apps/quantify/e2e/exchange-accounts/exchange-accounts.e2e-spec.ts
dx test e2e quantify apps/quantify/e2e/trading/binance-execution.e2e-spec.ts
```

Expected: PASS with updated contract expectations.

- [ ] **Step 5: Commit the boundary slice**

```bash
git add apps/quantify/src/modules/exchange-accounts/exchange-accounts.controller.ts \
  apps/quantify/src/modules/accounts/accounts.controller.ts \
  apps/quantify/src/modules/positions/positions.controller.ts \
  apps/quantify/e2e/exchange-accounts/exchange-accounts.e2e-spec.ts \
  apps/quantify/e2e/trading/binance-execution.e2e-spec.ts
git commit -F - <<'MSG'
docs: mark quantify execution APIs as internal service endpoints

- document transition-phase internal API boundary
- prevent further public raw-userId endpoint drift

Refs: #<issue-id>
MSG
```

### Task 8: Full verification and final cleanup

**Files:**
- Modify: `docs/superpowers/specs/2026-03-17-quantify-trading-execution-binance-design.md` if implementation changed the design materially
- Modify: `docs/superpowers/plans/2026-03-17-quantify-trading-execution-binance-implementation-plan.md` only if execution requires plan corrections

- [ ] **Step 1: Run lint and build**

Run:

```bash
dx lint
dx build quantify --dev
```

Expected: PASS.

- [ ] **Step 2: Run required unit coverage**

Run:

```bash
dx test unit quantify
```

Expected: PASS.

- [ ] **Step 3: Run required E2E coverage**

Run:

```bash
dx test e2e quantify apps/quantify/e2e/trading/trading.e2e-spec.ts
dx test e2e quantify apps/quantify/e2e/trading/binance-execution.e2e-spec.ts
dx test e2e quantify apps/quantify/e2e/trading/binance-reconciliation.e2e-spec.ts
dx test e2e quantify apps/quantify/e2e/exchange-accounts/exchange-accounts.e2e-spec.ts
dx test e2e quantify apps/quantify/e2e/strategy-signals/strategy-signals.e2e-spec.ts
```

Expected: PASS.

- [ ] **Step 4: Update spec only if reality changed**

If implementation materially changes:

- execution stages
- API boundary
- milestone assumptions

then patch the design spec to match shipped behavior.

- [ ] **Step 5: Create final implementation commit**

```bash
git status --short
git add apps/quantify docs/superpowers/specs docs/superpowers/plans
git commit -F - <<'MSG'
feat: complete quantify binance execution loop

- add staged Binance execution orchestration
- harden ledger application and reconciliation semantics
- prepare reusable execution framework for future exchanges

Refs: #<issue-id>
MSG
```

- [ ] **Step 6: Prepare PR summary**

Include:

- what changed in execution orchestration
- what changed in ledger/reconciliation semantics
- which Binance spot/perp paths are now covered
- what remains for OKX / Hyperliquid

## Review Notes

- Do not start implementation on `main`.
- Do not skip the issue/branch step.
- If `signal-executor.service.ts` becomes difficult to reason about, split precheck or ledger application helpers in a dedicated follow-up commit.
- If `dx test unit quantify` is too broad during active work, still use it at checkpoint boundaries before each commit and at final verification.
- Future `OKX / Hyperliquid` work should reuse this plan structure, but only after the Binance execution path is stable.
