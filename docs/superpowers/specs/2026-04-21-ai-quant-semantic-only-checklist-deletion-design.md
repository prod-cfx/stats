# AI Quant Semantic-Only Checklist Deletion Design

## Context

AI Quant codegen is still in testing and has not been exposed to users. The session table no longer persists the `checklist` column, and the confirmed publication path already prefers `semanticState` plus `CanonicalSpecV2`. However, production code still contains checklist compatibility structures, planner `logic` fallback, checklist-based engine test input, and canonical-spec fallback paths.

Keeping those compatibility paths now would make atomic semantics harder to trust later. This design removes checklist from production code as an input shape, fallback shape, test API shape, and naming concept. The only source of strategy semantics will be:

- `SemanticState`
- `CodegenSemanticPatch`
- `CanonicalSpecV2`

The deletion must not regress the strategies that recently became runnable.

## Goals

- Delete `ChecklistPayload`, `ChecklistRuleDraft`, `ChecklistRuleBasis`, and `checklist-compat.ts` from production code.
- Remove planner `logic` and all checklist merge/projection fallbacks from the main conversation path.
- Remove checklist input from publication generation and pipeline services.
- Change `engine/test` to semantic-only input.
- Preserve the existing main semantic data flow and atomic semantic contracts. This work removes checklist only; it must not redesign `SemanticState`, atom keys, reducer semantics, canonical compiler behavior, digest semantics, or publication semantics.
- Keep recently working strategy families runnable through native semantic state:
  - MA / EMA crossover and price-vs-MA strategies.
  - Bollinger upper/lower/middle strategies, including touch vs close confirmation and one-side or dual-side variants.
  - Fixed-range grid strategies, including long-only, short-only, and bidirectional grids.
  - Percent-change triggers and `execution.on_start`.
  - Position sizing, stop loss, take profit, basis, exchange, market type, symbol, and timeframe.
- Add regression checks that production code cannot reintroduce checklist as a semantic source.

## Non-Goals

- No backwards compatibility for old checklist request bodies. This is acceptable because the feature is still in testing.
- No migration for historical checklist payloads. The database column has already been dropped.
- No broad UI redesign. Frontend work is limited to naming and API payload changes needed by semantic-only codegen.
- No atomic semantic model redesign. Existing `SemanticState`, `CodegenSemanticPatch`, semantic reducer, semantic slots, normalized intent, and `CanonicalSpecV2` behavior are treated as the stable main path.
- No opportunistic fixes to strategy semantics unless a failure is directly caused by checklist removal. If a regression appears, restore the existing behavior through semantic-native extraction or wiring, not by changing atom meaning.

## Boundary Rule

This change is a deletion and rewiring project, not a new semantic architecture project.

Allowed:

- Remove checklist types, helpers, DTO fields, publication inputs, and planner fallback fields.
- Replace checklist-derived inputs with already-existing semantic equivalents.
- Move deterministic parsing that currently produces checklist into a semantic-native adapter only when it is required to preserve an already working strategy.
- Add tests that prove checklist cannot re-enter production paths.

Not allowed:

- Rename or reinterpret existing atom keys.
- Change reducer merge precedence except where the current precedence depends on checklist fallback.
- Change canonical compiler output for existing semantic states.
- Change digest generation semantics.
- Change publication persistence semantics.
- Broaden strategy behavior beyond preserving the currently working strategy families.

## Key Risk

The highest risk is not the final compile/publish path. It is start/continue semantic completion.

Today, when the planner returns an incomplete `semanticPatch`, checklist helpers can still infer or preserve details through `logic`, `inferChecklistFromMessage()`, `buildFallbackSemanticState()`, and `projectLegacyChecklistFromSemanticState()`. Removing those without a semantic-native replacement could make working strategies fall back to `DRAFTING`, hit compileability blockers, or lose risk/context details.

The fix is to move the useful deterministic extraction into a semantic-native boundary before deleting checklist.

## Proposed Architecture

### Semantic Seed Extractor

Introduce a semantic-native service, tentatively `SemanticSeedExtractorService`.

It accepts natural-language text and returns a `CodegenSemanticPatch` or partial `SemanticState`. It replaces the useful behavior currently hidden behind checklist inference:

- Detect symbol, exchange, market type, and timeframe.
- Detect position sizing and position mode.
- Detect MA / EMA reference-period triggers and exits.
- Detect Bollinger upper/lower/middle triggers and exits with confirmation mode.
- Detect grid range, step, side mode, and breakout action.
- Detect percent-change triggers.
- Detect `execution.on_start`.
- Detect stop loss, take profit, and basis where explicit.

This service must not invent a new semantic model or change atomic semantic meaning. It only ports existing deterministic checklist-era recognition into current `CodegenSemanticPatch` / `SemanticState` shapes. Its output is only semantic atoms, semantic slots, and context slots.

### Planner Contract

`ConversationPlan` becomes semantic-only:

```ts
interface ConversationPlan {
  related: boolean
  logicReady: boolean
  assistantPrompt: string
  semanticPatch?: CodegenSemanticPatch
}
```

`planConversationByLlm()` sends the current `SemanticState`, user message, and recent history. It does not send `compatibilityChecklist`.

Planner responses only consume `semanticPatch` or `semanticUpdates`. Any legacy `logic` object is treated as schema mismatch and ignored. If the planner gives no valid semantic patch, the service can use `SemanticSeedExtractorService` on the user message, then continue through the same semantic merge/reducer path.

### Conversation Flow

The main flow becomes:

```text
message
 -> semantic seed extraction and/or planner semanticPatch
 -> SemanticState merge/reducer
 -> open semantic slots / clarification
 -> CanonicalSpecV2
 -> canonical digest confirmation
 -> compile and publish
```

The deleted flow is:

```text
message -> checklist -> semanticState
semanticState -> checklist -> canonicalSpec
checklist -> publication fallback
```

### Canonical Spec

`buildCanonicalSpecForConversation()` must no longer build `checklistSpec` first.

When `semanticState` exists, canonical spec generation only uses:

- `buildNormalizationFromSemanticState(semanticState)`
- semantic canonical context
- `canonicalSpecBuilder.buildFromNormalizedIntent(...)`

If the semantic state cannot compile, the user gets semantic clarification or compileability feedback. The service must not silently recover by compiling from checklist.

The canonical compiler itself is not redesigned by this work. Existing semantic-state golden cases should produce the same canonical structure unless the previous structure depended on checklist fallback rather than atomic semantics.

### Clarification

Clarification should read `SemanticState` and `StrategyClarificationState`. Legacy checklist completeness items are removed:

- missing entry rules
- missing exit rules
- missing stop-loss rule
- missing take-profit rule

The replacement is open semantic slots and compileability reasons. For example, a missing MA period is `semantic.reference.period.entry`; missing position sizing is `position.sizing`; missing grid bounds are `grid.range.lower` and `grid.range.upper`.

### Publication

`CodegenSessionPublicationPipelineService.run()` and `CodegenPublicationGenerationStage.generate()` no longer accept `checklist`.

Publication input becomes:

```ts
{
  sessionId: string
  userId: string
  semanticState: SemanticState
  canonicalSpecOverride?: CanonicalStrategySpecV2
  message: string
  model?: string
  existingStrategyInstanceId?: string | null
}
```

Locked params and publish params are derived from semantic state and canonical spec only.

### Engine Test API

`TestLlmCodegenEngineDto` no longer accepts `symbols`, `timeframes`, `entryRules`, `exitRules`, or `riskRules`.

It accepts one of:

- `semanticState`
- `canonicalSpec`

The preferred test request is `semanticState`, because it validates the same semantic-only compiler path as conversation confirmation.

Old checklist test bodies should fail validation.

### Frontend Naming

Frontend names containing checklist should be changed to semantic or logic names when they refer to current UI messages. This includes variables like `checklistContinuedMessage` and `checklistUpdatedMessage`.

## Files To Remove Or Retire

Delete from production code:

- `apps/quantify/src/modules/llm-strategy-codegen/types/checklist-compat.ts`
- `apps/quantify/src/modules/llm-strategy-codegen/services/checklist-compat.ts`
- `REQUIRED_CHECKLIST_FIELDS` and `ChecklistField` in `constants/constraint-pack.ts`
- `SpecDescBuilderService.build(checklist, ...)`
- checklist branches in `CodegenPublicationGenerationStage`
- checklist input in `CodegenSessionPublicationPipelineService`
- checklist fields in `TestLlmCodegenEngineDto`

Retire from `CodegenConversationService` by replacing with semantic-native equivalents:

- `inferChecklistFromMessage`
- `buildFallbackSemanticState`
- `projectLegacyChecklistFromSemanticState`
- `buildLegacyChecklistFromSemanticState`
- `mergeChecklistSnapshots`
- `normalizeChecklist`
- `readChecklistPayload`
- checklist-based `applyClarificationAnswers`
- checklist-based `resolveClarificationArtifacts`
- checklist fallback in `buildCanonicalSpecForConversation`

## Regression Strategy Set

The final implementation must verify these strategy families still compile or reach the same intended clarification state:

1. MA / EMA
   - `OKX 现货 BTCUSDT 15m；15m 收盘确认当价格突破 MA50 时买入；15m 收盘确认当价格跌破 MA10 时卖出；亏损 5% 止损，盈利 10% 止盈；单笔 10%。`
   - `EMA7 上穿 EMA21 做多；EMA7 下穿 EMA21 平多；单笔 10%。`

2. Bollinger
   - `OKX 合约 BTCUSDT 15m；K线收盘后确认突破布林带(30,2.5)上轨时做空；价格回到布林带中轨(MA30)时平空；单笔 10%。`
   - `K线收盘后确认突破布林带(20,2)上轨时做空，突破下轨时做多；价格回到布林带中轨时平仓；单笔 10%，亏损 5% 止损。`
   - A one-side confirmed semantic state must publish only that confirmed side.

3. Grid
   - `OKX 合约 BTCUSDT 15m；在 60000-80000 区间执行双向网格，步长 0.5%，单笔 10%。`
   - `BTCUSDT 固定区间 60000-80000，按 1% 网格买入，触达上方网格卖出，仓位 1%，单笔最大亏损 2%。`

4. Percent Change
   - `BTCUSDT 3m 当前K线收盘价相对上一根K线收盘价下跌 1% 时买入；15m 相对开仓均价上涨 2% 时卖出；5% 止损；10% 仓位。`

5. On Start
   - `立即开始时市价买入一次；1h；BTCUSDT；单笔 10%；亏损 5% 止损。`

## Verification Plan

Minimum verification after implementation:

- TypeScript compile for quantify.
- Focused unit tests for:
  - semantic seed extraction
  - conversation start/continue
  - confirmation digest
  - publication generation
  - engine/test semantic-only DTO
- Focused E2E:
  - `dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen`
- Regression grep:
  - no production import from `types/checklist-compat`
  - no production file named `checklist-compat.ts`
  - no production `ChecklistPayload`
  - no `ConversationPlan.logic`
  - no `compatibilityChecklist`
  - no `canonicalSpecBuilder.build(checklist)`
  - no publication input named `checklist`

The final report must explicitly say whether each strategy family above still reaches compile/publish or, when intentionally incomplete, the expected semantic clarification gate.

It must also explicitly say whether any main data-flow component was changed. The expected answer should be limited to checklist removal wiring; changes to atomic semantic meaning require separate approval.

## Rollout And Compatibility

This is intentionally breaking for old testing clients and fixtures. Because the feature is not user-facing, the safer long-term choice is to delete compatibility now. No runtime feature flag is needed.

If any of the regression strategy families fails after checklist deletion, do not restore checklist fallback. Add the missing semantic extraction, semantic reducer, or canonical compiler support instead.

## Acceptance Criteria

- Production code has no checklist semantic source.
- Engine test API is semantic-only.
- Planner cannot update strategy semantics through legacy `logic`.
- Publication cannot compile from checklist fallback.
- Existing atomic semantic state, reducer, canonical compiler, digest, and publication persistence contracts are preserved except for checklist input removal.
- The regression strategy set is verified and documented in the implementation final report.
- Any remaining occurrence of the word checklist is limited to historical docs, deleted migration comments, or tests explicitly asserting the absence of checklist.
