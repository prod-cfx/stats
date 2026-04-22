# AI Quant Semantic Conversation View Projection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a semantic-native conversation view and use it to remove `StrategyLogicSnapshot` projection from conversation summary, prompt, recommendation, decision, and inferred-default paths.

**Architecture:** Extend `SemanticStateProjectionService` into the semantic view boundary, then migrate `CodegenConversationService` callers one category at a time. Keep canonical generation semantic-only and defer deletion until tests prove the semantic view replaces old projection behavior.

**Tech Stack:** NestJS 11, TypeScript 5.9, Jest, Nx, existing `dx` command wrapper.

---

## File Structure

- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts`
  - Owns semantic conversation view projection from `SemanticState`.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts`
  - Unit tests for semantic view summaries, recommendation signals, deterministic semantics, and inferred defaults.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
  - Replace legacy projection consumers with semantic view consumers.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
  - Update conversation assertions away from private legacy projection helpers.
- Modify `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts`
  - Existing guard should pass after final deletion.

## Task 1: Semantic Conversation View Projection

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts`

- [ ] **Step 1: Add failing tests for the semantic conversation view**

Append tests that call `service.buildConversationView(state)` and assert representative fields:

```ts
it('builds a deterministic MA conversation view', () => {
  const view = service.buildConversationView({
    version: 1,
    families: ['single-leg'],
    triggers: [
      {
        id: 'entry-ma',
        key: 'indicator.above',
        phase: 'entry',
        params: { indicator: 'ma', 'reference.period': 50 },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      },
    ],
    actions: [{ id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' }],
    risk: [
      {
        id: 'sl',
        key: 'risk.stop_loss_pct',
        params: { valuePct: 5, basis: 'entry_avg_price', basisSource: 'system_default' },
        status: 'locked',
        source: 'derived',
        openSlots: [],
      },
    ],
    position: { mode: 'fixed_ratio', value: 0.1, positionMode: 'long_only', status: 'locked', source: 'user_explicit', openSlots: [] },
    contextSlots: {
      exchange: { slotKey: 'exchange', fieldPath: 'contextSlots.exchange', value: 'okx', status: 'locked', priority: 'context', questionHint: '', affectsExecution: true },
      symbol: { slotKey: 'symbol', fieldPath: 'contextSlots.symbol', value: 'BTCUSDT', status: 'locked', priority: 'context', questionHint: '', affectsExecution: true },
      marketType: { slotKey: 'marketType', fieldPath: 'contextSlots.marketType', value: 'spot', status: 'locked', priority: 'context', questionHint: '', affectsExecution: true },
      timeframe: { slotKey: 'timeframe', fieldPath: 'contextSlots.timeframe', value: '15m', status: 'locked', priority: 'context', questionHint: '', affectsExecution: true },
    },
    normalizationNotes: [],
    updatedAt: '2026-04-22T00:00:00.000Z',
  })

  expect(view.summary).toContain('MA50')
  expect(view.hasDeterministicSemantics).toBe(true)
  expect(view.executionContext).toEqual({ exchange: 'okx', symbol: 'BTCUSDT', marketType: 'spot', timeframe: '15m' })
  expect(view.recommendationSignals.hasLongIntent).toBe(true)
  expect(view.inferredDefaults).toEqual({
    inferredKeys: ['risk.stopLossBasis'],
    stopLossBasis: 'entry_avg_price',
    takeProfitBasis: null,
  })
})
```

Add one grid/Bollinger/percent-change test each with concise assertions:

```ts
expect(view.recommendationSignals.hasGridIntent).toBe(true)
expect(view.recommendationSignals.hasShortIntent).toBe(true)
expect(view.summary).toContain('价格相对前收盘')
```

- [ ] **Step 2: Run projection tests and verify failure**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts
```

Expected: FAIL because `buildConversationView` does not exist.

- [ ] **Step 3: Implement `buildConversationView`**

Add exported interfaces and implementation in `semantic-state-projection.service.ts`:

```ts
export interface SemanticConversationView {
  summary: string
  triggerSummary: string
  riskSummary: string
  positionSummary: string
  executionContext: { exchange: string | null, symbol: string | null, marketType: string | null, timeframe: string | null }
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

`buildConversationView(state)` should:

- reuse current trigger summary behavior
- read locked context slots only
- treat non-superseded triggers/actions/risk as deterministic signal
- derive long/short/grid signals from action keys, trigger side scopes, and grid triggers
- derive inferred defaults from semantic risk atoms whose `params.basisSource === 'system_default'`

- [ ] **Step 4: Run projection tests and commit**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts
```

Expected: PASS.

Commit:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts
git commit -F - <<'MSG'
feat: add semantic conversation view projection

变更说明：
- 增加 SemanticState 到会话视图的语义投影
- 覆盖 summary、推荐信号、执行上下文和 inferred defaults

Refs: #850
MSG
```

## Task 2: Semantic Prompt And Summary Helpers

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

- [ ] **Step 1: Add semantic helper methods**

In `CodegenConversationService`, add helpers that use `this.semanticStateProjection.buildConversationView(semanticState)`:

```ts
private buildSemanticClarificationSummary(semanticState: SemanticState): string {
  return this.semanticStateProjection.buildConversationView(semanticState).summary
}

private buildSemanticLogicGateAssistantPrompt(semanticState: SemanticState, normalizedIntent: StrategyNormalizedIntent): string {
  const summary = this.buildSemanticClarificationSummary(semanticState)
  return `我整理出的策略逻辑如下：${summary}。请确认是否按这个逻辑生成脚本。`
}

private buildSemanticNormalizationAssistantPrompt(semanticState: SemanticState, normalization: NormalizationResult): string {
  const summary = this.buildSemanticClarificationSummary(semanticState)
  const blocker = normalization.blockerReason ? `当前还缺少：${normalization.blockerReason}` : '当前语义仍未完整。'
  return `我当前理解的策略是：${summary}\n${blocker}`
}
```

Keep wording aligned with existing tests as much as practical; adjust only assertions that depended on legacy `entryRules/exitRules`.

- [ ] **Step 2: Replace prompt call sites**

Replace in `startSession`, `continueSession`, and `continueConfirmedSession`:

- `buildLogicGateAssistantPrompt(checklist, normalization.normalizedIntent)` with semantic helper
- `buildNormalizationAssistantPrompt(checklist, normalization)` with semantic helper

- [ ] **Step 3: Run conversation tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
```

Expected: PASS after assertion updates.

- [ ] **Step 4: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
git commit -F - <<'MSG'
refactor: build conversation prompts from semantic view

变更说明：
- 将确认与 normalization 提示切到 SemanticState 会话视图
- 移除提示词对 legacy rule snapshot 的依赖

Refs: #850
MSG
```

## Task 3: Semantic Recommendation And Deterministic Authority

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

- [ ] **Step 1: Replace recommendation style input**

Add a semantic-native helper:

```ts
private inferRecommendationStyleFromSemanticContext(
  message: string | undefined,
  semanticState: SemanticState,
  currentStyle: RecommendationStyle | undefined,
): RecommendationStyle | undefined {
  const view = this.semanticStateProjection.buildConversationView(semanticState)
  const text = `${message ?? ''} ${view.summary}`.trim()
  if (/均线|金叉|死叉|\bma\b|moving average/i.test(text)) {
    return 'ma'
  }
  if (
    view.recommendationSignals.hasGridIntent
    || view.summary.includes('价格相对')
    || /下跌|上涨|回撤|[跌涨天%]|分钟|小时|\d+\s*[mhd]/i.test(text)
  ) {
    return 'drop-rise'
  }
  return currentStyle
}
```

`RecommendationStyle` currently supports only `'ma' | 'drop-rise'`; do not introduce new literals such as `'grid'`, `'short'`, or `'long_short'`.

- [ ] **Step 2: Replace deterministic authority input**

Change `resolveContinueSessionDeterministicAuthority` to remove `checklist` from input. Change `hasDeterministicStrategySemantics` to use `SemanticState` / `SemanticConversationView` only.

- [ ] **Step 3: Run conversation tests and commit**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
```

Expected: PASS.

Commit:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
git commit -F - <<'MSG'
refactor: derive conversation decisions from semantic view

变更说明：
- 将推荐风格和 deterministic authority 切到 semantic view
- 移除决策层对 legacy rule snapshot 的依赖

Refs: #850
MSG
```

## Task 4: Semantic Inferred Defaults And Projection Deletion

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts`

- [ ] **Step 1: Replace inferred default bridge**

Replace `buildInferredConfirmationSemanticDefaults(...)` so it accepts `SemanticState` and uses `SemanticConversationView.inferredDefaults`.

- [ ] **Step 2: Delete production projection methods**

Delete from `codegen-conversation.service.ts` after all call sites are gone:

- `projectLegacyLogicSnapshotFromSemanticState`
- `buildFallbackSemanticState`
- `mergeLogicSnapshotIntoSemanticState`
- dependent merge/project helper methods that are no longer referenced

Tests that still need legacy comparison must define explicit test-local helpers, not call private production projection.

- [ ] **Step 3: Run guard and focused tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts -t "legacy checklist authority"
dx build quantify --dev
```

Expected: all PASS; guard has no production legacy authority match.

- [ ] **Step 4: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts
git commit -F - <<'MSG'
refactor: remove semantic to legacy conversation projection

变更说明：
- 删除 production semantic-to-legacy projection 入口
- 用 semantic view 提供 inferred defaults 与测试 guard

Refs: #850
MSG
```

## Task 5: Full Strategy Regression And Report

**Files:**
- Modify: `docs/testing/reports/2026-04-22-issue-850-semantic-only-checklist-deletion-verification.md`

- [ ] **Step 1: Run full verification**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
dx build quantify --dev
dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen
```

Expected: all PASS except documented semantic gaps remain as asserted in tests.

- [ ] **Step 2: Append verification report**

Append a section recording:

```md
## Semantic Conversation View Projection Verification

- Conversation summaries, prompts, recommendation style, deterministic authority, and inferred defaults now use semantic view data instead of `StrategyLogicSnapshot`.
- Production guard for legacy conversation authority passes.
- Revalidated strategy families:
  - EMA crossover: publishes.
  - Bollinger upper/middle: publishes.
  - Two-sided Bollinger: publishes.
  - One-sided confirmed Bollinger: publishes only confirmed side.
  - Explicit grid range/step: publishes.
  - Percent-change entry/exit: publishes.
  - On-start entry with stop loss: publishes.
  - MA price-vs-reference: remains explicit semantic compiler gap.
  - Fixed-range grid wording without explicit range/step: remains extraction gap.
  - Incomplete MA semantics: remains semantic clarification.
```

- [ ] **Step 3: Commit**

```bash
git add docs/testing/reports/2026-04-22-issue-850-semantic-only-checklist-deletion-verification.md
git commit -F - <<'MSG'
test: document semantic conversation view verification

变更说明：
- 记录 semantic view projection 后的策略回归结果
- 确认 legacy authority guard 通过

Refs: #850
MSG
```
