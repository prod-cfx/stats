# AI Quant Rules Tree Staging 31 Hard Gates Design

Date: 2026-05-19

## Context

Issue #1491 closed after moving AI Quant codegen toward a rules tree pipeline. Follow-up fixes #1550 and #1551 aligned the real LLM prompt with the hard rules-first schema. Staging is now deployed with the latest main, but the 31 recorded staging sessions still show failures across entry parsing, rules persistence, projection, readiness, UI rendering, clarification, and script generation.

The staging DB evidence is stored in `tmp/ai-quant-staging-31-strategy-debug-notes.md`. The failures prove that the previous acceptance path did not fully validate the real staging natural-language entrypoint. Mocked or hand-built rules tree tests can pass while real user flows still fail.

## Non-Negotiable Principles

- Atomic `rules tree` is the core and only strategy semantic source of truth.
- `flat buckets` are compatibility projections derived from the rules tree. They must not write back to or override the rules tree.
- If planner output is rejected, the system may retry once. If retry still fails, it must enter visible unsupported state. Dispatcher fallback must not synthesize strategy semantics.
- Unsupported atoms must be visible, explainable, and fail-closed. The system must not generate incorrect scripts.
- UI, Canonical Spec, IR, AST, and script must all derive from the same rules tree.
- Clarification remains part of the main flow. Missing executable slots must be asked, answers must fill the pending slot, and existing rules must be preserved.

## Goal

Create hard gates around the rules tree pipeline so any strategy, including the 31 staging cases, follows one traceable path:

```text
user input
  -> planner semanticPatch.rules[]
  -> SemanticState.rules
  -> rules-derived projections
  -> readiness / clarification
  -> UI summary and logic graph
  -> Canonical Spec
  -> IR
  -> AST
  -> script or visible unsupported
```

The goal is not to patch 31 individual strategies. The goal is to make the 31 cases a staging hard gate proving the pipeline works for broader strategies.

## Current Failure Groups

### 1. Entry Produces No Durable Rules

Some sessions persist empty `rules[]`, `trigger[]`, `action[]`, and `risk[]` while the assistant text says the strategy was understood or returns the generic rules-first unsupported prompt.

Examples: strategies 5, 10, 13, 19, 28.

Root failure: planner rejection or semantic patch loss leaves the session with no durable rules tree. The system sometimes marks clarification state as clear even though no executable semantic state exists.

### 2. Rules Exist But Projection or Readiness Rejects Actions

Many sessions contain rules with effects such as `action.open_long`, `action.close_long`, `action.open_short`, and `action.close_short`, but generation reports the public actions as unsupported.

Examples: strategies 2, 3, 4, 6, 7, 8, 14, 16, 18, 20, 21, 24, 25, 27, 29.

Root failure: rules tree effects are not consistently accepted by the rules-derived projection, support classifier, readiness layer, or generation layer.

### 3. Rules Tree Semantics Are Wrong or Incomplete

Some inputs produce a rules tree, but atom choice or composition is wrong.

Examples:

- Candle close above open becomes `price.percent_change(valuePct=0)`.
- RSI entry is dropped.
- MA pullback and reclaim are reduced to a regime gate.
- Grid and DCA intent is misrouted into `action.add_position`.
- Quantile range semantics are inverted or rendered with percent labels.

Root failure: atom selection and rule composition are not covered by a real-entry semantic contract.

### 4. Context, Position, and Risk Do Not Reach Execution

Explicit user text like `OKX`, `现货`, `合约`, `15m`, `10%`, `10 USDT`, `止损 5%`, and `止盈 10%` often does not persist into `contextSlots`, `position`, or executable risk state.

Root failure: extraction, defaulting, and projection for execution-critical non-condition data is inconsistent.

### 5. UI Rendering Does Not Reflect Rules Tree Semantics

The UI summary sometimes falls back to generic labels like `指标高于阈值` or simplified labels like `向上突破（24，0%）`, even when the rules tree contains more specific MA, EMA, timeframe, channel, or range semantics.

Root failure: renderer does not consistently consume the rules tree parameter shape and composition.

### 6. Clarification Does Not Preserve and Fill State

Some sessions ask valid or invalid clarification questions, then fail to merge short answers such as `是的`, `不需要`, `okx`, `15m`, or `不加仓` back into the pending slot. Some repeat the same question or clear previously understood strategy semantics.

Root failure: clarification answer handling is not slot-bound and not rules-tree-preserving enough.

## Design

### Gate 1: RulesTreeEntryGate

The entry gate validates that a user strategy response produces a durable rules tree or an explicit unsupported state.

Requirements:

- If the user input contains recognizable strategy semantics, the session must persist non-empty `semantic_state.rules[]`.
- Empty rules must not be marked as `clarification_state.status=CLEAR`.
- Planner schema reject reasons must be persisted into DB-visible diagnostics or validation report, not only logs.
- Planner retry remains single-attempt.
- Dispatcher fallback remains forbidden for production semantic synthesis.
- If output is unsupported, assistant text must identify unsupported reason and keep the session fail-closed.

Acceptance:

- Strategy 5 style grid input cannot persist an empty clear state.
- Strategies 19 and 28 cannot have assistant text claiming understanding while `rules[]` is empty.
- DB evidence must show either valid rules, pending clarification slots, or explicit unsupported diagnostics.

### Gate 2: RulesTreeProjectorGate

The projector gate validates that all derived compatibility buckets are exact projections of the rules tree.

Requirements:

- `trigger`, `action`, `risk`, `positionConstraint`, and `orchestration` projections are recomputed from `rules[]` when rules are present.
- Projections cannot add, remove, or rename action effects.
- Dotted action atoms such as `action.open_long` must be treated as valid rules-tree action atoms throughout projection, support classification, readiness, and generation.
- Any flat value that differs from rules-derived projection is discarded or overwritten by projection.
- Projection failures must be diagnosable.

Acceptance:

- Any rule effect `action.open_long` projects into an action state that readiness and generation consider supported.
- No generate failure may say `开多/平多 unsupported` when the atom contract marks the corresponding rules-tree action as executable.
- Readiness consumes the projected state generated from the same rules tree.

### Gate 3: RulesTreeCompletenessGate

The completeness gate validates execution-critical context, position, and risk.

Requirements:

- Explicit context in user text must lock `contextSlots`: exchange, symbol, marketType, and timeframe.
- Explicit sizing such as percent, quote amount, base amount, or per-grid budget must lock or create the correct position or position constraint.
- Defaultable slots are filled without user questions:
  - stop-loss and take-profit basis defaults to `entry_avg_price` when product convention applies.
  - BOLL defaults to `(20, 2)`.
  - RSI defaults to period `14`.
- Real missing executable slots become open clarification slots.
- Missing context or sizing must not be misreported as unsupported atom semantics.

Acceptance:

- `OKX 合约 BTCUSDT 15m` locks exchange, market type, symbol, and timeframe.
- `止损 5%` creates risk basis `entry_avg_price` without asking.
- `单笔 10%` and `仓位 10usdt` reach execution sizing.
- If a mandatory slot is missing, response enters clarification rather than unsupported.

### Gate 4: RulesTreeRenderGate

The render gate validates that user-visible summaries and logic graphs are rendered from the rules tree.

Requirements:

- Rule summary, UI logic graph, clarification summary, and unsupported summary derive from rules tree semantics.
- Renderer must understand nested parameter shapes such as `params.reference.period`.
- Renderer must preserve composition: AND, OR, sequence, gate, effect, and risk.
- Renderer may not use generic labels when required display params are present.
- Unsupported atoms must show public names and reasons, not internal keys or contract slot names.

Acceptance:

- EMA/MA conditions render with indicator type, period, relation, and timeframe when present.
- Channel breakout renders previous high/low or rolling high/low semantics.
- Grid and DCA render as grid/DCA programs, not irrelevant add-position prompts.
- UI graph and script intent summary refer to the same rules.

### Gate 5: ClarificationSlotGate

The clarification gate preserves rules while asking and filling missing slots.

Requirements:

- When clarification is needed, current `rules[]` must remain persisted.
- `clarification_state.items[]` must map to open slots in rules, contextSlots, position, risk, or orchestration.
- User answers are applied to the pending slot first. They must not be treated as a new strategy unless no pending slot exists.
- Short answers such as `是的`, `不需要`, `okx`, `15m`, `10%`, and `不加仓` must resolve against the pending slot context.
- Filling a slot closes that slot and triggers projection and readiness again.
- If more slots remain, ask the next one.
- If no slots remain, proceed to generation or confirmation.
- The same slot must not be asked repeatedly after a valid answer.

Acceptance:

- Strategy 1: `是的` fills stop-loss basis if asked, but defaulting should avoid the question.
- Strategy 12: default BOLL parameters are not repeatedly asked.
- Strategy 13: `不需要` closes reverse-position clarification and preserves close-long semantics.
- Strategy 15 and 30: `不加仓` closes add-position related clarification or prevents irrelevant add-position route.
- Strategy 29: `okx` locks exchange without clearing existing rules.

### Gate 6: Staging31HardGate

The staging gate makes the 31 recorded strategies the real acceptance suite.

Requirements:

- Run the 31 strategies through the same staging or staging-equivalent real natural-language entrypoint.
- Each run records:
  - input text
  - assistant response
  - `semantic_state.rules`
  - projected flat buckets
  - contextSlots
  - clarification state
  - UI summary or graph payload
  - readiness decision
  - Canonical Spec summary
  - IR summary
  - AST summary
  - generated script summary or unsupported reason
- Each case must end in one of:
  - `pass`: rules/UI/Spec/IR/AST/script are consistent.
  - `needs_clarification`: rules are preserved and missing slots are explicit.
  - `unsupported`: rules and unsupported capability are visible, fail-closed, and no script is generated.
- Empty clear states fail.
- Generate unsupported for supported actions fails.
- UI/script mismatch fails.

Acceptance:

- The 31 strategy report becomes a release gate for AI Quant codegen changes.
- New strategy classes can fail only as visible unsupported or valid clarification, not as empty state or incorrect script.

## Architecture Changes

### Diagnostics

Persist structured diagnostics for each gate:

- `entry.rejectReasons`
- `projection.diff`
- `completeness.missingSlots`
- `render.warnings`
- `clarification.slotResolution`
- `staging31.caseResult`

These diagnostics can live in existing validation or diagnostic JSON fields. They must be queryable from DB for staging triage.

### Projection Contract

Define one projection API that all downstream code uses:

```text
projectFromRules(rules, context) -> projectedState
```

Consumers must not read stale flat fields directly when rules are present.

### Readiness Contract

Readiness uses projected rules state and returns one decision:

- `ready_to_generate`
- `needs_clarification`
- `unsupported`
- `invalid_state`

`invalid_state` is for internal inconsistency such as rules action present but projected action missing.

### Clarification Contract

Clarification uses a pending-slot resolver:

```text
resolveAnswer(pendingSlot, answer, currentRulesState) -> updatedRulesState
```

It must update the same rules state or context state, then rerun projection and readiness.

## Test Strategy

### Unit Tests

- Rules tree projection for every supported action atom.
- Context extraction and defaulting for exchange, symbol, market type, timeframe, sizing, and risk basis.
- Renderer tests for indicator, BOLL, breakout, sequence, grid, DCA, webhook, and quantile cases.
- Clarification slot answer tests for short answers and repeated-question prevention.

### Integration Tests

- Rules tree -> projection -> readiness.
- Rules tree -> UI graph.
- Rules tree -> Canonical Spec -> IR -> AST -> script.
- Clarification answer -> updated rules -> projection -> readiness.

### Staging 31 Tests

- DB-backed replay or live staging-equivalent execution for all 31 cases.
- Snapshot and compare gate outputs.
- Fail if any case returns empty clear state, unsupported supported action, state-clearing clarification, or UI/script mismatch.

## Rollout

1. Add diagnostics and hard gate tests without changing behavior where possible.
2. Fix entry persistence and reject diagnostics.
3. Fix projection and action support/readiness consistency.
4. Fix context, position, and risk completeness.
5. Fix clarification slot merge.
6. Fix renderer consistency.
7. Run Staging31HardGate and publish report.

## Out Of Scope

- Reintroducing dispatcher fallback as production semantic source.
- Letting flat buckets override rules tree.
- Generating best-effort scripts for unsupported atoms.
- Adding unrelated trading features beyond what is needed to make the current rules tree pipeline coherent.

## Success Criteria

- All 31 staging strategies produce a deterministic gate result.
- Supported strategies generate scripts whose UI, Spec, IR, AST, and script all match the same rules tree.
- Missing slots are asked and filled without losing existing rules.
- Unsupported capabilities are visible and fail-closed.
- DB contains enough diagnostics to identify the exact failing gate without rerunning browser flow.

## PR Merge Gate

Every implementation PR for this work must run the 31 strategies through the staging real entrypoint, not mock rules. Each case report must include:

```text
input
  -> assistant response
  -> rules tree
  -> projected flat
  -> context / position / risk
  -> clarification
  -> readiness
  -> UI summary / graph
  -> Canonical Spec
  -> IR
  -> AST
  -> script or error
```

Each case must end as exactly one of:

- `pass`: UI, Canonical Spec, IR, AST, and script are consistent with the same rules tree.
- `needs_clarification`: rules tree is preserved, missing slots are explicit, and the next answer can fill the pending slot.
- `unsupported`: unsupported atom or capability is visible and explained, and no script is generated.

The PR must not merge if any case has:

- empty `rules[]` with clear status.
- supported action reported as unsupported.
- clarification that clears the rules tree.
- repeated question for a slot already answered.
- UI and AST or script mismatch.
- flat bucket state overriding rules tree.
- unsupported state that still generates a script.
