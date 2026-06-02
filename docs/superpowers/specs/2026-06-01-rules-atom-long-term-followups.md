# Rules Atom Runtime Closure Record

PR2 now closes the four requested follow-up task groups against product-facing compile, backtest/runtime, and deploy-payload evidence. Rows below are allowed to remain `deploy_ready` only because targeted tests prove both runtime and deploy payload paths.

## Closed Rows

### Task 1: Action Atoms

Rows:
- `action.reduce_position`
- `action.conditional_order`
- `action.limit_order`

Evidence:
- `run-decision-programs.ts` carries action `order` metadata into `StrategyDecisionV1.meta.order`.
- `runtime-signal-intent.adapter.ts` maps runtime `meta.order` into deploy signal intent payloads.
- `rules-atom-followup-runtime-closure.spec.ts` proves canonical/IR action order metadata for conditional and limit orders.
- `runtime-signal-intent.adapter.spec.ts` proves live adapter payloads for limit and conditional order metadata.

### Task 2: Program Atoms

Rows:
- `program.twap`
- `program.dca`
- `program.martingale`
- `program.rebalance`
- `program.iceberg`

Evidence:
- Canonical spec and IR unions include generic execution programs.
- `runOrderPrograms` supports all five kinds and emits working order payloads with lifecycle state.
- `GenericSeedDispatcher` routes first-attempt program utterances into `rules[].effects.programs`.
- `rules-atom-followup-runtime-closure.spec.ts` proves compiled deploy script payload plus live order fan-out payload for all five kinds.
- `action-program-dialogue-entrance.spec.ts` proves dialogue entry for all five kinds.

### Task 3: Multi-Leg Orchestration

Row:
- `orchestration.multi_leg`

Evidence:
- `compiled-script-emitter.service.ts` passes `ORCHESTRATION_SCOPES` and `ORCHESTRATION_LEG_SCOPES` into `runDecisionPrograms` when present.
- `compiled-script-parser.service.ts` accepts old wrappers and scoped wrappers.
- `compiled-script-emitter-leg-byte-equal.spec.ts` proves the generated live wrapper passes leg scopes, and round-trip parser support remains intact.

### Task 4: Foundation Rows

Rows:
- `predicate.foundation.indicator_boundary`
- `risk.foundation.atr_stop`
- `position.foundation.fixed_notional`

Evidence:
- `price.detect.indicator_boundary` now compiles directly into Bollinger boundary runtime predicates.
- `risk.atr_stop` compiles into `riskPolicy.riskPredicates:atrTrailingStop` payload.
- fixed notional sizing compiles into `portfolio.sizing` and action quantity fixed quote payloads.
- `rules-atom-followup-runtime-closure.spec.ts` proves all three product-facing foundation rows reach backtest/deploy payload surfaces.

## Verification Commands

Passed:
- `pnpm --filter @net/quantify run test src/modules/strategy-signals/services/__tests__/runtime-signal-intent.adapter.spec.ts -- --runInBand`
- `pnpm --filter @net/quantify run test src/modules/llm-strategy-codegen/services/__tests__/rules-atom-followup-runtime-closure.spec.ts -- --runInBand`
- `pnpm --filter @net/quantify run test src/modules/llm-strategy-codegen/stage4/__tests__/action-program-dialogue-entrance.spec.ts -- --runInBand`
- `pnpm --filter @net/quantify run test src/modules/llm-strategy-codegen/stage4/__tests__/atom-coverage-matrix.spec.ts -- --runInBand`
- `pnpm --filter @net/quantify run test src/modules/llm-strategy-codegen/services/__tests__/compiled-script-emitter-leg-byte-equal.spec.ts -- --runInBand`
- `pnpm --filter @net/quantify run build`
- `dx test unit shared packages/shared/src/script-engine/compiled-runtime/run-order-programs.spec.ts`

Notes:
- `dx` currently prints only npm config warnings in this worktree for some commands, so pnpm commands above are listed for readable output.
- `orchestration-leg-scope-golden-corpus.spec.ts` is skipped by its suite guard; multi-leg live wrapper coverage is asserted in `compiled-script-emitter-leg-byte-equal.spec.ts`.

## Global Gate

No row may be `deploy_ready` unless it has all of the following:
- `unsupportedReason === null`
- `reachesBacktest === true`
- `reachesDeployPayload === true`
- source-path evidence in canonical/IR/deploy payload fields where required
- targeted runtime/backtest/live tests proving the claim
