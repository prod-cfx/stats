# AI Quant Semantic-Only Checklist Deletion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove checklist as a production semantic source while preserving the existing AI Quant atomic semantic data flow.

**Architecture:** Treat `SemanticState`, `CodegenSemanticPatch`, and `CanonicalSpecV2` as the stable main path. Delete checklist types, planner `logic`, publication checklist input, and engine/test checklist DTOs. Any behavior previously preserved through checklist fallback must be restored through semantic-native extraction or wiring without changing atom keys, reducer semantics, canonical compiler semantics, digest semantics, or publication persistence.

**Tech Stack:** NestJS 11, TypeScript 5.9, Prisma, Jest, Nx/dx, AI Quant `apps/quantify/src/modules/llm-strategy-codegen`.

---

## Scope Guard

This plan implements Issue #850 and spec `docs/superpowers/specs/2026-04-21-ai-quant-semantic-only-checklist-deletion-design.md`.

Do not change:

- existing atom keys
- `SemanticState` meaning
- reducer merge semantics except where checklist fallback is removed
- canonical compiler output for existing semantic states
- digest generation semantics
- publication persistence semantics

If a regression appears, fix the missing semantic-native input or wiring. Do not restore checklist fallback.

## File Map

- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`
  - Deterministic message-to-`CodegenSemanticPatch` extraction for the strategy families currently covered by checklist inference.
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts`
  - Golden tests for MA/EMA, Bollinger, Grid, percent-change, on-start, risk, position, and context extraction.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation-start-session.helper.ts`
  - Remove `ConversationPlan.logic`.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
  - Remove checklist inference/projection/merge helpers and route start/continue through semantic patch/state only.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts`
  - Remove checklist input branch. Derive publish and locked params from semantic state/canonical spec.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-session-publication-pipeline.service.ts`
  - Remove checklist argument from pipeline input.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/dto/test-llm-codegen-engine.dto.ts`
  - Replace checklist fields with `semanticState` or `canonicalSpec`.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/spec-desc-builder.service.ts`
  - Remove `build(checklist, ...)` legacy entry point.
- Delete: `apps/quantify/src/modules/llm-strategy-codegen/types/checklist-compat.ts`
- Delete: `apps/quantify/src/modules/llm-strategy-codegen/services/checklist-compat.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/constants/constraint-pack.ts`
  - Remove `REQUIRED_CHECKLIST_FIELDS` and `ChecklistField`.
- Modify tests under `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/`
  - Replace checklist fixtures with semantic-state fixtures.
- Modify E2E: `apps/quantify/e2e/llm-strategy-codegen/llm-strategy-codegen.e2e-spec.ts`
  - Update engine/test request bodies to semantic-only.
- Modify frontend naming only where production names still say checklist:
  - `apps/front/src/app/[lng]/ai-quant/ai-quant-page-codegen.ts`

## Task 1: Add Semantic Seed Extractor Tests

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts`
- Create in Task 2: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`

- [ ] **Step 1: Write the failing test file**

Create `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts` with:

```ts
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'

describe('SemanticSeedExtractorService', () => {
  const service = new SemanticSeedExtractorService()

  it('extracts MA price-vs-reference semantics without checklist', () => {
    const patch = service.extract('OKX 现货 BTCUSDT 15m；15m 收盘确认当价格突破 MA50 时买入；15m 收盘确认当价格跌破 MA10 时卖出；亏损 5% 止损，盈利 10% 止盈；单笔 10%。')

    expect(patch.contextSlots).toEqual(expect.objectContaining({
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'spot',
      timeframe: '15m',
    }))
    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'indicator.above',
        phase: 'entry',
        params: expect.objectContaining({ indicator: 'ma', period: 50, confirmationMode: 'close_confirm' }),
      }),
      expect.objectContaining({
        key: 'indicator.below',
        phase: 'exit',
        params: expect.objectContaining({ indicator: 'ma', period: 10, confirmationMode: 'close_confirm' }),
      }),
    ]))
    expect(patch.position).toEqual(expect.objectContaining({ mode: 'fixed_ratio', value: 10 }))
    expect(patch.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'risk.stop_loss_pct', params: expect.objectContaining({ value: 5 }) }),
      expect.objectContaining({ key: 'risk.take_profit_pct', params: expect.objectContaining({ value: 10 }) }),
    ]))
  })

  it('extracts Bollinger dual-side semantics without changing atom names', () => {
    const patch = service.extract('OKX 合约 BTCUSDT 15m；K线收盘后确认突破布林带(20,2)上轨时做空，突破下轨时做多；价格回到布林带中轨时平仓；单笔 10%，亏损 5% 止损。')

    expect(patch.contextSlots).toEqual(expect.objectContaining({
      exchange: 'okx',
      symbol: 'BTCUSDT',
      marketType: 'perp',
      timeframe: '15m',
    }))
    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'bollinger.touch_upper', phase: 'entry', sideScope: 'short' }),
      expect.objectContaining({ key: 'bollinger.touch_lower', phase: 'entry', sideScope: 'long' }),
      expect.objectContaining({ key: 'bollinger.touch_middle', phase: 'exit' }),
    ]))
    expect(patch.position).toEqual(expect.objectContaining({ positionMode: 'long_short', value: 10 }))
  })

  it('extracts fixed-range grid semantics', () => {
    const patch = service.extract('OKX 合约 BTCUSDT 15m；在 60000-80000 区间执行双向网格，步长 0.5%，单笔 10%。')

    expect(patch.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'grid.range_rebalance',
        phase: 'entry',
        sideScope: 'both',
        params: expect.objectContaining({
          rangeLower: 60000,
          rangeUpper: 80000,
          stepPct: 0.5,
          sideMode: 'bidirectional',
        }),
      }),
    ]))
  })

  it('extracts percent-change and on-start semantics', () => {
    const percent = service.extract('BTCUSDT 3m 当前K线收盘价相对上一根K线收盘价下跌 1% 时买入；15m 相对开仓均价上涨 2% 时卖出；5% 止损；10% 仓位。')
    expect(percent.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'price.change_pct', phase: 'entry' }),
      expect.objectContaining({ key: 'position.pnl_pct', phase: 'exit' }),
    ]))

    const onStart = service.extract('立即开始时市价买入一次；1h；BTCUSDT；单笔 10%；亏损 5% 止损。')
    expect(onStart.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'execution.on_start', phase: 'entry' }),
    ]))
    expect(onStart.contextSlots).toEqual(expect.objectContaining({ symbol: 'BTCUSDT', timeframe: '1h' }))
  })
})
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
npx nx test quantify --runTestsByPath apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts --runInBand
```

Expected: FAIL because `semantic-seed-extractor.service.ts` does not exist.

## Task 2: Implement Semantic Seed Extractor

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts`

- [ ] **Step 1: Create the service**

Add `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`:

```ts
import type { CodegenSemanticPatch } from '../types/codegen-semantic-patch'

function normalizeSymbol(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/gu, '')
}

function parseNumber(raw: string | undefined): number | undefined {
  if (!raw) return undefined
  const value = Number(raw.replace(/,/gu, ''))
  return Number.isFinite(value) ? value : undefined
}

export class SemanticSeedExtractorService {
  extract(message?: string): CodegenSemanticPatch {
    const text = message?.trim() ?? ''
    const contextSlots: Record<string, string> = {}
    const triggers: NonNullable<CodegenSemanticPatch['triggers']> = []
    const actions: NonNullable<CodegenSemanticPatch['actions']> = []
    const risk: NonNullable<CodegenSemanticPatch['risk']> = []

    const symbolMatch = text.toUpperCase().match(/\b([A-Z]{2,12}\/?(?:USDT|USDC|USD))\b/u)
    if (symbolMatch?.[1]) contextSlots.symbol = normalizeSymbol(symbolMatch[1])
    if (/OKX/i.test(text)) contextSlots.exchange = 'okx'
    else if (/BINANCE|币安/i.test(text)) contextSlots.exchange = 'binance'
    else if (/HYPERLIQUID/i.test(text)) contextSlots.exchange = 'hyperliquid'
    if (/合约|永续|perp|swap/i.test(text)) contextSlots.marketType = 'perp'
    else if (/现货|spot/i.test(text)) contextSlots.marketType = 'spot'
    const timeframeMatch = text.match(/\b(\d+)\s*(m|h|d)\b/iu)
    if (timeframeMatch?.[1] && timeframeMatch[2]) {
      contextSlots.timeframe = `${timeframeMatch[1]}${timeframeMatch[2].toLowerCase()}`
    }

    this.extractMa(text, triggers, actions)
    this.extractBollinger(text, triggers, actions)
    this.extractGrid(text, triggers)
    this.extractPercentChange(text, triggers, actions)
    this.extractOnStart(text, triggers, actions)
    this.extractRisk(text, risk)

    const positionPct = this.extractPositionPct(text)
    const positionMode = triggers.some(trigger => trigger.sideScope === 'short') && triggers.some(trigger => trigger.sideScope === 'long')
      ? 'long_short'
      : triggers.some(trigger => trigger.sideScope === 'short')
        ? 'short_only'
        : 'long_only'

    return {
      ...(Object.keys(contextSlots).length > 0 ? { contextSlots } : {}),
      ...(triggers.length > 0 ? { triggers } : {}),
      ...(actions.length > 0 ? { actions } : {}),
      ...(risk.length > 0 ? { risk } : {}),
      ...(positionPct ? { position: { mode: 'fixed_ratio', value: positionPct, positionMode } } : {}),
    }
  }

  private extractMa(
    text: string,
    triggers: NonNullable<CodegenSemanticPatch['triggers']>,
    actions: NonNullable<CodegenSemanticPatch['actions']>,
  ): void {
    const entry = text.match(/突破\s*(?:MA|EMA)\s*(\d+)/iu)
    if (entry?.[1] && /买入|做多|开多/u.test(text)) {
      triggers.push({
        key: 'indicator.above',
        phase: 'entry',
        sideScope: 'long',
        params: { indicator: 'ma', period: Number(entry[1]), confirmationMode: /收盘|K线收盘/u.test(text) ? 'close_confirm' : 'touch' },
      })
      actions.push({ key: 'position.open_long' })
    }
    const exit = text.match(/跌破\s*(?:MA|EMA)\s*(\d+)/iu)
    if (exit?.[1] && /卖出|平多|平仓/u.test(text)) {
      triggers.push({
        key: 'indicator.below',
        phase: 'exit',
        sideScope: 'long',
        params: { indicator: 'ma', period: Number(exit[1]), confirmationMode: /收盘|K线收盘/u.test(text) ? 'close_confirm' : 'touch' },
      })
      actions.push({ key: 'position.close_long' })
    }
  }

  private extractBollinger(
    text: string,
    triggers: NonNullable<CodegenSemanticPatch['triggers']>,
    actions: NonNullable<CodegenSemanticPatch['actions']>,
  ): void {
    if (!/布林/u.test(text)) return
    const paramsMatch = text.match(/布林带\s*\(?\s*(\d+)?\s*[,，]?\s*([\d.]+)?\s*\)?/u)
    const period = parseNumber(paramsMatch?.[1]) ?? 20
    const stdDev = parseNumber(paramsMatch?.[2]) ?? 2
    const confirmationMode = /收盘|K线收盘/u.test(text) ? 'close_confirm' : 'touch'
    if (/上轨/u.test(text) && /做空|开空|空/u.test(text)) {
      triggers.push({ key: 'bollinger.touch_upper', phase: 'entry', sideScope: 'short', params: { indicator: 'bollinger', period, stdDev, confirmationMode } })
      actions.push({ key: 'position.open_short' })
    }
    if (/下轨/u.test(text) && /做多|买入|多/u.test(text)) {
      triggers.push({ key: 'bollinger.touch_lower', phase: 'entry', sideScope: 'long', params: { indicator: 'bollinger', period, stdDev, confirmationMode } })
      actions.push({ key: 'position.open_long' })
    }
    if (/中轨/u.test(text) && /平仓|平空|平多|卖出/u.test(text)) {
      triggers.push({ key: 'bollinger.touch_middle', phase: 'exit', sideScope: 'both', params: { indicator: 'bollinger', period, stdDev, confirmationMode } })
      actions.push({ key: 'position.close' })
    }
  }

  private extractGrid(text: string, triggers: NonNullable<CodegenSemanticPatch['triggers']>): void {
    if (!/网格/u.test(text)) return
    const range = text.match(/(\d+(?:\.\d+)?)\s*[-到至]\s*(\d+(?:\.\d+)?)/u)
    const step = text.match(/步长\s*(\d+(?:\.\d+)?)\s*%/u)
    const sideMode = /双向/u.test(text) ? 'bidirectional' : /只做空|空头/u.test(text) ? 'short_only' : /只做多|多头/u.test(text) ? 'long_only' : undefined
    triggers.push({
      key: 'grid.range_rebalance',
      phase: 'entry',
      sideScope: sideMode === 'short_only' ? 'short' : sideMode === 'long_only' ? 'long' : 'both',
      params: {
        ...(range?.[1] ? { rangeLower: Number(range[1]) } : {}),
        ...(range?.[2] ? { rangeUpper: Number(range[2]) } : {}),
        ...(step?.[1] ? { stepPct: Number(step[1]) } : {}),
        ...(sideMode ? { sideMode } : {}),
      },
    })
  }

  private extractPercentChange(
    text: string,
    triggers: NonNullable<CodegenSemanticPatch['triggers']>,
    actions: NonNullable<CodegenSemanticPatch['actions']>,
  ): void {
    const down = text.match(/下跌\s*(\d+(?:\.\d+)?)\s*%/u)
    if (down?.[1] && /买入|做多/u.test(text)) {
      triggers.push({ key: 'price.change_pct', phase: 'entry', sideScope: 'long', params: { direction: 'down', value: Number(down[1]) } })
      actions.push({ key: 'position.open_long' })
    }
    const up = text.match(/上涨\s*(\d+(?:\.\d+)?)\s*%/u)
    if (up?.[1] && /卖出|平仓|平多/u.test(text)) {
      triggers.push({ key: 'position.pnl_pct', phase: 'exit', sideScope: 'long', params: { direction: 'up', value: Number(up[1]) } })
      actions.push({ key: 'position.close_long' })
    }
  }

  private extractOnStart(
    text: string,
    triggers: NonNullable<CodegenSemanticPatch['triggers']>,
    actions: NonNullable<CodegenSemanticPatch['actions']>,
  ): void {
    if (!/立即开始|启动时|开始时/u.test(text)) return
    triggers.push({ key: 'execution.on_start', phase: 'entry', sideScope: 'long', params: {} })
    actions.push({ key: 'position.open_long' })
  }

  private extractRisk(text: string, risk: NonNullable<CodegenSemanticPatch['risk']>): void {
    const stopLoss = text.match(/(?:亏损|止损)\s*(\d+(?:\.\d+)?)\s*%/u)
    if (stopLoss?.[1]) risk.push({ key: 'risk.stop_loss_pct', params: { value: Number(stopLoss[1]) } })
    const takeProfit = text.match(/(?:盈利|止盈)\s*(\d+(?:\.\d+)?)\s*%/u)
    if (takeProfit?.[1]) risk.push({ key: 'risk.take_profit_pct', params: { value: Number(takeProfit[1]) } })
  }

  private extractPositionPct(text: string): number | undefined {
    const match = text.match(/(?:单笔|仓位|资金)\s*(?:为|最大|)\s*(\d+(?:\.\d+)?)\s*%/u)
    return parseNumber(match?.[1])
  }
}
```

- [ ] **Step 2: Run the semantic seed tests**

Run:

```bash
npx nx test quantify --runTestsByPath apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts --runInBand
```

Expected: PASS. If an atom key does not match existing reducer/compiler expectations, update the extractor to use the existing key; do not rename existing atoms.

- [ ] **Step 3: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts
git commit -m "feat: add semantic seed extraction for codegen" -m "Refs: #850"
```

## Task 3: Remove Planner `logic` and Checklist Compatibility Input

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation-start-session.helper.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Modify tests: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

- [ ] **Step 1: Update `ConversationPlan` type**

In `codegen-conversation-start-session.helper.ts`, change:

```ts
export interface ConversationPlan {
  related: boolean
  logicReady: boolean
  assistantPrompt: string
  semanticPatch?: CodegenSemanticPatch
}
```

Remove the `ChecklistPayload` import.

- [ ] **Step 2: Add failing tests that legacy planner `logic` is ignored**

In `codegen-conversation.service.spec.ts`, add a test near planner schema tests:

```ts
it('ignores legacy planner logic and only applies semanticPatch', async () => {
  mockAiService.chat.mockResolvedValueOnce({
    content: JSON.stringify({
      related: true,
      logicReady: true,
      assistantPrompt: '我已整理出策略逻辑，请确认逻辑图。',
      logic: {
        entryRules: ['价格突破 MA50 买入'],
        exitRules: ['价格跌破 MA10 卖出'],
        riskRules: { positionPct: 10 },
      },
    }),
  })

  await service.startSession({
    userId: 'u-legacy-logic',
    initialMessage: 'legacy logic only',
  })

  const createPayload = mockRepo.createSession.mock.calls.at(-1)?.[0] as Record<string, any>
  expect(createPayload.semanticState.triggers).toEqual([])
  expect(createPayload.semanticState.actions).toEqual([])
})
```

Expected before implementation: FAIL because `logic` is still consumed.

- [ ] **Step 3: Remove `compatibilityChecklist` from planner call**

In `CodegenConversationService.planConversationByLlm`, change the signature to:

```ts
private async planConversationByLlm(
  message: string,
  currentSemanticState: SemanticState,
  options?: { providerCode?: string, model?: string },
  history: string[] = [],
): Promise<ConversationPlan>
```

In the LLM user payload, remove `compatibilityChecklist`. Remove parsing and merging of `parsed.logic`. The returned plan should be:

```ts
return {
  related,
  logicReady,
  assistantPrompt,
  ...(semanticPatch ? { semanticPatch } : {}),
} satisfies ConversationPlan
```

In fallback branches, return no `logic`; use `this.semanticSeedExtractor.extract(text)` only if it returns non-empty semantic fields.

- [ ] **Step 4: Inject and use semantic seed extraction**

Add a private default instance in `CodegenConversationService` constructor field list:

```ts
private readonly semanticSeedExtractor: SemanticSeedExtractorService = new SemanticSeedExtractorService(),
```

Add import:

```ts
import { SemanticSeedExtractorService } from './semantic-seed-extractor.service'
```

Create a helper:

```ts
private extractSemanticPatchFromMessage(message?: string): CodegenSemanticPatch | undefined {
  const patch = this.semanticSeedExtractor.extract(message)
  return patch.contextSlots || patch.triggers || patch.actions || patch.risk || patch.position
    ? patch
    : undefined
}
```

Use this helper in planner fallback branches instead of `inferChecklistFromMessage`.

- [ ] **Step 5: Simplify `applyConversationPlanToSemanticState`**

Change the input type to:

```ts
private applyConversationPlanToSemanticState(input: {
  currentState: SemanticState
  plan: ConversationPlan
}): SemanticState
```

Remove all `compatibilityChecklist`, `plan.logic`, `buildFallbackSemanticState`, and `requiredSlotChecklist` logic. Keep:

```ts
let nextState = input.currentState
const semanticPatchState = this.buildSemanticStateFromPlannerPatch(input.plan.semanticPatch)
if (semanticPatchState) {
  nextState = this.semanticStateMerge.merge({
    persisted: nextState,
    derived: semanticPatchState,
  })
}
return this.withRequiredSemanticOpenSlots(nextState, {}, {
  preserveLockedPositionSizing: Boolean(
    this.hasValidLockedPositionSizing(semanticPatchState?.position)
    || this.hasValidLockedPositionSizing(input.currentState.position),
  ),
})
```

If `withRequiredSemanticOpenSlots` still requires a checklist argument, change it in this step to read only semantic state and remove the checklist parameter before continuing.

- [ ] **Step 6: Update call sites**

Replace calls like:

```ts
this.planConversationByLlm(message, state, options, history, checklist)
this.applyConversationPlanToSemanticState({ currentState, compatibilityChecklist, plan })
```

with:

```ts
this.planConversationByLlm(message, state, options, history)
this.applyConversationPlanToSemanticState({ currentState, plan })
```

- [ ] **Step 7: Run focused conversation tests**

Run:

```bash
npx nx test quantify --runTestsByPath apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts --runInBand
```

Expected: many checklist-specific tests may fail. Update tests by replacing checklist fixtures with semantic-state fixtures only where the test still describes a valid semantic behavior. Delete tests whose only purpose is checklist projection.

- [ ] **Step 8: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation-start-session.helper.ts apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
git commit -m "refactor: remove checklist planner fallback" -m "Refs: #850"
```

## Task 4: Remove Checklist Canonical Spec Fallback

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Modify tests: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`

- [ ] **Step 1: Add failing assertion for semantic-only canonical build**

Add or update a test to spy on `canonicalSpecBuilder.build` during confirm generation from persisted semantic state:

```ts
const checklistBuildSpy = jest.spyOn(canonicalSpecBuilder, 'build')
await service.continueSession('s-semantic-confirm', {
  message: '确认生成',
  confirmGenerate: true,
  confirmedCanonicalDigest,
}, 'u-1')
expect(checklistBuildSpy).not.toHaveBeenCalled()
```

Expected before implementation: FAIL if checklist fallback still builds `checklistSpec`.

- [ ] **Step 2: Change canonical spec helper signature**

Replace:

```ts
private buildCanonicalSpecForConversation(
  checklist: ChecklistPayload,
  normalization: NormalizationResult,
  semanticState?: SemanticState,
)
```

with:

```ts
private buildCanonicalSpecForConversation(
  normalization: NormalizationResult,
  semanticState: SemanticState,
)
```

Implementation:

```ts
return this.canonicalSpecBuilder.buildFromNormalizedIntent(
  this.buildSemanticCanonicalContext(semanticState),
  normalization.normalizedIntent,
)
```

Do not add fallback to `canonicalSpecBuilder.build(...)`.

- [ ] **Step 3: Update call sites**

For every call, compute:

```ts
const normalization = this.buildNormalizationFromSemanticState(reducedSemanticState)
const canonicalSpec = this.buildCanonicalSpecForConversation(normalization, reducedSemanticState)
```

If a call has no semantic state, first create or read semantic state. Do not create a checklist.

- [ ] **Step 4: Run canonical and conversation tests**

Run:

```bash
npx nx test quantify --runTestsByPath apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/canonical-spec-builder.service.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts --runInBand
```

Expected: PASS after test updates. Golden semantic-state canonical structures should remain stable.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts
git commit -m "refactor: remove checklist canonical fallback" -m "Refs: #850"
```

## Task 5: Make Publication Pipeline Semantic-Only

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-session-publication-pipeline.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts`
- Modify tests: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-publication-generation.stage.spec.ts`

- [ ] **Step 1: Update publication generation input**

In `CodegenPublicationGenerationInput`, remove `checklist` and make `semanticState` required:

```ts
export interface CodegenPublicationGenerationInput {
  semanticState: SemanticState
  message: string
  canonicalSpecOverride?: CanonicalStrategySpecV2
}
```

- [ ] **Step 2: Delete checklist branches in generation stage**

In `generate(input)`, replace all ternaries with semantic-only logic:

```ts
const normalization = this.buildNormalizationFromSemanticState(input.semanticState)
const canonicalSpec = input.canonicalSpecOverride
  ?? this.canonicalSpecBuilder.buildFromNormalizedIntent(
    this.buildSemanticCanonicalContext(input.semanticState),
    normalization.normalizedIntent,
  )
const userIntentSummary = this.strategySummaryBuilder.buildStrategySummary(canonicalSpec)
const lockedParams = this.buildSemanticLockedParams({
  semanticState: input.semanticState,
  canonicalSpec,
  normalizedIntent: normalization.normalizedIntent,
})
const publishParams = this.buildSemanticPublishParams({
  canonicalSpec,
  semanticState: input.semanticState,
})
```

Delete `buildChecklistPublishParams`, `buildChecklistLockedParams`, and `inferPublishedMarketType`.

- [ ] **Step 3: Update pipeline input**

In `CodegenSessionPublicationPipelineService.run`, remove `checklist` from args and generation input:

```ts
async run(args: {
  sessionId: string
  userId: string
  semanticState: SemanticState
  canonicalSpecOverride?: CanonicalStrategySpecV2
  message: string
  model?: string
  existingStrategyInstanceId?: string | null
}): Promise<void>
```

- [ ] **Step 4: Update conversation call site**

In `continueConfirmedSession`, call:

```ts
void this.publicationPipeline.run({
  sessionId: session.id,
  userId: sessionUserId,
  semanticState: reducedSemanticState,
  canonicalSpecOverride: canonicalSpec,
  message: dto.message,
  model: dto.model,
  existingStrategyInstanceId: session.strategyInstanceId ?? null,
})
```

- [ ] **Step 5: Update publication tests**

In `codegen-publication-generation.stage.spec.ts`, remove tests that cover checklist fallback payloads. Keep and strengthen semantic-state cases:

```ts
expect(buildFromNormalizedIntentSpy).toHaveBeenCalledWith(
  expect.objectContaining({ symbol: 'BTCUSDT' }),
  expectedNormalizedIntent,
)
```

Add:

```ts
expect(JSON.stringify(artifacts.sessionSpecDesc)).not.toContain('checklist')
```

- [ ] **Step 6: Run publication tests**

Run:

```bash
npx nx test quantify --runTestsByPath apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-publication-generation.stage.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-session-publication-pipeline.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/codegen-session-publication-pipeline.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-publication-generation.stage.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-session-publication-pipeline.spec.ts
git commit -m "refactor: make codegen publication semantic-only" -m "Refs: #850"
```

## Task 6: Make Engine Test DTO Semantic-Only

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/dto/test-llm-codegen-engine.dto.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts`
- Modify: `apps/quantify/e2e/llm-strategy-codegen/llm-strategy-codegen.e2e-spec.ts`

- [ ] **Step 1: Replace DTO fields**

In `test-llm-codegen-engine.dto.ts`, remove `symbols`, `timeframes`, `entryRules`, `exitRules`, and `riskRules`. Add:

```ts
@ApiPropertyOptional({ description: 'Semantic state input', type: 'object', additionalProperties: true })
@IsOptional()
@IsObject()
semanticState?: Record<string, unknown>

@ApiPropertyOptional({ description: 'Canonical strategy spec v2 input', type: 'object', additionalProperties: true })
@IsOptional()
@IsObject()
canonicalSpec?: Record<string, unknown>
```

- [ ] **Step 2: Update service testEngine**

In `testEngine(dto)`, replace `extractChecklist(dto)` with:

```ts
const semanticState = this.readSemanticState(dto.semanticState as Prisma.JsonValue | null | undefined)
const normalization = this.buildNormalizationFromSemanticState(semanticState)
const canonicalSpec = dto.canonicalSpec && typeof dto.canonicalSpec === 'object'
  ? dto.canonicalSpec as ReturnType<CodegenConversationService['buildCanonicalSpecForConversation']>
  : this.buildCanonicalSpecForConversation(normalization, semanticState)
```

If neither `semanticState` nor `canonicalSpec` is present, throw `codegen.missing_required_fields` with `{ missingFields: ['semanticState'] }`.

- [ ] **Step 3: Update E2E**

In `llm-strategy-codegen.e2e-spec.ts`, change the old missing checklist test name to:

```ts
it('rejects engine test when semantic input is missing', async () => {
  const response = await request(app.getHttpServer())
    .post('/api/v1/live-llm-strategy-codegen/engine/test')
    .set('x-engine-test-token', appSecret)
    .send({ userId: 'u-1', message: 'test' })
    .expect(400)

  expect(response.body.args.missingFields).toEqual(['semanticState'])
})
```

For successful engine tests, pass a locked semantic state fixture instead of checklist fields.

- [ ] **Step 4: Run E2E file**

Run:

```bash
dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen
```

Expected: PASS in a configured E2E environment. If local DB/env is unavailable, record the exact failure and run unit coverage for DTO/service instead.

- [ ] **Step 5: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/dto/test-llm-codegen-engine.dto.ts apps/quantify/src/modules/llm-strategy-codegen/services/codegen-conversation.service.ts apps/quantify/e2e/llm-strategy-codegen/llm-strategy-codegen.e2e-spec.ts
git commit -m "refactor: make engine test semantic-only" -m "Refs: #850"
```

## Task 7: Delete Checklist Types, Helpers, and Dead Names

**Files:**
- Delete: `apps/quantify/src/modules/llm-strategy-codegen/types/checklist-compat.ts`
- Delete: `apps/quantify/src/modules/llm-strategy-codegen/services/checklist-compat.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/constants/constraint-pack.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/spec-desc-builder.service.ts`
- Modify: `apps/front/src/app/[lng]/ai-quant/ai-quant-page-codegen.ts`

- [ ] **Step 1: Remove unused constraint constants**

Delete:

```ts
export const REQUIRED_CHECKLIST_FIELDS = [
  'entryRules',
  'exitRules',
] as const

export type ChecklistField = typeof REQUIRED_CHECKLIST_FIELDS[number]
```

- [ ] **Step 2: Remove `SpecDescBuilderService.build(checklist, ...)`**

Delete the `SpecDescChecklistSnapshot` interface and the `build()` method from `spec-desc-builder.service.ts`. Keep `buildFromCanonicalSpec()`.

- [ ] **Step 3: Delete checklist files**

Run:

```bash
rm apps/quantify/src/modules/llm-strategy-codegen/types/checklist-compat.ts
rm apps/quantify/src/modules/llm-strategy-codegen/services/checklist-compat.ts
```

- [ ] **Step 4: Rename frontend message variables**

In `ai-quant-page-codegen.ts`, rename:

```ts
checklistContinuedMessage -> logicContinuedMessage
checklistUpdatedMessage -> logicUpdatedMessage
```

Do not change user-facing translated strings in this task unless tests require the key names to change.

- [ ] **Step 5: Run grep checks**

Run:

```bash
rg -n "ChecklistPayload|ChecklistRuleDraft|ChecklistRuleBasis|checklist-compat|ConversationPlan.*logic|compatibilityChecklist|canonicalSpecBuilder\\.build\\(checklist\\)|publication.*checklist" apps/quantify/src/modules/llm-strategy-codegen apps/front/src/app/[lng]/ai-quant/ai-quant-page-codegen.ts
```

Expected: no production matches. Test files may still contain absence assertions only.

- [ ] **Step 6: Commit**

```bash
git add -A apps/quantify/src/modules/llm-strategy-codegen apps/front/src/app/[lng]/ai-quant/ai-quant-page-codegen.ts
git commit -m "refactor: delete checklist compatibility code" -m "Refs: #850"
```

## Task 8: Regression Verification for Recently Working Strategies

**Files:**
- Modify or create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts`

- [ ] **Step 1: Add semantic-only regression test file**

Create `semantic-only-strategy-regression.spec.ts` with a table of messages from the spec:

```ts
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { buildNormalizedIntentFromSemanticState } from '../semantic-state-normalization'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticStateMergeService } from '../semantic-state-merge.service'

const cases = [
  ['ma', 'OKX 现货 BTCUSDT 15m；15m 收盘确认当价格突破 MA50 时买入；15m 收盘确认当价格跌破 MA10 时卖出；亏损 5% 止损，盈利 10% 止盈；单笔 10%。'],
  ['ema', 'EMA7 上穿 EMA21 做多；EMA7 下穿 EMA21 平多；单笔 10%。'],
  ['bollinger-one-side', 'OKX 合约 BTCUSDT 15m；K线收盘后确认突破布林带(30,2.5)上轨时做空；价格回到布林带中轨(MA30)时平空；单笔 10%。'],
  ['bollinger-dual-side', 'K线收盘后确认突破布林带(20,2)上轨时做空，突破下轨时做多；价格回到布林带中轨时平仓；单笔 10%，亏损 5% 止损。'],
  ['grid-bidirectional', 'OKX 合约 BTCUSDT 15m；在 60000-80000 区间执行双向网格，步长 0.5%，单笔 10%。'],
  ['grid-long', 'BTCUSDT 固定区间 60000-80000，按 1% 网格买入，触达上方网格卖出，仓位 1%，单笔最大亏损 2%。'],
  ['percent-change', 'BTCUSDT 3m 当前K线收盘价相对上一根K线收盘价下跌 1% 时买入；15m 相对开仓均价上涨 2% 时卖出；5% 止损；10% 仓位。'],
  ['on-start', '立即开始时市价买入一次；1h；BTCUSDT；单笔 10%；亏损 5% 止损。'],
] as const

describe('semantic-only strategy regressions', () => {
  const extractor = new SemanticSeedExtractorService()
  const merge = new SemanticStateMergeService()
  const canonicalSpecBuilder = new CanonicalSpecBuilderService()

  it.each(cases)('keeps %s runnable without checklist', (_name, message) => {
    const patch = extractor.extract(message)
    const state = merge.merge({
      persisted: {
        version: 1,
        families: [],
        triggers: [],
        actions: [],
        risk: [],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-21T00:00:00.000Z',
      },
      derived: {
        version: 1,
        families: [],
        triggers: [],
        actions: [],
        risk: [],
        position: null,
        contextSlots: { exchange: null, symbol: null, marketType: null, timeframe: null },
        normalizationNotes: [],
        updatedAt: '2026-04-21T00:00:00.000Z',
        ...patch,
      } as any,
    })
    const normalizedIntent = buildNormalizedIntentFromSemanticState(state)
    const spec = canonicalSpecBuilder.buildFromNormalizedIntent({
      exchange: state.contextSlots.exchange?.value ?? 'okx',
      symbol: state.contextSlots.symbol?.value ?? 'BTCUSDT',
      marketType: state.contextSlots.marketType?.value ?? 'perp',
      defaultTimeframe: state.contextSlots.timeframe?.value ?? '15m',
    }, normalizedIntent)

    expect(spec.version).toBe(2)
    expect(spec.rules.length).toBeGreaterThan(0)
    expect(JSON.stringify(spec)).not.toContain('checklist')
  })
})
```

If `SemanticStateMergeService.merge` cannot accept patch-shaped state directly, adapt the test to use the production conversion helper added in Task 3. Do not add checklist fixtures.

- [ ] **Step 2: Run regression tests**

Run:

```bash
npx nx test quantify --runTestsByPath apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts --runInBand
```

Expected: PASS.

- [ ] **Step 3: Run the production grep guard**

Run:

```bash
rg -n "ChecklistPayload|ChecklistRuleDraft|ChecklistRuleBasis|checklist-compat|ConversationPlan.*logic|compatibilityChecklist|canonicalSpecBuilder\\.build\\(checklist\\)|checklist:" apps/quantify/src/modules/llm-strategy-codegen -g '!**/__tests__/**' -g '!**/*.spec.ts'
```

Expected: no matches except historical comments that explicitly state checklist is absent. Prefer removing comments if they are not needed.

- [ ] **Step 4: Run focused suite**

Run:

```bash
npx nx test quantify --runTestsByPath \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts \
  apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-publication-generation.stage.spec.ts \
  --runInBand
```

Expected: PASS.

- [ ] **Step 5: Run build or typecheck**

Run:

```bash
dx build quantify --dev
```

Expected: PASS.

- [ ] **Step 6: Run focused E2E**

Run:

```bash
dx test e2e quantify apps/quantify/e2e/llm-strategy-codegen
```

Expected: PASS in configured E2E environment. If unavailable, record exact environment failure and include the focused unit/build evidence.

- [ ] **Step 7: Commit**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-only-strategy-regression.spec.ts
git commit -m "test: lock semantic-only strategy regressions" -m "Refs: #850"
```

## Self-Review

- Spec coverage: Tasks cover semantic seed extraction, planner `logic` deletion, canonical fallback deletion, publication semantic-only input, engine/test semantic-only DTO, checklist file deletion, frontend naming, and final strategy verification.
- Placeholder scan: No placeholder markers or unspecified implementation steps are intentionally left.
- Boundary check: The plan repeatedly forbids atom key, reducer, canonical compiler, digest, and publication persistence redesign. Any behavior preservation must use semantic-native input/wiring.
- Verification check: The final verification explicitly includes MA/EMA, Bollinger, Grid, percent-change, on-start, grep guard, build, and E2E.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-21-ai-quant-semantic-only-checklist-deletion-implementation-plan.md`. Two execution options:

1. Subagent-Driven (recommended) - dispatch a fresh subagent per task, review between tasks, fast iteration.
2. Inline Execution - execute tasks in this session using executing-plans, batch execution with checkpoints.

Which approach?
