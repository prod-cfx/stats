# Stage 4 PR2: Predicate Dialogue Atoms Design

## Context

PR2 for #1736 extends Stage 4 predicate atom coverage after #1741 and #1742. PR1 already added the Stage 4 atom coverage matrix, coverage reporter, corpus types, runner result model, blocker taxonomy, and attempt-1 corpus numerator rules.

PR2 must start from latest `main`, run serially after PR1/follow-up, and stay inside predicate scope. It must not start PR3-PR6 work, reintroduce legacy fallback, restore flat projection, or count retry success as pass.

## Goal

Make PR2 predicate atoms dialogue-first and rules-only. Natural-language utterances must parse through the real planner / dispatcher entrance on attempt-1, produce `semanticPatch.rules[]`, and place predicate semantics in `rules[].condition` before any display, canonical, IR, runtime, backtest, or deploy processing.

The full acceptance chain is:

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

The PR succeeds only when deploy-ready predicate atoms preserve predicate semantics and source path through that chain.

## Atom Model

The matrix uses #1736 umbrella atom rows and maps each row to existing or newly added granular registry atom keys. This keeps issue acceptance language stable while reusing the existing rules tree atom model.

Examples:

- `indicator.cross` covers `indicator.cross_over` and `indicator.cross_under`.
- `indicator.threshold` covers threshold-style indicator conditions such as `indicator.above`, `indicator.below`, and canonical threshold variants already present in compiler paths.
- `pattern.breakout` covers `price.breakout_up` and `price.breakout_down`.
- `volume.spike` covers executable volume spike / relative volume threshold semantics, using current `volume.threshold` shape when possible.
- `event.externalSignal` covers `external.signal`.

No separate umbrella runtime model is introduced. The umbrella row is coverage metadata; execution still uses typed rule atoms from the registry.

## PR2 Rows

Add PR2 matrix rows for:

- `indicator.cross`
- `indicator.threshold`
- `indicator.slope`
- `pattern.breakout`
- `pattern.pullback`
- `pattern.range`
- `volume.spike`
- `volume.confirmation`
- `time.session`
- `time.cooldownWindow`
- `event.externalSignal`
- `orderbook.imbalance`
- `fundingRate.condition`
- `openInterest.condition`
- `liquidation.condition`

Each row records `coveredAtomKeys`, `rulePath: 'rules[].condition'`, params, required slots, utterance examples, source-path expectations, data requirements, deploy payload impact, status, and blocker if not deploy-ready.

Deploy-ready rows need at least three utterances and full dialogue-to-deploy coverage. Market-data rows may enter matrix, dialogue, and typed rules as predicate shells, but remain below deploy-ready until runtime data binding exists.

## Dialogue Entrance

PR2 tests must run the real dialogue entrance, not direct typed rules fixtures. For each deploy-ready row, at least three utterances must:

- parse on attempt-1 through planner / dispatcher;
- produce `semanticPatch.rules[]`;
- place the mapped predicate atom in `rules[].condition`;
- keep required entry/exit action effects in `rules[].effects.actions` only when needed by the utterance;
- avoid duplicate entry and duplicate exit rules;
- preserve evidence/source path from utterance through typed rules.

Assistant first response must be derived from the same rules/readiness state. It must not omit predicate semantics, add unrelated semantics, or mention duplicate entry/exit behavior.

## Readiness And Slots

Readiness runs after `semanticPatch.rules[]` is produced. Missing predicate parameters create one open slot at a time, and each slot path points to the original rules path, such as `rules[0].condition.params.threshold`.

Slot answers update the existing atom path. They must not create a second rule, a second condition atom, or duplicate action effects.

## Downstream Preservation

Display graph, canonical spec, IR, script/runtime evaluator, backtest, and deploy payload are validation layers for semantics already present in typed rules.

They must preserve:

- predicate atom key or canonical mapped shape;
- params used for execution;
- rules source path;
- source-path chain from dialogue to deploy payload;
- backtest IR hash and deploy payload IR hash consistency where available.

Canonical builder or IR compiler must not infer missing PR2 predicate conditions from display text, summary text, legacy spec description, flat fields, or retry output.

## Market-Data Predicate Shells

`orderbook.imbalance`, `fundingRate.condition`, `openInterest.condition`, and `liquidation.condition` are allowed to reach dialogue and typed rules in PR2.

If runtime data is not wired, they fail closed with blocker `data_source_missing`. They must not silently downgrade to OHLCV, generic volume, or price-only predicates. Their matrix rows stay below `deploy_ready` until canonical data requirements, IR runtime context, backtest, and deploy payload binding are actually implemented.

## Testing

Add tests before implementation for:

- PR2 matrix rows exist and have unique umbrella keys.
- Deploy-ready PR2 rows have at least three utterances.
- Umbrella rows map to supported granular atom keys.
- Dialogue entrance maps utterances to `semanticPatch.rules[]` on attempt-1.
- `indicator`, `pattern`, `volume`, `time`, and `event` predicates enter `rules[].condition`.
- Assistant first response has no missing/extra predicate semantics and no duplicate entry/exit.
- Readiness slot paths point to rules paths and slot answers mutate original paths.
- Market-data predicate shells fail closed with `data_source_missing` when runtime data is absent.
- Retry pass is not counted as pass.
- Existing staging30 and staging31 rules-only behavior does not regress.

Run minimum verification:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4
dx test unit quantify <PR2-focused dialogue/prompt/service test files>
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/scripts/__tests__/staging30-rules-only-mainflow-report.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/staging31-report.contract.spec.ts
dx build quantify --dev
```

If code touches staging E2E behavior, run focused staging30/staging31 rules-only regression commands rather than all E2E.

## Non-Goals

PR2 does not implement risk, position, action, program, orchestration, or final 90% corpus acceptance. It does not make market-data shells deploy-ready unless data binding is genuinely present. It does not use flat projection, legacy fallback, canonical backfill, IR backfill, or retry success to satisfy dialogue entrance acceptance.

## PR Evidence

The PR body must map each #1736 acceptance item to code and tests, list final row statuses, explain any row below deploy-ready with blocker/status, and include command results for unit tests and `dx build quantify --dev`.

Refs: #1736
Refs: #1631
