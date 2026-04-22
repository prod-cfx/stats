# AI Quant Semantic Single Authority Tail Cleanup Design

## Context

Issue #850 removed the external checklist contract from AI Quant codegen: planner output no longer carries legacy `logic`, publication no longer accepts checklist input, engine tests reject checklist bodies, and session persistence no longer writes a checklist column.

One internal compatibility layer remains. `StrategyLogicSnapshot` is produced from `SemanticState` and then read by conversation clarification, summaries, execution-context resolution, inferred-confirmation decisions, and canonical-spec fallback paths. Although this no longer exposes checklist as an API or persistence contract, it still creates a second semantic authority inside the main path.

The feature is still in testing and has not been released online. The correct cleanup window is now: remove the final compatibility authority while regressions are still cheap to fix.

## Goals

- Make `SemanticState`, normalized intent, and `CanonicalSpecV2` the only production authority chain for strategy meaning.
- Remove `StrategyLogicSnapshot` projection from the start/continue/confirm/publish main conversation path.
- Remove the conversation-level canonical fallback that compiles from a legacy logic snapshot.
- Replace remaining production decisions that read `StrategyLogicSnapshot` with semantic-native readers.
- Keep current working strategy families usable after the final checklist removal.
- Add verification that proves the already working main-path strategies still compile, publish, or reach the intended semantic clarification state.

## Non-Goals

- No compatibility for old checklist request bodies or old persisted checklist payloads.
- No redesign of atom keys, semantic reducer merge rules, canonical digest semantics, or publication persistence semantics.
- No broad UI redesign.
- No new strategy behavior unless needed to preserve a strategy that already worked through the current semantic main path.

## Design

### Authority Chain

The production main path becomes:

```text
message / semanticPatch
-> SemanticState
-> semantic clarification and normalized intent
-> CanonicalSpecV2
-> confirmation digest
-> publication
```

The removed path is:

```text
SemanticState
-> StrategyLogicSnapshot
-> clarification / summary / execution context / canonical fallback
```

`StrategyLogicSnapshot` may remain only in tests, historical docs, or temporary debug-only projections. It must not drive production decisions.

### Clarification

Clarification must read semantic structures:

- open slots on triggers, risk atoms, position, and context slots
- compileability report reasons
- semantic clarification state already persisted on the session

Legacy completeness checks such as "missing entryRules" and "missing exitRules" are removed from production main flow. If a strategy lacks a required entry, exit, risk, position, market, or timeframe component, the blocker is represented as a semantic open slot or a canonical compileability reason.

### Execution Context

Execution context is read from semantic state:

- exchange, market type, symbol, and timeframe from context slots or canonical semantic context
- position sizing and mode from semantic position state
- risk defaults from risk atoms and confirmed inferred assumptions

The old lookup order through `StrategyLogicSnapshot.market`, `symbols`, `timeframes`, and `riskRules` is removed from conversation decisions.

### Inferred Confirmation

Inferred confirmation must classify defaults from semantic state and constraint pack data. It cannot receive `StrategyLogicSnapshot` as its strategy input. Stop-loss basis, take-profit basis, position defaults, and generic default assumptions must be derived from semantic atoms and explicit inferred-confirmation metadata.

### Canonical Spec

Conversation canonical generation always requires semantic state or normalized semantic intent. `buildCanonicalSpecForConversation()` must not fall back to `canonicalSpecBuilder.build(legacyLogicSnapshot)`.

If semantic state cannot compile, the service returns semantic clarification or compileability feedback. It must not silently recover by compiling from a projected legacy structure.

### Summary And Assistant Prompts

Summary and confirmation prompts should be built from:

- semantic projection views
- normalized intent
- canonical spec description
- semantic clarification items

They should not reconstruct user-facing logic from legacy `entryRules`, `exitRules`, or `riskRules`.

## Files And Components

Expected production cleanup targets:

- `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
  - remove main-path calls to `projectLegacyLogicSnapshotFromSemanticState`
  - remove `buildFallbackSemanticState` from production main path
  - remove `buildCanonicalSpecFromLegacyLogicSnapshotForNonSemanticCompatibilityOnly`
  - replace `resolveClarificationArtifacts(checklist)` with semantic-native artifacts
  - replace `session.checklist` reads in confirmation path
- `apps/quantify/src/modules/llm-strategy-codegen/services/inferred-confirmation-classifier.service.ts`
  - accept semantic authority input instead of `StrategyLogicSnapshot`
- `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-execution-context.service.ts`
  - add semantic-state resolution or retire it from main path
- `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-summary-builder.service.ts`
  - ensure production summaries are semantic/canonical based
- `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-intent-normalizer.service.ts`
  - keep only if used by non-main legacy tests, or replace main-path usage with `buildNormalizedIntentFromSemanticState`

## Verification Strategy

After implementation, rerun the current main-path strategy regression set and document each result:

- EMA crossover publishes through semantic state.
- Bollinger upper-short and middle-exit publishes.
- Two-sided Bollinger publishes.
- One-sided confirmed Bollinger publishes only the confirmed side.
- Bidirectional grid with explicit range and step publishes.
- Percent-change entry and position-basis exit publishes.
- On-start market entry with stop loss publishes.
- MA price-vs-reference remains the explicit semantic compiler gap unless semantic compiler support is added.
- Fixed-range grid wording without explicit range/step remains the documented semantic extraction gap unless semantic extraction support is added.
- Incomplete MA semantics remains in semantic clarification instead of falling back.

Minimum commands:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts
dx build quantify --dev
dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen
```

Regression grep must show no production main-path matches for:

- `projectLegacyLogicSnapshotFromSemanticState`
- `buildFallbackSemanticState`
- `buildCanonicalSpecFromLegacyLogicSnapshotForNonSemanticCompatibilityOnly`
- `canonicalSpecBuilder.build(checklist)`
- `session.checklist`
- production `checklist:` parameters used as semantic input

Any remaining checklist references must be limited to historical migrations, docs, or tests explicitly asserting checklist absence.

## Acceptance Criteria

- Production conversation main path has one semantic authority chain: `SemanticState -> normalized intent -> CanonicalSpecV2`.
- `StrategyLogicSnapshot` no longer participates in production clarification, summary decisions, execution context, inferred confirmation, canonical generation, or publication.
- Existing working strategy families are revalidated after the cleanup.
- Any strategy that stops working is fixed semantically, not by restoring checklist or legacy snapshot fallback.
- Verification report clearly states which strategy families publish, which intentionally clarify, and which remain explicit semantic compiler or extractor gaps.

