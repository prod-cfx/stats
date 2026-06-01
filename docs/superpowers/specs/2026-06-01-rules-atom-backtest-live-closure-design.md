# Rules Atom Backtest And Live Closure Design

## Background

Recent rules atom upgrades added Stage4 predicate, action, program, orchestration, and foundation rows. PR #2004 already closed the external feed gap for `external.signal`, `fundingRate.condition`, and `liquidation.condition` by wiring event stream extraction, runtime context injection, backtest hydration, and live hydration.

The remaining problem is that several upgraded atoms are marked or treated as ready without a full path through backtest and deployed live execution. Some longer-term rows are known planned capabilities and should not be counted as deploy-ready until their full runtime semantics exist.

## Goals

- Make recently upgraded predicate atoms executable in both backtest and deployed live strategy runtime.
- Prevent Stage4 coverage from reporting deploy-ready atoms when either backtest or live deployment payload/runtime is missing.
- Split larger action, program, orchestration, and foundation gaps into explicit follow-up PR scopes instead of hiding them behind ambiguous matrix states.

## Non-Goals

- Do not implement every action/program/orchestration/foundation gap in one PR.
- Do not change user-facing strategy semantics for atoms already working through PR #2004.
- Do not introduce a new strategy runtime architecture; extend the existing compiled runtime and data portal path.

## Scope

### PR1: Executable Closure For Upgraded Predicate Atoms

PR1 closes backtest and deployed live runtime for:

- `orderbook.imbalance`
- `openInterest.condition`
- `indicator.slope`
- `volume.confirmation`
- `time.cooldown_window`

PR1 also tightens Stage4 matrix guardrails so `deploy_ready` and `corpus_pass` require both `reachesBacktest=true` and `reachesDeployPayload=true`.

### PR2: Long-Term Gap Decomposition

PR2 documents and marks remaining gaps honestly, then splits code work into follow-up implementation PRs:

- Action atoms: `action.reduce_position`, `action.conditional_order`, `action.limit_order`
- Program atoms: `program.twap`, `program.dca`, `program.martingale`, `program.rebalance`, `program.iceberg`
- Orchestration atom: `orchestration.multi_leg`
- Foundation rows: `predicate.foundation.indicator_boundary`, `risk.foundation.atr_stop`, `position.foundation.fixed_notional`

PR2 should not claim deploy readiness for these rows until their own runtime semantics, backtest behavior, and live payload effects are implemented.

## Architecture

PR1 uses one common path instead of atom-specific shortcuts:

```text
Canonical atom
  -> IR predicate
  -> runtime data plan
  -> backtest/live data loader
  -> runtime context
  -> evaluate-expr-pool
  -> signal/backtest decision
```

### Runtime Data Plan

Extend `RuntimeEventStreamRequirement.schemaRef` beyond existing `webhook_event | funding | liquidation` to include:

- `orderbook`
- `open_interest`

Update `readEventStreamsFromExprPool` so compiled predicates derive stream requirements for:

- `orderbookImbalance`
- `openInterestCondition`
- existing `externalSignal`, `fundingRateCondition`, and `liquidationCondition`

### Data Providers

Extend `OkxMarketDataProvider` with runtime event readers:

- `fetchOrderbookImbalanceEvents(input)`
- `fetchOpenInterestEvents(input)`

Both methods return the existing runtime event shape:

```ts
{ id: string; ts: number; payload: Record<string, unknown> }
```

Backtest and live should use the same schema dispatch path so behavior does not drift between `BacktestJobExecutorService` and `SignalGeneratorService`.

### Runtime Evaluator

Extend `evaluate-expr-pool` with predicate evaluation for:

- `orderbookImbalance`
- `openInterestCondition`
- `indicator.slope`
- `volume.confirmation`
- `time.cooldown_window`

Evaluation rules:

- `orderbook.imbalance`: read bid/ask depth, compare bid/ask ratio or bid-side ratio against atom params.
- `openInterest.condition`: read open-interest snapshots/events and compare direction/change percentage over the declared window.
- `indicator.slope`: compute slope from bars or available indicator series over the requested period; up/down/flat are explicit outcomes.
- `volume.confirmation`: compare current volume to rolling average volume with `multiplier` and `refWindow` defaults from atom params.
- `time.cooldown_window`: read runtime state for last exit/stop/trade timestamp or bar index; missing state fails closed.

## Error Handling

- Missing external data source fails closed. Strategy does not open or close based on missing truth.
- Schema mismatch fails closed and should surface in diagnostics.
- OKX REST failures produce an empty feed for that stream and must never evaluate as true.
- Cooldown state absence evaluates false, not true.
- Unsupported long-term rows keep explicit blockers in the matrix and reports.

## Testing

### Runtime Evaluator Tests

Add or extend `packages/shared/src/script-engine/compiled-runtime/evaluate-expr-pool.spec.ts`:

- `orderbookImbalance`: true with sufficient bid/ask imbalance; false with no data or threshold miss.
- `openInterestCondition`: true/false for up/down/changePct/window.
- `indicator.slope`: up, down, flat, insufficient bars.
- `volume.confirmation`: volume spike and no spike.
- `time.cooldown_window`: inside cooldown false, after cooldown true, missing state false.

### Data Plan And Loader Tests

Add or extend:

- `apps/quantify/src/modules/strategy-runtime/runtime-data-plan.spec.ts`
- `apps/quantify/src/modules/backtesting/jobs/backtest-job-executor.service.spec.ts`
- `apps/quantify/src/modules/strategy-signals/services/__tests__/signal-generator.service.spec.ts`

Coverage:

- `exprPool` derives `orderbook` and `open_interest` stream requirements.
- Backtest hydrates those streams when required.
- Live runtime hydrates those streams when required.
- Missing provider or failed REST call does not evaluate as true.

### Stage4 Guardrail Tests

Update `apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/atom-coverage-matrix.spec.ts`:

- Any `deploy_ready` or `corpus_pass` row must have `reachesBacktest=true` and `reachesDeployPayload=true`.
- Any row with `unsupportedReason=null` must not be `planned`.
- PR2 long-term gaps must have concrete blockers and must not be counted as deploy-ready.

## PR Plan

### PR1

Deliver executable closure for five upgraded predicate atoms.

Files likely touched:

- `apps/quantify/src/modules/strategy-runtime/runtime-data-plan.ts`
- `apps/quantify/src/modules/strategy-runtime/runtime-data-plan.resolver.ts`
- `apps/quantify/src/modules/market-data/providers/okx-market-data.provider.ts`
- `apps/quantify/src/modules/backtesting/jobs/backtest-job-executor.service.ts`
- `apps/quantify/src/modules/strategy-signals/services/signal-generator.service.ts`
- `packages/shared/src/script-engine/compiled-runtime/evaluate-expr-pool.ts`
- Stage4 matrix and tests

Acceptance:

- Five P0 atoms execute in runtime evaluator.
- Backtest and live both hydrate required data.
- Stage4 matrix cannot mark them deploy-ready unless both runtime paths are true.

### PR2

Deliver honest long-term gap decomposition and follow-up queue.

Subsequent implementation PRs:

- PR2a: action atoms
- PR2b: program atoms
- PR2c: `orchestration.multi_leg`
- PR2d: foundation rows

Acceptance:

- No long-term gap is silently counted as deploy-ready.
- Each gap has concrete blocker, owner follow-up PR or issue, and expected test layer.

## Parallelization

PR1 and PR2 design/report work can proceed in parallel. PR2 implementation code should wait for PR1 or rebase on PR1 because both touch Stage4 matrix and runtime planning surfaces.

If implementation must run in parallel, split PR2 into PR2a..PR2d and base them on PR1.
