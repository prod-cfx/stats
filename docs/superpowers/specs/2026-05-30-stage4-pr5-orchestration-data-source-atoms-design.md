# Stage 4 PR5: Orchestration and Data-Source Binding Atoms

## Context

Issue #1739 is Stage 4 PR5 under parent #1631. PR5 extends rules-only orchestration and data-source binding atom coverage after PR1 through PR4 have landed on `main`.

The production mainflow remains `SemanticState.rules[]`. PR5 must not restore flat buckets, flat projection, or old five-bucket fallback paths. A deploy-ready claim is valid only when the atom is proven through the rules tree path from dialogue to deploy payload.

PR5 does not implement PR6 staging acceptance, does not redo PR4 action/program atoms, and does not migrate DCA. `position.dca_schedule` remains under `rules[].effects.positions`; `program.dca` remains a low-status program gap unless a separate issue designs the program lifecycle.

## Goals

- Add PR5 matrix rows for orchestration and data-source binding atoms.
- Keep orchestration rows under `rules[].effects.orchestration`.
- Let predicates and orchestration effects declare data-source needs explicitly.
- Align data-source binding evidence with PR2 market-data predicate rows.
- Mark only real end-to-end atoms as deploy ready.
- Keep unsupported runtime or deploy gaps fail-closed with concrete blockers.
- Extend corpus and tests without reducing existing Stage 4 e2e pass coverage.

## Non-Goals

- Do not add flat projection or legacy fallback.
- Do not count registry presence as deploy-ready evidence.
- Do not mark unsupported atoms deploy-ready to improve coverage numbers.
- Do not implement broad runtime/deploy support for all market-data predicates.
- Do not implement PR6 90% acceptance.
- Do not change PR4 `program.fixed_grid_gated`, `program.dca`, or action atom readiness.

## Main Dataflow

Deploy-ready PR5 evidence must follow this path:

```text
dialogue utterance
  -> GenericSeedDispatcher / semantic patch
  -> SemanticState.rules[]
  -> rules[].condition or rules[].effects.orchestration
  -> display graph
  -> canonical spec
  -> IR
  -> backtest-capable publication artifacts
  -> deploy payload shape
```

Every ready atom must preserve a source path rooted in the rules tree, such as:

- `rules[0].effects.orchestration[0]`
- `rules[0].condition`

Market-data predicates remain condition atoms. PR5 may upgrade a PR2 market-data predicate only if a real data-source binding is present and that binding reaches deploy payload data requirements. Without binding, the predicate stays fail-closed.

## Atom Rows

PR5 rows use `prBatch='pr5-orchestration-data'`.

Orchestration rows use `family='orchestration'` and `rulePath='rules[].effects.orchestration'`:

- `orchestration.multi_timeframe`, covering `scope.timeframe`
- `orchestration.multi_symbol`, covering `scope.symbol`
- `orchestration.multi_leg`, covering `scope.leg`
- `orchestration.portfolio_risk`, covering `portfolioRisk.drawdown_block`, `portfolioRisk.symbol_exposure_cap`, and `portfolioRisk.substrategy_exposure_cap`
- `orchestration.regime_gate`, covering `gate.regime`
- `orchestration.data_source_binding`, covering `scope.dataSource`

Data-source binding must support these declared source families in Stage 4 matrix metadata:

- `ohlcv`
- `orderbook`
- `funding`
- `open_interest`
- `liquidation`
- `webhook`

The existing semantic/canonical `scope.dataSource` substrate should be extended to accept `funding` and `open_interest` schema refs in addition to the already supported `ohlcv`, `orderbook`, `liquidation`, and `webhook_event`. This is schema and binding support, not a runtime readiness claim.

## Readiness Rules

A PR5 deploy-ready row must declare:

- At least three utterance examples.
- Display, canonical, and IR shapes that include rules source path evidence.
- Runtime requirement text describing real runtime/deploy needs.
- Deploy payload impact containing `sourcePath` or data requirement binding evidence.
- `reachesBacktest=true`.
- `reachesDeployPayload=true`.
- `unsupportedReason=null`.

A non-ready PR5 row must declare:

- A concrete blocker such as `data_source_missing`, `runtime_missing_data`, or `deploy_payload_missing_binding`.
- No combination of `reachesBacktest=true` and `reachesDeployPayload=true`.
- A low status such as `dialogue_ready`, `canonical_ready`, or `ir_ready`.

Do not add blocker taxonomy unless existing blockers cannot express the gap. If a new blocker is required, update the staging dialogue runner and tests in the same PR.

## PR2 Market-Data Predicate Alignment

PR5 must align with these PR2 market-data predicates:

- `orderbook.imbalance`
- `fundingRate.condition`
- `openInterest.condition`
- `liquidation.condition`
- `event.externalSignal`

If any of these rows are upgraded, tests must prove that the predicate has a matching data-source binding and that the binding reaches deploy payload. Otherwise, the row must remain low status with a blocker. Unbound market-data predicates must fail closed and must not generate fake deploy payload data.

## Tests

Extend `atom-coverage-matrix.spec.ts` with PR5 invariants:

- PR5 atom key lists exist.
- All orchestration rows use `rules[].effects.orchestration`.
- PR5 rows are not all `planned`.
- Deploy-ready rows satisfy the full-chain field requirements.
- Non-ready rows have concrete blockers.
- Coverage reporter numerator counts only true deploy-ready rows.
- PR2 market-data predicate upgrades require data-source binding evidence.

Add `orchestration-data-source-dialogue-entrance.spec.ts`:

- Multi-timeframe utterances route to `rules[].effects.orchestration` on attempt 1.
- Multi-symbol utterances route to `rules[].effects.orchestration` on attempt 1.
- Portfolio risk and regime gate route to orchestration or risk roles correctly and do not pollute action/program roles.
- Orderbook, funding, open interest, liquidation, and webhook utterances route to condition predicates plus data-source binding when supported.
- Unsupported market-data paths remain fail-closed.
- Entry and exit rules are not duplicated.

Extend display, canonical, IR, publication, and corpus tests only where the claimed readiness requires it. Full deploy assertions are required for deploy-ready rows. Low-status rows should assert fail-closed behavior, not deploy payload success.

## Real Strategy Corpus

Add corpus cases for:

- Multi-timeframe trend gate.
- Multi-symbol shared rule.
- Portfolio max exposure or drawdown gate.
- Regime gate.
- Orderbook data-source binding.
- Funding data-source binding.
- Open-interest data-source binding.
- Liquidation data-source binding.
- Webhook or external event source.

Cases with deploy-ready atoms use `expectedFailure: null`. Cases with missing runtime or deploy binding use the blocker from the matrix. Existing Stage 4 e2e pass coverage must not decrease.

## Validation

Required validation for implementation PR:

Every deploy-ready PR5 case must be validated through the full rules pipeline:

```text
dialogue utterance
  -> planner / dispatcher parse
  -> semanticPatch.rules[]
  -> rules[].condition or rules[].effects.*
  -> readiness slots
  -> assistant clarification / confirmation text
  -> display graph
  -> canonical spec
  -> IR
  -> script / runtime evaluator
  -> backtest
  -> deploy payload
```

Focused unit tests may cover individual stages, but a deploy-ready row needs at least one rule-mainflow full-pipeline test that proves the atom survives this chain. Non-ready rows must prove the chain fails closed at the declared blocker and does not produce a fake deploy payload.

Run these commands after the full-pipeline assertions are in place:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/atom-contracts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/publication-gate-rules-only-hash-chain.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/display-logic-graph-rules-tree.spec.ts
dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen/stage4-rules-only-atoms.e2e-spec.ts
dx build quantify --dev
```

All pass cases must be attempt 1. Retry-based success is not accepted as proof.

## Risks

- Data-source schema expansion could look like runtime support. Tests must separate schema binding from deploy readiness.
- Market-data predicates could accidentally become deploy-ready without real data binding. Matrix invariants must block this.
- Existing PR4 rows could be touched while adding orchestration rows. PR5 must leave PR4 readiness unchanged.
- Existing skipped or historical orchestration tests may imply support that publication does not have. PR5 readiness must be based on current active tests and real artifacts.
