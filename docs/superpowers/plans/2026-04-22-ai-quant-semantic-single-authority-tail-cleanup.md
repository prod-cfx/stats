# AI Quant Semantic Single Authority Tail Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the final `StrategyLogicSnapshot` / checklist-derived authority from the AI Quant production conversation main path while proving the currently working strategy families still work.

**Architecture:** The production path becomes `SemanticState -> normalized intent -> CanonicalSpecV2 -> confirmation digest -> publication`. Legacy logic snapshots can remain only in historical tests or non-main legacy units; production conversation decisions must read semantic state, semantic clarification, normalized intent, canonical spec, and compileability reports.

**Tech Stack:** NestJS 11, TypeScript 5.9, Jest, Nx, Prisma, existing `dx` command wrapper.

---

## File Structure

- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
  - Owns conversation start, continue, confirm, canonical generation, clarification artifacts, and final response shaping.
  - Replace main-path `StrategyLogicSnapshot` variables with semantic artifacts.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/inferred-confirmation-classifier.service.ts`
  - Change classifier input from `checklist: StrategyLogicSnapshot` to semantic risk/default input.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-execution-context.service.ts`
  - Add semantic-state context resolution, then move conversation usage to that API.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts`
  - Expand semantic summary / next-question view so prompt and summary code no longer needs legacy rule text.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts`
  - Add production grep guard and keep the existing strategy-family verification.
- Modify focused unit tests under `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/`
  - Update inferred confirmation, execution context, and conversation tests to semantic-state inputs.
- Update `docs/testing/reports/2026-04-22-issue-850-semantic-only-checklist-deletion-verification.md`
  - Append final tail-cleanup verification results after implementation.

## Task 1: Add A Production Guard Test For Legacy Main-Path Authority

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts`

- [ ] **Step 1: Add the failing production grep guard test**

Append this test inside the existing `describe('semantic-only strategy regression verification', ...)` block:

```ts
  it('keeps production conversation main path free of legacy checklist authority', () => {
    const productionFiles = [
      'apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/services/inferred-confirmation-classifier.service.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/services/strategy-execution-context.service.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts',
      'apps/quantify/src/modules/llm-strategy-codegen/services/codegen-session-publication-pipeline.service.ts',
    ]
    const fs = require('node:fs') as typeof import('node:fs')
    const path = require('node:path') as typeof import('node:path')
    const root = path.resolve(__dirname, '../../../../../../..')
    const forbiddenPatterns = [
      /projectLegacyLogicSnapshotFromSemanticState/u,
      /buildFallbackSemanticState/u,
      /buildCanonicalSpecFromLegacyLogicSnapshotForNonSemanticCompatibilityOnly/u,
      /canonicalSpecBuilder\.build\(checklist\)/u,
      /session\.checklist/u,
      /\bchecklist:\s*StrategyLogicSnapshot\b/u,
    ]

    for (const file of productionFiles) {
      const source = fs.readFileSync(path.join(root, file), 'utf8')
      for (const pattern of forbiddenPatterns) {
        expect(source).not.toMatch(pattern)
      }
    }
  })
```

- [ ] **Step 2: Run the guard and verify it fails**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts -t "legacy checklist authority"
```

Expected: FAIL because `codegen-conversation.service.ts` still contains `projectLegacyLogicSnapshotFromSemanticState`, `buildFallbackSemanticState`, and `session.checklist`.

- [ ] **Step 3: Commit the failing guard**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts
git commit -F - <<'MSG'
test: guard semantic conversation authority

变更说明：
- 增加生产主链路 legacy checklist authority 回归守卫
- 先锁定 StrategyLogicSnapshot/checklist fallback 的剩余删除目标

Refs: #850
MSG
```

## Task 2: Add Semantic Execution Context Resolution

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-execution-context.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-execution-context.service.spec.ts`

- [ ] **Step 1: Add the semantic-state execution context test**

Add this test case to `strategy-execution-context.service.spec.ts`:

```ts
import type { SemanticState } from '../../types/semantic-state'
import { StrategyExecutionContextService } from '../strategy-execution-context.service'

describe('StrategyExecutionContextService semantic state', () => {
  const service = new StrategyExecutionContextService()

  function slot(slotKey: string, fieldPath: string, value: string) {
    return {
      slotKey,
      fieldPath,
      value,
      status: 'locked' as const,
      priority: 'context' as const,
      questionHint: '',
      affectsExecution: true,
    }
  }

  it('resolves exchange symbol market type and timeframe from semantic context slots', () => {
    const state: SemanticState = {
      version: 1,
      families: [],
      triggers: [],
      actions: [],
      risk: [],
      position: null,
      contextSlots: {
        exchange: slot('market.exchange', 'context.exchange', 'okx'),
        symbol: slot('market.symbol', 'context.symbol', 'BTCUSDT'),
        marketType: slot('market.marketType', 'context.marketType', 'perp'),
        timeframe: slot('market.timeframe', 'context.timeframe', '15m'),
      },
      normalizationNotes: [],
      updatedAt: '2026-04-22T00:00:00.000Z',
    }

    expect(service.resolveFromSemanticState(state)).toEqual({
      context: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        marketType: 'perp',
        timeframe: '15m',
      },
      ambiguities: [],
      evidence: [],
    })
  })
})
```

- [ ] **Step 2: Run the test and verify it fails**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-execution-context.service.spec.ts -t "semantic context slots"
```

Expected: FAIL with `resolveFromSemanticState is not a function`.

- [ ] **Step 3: Implement `resolveFromSemanticState`**

In `strategy-execution-context.service.ts`, add `SemanticState` import and this public method:

```ts
import type { SemanticState, SemanticSlotState } from '../types/semantic-state'
```

```ts
  resolveFromSemanticState(state: SemanticState): StrategyExecutionContextResolution {
    const context: StrategyExecutionContext = {
      exchange: this.readSemanticExchange(state.contextSlots.exchange),
      symbol: this.readSemanticSymbol(state.contextSlots.symbol),
      marketType: this.readSemanticMarketType(state.contextSlots.marketType),
      timeframe: this.readSemanticString(state.contextSlots.timeframe),
    }
    const timeframeOptional = !context.timeframe && this.hasSemanticGridTrigger(state)
    const ambiguities = [
      ...(!context.exchange ? [{ kind: 'execution_context_missing' as const, field: 'exchange' as const, reason: 'missing_exchange' as const }] : []),
      ...(!context.symbol ? [{ kind: 'execution_context_missing' as const, field: 'symbol' as const, reason: 'missing_symbol' as const }] : []),
      ...(!context.marketType ? [{ kind: 'execution_context_missing' as const, field: 'marketType' as const, reason: 'missing_market_type' as const }] : []),
      ...(!context.timeframe && !timeframeOptional ? [{ kind: 'execution_context_missing' as const, field: 'timeframe' as const, reason: 'missing_timeframe' as const }] : []),
    ]
    const evidence: StrategyExecutionContextResolution['evidence'] = []
    if (!context.exchange) {
      evidence.push({ key: 'market.exchange', reason: 'runtime_context_missing', priority: 100, question: '请确认交易所（binance / okx / hyperliquid）。' })
    }
    if (!context.symbol) {
      evidence.push({ key: 'market.symbol', reason: 'runtime_context_missing', priority: 95, question: '请确认策略交易标的（例如 BTCUSDT）。' })
    }
    if (!context.marketType) {
      evidence.push({ key: 'market.marketType', reason: 'runtime_context_missing', priority: 90, question: '请确认市场类型（现货或合约/perp）。' })
    }
    if (!context.timeframe && !timeframeOptional) {
      evidence.push({ key: 'market.timeframe', reason: 'runtime_context_missing', priority: 80, question: '请确认策略主周期（例如 15m 或 1h）。' })
    }
    if (timeframeOptional) {
      evidence.push({ key: 'timeframe_not_required_for_uniqueness', reason: 'timeframe_optional', priority: 10 })
    }

    return { context, ambiguities, evidence }
  }

  private readSemanticString(slot: SemanticSlotState | null): string | null {
    return typeof slot?.value === 'string' && slot.value.trim() ? slot.value.trim() : null
  }

  private readSemanticSymbol(slot: SemanticSlotState | null): string | null {
    const value = this.readSemanticString(slot)
    return value ? canonicalizeStrategySymbolInput(value) : null
  }

  private readSemanticExchange(slot: SemanticSlotState | null): StrategyExecutionContext['exchange'] {
    const normalized = this.readSemanticString(slot)?.toLowerCase()
    return normalized === 'okx' || normalized === 'binance' || normalized === 'hyperliquid' ? normalized : null
  }

  private readSemanticMarketType(slot: SemanticSlotState | null): StrategyExecutionContext['marketType'] {
    const normalized = this.readSemanticString(slot)?.toLowerCase()
    return normalized === 'spot' || normalized === 'perp' ? normalized : null
  }

  private hasSemanticGridTrigger(state: SemanticState): boolean {
    return state.triggers.some(trigger => trigger.status !== 'superseded' && trigger.key === 'grid.range_rebalance')
  }
```

- [ ] **Step 4: Run the test and verify it passes**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-execution-context.service.spec.ts -t "semantic context slots"
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/strategy-execution-context.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-execution-context.service.spec.ts
git commit -F - <<'MSG'
refactor: resolve execution context from semantic state

变更说明：
- 为策略执行上下文增加 SemanticState 读取入口
- 覆盖 exchange/symbol/marketType/timeframe 的语义来源

Refs: #850
MSG
```

## Task 3: Convert Inferred Confirmation To Semantic Input

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/inferred-confirmation-classifier.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/inferred-confirmation-classifier.service.spec.ts`

- [ ] **Step 1: Add semantic input types**

In `inferred-confirmation-classifier.service.ts`, replace the `StrategyLogicSnapshot` input field with this interface:

```ts
export interface InferredConfirmationSemanticDefaults {
  stopLossBasis?: StrategyRuleBasis['kind'] | null
  takeProfitBasis?: StrategyRuleBasis['kind'] | null
  inferredKeys: readonly string[]
}

export interface InferredConfirmationClassifierInput {
  message?: string | null
  assistantPrompt?: string | null
  conversationPhase?: string | null
  providerCode?: string | null
  model?: string | null
  decisionKeys: readonly string[]
  semanticDefaults: InferredConfirmationSemanticDefaults
}
```

- [ ] **Step 2: Replace default extraction**

Replace calls to `input.checklist` inside `classifyInferredDecisionReply()` with `input.semanticDefaults`. Replace `buildPendingKeyDefaults(input.checklist, activeKeys)` with:

```ts
this.buildPendingKeyDefaults(input.semanticDefaults, activeKeys)
```

Replace the helper signature and body with:

```ts
  private buildPendingKeyDefaults(
    defaults: InferredConfirmationSemanticDefaults,
    activeKeys: ReadonlySet<InferredConfirmationDecisionKey>,
  ): Partial<Record<InferredConfirmationDecisionKey, StrategyRuleBasis['kind']>> {
    const pendingDefaults: Partial<Record<InferredConfirmationDecisionKey, StrategyRuleBasis['kind']>> = {}
    if (activeKeys.has('risk.stopLossBasis') && defaults.stopLossBasis) {
      pendingDefaults['risk.stopLossBasis'] = defaults.stopLossBasis
    }
    if (activeKeys.has('risk.takeProfitBasis') && defaults.takeProfitBasis) {
      pendingDefaults['risk.takeProfitBasis'] = defaults.takeProfitBasis
    }
    return pendingDefaults
  }
```

- [ ] **Step 3: Update classifier tests**

In each classifier test input, replace:

```ts
checklist: buildChecklist(),
```

with:

```ts
semanticDefaults: {
  inferredKeys: [],
  stopLossBasis: null,
  takeProfitBasis: null,
},
```

For tests that previously used `buildChecklist({ stopLossBasis: 'entry_avg_price' })`, use:

```ts
semanticDefaults: {
  inferredKeys: ['risk.stopLossBasis'],
  stopLossBasis: 'entry_avg_price',
  takeProfitBasis: null,
},
```

- [ ] **Step 4: Run classifier tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/inferred-confirmation-classifier.service.spec.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/inferred-confirmation-classifier.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/inferred-confirmation-classifier.service.spec.ts
git commit -F - <<'MSG'
refactor: classify inferred confirmation from semantic defaults

变更说明：
- 移除 inferred confirmation classifier 的 StrategyLogicSnapshot 输入
- 用 semantic defaults 表达止损/止盈 basis 推断

Refs: #850
MSG
```

## Task 4: Replace Conversation Clarification And Canonical Fallback With Semantic Artifacts

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

- [ ] **Step 1: Add semantic clarification artifact helper**

Add this private helper to `CodegenConversationService`:

```ts
  private resolveSemanticClarificationArtifacts(semanticState: SemanticState): {
    clarificationState: StrategyClarificationStateWithSummary
    normalization: NormalizationResult
    executionContext: StrategyExecutionContextResolution
    blockingReasons: StrategyBlockingReason[]
    clarificationPrompt: string | null
  } {
    const clarificationState = this.buildClarificationFromSemanticState(
      semanticState,
      {},
      { preserveLegacyFallback: false },
    )
    const normalization = this.buildNormalizationFromSemanticState(semanticState)
    const executionContext = this.executionContext.resolveFromSemanticState(semanticState)
    const blockingReasons = this.buildEffectiveBlockingReasonsFromClarificationState(clarificationState)
    const clarificationPrompt = this.buildSemanticClarificationPrompt(semanticState)
      || this.clarificationQuestion.build(clarificationState)

    return {
      clarificationState,
      normalization,
      executionContext,
      blockingReasons,
      clarificationPrompt,
    }
  }
```

- [ ] **Step 2: Make canonical generation semantic-only**

Replace `buildCanonicalSpecForConversation()` with this implementation:

```ts
  private buildCanonicalSpecForConversation(
    semanticState: SemanticState,
    normalization: NormalizationResult = this.buildNormalizationFromSemanticState(semanticState),
  ) {
    return this.canonicalSpecBuilder.buildFromNormalizedIntent(
      this.buildSemanticCanonicalContext(semanticState),
      normalization.normalizedIntent,
    )
  }
```

Delete `buildCanonicalSpecFromLegacyLogicSnapshotForNonSemanticCompatibilityOnly()`.

- [ ] **Step 3: Update `startSession()` local flow**

In `startSession()`, remove:

```ts
const checklist = this.projectLegacyLogicSnapshotFromSemanticState(initialSemanticState, {})
const clarification = this.resolveClarificationArtifacts(checklist)
const normalization = this.buildNormalizationFromSemanticState(initialSemanticState)
const initialCanonicalSpec = this.buildCanonicalSpecForConversation(
  checklist,
  normalization,
  initialSemanticState,
)
```

Replace with:

```ts
const semanticArtifacts = this.resolveSemanticClarificationArtifacts(initialSemanticState)
const normalization = semanticArtifacts.normalization
const initialCanonicalSpec = this.buildCanonicalSpecForConversation(initialSemanticState, normalization)
```

Use `semanticArtifacts.executionContext.context` when building `initialSpecDesc`. Use `semanticArtifacts.clarificationPrompt` for fallback prompt selection.

- [ ] **Step 4: Update `continueSession()` local flow**

Remove `semanticBaseLogicSnapshotAfterAnswers`, `baseLogicSnapshotAfterAnswers`, `baseLogicSnapshot`, `preMergedLogicSnapshot`, and `canonicalLogicSnapshot` from the semantic path. Use:

```ts
const baseSemanticState = semanticStateAfterAnswers
const inferredConfirmation = await this.withConfirmedInferredDecisionKeys(
  this.readConstraintPack(session.constraintPack),
  baseSemanticState,
  dto.message,
  {
    providerCode: this.resolveProviderCode(dto.providerCode),
    model: dto.model,
  },
)
const preMergedSemanticState = this.mergeSemanticPatchIntoState(
  inferredConfirmation.semanticState,
  this.extractSemanticPatchFromMessage(dto.message),
)
const plannedSemanticState = this.applyConversationPlanToSemanticState({
  currentState: preMergedSemanticState,
  plan,
})
const reducedSemanticState = plannedSemanticState
const semanticArtifacts = this.resolveSemanticClarificationArtifacts(reducedSemanticState)
const normalization = semanticArtifacts.normalization
const canonicalSpec = this.buildCanonicalSpecForConversation(reducedSemanticState, normalization)
```

Use `semanticArtifacts.clarificationState`, `semanticArtifacts.clarificationPrompt`, `semanticArtifacts.executionContext.context`, and `semanticArtifacts.blockingReasons`.

- [ ] **Step 5: Update `continueConfirmedSession()`**

Remove:

```ts
this.readStrategyLogicSnapshot(session.checklist)
this.projectLegacyLogicSnapshotFromSemanticState(
  semanticStateAfterAnswers,
  persistedLogicSnapshot,
)
this.applyClarificationAnswers(
  confirmationBaseLogicSnapshot,
  baseClarificationState,
  effectiveClarificationAnswers,
)
this.resolveClarificationArtifacts(baseLogicSnapshot)
```

Use only `session.semanticState`, semantic clarification answers, `withRequiredSemanticOpenSlots(reducedSemanticState, {})`, `resolveSemanticClarificationArtifacts(reducedSemanticState)`, and `buildCanonicalSpecForConversation(reducedSemanticState, normalization)`.

- [ ] **Step 6: Run focused conversation tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
```

Expected: PASS after updating tests to no longer call private checklist helpers.

- [ ] **Step 7: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
git commit -F - <<'MSG'
refactor: make conversation canonical flow semantic-only

变更说明：
- 移除 conversation 主链路的 StrategyLogicSnapshot canonical fallback
- 将澄清、上下文和 spec 生成切到 SemanticState 权威链路

Refs: #850
MSG
```

## Task 5: Remove Remaining Production Legacy Projection Methods

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

- [ ] **Step 1: Delete named legacy methods from conversation service**

Delete the complete private method definitions with these names from `codegen-conversation.service.ts`:

- `buildFallbackSemanticState`
- `mergeLogicSnapshotIntoSemanticState`
- `projectLegacyLogicSnapshotFromSemanticState`
- `readStrategyLogicSnapshot`
- `resolveClarificationArtifacts`
- `detectClarificationState`
- `resolveLogicSnapshotMissingFields`

Replace the existing `buildStrategyDecision` method with this semantic-input version:

```ts
  private buildStrategyDecision(input: {
    normalizedSummary: string
    blockingReasons: StrategyBlockingReason[]
    inferredAssumptions: StrategyInferredAssumption[]
    compileability: CanonicalCompileabilityReport | null
  }) {
    return this.uniquenessDecision.decide({
      normalizedSummary: input.normalizedSummary || '已识别部分条件，但仍未完整。',
      blockingReasons: input.blockingReasons,
      inferredAssumptions: input.inferredAssumptions,
      compileability: input.compileability,
    })
  }
```

Update every `buildStrategyDecision` call site to pass `normalizedSummary`, `blockingReasons`, `inferredAssumptions`, and `compileability` directly from semantic artifacts and constraint-pack data.

- [ ] **Step 2: Remove production imports that become unused**

Run:

```bash
rg -n "StrategyLogicSnapshot|StrategyRuleDraft|buildStrategyRuleDrafts|resolveStrategyDefaultTimeframe" apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts
```

Expected after cleanup: no matches in `codegen-conversation.service.ts`.

- [ ] **Step 3: Run TypeScript build**

Run:

```bash
dx build quantify --dev
```

Expected: PASS. If TypeScript reports unused imports or old private method calls, remove the import or replace the call with semantic artifacts from Task 4.

- [ ] **Step 4: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__
git commit -F - <<'MSG'
refactor: remove legacy logic projection from conversation service

变更说明：
- 删除 conversation 中剩余 StrategyLogicSnapshot 投影方法
- 收敛策略决策到语义摘要、阻塞项和编译报告

Refs: #850
MSG
```

## Task 6: Update Strategy Regression Tests And Verification Report

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts`
- Modify: `docs/testing/reports/2026-04-22-issue-850-semantic-only-checklist-deletion-verification.md`

- [ ] **Step 1: Run the full semantic strategy regression test**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts
```

Expected: PASS with these current outcomes:

```text
publishes EMA crossover
publishes Bollinger upper-short and middle-exit
publishes two-sided Bollinger
publishes only confirmed one-sided Bollinger
publishes bidirectional grid with explicit range and step
publishes percent-change entry and position-basis exit
publishes on-start market entry with stop loss
rejects MA price-vs-reference as explicit semantic compiler gap
documents fixed-range grid wording extraction gap
keeps incomplete MA semantics in semantic clarification
```

- [ ] **Step 2: Run E2E codegen coverage**

Run:

```bash
dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen
```

Expected: PASS.

- [ ] **Step 3: Append final verification report section**

Append this section to `docs/testing/reports/2026-04-22-issue-850-semantic-only-checklist-deletion-verification.md`:

```md
## Final Tail Cleanup Verification

The final cleanup removed `StrategyLogicSnapshot` as a production conversation authority. Main-path clarification, execution context, inferred confirmation, and canonical generation now use semantic state, normalized intent, canonical spec, compileability reports, and semantic clarification state.

Verified strategy outcomes after removing the last checklist fallback:

- Publishes: EMA crossover.
- Publishes: Bollinger upper-short and middle-exit.
- Publishes: two-sided Bollinger.
- Publishes: one-side confirmed Bollinger.
- Publishes: bidirectional grid with explicit range and step.
- Publishes: percent-change entry and position-basis exit.
- Publishes: on-start market entry with stop loss.
- Explicit gap remains: MA price-vs-reference rejects as semantic compiler gap.
- Explicit gap remains: fixed-range grid wording without explicit range/step is not extracted as grid semantics.
- Clarification remains semantic: incomplete MA semantics stays in semantic clarification.

Verification commands:

- `dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts`
- `dx build quantify --dev`
- `dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen`
```

- [ ] **Step 4: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts docs/testing/reports/2026-04-22-issue-850-semantic-only-checklist-deletion-verification.md
git commit -F - <<'MSG'
test: verify semantic-only tail cleanup strategies

变更说明：
- 重新验证已打通策略在移除最后 checklist fallback 后仍可用
- 记录最终语义单权威验证结果

Refs: #850
MSG
```

## Task 7: Final Build, Grep Guard, And Status Check

**Files:**
- Verify only unless a command exposes a missed cleanup.

- [ ] **Step 1: Run final build**

Run:

```bash
dx build quantify --dev
```

Expected: PASS.

- [ ] **Step 2: Run final production grep guard**

Run:

```bash
rg -n "projectLegacyLogicSnapshotFromSemanticState|buildFallbackSemanticState|buildCanonicalSpecFromLegacyLogicSnapshotForNonSemanticCompatibilityOnly|canonicalSpecBuilder\\.build\\(checklist\\)|session\\.checklist|checklist:\\s*StrategyLogicSnapshot" apps/quantify/src/modules/llm-strategy-codegen -g '!**/__tests__/**' -g '!**/*.spec.ts'
```

Expected: no output.

- [ ] **Step 3: Run final focused tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/inferred-confirmation-classifier.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-execution-context.service.spec.ts
dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen
```

Expected: all PASS.

- [ ] **Step 4: Confirm git status**

Run:

```bash
git status --short --branch
```

Expected: branch `codex/refactor/850-semantic-single-authority-tail-cleanup` with a clean working tree.

- [ ] **Step 5: Final commit if verification report changed after previous commits**

If `git status --short` shows modified verification docs or tests, commit them:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts docs/testing/reports/2026-04-22-issue-850-semantic-only-checklist-deletion-verification.md
git commit -F - <<'MSG'
test: finalize semantic single authority verification

变更说明：
- 补齐最终验证记录
- 确认主链路策略回归在语义单权威路径下通过

Refs: #850
MSG
```
