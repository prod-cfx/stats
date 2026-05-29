# Stage 4 PR3 Risk and Position Atoms Design

## Background

Stage 4 PR1 added the atom coverage matrix, coverage reporter, corpus model, staging runner result model, and attempt-1 gate. PR2 expanded predicate atoms by adding matrix rows, utterance corpus entries, atom catalog/contract coverage, and focused pipeline tests without changing the rules-only mainflow.

PR3 follows the same expansion pattern for risk and position atoms. It does not introduce alias keys, does not remap external keys to internal keys, and does not change the rules-only main dataflow. The atom key in the matrix is the execution atom key used by the existing pipeline. If the current matrix row type requires `coveredAtomKeys`, PR3 rows use a self-reference such as `coveredAtomKeys: ['risk.stop_loss_pct']`, not a cross-key mapping.

The PR3 rule paths are fixed:

- Risk atoms enter `rules[].effects.risks`.
- Position atoms enter `rules[].effects.positions`.

Risk and position semantics must not be stored only in generated script text, prompt notes, canonical post-processing, or any legacy flat bucket path.

Refs: #1631
Refs: #1737

## Goals

Expand PR3 risk and position atom capability across the full rules-only dataflow. A PR3 atom is accepted only when the semantics are preserved through every layer below, or the atom is explicitly marked below `deploy_ready` with a fail-closed blocker:

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

Required risk coverage:

- Fixed stop loss: `risk.stop_loss_pct`.
- Trailing stop: `risk.trailing_stop_pct` if already present, otherwise add that atom key directly.
- Partial take profit: `risk.partial_take_profit`.
- Maximum drawdown: `risk.max_drawdown_pct` if single-strategy risk runtime support exists; otherwise add the atom row with fail-closed status and explicit blocker.
- Cooldown: `risk.cooldown` as a risk effect, not a condition predicate.
- Maximum loss per trade: `risk.max_loss_per_trade`.

Required position coverage:

- Fixed amount: `position.sizing` with fixed quote sizing params. This is mode coverage inside the direct atom, not a separate alias atom.
- Percent of equity: `position.sizing` with fixed percent sizing params. This is mode coverage inside the direct atom, not a separate alias atom.
- Pyramid: `position.pyramiding_limit`.
- DCA: `position.dca_schedule`.
- Budget: `position.budget_cap` if not already present.
- Leverage: `position.leverage`.
- Exposure cap: `position.max_exposure_pct`.

When an atom lacks complete runtime, backtest, or deploy support, PR3 must keep it below `deploy_ready`, set a structured blocker such as `runtime_missing_data`, `ir_compile_missing_branch`, or `deploy_payload_missing_binding`, and fail closed. It must not mark shell-only support as deploy-ready.

## Non-Goals

- No PR4 action/program expansion.
- No PR5 orchestration/data-source expansion.
- No PR6 90 percent corpus acceptance.
- No key aliasing layer between issue names and execution atom keys.
- No changes to `RuleEffectsByRole` shape.
- No restoration of flat projection, legacy fallback, or old five-bucket side paths.
- No changes to staging30 or staging31 rules-only expected behavior except regression tests that prove no change.

## Architecture

PR3 uses the same atom expansion architecture as PR2, with one extra rule: each expanded atom must carry test evidence for the whole dataflow, not only registry or typed-rules presence.

1. Add Stage 4 matrix rows in `stage4/atom-coverage-matrix.ts` with direct execution atom keys. Any required `coveredAtomKeys` value is self-referential for PR3 rows.
2. Add or extend utterance corpus entries for deploy-ready atoms.
3. Extend atom contracts/catalog metadata so the planner prompt exposes atom meaning, params, required slots, and effect role.
4. Ensure planner/dispatcher parsing places risk atoms in `rules[].effects.risks` and position atoms in `rules[].effects.positions`.
5. Extend readiness slot detection and slot answer resolution so missing params use rules paths and one open slot per turn.
6. Ensure assistant clarification and confirmation text is grounded in the same rules path.
7. Preserve source paths through display, canonical spec, IR, script/runtime evaluator, backtest, and deploy payload.

The mainflow remains:

```text
user utterance
  -> planner / dispatcher parse
  -> semanticPatch.rules[]
  -> rules[].condition or rules[].effects.*
  -> rules[].effects.risks / rules[].effects.positions for PR3 atoms
  -> readiness slots
  -> assistant clarification / confirmation text
  -> display graph
  -> canonical spec
  -> IR
  -> script / runtime evaluator
  -> backtest
  -> deploy payload
```

## Atom Status Rules

An atom can be `deploy_ready` only when all of these are true:

- Matrix row exists with correct family and rule path.
- At least three utterance examples exist.
- Attempt-1 natural language tests create typed rules under the correct effects role.
- Required slot checks point to `rules[i].effects.risks[j].params.*` or `rules[i].effects.positions[j].params.*`.
- Slot answers write back to the original atom path.
- Assistant clarification and confirmation text mentions the missing or completed risk/position semantics from the same rules path.
- Display output includes the atom from rules/canonical source data.
- Canonical spec and IR keep the executable semantics and source path.
- Script generation or runtime evaluator consumes the IR semantics.
- Backtest consumes the same IR semantics.
- Deploy payload contains auditable risk/position parameters or references the same IR hash used by backtest.

Rows that stop earlier remain explicit shells with a blocker. They can improve dialogue/readiness coverage but are not counted as deploy-ready.

## Data Flow Details

### Dialogue To Typed Rules

Risk utterances must produce `RuleEffectsByRole.risks`. Position utterances must produce `RuleEffectsByRole.positions`. The dispatcher/merge layer must not create duplicate entry or exit rules when a user mentions entry plus risk/position in the same sentence.

Examples:

- `EMA20 上穿开多，亏损 3% 止损，单笔 10% 仓位` produces one entry rule with action semantics plus `risk.stop_loss_pct` in risks and `position.sizing` in positions.
- `盈利 5% 先平一半，盈利 10% 再平剩余` produces `risk.partial_take_profit` in risks.
- `每跌 3% 补仓一次，最多 3 次，总预算 1000 USDT` produces `position.dca_schedule` and budget semantics in positions.

### Readiness And Clarification

Missing params produce exactly one open slot per turn. Slot paths must point into the original rule effect, for example:

- `rules[0].effects.risks[0].params.valuePct`
- `rules[0].effects.risks[0].params.tiers`
- `rules[0].effects.positions[0].params.sizing.value`
- `rules[0].effects.positions[1].params.maxCount`

When the user answers a slot question, the answer updates the existing atom. It must not add a second entry rule, a second exit rule, or a duplicate risk/position effect.

### Assistant Text

Assistant clarification questions and confirmation summaries are part of the acceptance path. They must be derived from readiness/rules state, not from prompt-only notes or old summaries. If a slot is missing, the assistant text must correspond to the single open slot path. If no slot is missing, confirmation text must not invent risk or position semantics that are absent from typed rules.

### Display, Canonical, IR, Runtime, Backtest, Deploy

Display should render risk and position atoms from rules or canonical spec only. Canonical spec should compile these atoms into risk guards, exit policies, sizing policies, DCA/pyramid constraints, leverage, budget, or exposure constraints as appropriate. IR must carry source-path metadata where existing types support it. Script generation or the runtime evaluator must consume the IR representation, not prompt comments. Backtest and deploy payload must use the same IR semantics; deploy payload must not reconstruct risk or position behavior from display text.

## Error Handling

PR3 fails closed for incomplete runtime support:

- `dialogue_unrecognized` when no typed rule atom is created.
- `wrong_effect_role` when a risk or position atom lands outside its required effects role.
- `wrong_slot_path` when readiness points to a flat owner or unrelated rule.
- `slot_answer_created_duplicate_rule` when a clarification answer creates duplicate semantics.
- `canonical_unsupported_atom` when canonical spec cannot represent the atom.
- `ir_compile_missing_branch` when canonical compiles but IR does not.
- `script_semantics_drift` when script/runtime semantics differ from IR.
- `runtime_missing_data` when runtime state required by the atom is unavailable.
- `backtest_rejected` when backtest refuses the atom.
- `deploy_payload_missing_binding` when deploy payload cannot preserve the atom semantics.
- `deploy_payload_drift` when deploy payload semantics differ from backtest IR semantics.

Retry success never converts a failed first attempt into pass.

## Testing

PR3 adds focused tests before implementation:

- Matrix tests assert direct PR3 atom keys exist, `coveredAtomKeys` is self-referential, families are `risk` or `position`, and rule paths are `rules[].effects.risks` or `rules[].effects.positions`.
- Dialogue tests assert at least three utterances for deploy-ready risk/position atoms land in typed effects on attempt-1.
- Readiness tests assert one missing slot per turn and rule-path slot locations.
- Slot answer tests assert answers update the original atom path and do not create duplicate entry, exit, risk, or position effects.
- Dataflow tests assert fixed stop loss, trailing stop, partial take profit, max drawdown, cooldown, max loss per trade, fixed amount, percent equity, pyramid, DCA, budget, leverage, and exposure cap semantics survive the full chain: dialogue utterance, planner/dispatcher parse, `semanticPatch.rules[]`, typed effects role, readiness slots, assistant text, display graph, canonical spec, IR, script/runtime evaluator, backtest, and deploy payload.
- Reporter tests assert retry pass is not counted.
- Regression tests keep staging30/staging31 rules-only behavior unchanged.

Minimum verification commands:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/stage4
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/atom-contracts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.rules-mode.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.rules-only-mainflow.spec.ts
dx build quantify --dev
```

If compiler or backtest behavior changes, add focused service/backtesting tests rather than full E2E. If staging regression files are affected, run focused staging30/staging31 rules-only tests only.

## Implementation Notes

- Reuse existing atom contracts, emit hooks, risk guard emits, rule-block emits, lifecycle emits, and canonical/IR paths where they already exist.
- Use direct atom keys in matrix and tests. If `coveredAtomKeys` is required by the matrix type, keep it equal to the row atom key. Do not add cross-key mapping for PR3 issue names.
- Treat `position.sizing` as one atom with multiple sizing modes instead of creating separate aliases for fixed amount and percent equity.
- Treat `position.dca_schedule` and `position.pyramiding_limit` as position effects, not programs.
- Treat PR2 `time.cooldown_window` as predicate coverage; PR3 cooldown must be a risk effect if it is counted for PR3.
- Leave market-data predicate shells and PR5 data-source binding untouched.

## Acceptance Mapping

- Fixed stop loss, trailing stop, partial take profit, max drawdown, cooldown, and max loss per trade enter typed `rules[].effects.risks`.
- Fixed amount, percent equity, pyramid, DCA, budget, leverage, and exposure cap enter typed `rules[].effects.positions`.
- Every deploy-ready PR3 atom has full dataflow evidence from dialogue utterance through deploy payload.
- Clarification asks one slot per turn and writes answers to original rule paths.
- Slot answers do not create duplicate entry, exit, or risk rules.
- Assistant text, display graph, canonical spec, IR, script/runtime evaluator, backtest, and deploy payload preserve risk/position semantics for deploy-ready atoms.
- Real corpus additions cover trend, mean reversion, DCA, and add-position strategies.
- Attempt-1 pass is required; retry pass is excluded.
- `dx build quantify --dev` must pass before PR.
