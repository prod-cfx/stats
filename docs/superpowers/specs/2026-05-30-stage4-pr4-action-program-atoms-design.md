# Stage 4 PR4: Action and Program Atoms

## Context

Issue #1738 is Stage 4 PR4 under parent #1631. PR4 extends rules-only action and program atom coverage without changing PR5 orchestration/data-source binding or PR6 staging 90% acceptance.

The production mainflow is `SemanticState.rules[]`. PR4 acceptance must start from rules tree semantics and preserve source paths through readiness, assistant text, display, canonical spec, IR, script/runtime evaluator, backtest, and deploy payload where an atom is marked `deploy_ready`.

The old checklist path is not a valid PR4 acceptance path. Test-only helpers such as `buildFromLegacyChecklistForTestsOnly` may still exist for historical compatibility, but PR4 tests and readiness evidence must not use them.

## Goals

- Add PR4 action and program rows to `stage4/atom-coverage-matrix.ts`.
- Keep action atoms under `rules[].effects.actions`.
- Keep program atoms under `rules[].effects.programs`.
- Mark only real rules-mainflow atoms as deploy ready.
- Mark unsupported runtime or deploy capabilities fail-closed with concrete blockers.
- Add dialogue entrance tests proving attempt-1 routing into typed rules roles.
- Add focused display/canonical/IR checks for source path preservation where ready status is claimed.

## Non-Goals

- Do not restore flat buckets, flat projection, or legacy fallback.
- Do not use canonical builder text inference to create missing action/program semantics.
- Do not count registry emit existence as deploy-ready evidence by itself.
- Do not move DCA from `position.dca_schedule` into a new program atom in PR4.
- Do not implement PR5 orchestration/data-source binding.
- Do not implement PR6 staging 90% acceptance.

## Main Dataflow

PR4 deploy-ready evidence must follow this complete acceptance path:

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

Every ready atom must preserve a source path rooted in the rules tree, for example:

- `rules[0].effects.actions[0]`
- `rules[0].effects.programs[0]`

No PR4 acceptance test may prove behavior by directly constructing legacy checklist input or by relying on flat `actions[]`, `position[]`, or other legacy semantic buckets as the source of truth.

## Action Atom Design

Action rows use `prBatch='pr4-action-program'`, `family='action'`, and `rulePath='rules[].effects.actions'`.

Deploy-ready candidates are limited to action atoms already supported by the rules mainflow and downstream execution path:

- `action.open_long`
- `action.open_short`
- `action.close_long`
- `action.close_short`
- `action.add_position`
- `action.reverse_position`

Each deploy-ready row must have at least three utterance examples, readiness and assistant-text coverage, display/canonical/IR source path coverage, script/runtime evaluator coverage, `reachesBacktest=true`, `reachesDeployPayload=true`, and `unsupportedReason=null`.

`action.reduce_position`, conditional order, and limit order must not be promoted to deploy-ready unless PR4 proves they enter `rules[].effects.actions` and retain deploy payload semantics. If runtime or deploy binding is incomplete, status must stay low, such as `dialogue_ready`, `canonical_ready`, or `ir_ready`, with a concrete blocker like `runtime_order_type_capability_missing` or `deploy_payload_missing_binding`.

## Program Atom Design

Program rows use `prBatch='pr4-action-program'`, `family='program'`, and `rulePath='rules[].effects.programs'`.

Fixed grid rows may be marked ready only if existing rules-mainflow behavior proves:

- dialogue or seed dispatch creates `effects.programs` entries,
- canonical spec preserves the program source path,
- IR produces the corresponding order/orchestration program shape,
- deploy payload binding is real.

TWAP, DCA program, martingale, rebalance, and iceberg remain low status unless equivalent proof exists. Unsupported rows must have a concrete `unsupportedReason` and must not set both `reachesBacktest` and `reachesDeployPayload` to true.

DCA remains represented by `position.dca_schedule` in `rules[].effects.positions`. PR4 may include a `program.dca` matrix row only as a low-status gap marker, with an unsupported reason that states independent program lifecycle and deploy binding do not exist yet.

## Matrix Rules

`stage4/atom-coverage-matrix.ts` is the PR4 single source of truth.

Required PR4 invariants:

- PR4 rows cannot all be `planned`.
- PR4 deploy-ready numerator must be greater than zero if any real action atom support exists.
- Deploy-ready PR4 rows require at least three utterances.
- Deploy-ready PR4 rows require readiness slot and assistant clarification/confirmation coverage.
- Deploy-ready PR4 rows require display/canonical/IR source path evidence.
- Deploy-ready PR4 rows require script/runtime evaluator evidence.
- Deploy-ready PR4 rows require `reachesBacktest=true` and `reachesDeployPayload=true`.
- Non-ready PR4 rows require `unsupportedReason !== null`.
- Non-ready PR4 rows cannot have both `reachesBacktest=true` and `reachesDeployPayload=true`.

## Dialogue Entrance Tests

Add `stage4/__tests__/action-program-dialogue-entrance.spec.ts`.

The test should dispatch natural language and assert attempt-1 rules routing:

- action utterances land only in `rules[].effects.actions`,
- program utterances land only in `rules[].effects.programs`,
- action/program atoms do not appear in condition, risk, position, or orchestration roles,
- entry/exit rules are not duplicated,
- `rule.effects` is typed `RuleEffectsByRole`.

The test should cover open, close, add, reduce, reverse, conditional order, limit order, grid, TWAP, DCA program, martingale, rebalance, and iceberg according to current capability. Unsupported atoms still need correct low-status routing or explicit blocker evidence; they must not be counted as deploy ready.

## Display, Canonical, IR, and Deploy Evidence

Focused tests should use rules-only semantic state fixtures, not legacy checklist fixtures.

Ready action atoms must prove:

- readiness slots and assistant clarification/confirmation text are derived from rules paths,
- display graph includes the rules source path,
- canonical rule actions retain `atomKey` and source metadata where applicable,
- IR `ruleBlocks.actions` preserve action semantics,
- script/runtime evaluator behavior matches the action semantics,
- deploy/backtest payload uses the same semantic source chain.

Ready program atoms must prove equivalent source path and runtime/deploy binding. If market/order runtime lacks capability, compilation or publication must fail closed rather than inventing a deploy payload.

## Real Strategy Corpus

Because #1746 has merged, PR4 should extend `stage4-real-strategy-corpus.ts` with action/program cases.

Cases should cover trend open/close, add/reduce, reverse, limit/conditional order, grid, TWAP, DCA program, and similar program intents. Runtime-unsupported cases must set `expectedFailure` rather than being treated as corpus pass.

## Validation

Run the required PR4 verification commands from repository root:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/atom-contracts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/publication-gate-rules-only-hash-chain.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/display-logic-graph-rules-tree.spec.ts
dx build quantify --dev
```

Attempt-1 behavior must be stable. Retrying a failed semantic route is not accepted as proof.
