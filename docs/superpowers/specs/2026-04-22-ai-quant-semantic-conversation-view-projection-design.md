# AI Quant Semantic Conversation View Projection Design

## Context

The semantic-only checklist deletion has removed checklist from external API, persistence, publication input, and canonical generation. The remaining blocker is internal conversation presentation and decision support. `CodegenConversationService` still projects `SemanticState` back into `StrategyLogicSnapshot` so old helpers can build:

- user-facing clarification summaries
- confirm-gate assistant prompts
- normalization assistant prompts
- recommendation style decisions
- deterministic authority decisions
- inferred confirmation defaults

Attempts to delete `projectLegacyLogicSnapshotFromSemanticState()` directly broke many conversation tests because these view/decision helpers still expect legacy rule arrays and `riskRules`. The root cause is missing semantic-native conversation view data.

## Goals

- Introduce a semantic-native conversation view that replaces `StrategyLogicSnapshot` as the input for summaries, prompts, recommendation style, deterministic authority, and inferred defaults.
- Replace the ambiguous `projectLegacyLogicSnapshotFromSemanticState()` production helper with an explicitly named legacy compatibility boundary, and remove it from canonical generation, publication authority, and new semantic mainline decisions.
- Keep canonical generation semantic-only.
- Preserve current working strategy flows and known semantic gap behavior.
- Make any remaining legacy bridge explicit, documented, and clearly non-main.

## Non-Goals

- Do not redesign `SemanticState`, atom keys, reducer behavior, canonical digest semantics, or publication persistence.
- Do not restore checklist compatibility for old persisted sessions.
- Do not broaden strategy semantics beyond preserving already working cases.
- Do not mechanically rename `checklist` to evade grep guards.

## Proposed Architecture

Add a semantic conversation view projection, likely in `SemanticStateProjectionService` or a focused sibling service:

```ts
interface SemanticConversationView {
  summary: string
  triggerSummary: string
  riskSummary: string
  positionSummary: string
  executionContext: {
    exchange: string | null
    symbol: string | null
    marketType: string | null
    timeframe: string | null
  }
  hasDeterministicSemantics: boolean
  recommendationSignals: {
    hasShortIntent: boolean
    hasLongIntent: boolean
    hasBidirectionalIntent: boolean
    hasGridIntent: boolean
  }
  inferredDefaults: {
    inferredKeys: Array<'risk.stopLossBasis' | 'risk.takeProfitBasis'>
    stopLossBasis: string | null
    takeProfitBasis: string | null
  }
}
```

The exact field shape can be adjusted during implementation, but the view must be derived only from:

- `SemanticState`
- normalized intent
- compileability report
- constraint pack metadata

It must not read `StrategyLogicSnapshot`, `entryRules`, `exitRules`, or `riskRules`.

## Replacement Map

### Summary And Prompts

Replace:

- `buildClarificationSummary(checklist, normalizedIntent?)`
- `buildLogicGateAssistantPrompt(checklist, normalizedIntent)`
- `buildNormalizationAssistantPrompt(checklist, normalization)`

with semantic view equivalents:

- `buildSemanticClarificationSummary(semanticState, normalizedIntent?)`
- `buildSemanticLogicGateAssistantPrompt(semanticState, normalizedIntent)`
- `buildSemanticNormalizationAssistantPrompt(semanticState, normalization)`

The prompt wording does not need to be byte-for-byte identical, but it must preserve gate intent:

- confirm gate summarizes recognized semantic strategy before asking for confirmation
- normalization blockers explain semantic open slots or compileability gaps
- no legacy missing `entryRules` / `exitRules` fallback language

### Recommendation Style

Replace `inferRecommendationStyleFromContext(message, checklist, currentStyle)` with a semantic-native variant that reads:

- user message
- semantic triggers/actions
- normalized intent side scopes
- grid side mode

It should not inspect legacy rule text.

### Deterministic Authority

Replace `resolveContinueSessionDeterministicAuthority({ semanticState, checklist, ... })` with semantic-only input. `hasDeterministicStrategySemantics()` should check active semantic triggers/actions/grid/position/risk, not legacy rule arrays.

### Inferred Confirmation Defaults

Replace the temporary bridge that derives inferred defaults from projected checklist/riskRules. Defaults should come from semantic risk atoms:

- `risk.stop_loss_pct.params.basis`
- `risk.take_profit_pct.params.basis`
- `basisSource` or equivalent semantic marker indicating system default inference
- constraint-pack consumed keys

### Tests

Tests should stop calling ambiguous production private projection helpers for semantic assertions. If legacy projection is needed to compare historical behavior, use explicitly named compatibility helpers and keep them out of canonical / publication authority.

Tests that assert old wording like “checklist gate” may keep names temporarily, but assertions should verify semantic authority behavior.

## Migration Plan

1. Add semantic conversation view projection tests around representative semantic states:
   - MA/EMA
   - Bollinger one-side and two-side
   - grid
   - percent-change
   - on-start
   - incomplete MA clarification
2. Implement semantic view projection.
3. Convert prompt/summary helpers to consume semantic view.
4. Convert recommendation style and deterministic authority to semantic view.
5. Convert inferred confirmation defaults to semantic risk atoms.
6. Rename and isolate the remaining projection helper as an explicit compatibility boundary, then progressively delete it after semantic-native replacements cover all callers.
7. Run guard and full strategy regression.

## Verification

Minimum verification:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts
dx build quantify --dev
dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen
```

The production guard must pass:

```bash
rg -n "projectLegacyLogicSnapshotFromSemanticState|buildFallbackSemanticState\\s*\\(|buildCanonicalSpecFromLegacyLogicSnapshotForNonSemanticCompatibilityOnly|canonicalSpecBuilder\\.build\\(\\s*checklist\\b|session\\.checklist" apps/quantify/src/modules/llm-strategy-codegen -g '!**/__tests__/**' -g '!**/*.spec.ts'
```

Expected: no output.

## Acceptance Criteria

- Production conversation main path does not use ambiguous semantic-to-legacy projection helpers as canonical or publication authority.
- Summary, prompt, recommendation style, deterministic authority, and inferred defaults are semantic-native.
- Existing working strategy families are revalidated after removal.
- Checklist-only persisted sessions do not generate through checklist completeness.
- Any remaining checklist references are historical docs, migrations, explicit legacy tests, or documented non-main compatibility boundaries scheduled for deletion.
