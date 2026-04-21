# Issue 850 Semantic-Only Checklist Deletion Verification

## Summary

The AI Quant codegen path no longer uses planner `logic`, publication checklist input, engine/test checklist DTOs, or `checklist-compat` production types/helpers. Semantic state, semantic patch, and canonical spec are now the intended authority path.

## Strategy Regression Results

- Publishes: EMA crossover.
- Publishes: Bollinger upper/middle.
- Publishes: two-sided Bollinger.
- Publishes: one-side confirmed Bollinger.
- Publishes: bidirectional grid with explicit range and step.
- Publishes: percent-change entry and position-basis exit.
- Publishes: on-start market entry with stop loss.
- Explicit gap: MA price-vs-reference (`indicator.above` / `indicator.below`) rejects with `codegen.canonical_spec_v2_condition_unsupported:indicator.above` after checklist fallback removal.
- Explicit gap: fixed-range grid wording `按 1% 网格买入...` is not yet extracted as grid semantics unless range/step wording is explicit.
- Clarify: incomplete MA semantics without a reference period stays in semantic clarification via `reference.period.entry`; it does not fall back to checklist-derived rules.

## Verification Commands

- `npx nx test quantify --runTestsByPath src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts --runInBand`
  - Passed: 10 tests.
- `npx nx test quantify --runTestsByPath src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts src/modules/llm-strategy-codegen/services/__tests__/codegen-publication-generation.stage.spec.ts --runInBand`
  - Passed in worker verification.
- `dx build quantify --dev`
  - Passed after a retry; Nx reported the target as flaky because the first run failed before the worker fixed a type issue.
- `dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen`
  - Passed: 6 tests.
  - Existing environment warnings were observed: `NODE_ENV` unset, ts-jest deprecation, Jest forceExit.

## Grep Guard

The strict final grep:

```bash
rg -n "ChecklistPayload|ChecklistRuleDraft|ChecklistRuleBasis|checklist-compat|ConversationPlan.*logic|compatibilityChecklist|canonicalSpecBuilder\.build\(checklist\)|checklist:" apps/quantify/src/modules/llm-strategy-codegen -g '!**/__tests__/**' -g '!**/*.spec.ts'
```

Results:

- Clean for removed authority symbols:
  - `ChecklistPayload`
  - `ChecklistRuleDraft`
  - `ChecklistRuleBasis`
  - `checklist-compat`
  - `ConversationPlan.*logic`
  - `compatibilityChecklist`
  - `canonicalSpecBuilder.build(checklist)`
- Not clean for `checklist:` variable/parameter names.

Remaining `checklist:` matches are in legacy `StrategyLogicSnapshot` projection, clarification, and summary compatibility code. The current semantic conversation path is expected to pass `SemanticState` into canonical generation, and the direct canonical checklist fallback has been isolated behind `buildCanonicalSpecFromLegacyLogicSnapshotForNonSemanticCompatibilityOnly()`.

These remaining names are an unresolved cleanup gap. They are not treated as a successful checklist removal proof. A follow-up should rename or remove these legacy snapshot parameters after the remaining clarification/projection compatibility path is converted.

## Boundary Confirmation

This work did not intentionally change atom keys, `SemanticState` meaning, reducer semantics, digest semantics, or publication persistence. Where old checklist fallback previously masked missing semantic compiler support, the tests now expose the gap instead of silently publishing through checklist.
