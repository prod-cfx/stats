# AI Quant Crypto Atom Closure Design

## Purpose

Close the remaining crypto coverage backlog atom-first. P1 fail-closed items must move from "explicitly blocked" to executable support when the repo already has safe substrate or can accept a small general atom implementation. P2 and P3 continue after P1 without switching to strategy-family implementation.

Support still means full main dataflow evidence: natural-language strategy description, clarification when needed, `semanticPatch.rules[]`, readiness, canonical spec, IR, runtime/backtest reachability, and deploy payload evidence. Unsupported C-scope strategies remain unsupported and must not be implemented in this route.

## Current Baseline

Latest report on this branch:

- 50 total cases.
- 40 passing cases.
- 80.62% weighted B coverage.
- 4 C-scope unsupported cases.
- Remaining failures: 19 `missing_deploy_payload`, 10 `missing_atom_contract`, 1 `missing_ir_emit`, 4 `missing_canonical_emit`.

C-scope stays closed:

- Cross-exchange arbitrage with automatic fund transfer.
- Triangular arbitrage matching.
- HFT market making.
- Latency-sensitive order queue alpha.

## Design Principles

- Atom-first only. No strategy-family shortcuts.
- Entry-first only. No atom counts as supported if it cannot start from natural language and dialogue.
- Fail-closed remains mandatory. Missing layers are blocked statuses, not silent support.
- General implementation only. No corpus-case hacks.
- Small vertical slices. Each atom must carry its own tests through front-half or back-half as applicable.

## P1 Closure Scope

P1 now closes the fail-closed B cases added for baseline coverage when closure is practical and non-latency-sensitive.

Atoms to close:

- `orderbook.spread_condition`: spread predicate from NL to canonical/IR using existing orderbook data-source patterns.
- `orderbook.depth_ratio`: bid/ask depth ratio predicate from NL to canonical/IR using existing orderbook data-source patterns.
- `execution.post_only`: order option carried through limit/open order intent to deploy payload.
- `execution.reduce_only`: order option carried through close/reduce intent to deploy payload.
- `execution.limit_chase`: bounded retry/chase order behavior as non-latency-sensitive order policy.
- `risk.daily_loss_limit`: portfolio/account daily loss gate that blocks new entries.
- `risk.kill_switch`: gate action derived from risk breach, initially `block_new_entries` / pause strategy only.
- `position.max_concurrent_positions`: portfolio/account position-count gate.

P1 closure acceptance:

- The three crypto P1 B cases no longer fail from missing atom contracts.
- These atoms emit from NL into `semanticPatch.rules[]`.
- Readiness either passes with concrete params or opens explicit slots.
- Canonical/IR/deploy evidence exists where behavior is implemented.
- If exchange/runtime lacks an option, output is blocked by that exact layer, not supported.

## P2 Closure Scope

P2 closes structural/front-half atoms currently blocked after P1.

Atoms to close:

- `action.reduce_position`: register contract and emit executable reduce action, bounded so it cannot reverse position.
- `action.conditional_order`: register contract, require trigger/condition binding, fail closed without executable trigger.
- `program.rebalance`: move from canonical-only to IR/order-program representation.
- `scope.leg`: fix NL and semantic shape to emit one canonical leg per `legId/direction/instrumentRef`, not aggregate `legs[]` blobs.
- `time.cooldown_window`: canonicalize cooldown gate without making the timeframe scope invalid.

P2 acceptance:

- No remaining `missing_atom_contract`, `missing_canonical_emit`, or `missing_ir_emit` for P2 atoms in coverage report.
- Each P2 atom has negative tests for ambiguous or unsafe variants.
- Multi-leg closure keeps scope binding fail-closed when any leg lacks symbol/instrument ref.

## P3 Closure Scope

P3 closes deploy/runtime evidence for atoms already represented in front-half.

Atoms and cases to close:

- `position.dca_schedule` and `position.budget_cap`: DCA schedule deploy payload evidence.
- `position.sizing`: fixed-ratio DCA schedule deploy payload evidence.
- `price.detect.indicator_boundary`: implement supported boundary shape or keep unsupported variants blocked by exact reason.
- `position.fixed_notional`, `position.leverage`, `risk.atr_stop`, `action.open_long`: boundary/ATR/fixed notional leverage case deploy evidence.
- `action.limit_order`: limit order deploy payload evidence with fail-closed price requirement.

P3 acceptance:

- Remaining deploy-payload failures either disappear or become a more precise unsupported/blocking reason.
- Runtime/backtest evidence proves behavior affects decisions or order payloads.
- Price-less limit order and unsupported boundary indicators remain fail-closed.

## Dataflow Changes

P1/P2/P3 implementation uses the same path for every atom:

1. `GenericSeedDispatcher` or NL gateway extracts atom intent and params.
2. `CodegenSemanticPatch.rules[]` carries atom in the correct role bucket.
3. `SemanticSeedStateBuilderService` preserves atom params into typed semantic state.
4. `SemanticContractReadinessService` validates params and emits missing slots.
5. `CanonicalSpecBuilderService` emits canonical condition/action/risk/position/program/scope shape.
6. `CanonicalSpecV2IrCompilerService` emits IR.
7. Runtime/backtest/deploy code carries data requirements, order options, risk gates, and program settings.
8. Crypto coverage runner records the first missing layer when closure is incomplete.

## Error Handling

- Missing atom contract: blocked by `missing_atom_contract` until contract exists.
- Missing params: readiness opens slot; coverage reports `missing_dialogue_slot` if corpus lacks clarification.
- Unsupported C-scope: `unsupported_out_of_scope` from entry.
- Unsupported B variant: blocked by exact missing layer or explicit unsupported variant reason.
- Silent drops: test failure.

## Testing Plan

For each atom closure:

- Add or update crypto coverage reporter test that proves failure class improves.
- Add NL dispatch/readiness test when extraction or slots change.
- Add canonical/IR test when builder/compiler changes.
- Add runtime/backtest/deploy test when payload or evaluator changes.
- Rerun report and verify weighted B coverage moves up without reducing C unsupported count.

Required verification before PR update:

- `dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/crypto-coverage`
- `dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4/__tests__/real-strategy-corpus.spec.ts`
- Targeted service tests for changed builder/compiler/runtime files.
- `dx build quantify --dev`

## Delivery Plan

Use incremental commits on the existing PR branch:

1. P1 atom closure commit.
2. P2 front-half structural atom commit.
3. P3 deploy/runtime evidence commit.
4. Final report refresh summary in PR body or comment, without committing generated tmp reports.

If any atom expands beyond a small vertical slice, stop and split that atom into its own follow-up PR. The split must keep coverage report fail-closed in the current PR.
