# AI Quant Atomic Contract Execution Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade AI Quant so the tested combination strategies flow end-to-end through atomic semantics, contracts, canonical predicates, emitted scripts, backtests, deploy/runtime signals, Prisma persistence, and frontend display.

**Architecture:** Keep `triggers / actions / risk / position / contextSlots` as the only semantic authority. Extend contract capability shapes into a generic predicate graph, project that graph into AST/IR/script helpers, persist versioned snapshots in `apps/quantify/prisma`, and render frontend logic graphs from `apps/quantify` output instead of frontend key guessing.

**Tech Stack:** NestJS and Jest in `apps/quantify`, Prisma 7, TypeScript, Next.js/Vitest in `apps/front`, OpenAPI-generated `packages/api-contracts`.

---

## 2026-05-06 Main Sync Review

Remote `origin/main` was merged into this branch at `0c829758` before implementation. The merge had no file-level conflicts with this plan branch. Main now includes PR #965/#966 work for atom-native normalization and semantic slot fulfillment, so this plan must build on that work instead of recreating it.

Already covered by latest `main`:

- `SemanticOpenSlotAnswerResolverService` exists and handles grid density plus semantic fragment fulfillment.
- `SemanticMissingPlaceholderReconcilerService` exists and removes/supersedes derived missing entry/exit placeholders after real atoms arrive.
- `SemanticClarificationQuestionRendererService` exists for business-facing semantic slot wording.
- `SemanticEventFrameParserService` and `SemanticEventFrameProjectorService` are registered providers.
- Multi-timeframe EMA/static indicator compare normalization and per-trigger timeframe projection are covered.
- `indicator.above` / `indicator.below` moving-average compare atoms have support/projection alignment.
- Canonical spec v2 IR now carries required timeframes from per-trigger params.

Remaining implementation focus after the sync:

- Add the new generic strategy building blocks not covered by #965/#966: rolling extrema breakout, RSI two-step sequence, pullback/retest confirmation, consecutive candle sequence, volume relative average, ATR multiple risk, remembered breakout-level stop, logical OR exit grouping, vague percent-change magnitude openSlots for wording such as `大跌`, falling-knife guard risk openSlots for wording such as `不要接飞刀`, and ambiguous sizing for wording such as `买一点`.
- Extend existing `SemanticOpenSlotAnswerResolverService`, `SemanticMissingPlaceholderReconcilerService`, and `SemanticClarificationQuestionRendererService` only where the new building blocks need owner openSlots. Do not create parallel services.
- Reuse current per-trigger timeframe support. Do not redo the already-merged multi-timeframe EMA work.
- Keep Task 5+ focused on canonical predicate graph, script helpers, runtime parity, persistence, and frontend display for the new building blocks.

## File Structure

- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts`
  - Add generic predicate/series/value/memory shape types used inside trigger/risk contract shapes.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-ast.ts`
  - Add AST predicate nodes for allOf/anyOf/sequence/compare/cross/remembered levels.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-ir.ts`
  - Add IR predicate and runtime state definitions that the emitter can compile.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`
  - Normalize tested natural-language patterns into atomic trigger/risk/position patches.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-event-frame-parser.service.ts`
  - Keep existing cross parsing, add generic clause grouping and inherited context support.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-event-frame-projector.service.ts`
  - Project event frames into atomic trigger/action patches without strategy-family branches.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-open-slot-answer-resolver.service.ts`
  - Extend the existing merged resolver for new confirmation/sizing fragments only.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-missing-placeholder-reconciler.service.ts`
  - Reuse the existing merged reconciler; adjust only if new trigger phases/keys need placeholder cleanup.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-clarification-question-renderer.service.ts`
  - Reuse the existing merged renderer for rebound/pullback/sizing wording.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-registry.service.ts`
  - Mark newly supported generic atoms executable.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-support-classifier.service.ts`
  - Stop routing supported volume/ATR/sequence atoms to unsupported fallback.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts`
  - Generate owner open slots for missing sizing and ambiguous confirmation definitions.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
  - Build canonical predicate graph from semantic contracts.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-strategy-ast-compiler.service.ts`
  - Compile canonical predicate graph into AST.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-strategy-ir-compiler.service.ts`
  - Compile AST predicates into IR predicates and runtime state requirements.
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/compiled-script-emitter.service.ts`
  - Emit helper-based script code for rolling extrema, volume average, ATR multiples, sequence, and remembered levels.
- Modify: `packages/shared/src/script-engine/helpers/technical-indicators.ts`
- Modify: `packages/shared/src/script-engine/helpers/signal-helpers.ts`
- Modify: `packages/shared/src/script-engine/helpers/index.ts`
  - Add or expose script helpers when existing helpers are insufficient.
- Modify: `apps/quantify/src/modules/backtesting/core/backtest-runner.service.ts`
  - Ensure emitted strategy runtime state is available during backtests.
- Modify: `apps/quantify/src/modules/strategy-signals/services/signal-generator.service.ts`
- Modify: `apps/quantify/src/modules/strategy-signals/services/runtime-signal-intent.adapter.ts`
- Modify: `apps/quantify/src/modules/strategy-signals/services/strategy-runtime-execution-state.service.ts`
- Modify: `apps/quantify/src/modules/strategy-signals/repositories/strategy-runtime-execution-state.repository.ts`
- Modify: `apps/quantify/src/modules/strategy-instances/services/strategy-instances.service.ts`
  - Ensure deployed runtime signal path uses the same published snapshot and runtime state semantics.
- Modify: `apps/quantify/prisma/schema/llm_strategies.prisma`
  - Add metadata only if existing JSON fields cannot persist schema version/runtime requirements reliably.
- Create: `apps/quantify/prisma/schema/migrations/20260505224500_atomic_contract_execution_metadata/migration.sql`
  - Add metadata columns only when required by Task 8.
- Modify: `apps/front/src/lib/api.ts`
  - Add generated or local frontend types for semantic display graph while contracts are regenerated.
- Modify: `apps/front/src/components/ai-quant/DisplayLogicGraphPreview.tsx`
  - Prefer `apps/quantify` semantic display graph.
- Modify: `apps/front/src/components/ai-quant/LogicGraphPreview.tsx`
  - Keep legacy graph fallback for old snapshots.
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.tsx`
- Modify: `apps/front/src/app/[lng]/ai-quant/ai-quant-page-conversation.ts`
  - Preserve new display graph and open slot prompts across conversation state.
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-combination-semantics.spec.ts`
  - New semantic extraction/readiness matrix for all ten prompts.
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-canonical-ir.spec.ts`
  - New canonical/AST/IR projection tests.
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-script-emitter.spec.ts`
  - New emitted script helper tests.
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-backtest-runtime-parity.spec.ts`
  - New parity tests for backtest/runtime signal decisions.
- Test: `apps/front/src/components/ai-quant/display-logic-graph-atomic-contract.test.tsx`
  - New frontend display graph tests.

## Task 1: Add End-to-End Semantic Failing Tests

**Main sync note:** Do not duplicate the already-merged multi-timeframe EMA and open-slot fragment tests from `2026-05-05-ai-quant-atom-native-normalization-and-slot-fulfillment.md`. This task adds coverage only for the broader combination strategy building blocks in the current spec.

**Files:**
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-combination-semantics.spec.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures/atom-coverage-golden-cases.ts`

- [ ] **Step 1: Write the failing semantic matrix test**

Create `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-combination-semantics.spec.ts`:

```ts
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticSupportClassifierService } from '../semantic-support-classifier.service'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'

describe('atomic contract combination semantics', () => {
  const extractor = new SemanticSeedExtractorService()
  const builder = new SemanticSeedStateBuilderService()
  const classifier = new SemanticSupportClassifierService(new SemanticAtomRegistryService())

  function buildState(message: string) {
    const patch = extractor.extract(message)
    const state = builder.buildFromPatch(patch)
    return classifier.classify(state)
  }

  it('extracts rolling high breakout entry and rolling low exit', () => {
    const result = buildState('BTC 4小时突破过去 20 根 K 线最高价做多，跌破过去 10 根 K 线最低价平仓。')

    expect(result.route).not.toBe('unsupported_fallback')
    expect(result.state.contextSlots).toEqual(expect.objectContaining({
      symbol: expect.objectContaining({ value: 'BTCUSDT' }),
      timeframe: expect.objectContaining({ value: '4h' }),
    }))
    expect(result.state.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'price.rolling_extrema_breakout',
        phase: 'entry',
        sideScope: 'long',
        params: expect.objectContaining({
          extrema: 'high',
          lookbackBars: 20,
          event: 'breakout_up',
        }),
      }),
      expect.objectContaining({
        key: 'price.rolling_extrema_breakout',
        phase: 'exit',
        sideScope: 'long',
        params: expect.objectContaining({
          extrema: 'low',
          lookbackBars: 10,
          event: 'breakout_down',
        }),
      }),
    ]))
    expect(result.state.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_long' }),
      expect.objectContaining({ key: 'close_long' }),
    ]))
  })

  it('extracts MA gate plus MA retest confirmation entry', () => {
    const result = buildState('ETH 日线在 MA120 上方时，只做多；价格回踩 MA20 后重新站上 MA20 买入。')

    expect(result.route).not.toBe('unsupported_fallback')
    expect(result.state.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'condition.expression',
        phase: 'gate',
        sideScope: 'long',
        params: expect.objectContaining({
          expression: expect.objectContaining({ kind: 'predicate' }),
        }),
      }),
      expect.objectContaining({
        key: 'condition.sequence',
        phase: 'entry',
        sideScope: 'long',
        params: expect.objectContaining({
          sequenceKind: 'pullback_reclaim',
          reference: expect.objectContaining({ indicator: 'ma', period: 20 }),
        }),
      }),
    ]))
  })

  it('keeps vague dip-buying semantics and asks for drop, falling-knife, and rebound confirmation', () => {
    const result = buildState('我想在大跌后抄底，但不要接飞刀，反弹确认后再买。')

    expect(result.route).toBe('open_slots')
    expect(result.state.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'price.percent_change',
        phase: 'gate',
        params: expect.objectContaining({ direction: 'down' }),
        openSlots: expect.arrayContaining([
          expect.objectContaining({
            slotKey: 'trigger.percent_change.magnitude',
            affectsExecution: true,
          }),
        ]),
      }),
      expect.objectContaining({
        key: 'confirmation.rebound',
        phase: 'entry',
        openSlots: expect.arrayContaining([
          expect.objectContaining({
            slotKey: 'trigger.confirmation.rebound_definition',
            affectsExecution: true,
          }),
        ]),
      }),
    ]))
    expect(result.state.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'risk.falling_knife_guard',
        openSlots: expect.arrayContaining([
          expect.objectContaining({
            slotKey: 'risk.falling_knife_guard.definition',
            affectsExecution: true,
          }),
        ]),
      }),
    ]))
    expect(result.state.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'open_long' }),
    ]))
  })

  it('extracts consecutive candle drop with volume rebound and ambiguous sizing', () => {
    const result = buildState('BTC 连续跌三根 15 分钟 K 线后，如果下一根开始放量反弹就买一点。')

    expect(result.route).toBe('open_slots')
    expect(result.state.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'condition.sequence',
        params: expect.objectContaining({ sequenceKind: 'consecutive_candles', count: 3, direction: 'down' }),
      }),
      expect.objectContaining({
        key: 'volume.relative_average',
        params: expect.objectContaining({ event: 'spike' }),
      }),
      expect.objectContaining({
        key: 'confirmation.rebound',
      }),
    ]))
    expect(result.state.position?.openSlots).toEqual(expect.arrayContaining([
      expect.objectContaining({ slotKey: 'position.sizing', affectsExecution: true }),
    ]))
  })

  it('extracts MA trend filter plus RSI two-step entry and RSI exit', () => {
    const result = buildState('BTC 1小时 MA50 在 MA200 上方时，只在 RSI 跌破 35 后重新上穿 35 买入，RSI 超过 65 卖出。')

    expect(result.route).not.toBe('unsupported_fallback')
    expect(result.state.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'condition.expression', phase: 'gate' }),
      expect.objectContaining({
        key: 'condition.sequence',
        phase: 'entry',
        params: expect.objectContaining({ sequenceKind: 'rsi_reclaim', threshold: 35 }),
      }),
      expect.objectContaining({
        key: 'oscillator.rsi_gte',
        phase: 'exit',
        params: expect.objectContaining({ value: 65 }),
      }),
    ]))
    const rsiValues = result.state.triggers
      .filter((trigger) => trigger.key.includes('rsi') || trigger.params?.indicator === 'rsi')
      .map((trigger) => trigger.params?.value ?? trigger.params?.threshold)
    expect(rsiValues).not.toContain(1)
  })

  it('extracts Bollinger lower plus volume relative average entry and upper exit', () => {
    const result = buildState('ETH 15分钟触碰布林带下轨，并且成交量高于过去 20 根均量的 1.5 倍时买入，上轨卖出。')

    expect(result.route).not.toBe('unsupported_fallback')
    expect(result.state.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'price.detect.indicator_boundary', phase: 'entry' }),
      expect.objectContaining({
        key: 'volume.relative_average',
        phase: 'entry',
        params: expect.objectContaining({ lookbackBars: 20, multiplier: 1.5 }),
      }),
      expect.objectContaining({ key: 'price.detect.indicator_boundary', phase: 'exit' }),
    ]))
  })

  it('extracts MA100 gate with MACD entry and OR exit', () => {
    const result = buildState('SOL 30分钟价格在 MA100 上方，MACD 金叉买入；跌破 MA100 或 MACD 死叉卖出。')

    expect(result.route).not.toBe('unsupported_fallback')
    expect(result.state.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'indicator.above', phase: 'gate' }),
      expect.objectContaining({ key: 'indicator.cross_over', phase: 'entry', params: expect.objectContaining({ indicator: 'macd' }) }),
      expect.objectContaining({ key: 'logical.any_of', phase: 'exit' }),
    ]))
  })

  it('extracts breakout retest confirmation and breakout-level stop', () => {
    const result = buildState('BTC 突破过去 24 小时高点后不立刻买，等回踩不破突破位再买，跌回突破位下方止损。')

    expect(result.route).toBe('open_slots')
    expect(result.state.triggers).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'condition.sequence',
        phase: 'entry',
        params: expect.objectContaining({ sequenceKind: 'breakout_retest', lookbackWindow: '24h' }),
      }),
    ]))
    expect(result.state.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({
        key: 'risk.remembered_level_stop',
        params: expect.objectContaining({ levelKey: 'breakout' }),
      }),
    ]))
  })

  it('extracts ATR multiple stop and take profit as supported risk atoms', () => {
    const result = buildState('ETH 1小时突破 MA20 买入，止损设为 2 倍 ATR，盈利达到 3 倍 ATR 后止盈')

    expect(result.route).not.toBe('unsupported_fallback')
    expect(result.state.risk).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'risk.atr_multiple_stop', params: expect.objectContaining({ multiple: 2 }) }),
      expect.objectContaining({ key: 'risk.atr_multiple_take_profit', params: expect.objectContaining({ multiple: 3 }) }),
    ]))
  })
})
```

- [ ] **Step 2: Run the semantic matrix and verify it fails**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-combination-semantics.spec.ts
```

Expected: FAIL. Failures should mention unknown keys such as `price.rolling_extrema_breakout`, unsupported `volume.relative_average`, missing sequence atoms, or missing position sizing open slots.

- [ ] **Step 3: Add the ten prompts to atom coverage fixtures**

Modify `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures/atom-coverage-golden-cases.ts` by adding:

```ts
export const ATOMIC_CONTRACT_EXECUTION_UPGRADE_CASES = [
  'BTC 4小时突破过去 20 根 K 线最高价做多，跌破过去 10 根 K 线最低价平仓。',
  'ETH 日线在 MA120 上方时，只做多；价格回踩 MA20 后重新站上 MA20 买入。',
  '我想在大跌后抄底，但不要接飞刀，反弹确认后再买。',
  'BTC 连续跌三根 15 分钟 K 线后，如果下一根开始放量反弹就买一点。',
  'BTC 1小时 MA50 在 MA200 上方时，只在 RSI 跌破 35 后重新上穿 35 买入，RSI 超过 65 卖出。',
  'ETH 15分钟触碰布林带下轨，并且成交量高于过去 20 根均量的 1.5 倍时买入，上轨卖出。',
  'SOL 30分钟价格在 MA100 上方，MACD 金叉买入；跌破 MA100 或 MACD 死叉卖出。',
  'BTC 突破过去 24 小时高点后不立刻买，等回踩不破突破位再买，跌回突破位下方止损。',
  'ETH 1小时突破 MA20 买入，止损设为 2 倍 ATR，盈利达到 3 倍 ATR 后止盈',
] as const
```

- [ ] **Step 4: Commit the failing semantic tests**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-combination-semantics.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures/atom-coverage-golden-cases.ts
git commit -F - <<'MSG'
test: cover atomic contract combination semantics

变更说明：
- 增加组合策略语义抽取、openSlot 和 unsupported fallback 负向覆盖。
- 将本次端到端支持样例加入 atom coverage fixture。

Refs: #960
MSG
```

## Task 2: Define Generic Atomic Contract Vocabulary

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-registry.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-support-classifier.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-registry.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-support-classifier.service.spec.ts`

- [ ] **Step 1: Add registry tests for newly supported atoms**

Append to `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-registry.service.spec.ts`:

```ts
it.each([
  'price.rolling_extrema_breakout',
  'condition.sequence',
  'confirmation.rebound',
  'logical.any_of',
  'volume.relative_average',
  'risk.atr_multiple_stop',
  'risk.atr_multiple_take_profit',
  'risk.remembered_level_stop',
  'risk.falling_knife_guard',
])('marks %s as supported by atomic contract execution', (key) => {
  const resolved = service.resolve(key)

  expect(resolved.supportStatus).toMatch(/^supported_/u)
  expect(resolved.executableProjection).toContain('canonical_spec_v1')
})
```

- [ ] **Step 2: Run registry tests and verify they fail**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-registry.service.spec.ts
```

Expected: FAIL because the new atom keys are unknown or recognized unsupported.

- [ ] **Step 3: Add generic predicate shape types**

In `apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts`, add these exported types near existing `SemanticExpression` types:

```ts
export type SemanticPredicateJoin = 'allOf' | 'anyOf'
export type SemanticSequenceKind =
  | 'rsi_reclaim'
  | 'pullback_reclaim'
  | 'breakout_retest'
  | 'consecutive_candles'

export interface SemanticSeriesReference {
  kind: 'series'
  source: 'price' | 'volume' | 'indicator' | 'memory'
  field?: 'open' | 'high' | 'low' | 'close' | 'volume'
  indicator?: 'ma' | 'ema' | 'rsi' | 'macd' | 'bollinger' | 'atr'
  period?: number
  fastPeriod?: number
  slowPeriod?: number
  signalPeriod?: number
  boundaryRole?: 'upper' | 'middle' | 'lower'
  memoryKey?: string
}

export interface SemanticPredicateShape {
  kind: 'compare' | 'cross' | 'sequence' | 'logical'
  join?: SemanticPredicateJoin
  sequenceKind?: SemanticSequenceKind
  left?: SemanticSeriesReference
  right?: SemanticSeriesReference | { kind: 'constant'; value: number; unit?: string }
  op?: SemanticExpressionOperator
  items?: SemanticPredicateShape[]
  steps?: SemanticPredicateShape[]
  memoryKey?: string
}
```

- [ ] **Step 4: Register supported atoms**

In `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-registry.service.ts`, add executable definitions alongside existing trigger/risk definitions:

```ts
executableTrigger('price.rolling_extrema_breakout', ['extrema', 'event']),
executableTrigger('condition.sequence', ['sequenceKind']),
executableTrigger('confirmation.rebound', []),
executableTrigger('logical.any_of', ['items']),
executableTrigger('volume.relative_average', ['lookbackBars', 'multiplier']),
executableRisk('risk.atr_multiple_stop', ['multiple']),
executableRisk('risk.atr_multiple_take_profit', ['multiple']),
executableRisk('risk.remembered_level_stop', ['levelKey']),
supportedRequiresSlotRisk('risk.falling_knife_guard', ['definition']),
```

If `executableRisk()` is not currently present, add the helper near `executableTrigger()`:

```ts
function executableRisk(key: string, requiredParams: string[]): SemanticAtomDefinition {
  return {
    key,
    category: 'risk',
    supportStatus: 'supported_executable',
    requiredParams,
    defaultableParams: [],
    executableProjection: ['canonical_spec_v1'],
    openSlots: [],
  }
}
```

If the registry does not yet have a helper for supported atoms that still require owner openSlots, add:

```ts
function supportedRequiresSlotRisk(key: string, requiredParams: string[]): SemanticAtomDefinition {
  return {
    key,
    category: 'risk',
    supportStatus: 'supported_requires_slot',
    requiredParams,
    defaultableParams: [],
    executableProjection: ['canonical_spec_v1'],
    openSlots: requiredParams.map((param) => `risk.${key.split('.').at(-1)}.${param}`),
  }
}
```

- [ ] **Step 5: Update support classifier test for volume and ATR**

Append to `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-support-classifier.service.spec.ts`:

```ts
it('does not route newly supported atomic contract atoms to unsupported fallback', () => {
  const state = buildSemanticState({
    triggers: [
      { id: 't-volume', key: 'volume.relative_average', phase: 'entry', status: 'locked', source: 'user_explicit', params: { lookbackBars: 20, multiplier: 1.5 }, contracts: [], openSlots: [] },
    ],
    actions: [
      { id: 'a-open', key: 'open_long', status: 'locked', source: 'user_explicit', params: {}, contracts: [], openSlots: [] },
    ],
    risk: [
      { id: 'r-atr-stop', key: 'risk.atr_multiple_stop', status: 'locked', source: 'user_explicit', params: { multiple: 2 }, contracts: [], openSlots: [] },
    ],
  })

  const result = service.classify(state)

  expect(result.route).not.toBe('unsupported_fallback')
  expect(result.unsupportedAtoms).toEqual([])
})
```

Use the local state builder helper already present in that spec. If the file does not expose a helper, create the full `SemanticState` object inline with empty locked context slots matching existing tests.

- [ ] **Step 6: Run registry and support tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-registry.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-support-classifier.service.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit vocabulary changes**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/types/semantic-state.ts apps/quantify/src/modules/llm-strategy-codegen/services/semantic-atom-registry.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/semantic-support-classifier.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-atom-registry.service.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-support-classifier.service.spec.ts
git commit -F - <<'MSG'
feat: add atomic contract predicate vocabulary

变更说明：
- 增加组合条件、序列、成交量、ATR 与 remembered level 的通用 atom vocabulary。
- 将本次支持范围内的成交量和 ATR atom 从 unsupported fallback 移入 canonical projection 路径。

Refs: #960
MSG
```

## Task 3: Normalize Combination Strategy Text Into Atomic Patches

**Main sync note:** `SemanticOpenSlotAnswerResolverService`, missing placeholder reconciliation, multi-timeframe EMA normalization, and per-trigger timeframe projection already exist in latest `main`. This task should extend `SemanticSeedExtractorService` and the existing event-frame services for new building blocks only; it must not reimplement the merged resolver/reconciler flow.

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-event-frame-parser.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-event-frame-projector.service.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-event-frame-parser.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-combination-semantics.spec.ts`

- [ ] **Step 1: Add focused extractor tests for each new pattern**

Append to `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts`:

```ts
it('extracts rolling window extrema breakouts with entry and exit intent', () => {
  const patch = service.extract('BTC 4小时突破过去 20 根 K 线最高价做多，跌破过去 10 根 K 线最低价平仓。')

  expect(patch.triggers).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: 'price.rolling_extrema_breakout', phase: 'entry', params: expect.objectContaining({ extrema: 'high', lookbackBars: 20 }) }),
    expect.objectContaining({ key: 'price.rolling_extrema_breakout', phase: 'exit', params: expect.objectContaining({ extrema: 'low', lookbackBars: 10 }) }),
  ]))
})

it('extracts volume relative average filters as supported entry triggers', () => {
  const patch = service.extract('ETH 15分钟触碰布林带下轨，并且成交量高于过去 20 根均量的 1.5 倍时买入，上轨卖出。')

  expect(patch.triggers).toEqual(expect.arrayContaining([
    expect.objectContaining({
      key: 'volume.relative_average',
      phase: 'entry',
      sideScope: 'long',
      params: expect.objectContaining({ lookbackBars: 20, multiplier: 1.5, comparator: 'gt' }),
    }),
  ]))
})

it('extracts ATR multiple risk atoms', () => {
  const patch = service.extract('ETH 1小时突破 MA20 买入，止损设为 2 倍 ATR，盈利达到 3 倍 ATR 后止盈')

  expect(patch.risk).toEqual(expect.arrayContaining([
    expect.objectContaining({ key: 'risk.atr_multiple_stop', params: expect.objectContaining({ multiple: 2 }) }),
    expect.objectContaining({ key: 'risk.atr_multiple_take_profit', params: expect.objectContaining({ multiple: 3 }) }),
  ]))
})

it('extracts vague dip-buying as semantic open slots before execution context questions', () => {
  const patch = service.extract('我想在大跌后抄底，但不要接飞刀，反弹确认后再买。')

  expect(patch.triggers).toEqual(expect.arrayContaining([
    expect.objectContaining({
      key: 'price.percent_change',
      phase: 'gate',
      params: expect.objectContaining({ direction: 'down' }),
      openSlots: expect.arrayContaining([
        expect.objectContaining({ slotKey: 'trigger.percent_change.magnitude', affectsExecution: true }),
      ]),
    }),
    expect.objectContaining({
      key: 'confirmation.rebound',
      phase: 'entry',
      openSlots: expect.arrayContaining([
        expect.objectContaining({ slotKey: 'trigger.confirmation.rebound_definition', affectsExecution: true }),
      ]),
    }),
  ]))
  expect(patch.risk).toEqual(expect.arrayContaining([
    expect.objectContaining({
      key: 'risk.falling_knife_guard',
      openSlots: expect.arrayContaining([
        expect.objectContaining({ slotKey: 'risk.falling_knife_guard.definition', affectsExecution: true }),
      ]),
    }),
  ]))
})
```

- [ ] **Step 2: Run focused extractor tests and verify they fail**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts -t "rolling window extrema|volume relative average|ATR multiple"
```

Expected: FAIL with missing keys or wrong unsupported keys.

- [ ] **Step 3: Add extraction calls in `extractTriggers()`**

In `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts`, update `extractTriggers()` so the new generic extractors run before old unsupported detection:

```ts
this.pushRollingExtremaBreakoutTriggers(segment, triggers, seen)
this.pushVagueDipBuyingTriggers(segment, triggers, seen)
this.pushSequenceTriggers(segment, triggers, seen, text)
this.pushVolumeRelativeAverageTriggers(segment, triggers, seen)
this.pushLogicalOrExitTriggers(segment, triggers, seen, text)
```

Place these calls after `pushPreviousBarExtremaExpressionTriggers()` and before `pushRecognizedUnsupportedTriggers()`.

- [ ] **Step 4: Implement rolling extrema extraction**

Add this method to `SemanticSeedExtractorService`:

```ts
private pushRollingExtremaBreakoutTriggers(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
  for (const clause of this.splitLogicClauses(segment)) {
    const intent = this.resolveTradeIntent(clause) ?? this.resolveTradeIntent(segment)
    if (!intent) continue

    const highBars = this.extractNumber(clause, [
      /(?:突破|升破|上破)\s*(?:过去|最近)\s*(\d{1,4})\s*根\s*K\s*线(?:最高价|最高|高点)/u,
      /(?:过去|最近)\s*(\d{1,4})\s*根\s*K\s*线(?:最高价|最高|高点).*?(?:突破|升破|上破)/u,
    ])
    if (highBars !== null) {
      this.pushTrigger(triggers, seen, {
        key: 'price.rolling_extrema_breakout',
        phase: intent.phase,
        sideScope: intent.sideScope,
        params: { extrema: 'high', lookbackBars: highBars, event: 'breakout_up' },
        evidence: { text: clause, source: 'user_explicit' },
      })
      continue
    }

    const lowBars = this.extractNumber(clause, [
      /(?:跌破|下破|跌穿|失守)\s*(?:过去|最近)\s*(\d{1,4})\s*根\s*K\s*线(?:最低价|最低|低点)/u,
      /(?:过去|最近)\s*(\d{1,4})\s*根\s*K\s*线(?:最低价|最低|低点).*?(?:跌破|下破|跌穿|失守)/u,
    ])
    if (lowBars !== null) {
      this.pushTrigger(triggers, seen, {
        key: 'price.rolling_extrema_breakout',
        phase: intent.phase,
        sideScope: intent.sideScope,
        params: { extrema: 'low', lookbackBars: lowBars, event: 'breakout_down' },
        evidence: { text: clause, source: 'user_explicit' },
      })
    }
  }
}
```

- [ ] **Step 5: Implement volume relative average extraction**

Add this method to `SemanticSeedExtractorService`:

```ts
private pushVolumeRelativeAverageTriggers(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
  for (const clause of this.splitLogicClauses(segment)) {
    if (!/(?:成交量|volume|放量|量能)/iu.test(clause)) continue
    if (this.hasNegatedUnsupportedContext(clause)) continue

    const intent = this.resolveTradeIntent(clause) ?? this.resolveTradeIntent(segment)
    if (!intent) continue

    const relative = clause.match(/成交量(?:高于|大于|超过)\s*(?:过去|最近)?\s*(\d{1,4})\s*根(?:均量|平均量|成交量均线)(?:的)?\s*(\d+(?:\.\d+)?)\s*倍/u)
    if (relative?.[1] && relative[2]) {
      this.pushTrigger(triggers, seen, {
        key: 'volume.relative_average',
        phase: intent.phase,
        sideScope: intent.sideScope,
        params: {
          comparator: 'gt',
          lookbackBars: Number(relative[1]),
          multiplier: Number(relative[2]),
        },
        evidence: { text: clause, source: 'user_explicit' },
      })
      continue
    }

    if (/(?:放量|成交量放大|volume\s*spike|量能放大)/iu.test(clause)) {
      this.pushTrigger(triggers, seen, {
        key: 'volume.relative_average',
        phase: intent.phase,
        sideScope: intent.sideScope,
        params: { comparator: 'gt', event: 'spike' },
        evidence: { text: clause, source: 'user_explicit' },
      })
    }
  }
}
```

- [ ] **Step 6: Implement ATR multiple risk extraction before unsupported ATR logic**

In `extractRisk()`, before `pushRecognizedUnsupportedRisk(text, risk)`, add:

```ts
this.pushAtrMultipleRisk(text, risk)
```

Then add:

```ts
private pushAtrMultipleRisk(text: string, risk: SeedRisk[]): void {
  for (const clause of this.splitRiskClauses(text)) {
    const stop = clause.match(/(?:止损|亏损.{0,8}止损).{0,8}(?:设为|为|到)?\s*(\d+(?:\.\d+)?)\s*倍\s*ATR/iu)
    if (stop?.[1]) {
      this.pushRisk(risk, {
        key: 'risk.atr_multiple_stop',
        params: { multiple: Number(stop[1]), indicator: 'atr', effect: 'close_position', scope: 'current_position' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      })
    }

    const takeProfit = clause.match(/(?:盈利|止盈).{0,12}(?:达到|达|到|设为|为)?\s*(\d+(?:\.\d+)?)\s*倍\s*ATR/iu)
    if (takeProfit?.[1]) {
      this.pushRisk(risk, {
        key: 'risk.atr_multiple_take_profit',
        params: { multiple: Number(takeProfit[1]), indicator: 'atr', effect: 'close_position', scope: 'current_position' },
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
      })
    }
  }
}
```

- [ ] **Step 7: Implement vague dip-buying and falling-knife risk extraction**

Add methods that preserve vague user intent as atom-owned openSlots instead of falling through to generic context questions:

```ts
private pushVagueDipBuyingTriggers(segment: string, triggers: SeedTrigger[], seen: Set<string>): void {
  const intent = this.resolveTradeIntent(segment) ?? (/抄底|买/u.test(segment) ? { phase: 'gate' as const, sideScope: 'long' as const } : null)
  if (!intent || !/(大跌|暴跌|急跌|跌很多)/u.test(segment)) return

  this.pushTrigger(triggers, seen, {
    key: 'price.percent_change',
    phase: 'gate',
    sideScope: intent.sideScope,
    status: 'open',
    params: { direction: 'down', magnitude: 'unknown' },
    openSlots: [{
      slotKey: 'trigger.percent_change.magnitude',
      fieldPath: `triggers[${triggers.length}].params.magnitude`,
      status: 'open',
      priority: 'core',
      questionHint: '请确认“大跌”的判定幅度，例如 4 小时跌幅超过 5% / 最近 20 根 K 线跌幅超过 8%。',
      affectsExecution: true,
      evidence: { text: segment, source: 'user_explicit' },
    }],
    evidence: { text: segment, source: 'user_explicit' },
  })
}

private pushFallingKnifeRisk(segment: string, risk: SeedRisk[]): void {
  if (!/(不要接飞刀|避免接飞刀|不接飞刀)/u.test(segment)) return

  this.pushRisk(risk, {
    key: 'risk.falling_knife_guard',
    params: { definition: 'unknown' },
    status: 'open',
    source: 'user_explicit',
    openSlots: [{
      slotKey: 'risk.falling_knife_guard.definition',
      fieldPath: `risk[${risk.length}].params.definition`,
      status: 'open',
      priority: 'core',
      questionHint: '请确认“不接飞刀”的判定方式，例如反弹站上 MA20 / 下一根 K 线收阳 / 跌幅停止扩大。',
      affectsExecution: true,
      evidence: { text: segment, source: 'user_explicit' },
    }],
  })
}
```

Call `pushFallingKnifeRisk(segment, risk)` from the existing risk extraction path before fallback risk detection.

- [ ] **Step 8: Implement sequence and confirmation extraction**

Add methods that push `condition.sequence` and `confirmation.rebound`:

```ts
private pushSequenceTriggers(segment: string, triggers: SeedTrigger[], seen: Set<string>, contextText: string): void {
  const intent = this.resolveTradeIntent(segment) ?? this.resolveTradeIntent(contextText)

  if (/RSI.{0,16}(?:跌破|下穿)\s*(\d+(?:\.\d+)?).{0,16}(?:重新)?(?:上穿|穿回)\s*\1/u.test(segment) && intent) {
    const threshold = Number(segment.match(/RSI.{0,16}(?:跌破|下穿)\s*(\d+(?:\.\d+)?)/u)?.[1])
    this.pushTrigger(triggers, seen, {
      key: 'condition.sequence',
      phase: intent.phase,
      sideScope: intent.sideScope,
      params: { sequenceKind: 'rsi_reclaim', threshold, period: this.extractLastRsiPeriod(segment) ?? 14 },
    })
  }

  const consecutive = segment.match(/连续(?:下跌|跌|收阴)\s*(\d{1,3})\s*根/u) ?? segment.match(/连续\s*(\d{1,3})\s*根.{0,8}(?:下跌|跌|收阴)/u)
  if (consecutive?.[1]) {
    this.pushTrigger(triggers, seen, {
      key: 'condition.sequence',
      phase: intent?.phase ?? 'gate',
      sideScope: intent?.sideScope ?? 'long',
      params: { sequenceKind: 'consecutive_candles', count: Number(consecutive[1]), direction: 'down' },
      evidence: { text: segment, source: 'user_explicit' },
    })
  }

  if (/(?:回踩|回调).{0,12}(?:重新站上|站回|重新突破)/u.test(segment) && intent) {
    const period = this.extractNumber(segment, [/MA\s*(\d{1,4})/iu])
    this.pushTrigger(triggers, seen, {
      key: 'condition.sequence',
      phase: intent.phase,
      sideScope: intent.sideScope,
      params: { sequenceKind: 'pullback_reclaim', reference: { indicator: 'ma', period: period ?? 20 } },
      evidence: { text: segment, source: 'user_explicit' },
    })
  }

  if (/突破.{0,24}(?:回踩|回调).{0,16}不破/u.test(segment) && intent) {
    this.pushTrigger(triggers, seen, {
      key: 'condition.sequence',
      phase: intent.phase,
      sideScope: intent.sideScope,
      params: { sequenceKind: 'breakout_retest', lookbackWindow: this.extractFirstTimeframe(segment) ?? '24h', memoryKey: 'breakout' },
      evidence: { text: segment, source: 'user_explicit' },
    })
  }

  if (/反弹确认/u.test(segment) && intent) {
    this.pushTrigger(triggers, seen, {
      key: 'confirmation.rebound',
      phase: intent.phase,
      sideScope: intent.sideScope,
      status: 'open',
      params: { confirmation: 'unknown' },
      openSlots: [{
        slotKey: 'trigger.confirmation.rebound_definition',
        fieldPath: `triggers[${triggers.length}].params.confirmation`,
        status: 'open',
        priority: 'core',
        questionHint: '请确认反弹确认条件，例如重新站上 MA20 / 收盘价上涨 1% / 下一根 K 线收阳。',
        affectsExecution: true,
        evidence: { text: '反弹确认', source: 'user_explicit' },
      }],
    })
  }
}
```

- [ ] **Step 9: Implement ambiguous sizing extraction for “买一点”**

In `extractPosition()`, before returning `null` for no sizing, add:

```ts
if (/(买一点|买一些|小仓位|轻仓|少量)/u.test(text)) {
  return {
    mode: 'fixed_ratio',
    value: null,
    positionMode: this.resolvePositionMode(text, triggers),
    status: 'open',
    source: 'user_explicit',
    openSlots: [{
      slotKey: 'position.sizing',
      fieldPath: 'position.sizing',
      status: 'open',
      priority: 'core',
      questionHint: '请确认单笔仓位大小，例如 10% / 10 USDT / 0.001 BTC。',
      affectsExecution: true,
      evidence: { text: '买一点', source: 'user_explicit' },
    }],
  }
}
```

If the `CodegenSemanticPatch['position']` type does not allow `value: null`, extend it to `number | null` in the corresponding type file and update tests that construct position patches.

- [ ] **Step 10: Run semantic tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-combination-semantics.spec.ts
```

Expected: PASS.

- [ ] **Step 11: Commit extractor normalization**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-seed-extractor.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/semantic-event-frame-parser.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/semantic-event-frame-projector.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-seed-extractor.service.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-event-frame-parser.service.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-combination-semantics.spec.ts
git commit -F - <<'MSG'
feat: normalize combination strategy text into atomic patches

变更说明：
- 支持 rolling extrema、sequence、volume relative average、ATR multiple 和 ambiguous sizing 的原子抽取。
- 将模糊反弹确认和买一点映射为 owner openSlots。

Refs: #960
MSG
```

## Task 4: Build Contract Readiness and Clarification for New Shapes

**Main sync note:** Latest `main` already introduced `SemanticClarificationQuestionRendererService`. Add mappings there instead of adding a new renderer or putting user-facing text back into `StrategyClarificationRulesService`.

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-question.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-clarification-question-renderer.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-clarification-metadata.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-question.service.spec.ts`

- [ ] **Step 1: Add readiness tests for rebound, vague drop, falling-knife, and sizing openSlots**

Append to `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.spec.ts`:

```ts
it('keeps ambiguous rebound confirmation as a trigger-owned blocking open slot', () => {
  const state = buildStateWithTrigger({
    key: 'confirmation.rebound',
    phase: 'entry',
    params: { confirmation: 'unknown' },
    openSlots: [{
      slotKey: 'trigger.confirmation.rebound_definition',
      fieldPath: 'triggers[0].params.confirmation',
      status: 'open',
      priority: 'core',
      affectsExecution: true,
    }],
  })

  const result = service.evaluate(state)

  expect(result.blockingOpenSlots).toEqual(expect.arrayContaining([
    expect.objectContaining({
      slotKey: 'trigger.confirmation.rebound_definition',
      ownerPath: expect.stringContaining('triggers'),
    }),
  ]))
})

it('keeps ambiguous position sizing as a position-owned blocking open slot', () => {
  const state = buildStateWithPosition({
    mode: 'fixed_ratio',
    value: null,
    openSlots: [{
      slotKey: 'position.sizing',
      fieldPath: 'position.sizing',
      status: 'open',
      priority: 'core',
      affectsExecution: true,
    }],
  })

  const result = service.evaluate(state)

  expect(result.blockingOpenSlots).toEqual(expect.arrayContaining([
    expect.objectContaining({
      slotKey: 'position.sizing',
      ownerPath: 'position',
    }),
  ]))
})

it('keeps vague drop and falling-knife wording as semantic-owned blocking open slots', () => {
  const state = buildState({
    triggers: [{
      key: 'price.percent_change',
      phase: 'gate',
      params: { direction: 'down', magnitude: 'unknown' },
      openSlots: [{
        slotKey: 'trigger.percent_change.magnitude',
        fieldPath: 'triggers[0].params.magnitude',
        status: 'open',
        priority: 'core',
        affectsExecution: true,
      }],
    }],
    risk: [{
      key: 'risk.falling_knife_guard',
      params: { definition: 'unknown' },
      openSlots: [{
        slotKey: 'risk.falling_knife_guard.definition',
        fieldPath: 'risk[0].params.definition',
        status: 'open',
        priority: 'core',
        affectsExecution: true,
      }],
    }],
  })

  const result = service.evaluate(state)

  expect(result.blockingOpenSlots).toEqual(expect.arrayContaining([
    expect.objectContaining({ slotKey: 'trigger.percent_change.magnitude', ownerPath: expect.stringContaining('triggers') }),
    expect.objectContaining({ slotKey: 'risk.falling_knife_guard.definition', ownerPath: expect.stringContaining('risk') }),
  ]))
})
```

Use the local helper names in the file. If helper names differ, create inline `SemanticState` fixtures matching the existing test style.

- [ ] **Step 2: Add clarification question tests**

Append to `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-question.service.spec.ts`:

```ts
it.each([
  ['trigger.percent_change.magnitude', '请确认“大跌”的判定幅度，例如 4 小时跌幅超过 5% / 最近 20 根 K 线跌幅超过 8%。'],
  ['trigger.confirmation.rebound_definition', '请确认反弹确认条件，例如重新站上 MA20 / 收盘价上涨 1% / 下一根 K 线收阳。'],
  ['trigger.confirmation.pullback_hold', '请确认回踩不破的判定方式，例如收盘价不跌破突破位，还是最低价不跌破突破位。'],
  ['risk.falling_knife_guard.definition', '请确认“不接飞刀”的判定方式，例如反弹站上 MA20 / 下一根 K 线收阳 / 跌幅停止扩大。'],
  ['position.sizing', '请确认单笔仓位大小，例如 10% / 10 USDT / 0.001 BTC。'],
])('renders business wording for %s', (slotKey, expected) => {
  const question = service.renderOpenSlotQuestion({
    slotKey,
    fieldPath: 'triggers[0].params.value',
    status: 'open',
    priority: 'core',
    affectsExecution: true,
  })

  expect(question).toBe(expected)
})
```

- [ ] **Step 3: Implement metadata mapping**

In `semantic-clarification-metadata.ts`, add explicit mappings:

```ts
if (
  slotKey === 'trigger.percent_change.magnitude'
  || slotKey === 'trigger.confirmation.rebound_definition'
  || slotKey === 'trigger.confirmation.pullback_hold'
) {
  return {
    reason: 'missing_semantic_trigger',
    field: 'triggers',
  }
}

if (slotKey === 'risk.falling_knife_guard.definition') {
  return {
    reason: 'missing_risk_atom',
    field: 'risk',
  }
}
```

- [ ] **Step 4: Implement question rendering**

In `semantic-clarification-question-renderer.service.ts`, extend the existing business copy mapping:

```ts
const SEMANTIC_OPEN_SLOT_QUESTIONS: Record<string, string> = {
  'trigger.percent_change.magnitude': '请确认“大跌”的判定幅度，例如 4 小时跌幅超过 5% / 最近 20 根 K 线跌幅超过 8%。',
  'trigger.confirmation.rebound_definition': '请确认反弹确认条件，例如重新站上 MA20 / 收盘价上涨 1% / 下一根 K 线收阳。',
  'trigger.confirmation.pullback_hold': '请确认回踩不破的判定方式，例如收盘价不跌破突破位，还是最低价不跌破突破位。',
  'risk.falling_knife_guard.definition': '请确认“不接飞刀”的判定方式，例如反弹站上 MA20 / 下一根 K 线收阳 / 跌幅停止扩大。',
  'position.sizing': '请确认单笔仓位大小，例如 10% / 10 USDT / 0.001 BTC。',
}
```

Then in the existing render method, return `SEMANTIC_OPEN_SLOT_QUESTIONS[slot.slotKey]` before generic fallback. Keep `strategy-clarification-question.service.ts` as an adapter/caller if the latest main already delegates rendering.

Also verify slot priority ordering: explicit strategy semantic/risk openSlots (`trigger.percent_change.magnitude`, `trigger.confirmation.rebound_definition`, `risk.falling_knife_guard.definition`, `position.sizing`) must be ranked before generic execution context slots such as exchange. This prevents vague strategy 3 from asking “请确认交易所” while unresolved strategy semantics still block execution.

- [ ] **Step 5: Run readiness and clarification tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-question.service.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit readiness changes**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-contract-readiness.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/strategy-clarification-question.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/semantic-clarification-question-renderer.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/semantic-clarification-metadata.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-contract-readiness.service.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/strategy-clarification-question.service.spec.ts
git commit -F - <<'MSG'
feat: clarify atomic contract open slots

变更说明：
- 将反弹确认、回踩不破和模糊仓位保留为 owner openSlots。
- 增加面向用户的业务化追问文案。

Refs: #960
MSG
```

## Task 5: Project Atomic Contracts Into Canonical Predicate AST and IR

**Main sync note:** Per-trigger timeframe collection and strict timeframe alignment support are already merged. Keep those paths intact and add only the predicate graph pieces needed for rolling extrema, volume relative average, sequence/retest, remembered levels, logical OR, and ATR risk.

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-ast.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-ir.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-strategy-ast-compiler.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/canonical-strategy-ir-compiler.service.ts`
- Create: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-canonical-ir.spec.ts`

- [ ] **Step 1: Write canonical/IR failing tests**

Create `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-canonical-ir.spec.ts`:

```ts
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalStrategyAstCompilerService } from '../canonical-strategy-ast-compiler.service'
import { CanonicalStrategyIrCompilerService } from '../canonical-strategy-ir-compiler.service'
import { buildLockedAtomicState } from './fixtures/semantic-state-golden-cases'

describe('atomic contract canonical predicate IR', () => {
  const specBuilder = new CanonicalSpecBuilderService()
  const astCompiler = new CanonicalStrategyAstCompilerService()
  const irCompiler = new CanonicalStrategyIrCompilerService()

  it('projects volume relative average and Bollinger touch into an allOf entry predicate', () => {
    const state = buildLockedAtomicState('bollinger-volume-entry')
    const spec = specBuilder.buildFromSemanticState(state)
    const ast = astCompiler.compile(spec)
    const ir = irCompiler.compile(ast)

    expect(spec.rules).toEqual(expect.arrayContaining([
      expect.objectContaining({
        phase: 'entry',
        predicate: expect.objectContaining({
          kind: 'allOf',
          items: expect.arrayContaining([
            expect.objectContaining({ kind: 'compare' }),
            expect.objectContaining({ kind: 'compare' }),
          ]),
        }),
      }),
    ]))
    expect(ir.predicates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'allOf' }),
    ]))
    expect(ir.runtimeRequirements.helpers).toEqual(expect.arrayContaining([
      'bollinger',
      'smaVolume',
    ]))
  })

  it('projects breakout retest into sequence IR with remembered level', () => {
    const state = buildLockedAtomicState('breakout-retest')
    const spec = specBuilder.buildFromSemanticState(state)
    const ast = astCompiler.compile(spec)
    const ir = irCompiler.compile(ast)

    expect(ir.predicates).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: 'sequence',
        memoryKey: 'breakout',
      }),
    ]))
    expect(ir.runtimeRequirements.stateKeys).toEqual(expect.arrayContaining([
      expect.stringContaining('breakout'),
    ]))
  })

  it('projects ATR multiple risk into risk IR helpers', () => {
    const state = buildLockedAtomicState('atr-risk')
    const spec = specBuilder.buildFromSemanticState(state)
    const ast = astCompiler.compile(spec)
    const ir = irCompiler.compile(ast)

    expect(ir.riskPredicates).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: 'atrMultipleStop', multiple: 2 }),
      expect.objectContaining({ kind: 'atrMultipleTakeProfit', multiple: 3 }),
    ]))
    expect(ir.runtimeRequirements.helpers).toEqual(expect.arrayContaining(['atr']))
  })
})
```

- [ ] **Step 2: Add locked semantic fixtures**

Modify `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures/semantic-state-golden-cases.ts` to export `buildLockedAtomicState(name)` with these cases:

```ts
export function buildLockedAtomicState(name: 'bollinger-volume-entry' | 'breakout-retest' | 'atr-risk'): SemanticState {
  if (name === 'bollinger-volume-entry') {
    return buildSemanticState({
      triggers: [
        { key: 'price.detect.indicator_boundary', phase: 'entry', sideScope: 'long', params: { indicator: { name: 'bollinger' }, boundaryRole: 'lower', event: 'touch' } },
        { key: 'volume.relative_average', phase: 'entry', sideScope: 'long', params: { lookbackBars: 20, multiplier: 1.5, comparator: 'gt' } },
        { key: 'price.detect.indicator_boundary', phase: 'exit', sideScope: 'long', params: { indicator: { name: 'bollinger' }, boundaryRole: 'upper', event: 'touch' } },
      ],
      actions: [{ key: 'open_long' }, { key: 'close_long' }],
      position: { mode: 'fixed_ratio', value: 0.1, sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' } },
    })
  }

  if (name === 'breakout-retest') {
    return buildSemanticState({
      triggers: [
        { key: 'condition.sequence', phase: 'entry', sideScope: 'long', params: { sequenceKind: 'breakout_retest', lookbackWindow: '24h', memoryKey: 'breakout' } },
      ],
      actions: [{ key: 'open_long' }],
      risk: [{ key: 'risk.remembered_level_stop', params: { levelKey: 'breakout' } }],
      position: { mode: 'fixed_ratio', value: 0.1, sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' } },
    })
  }

  return buildSemanticState({
    triggers: [
      { key: 'indicator.above', phase: 'entry', sideScope: 'long', params: { indicator: 'ma', referenceRole: 'short_term', 'reference.period': 20 } },
    ],
    actions: [{ key: 'open_long' }],
    risk: [
      { key: 'risk.atr_multiple_stop', params: { multiple: 2 } },
      { key: 'risk.atr_multiple_take_profit', params: { multiple: 3 } },
    ],
    position: { mode: 'fixed_ratio', value: 0.1, sizing: { kind: 'ratio', value: 0.1, unit: 'ratio' } },
  })
}
```

Adapt `buildSemanticState()` to the fixture helper style already used in the file.

- [ ] **Step 3: Run canonical/IR tests and verify they fail**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-canonical-ir.spec.ts
```

Expected: FAIL because predicates/runtime requirements are not implemented.

- [ ] **Step 4: Add AST and IR types**

In `canonical-strategy-ast.ts`, add:

```ts
export type CanonicalPredicateAst =
  | { kind: 'allOf'; items: CanonicalPredicateAst[] }
  | { kind: 'anyOf'; items: CanonicalPredicateAst[] }
  | { kind: 'sequence'; sequenceKind: string; steps: CanonicalPredicateAst[]; memoryKey?: string }
  | { kind: 'compare'; left: CanonicalSeriesAst; op: 'GT' | 'GTE' | 'LT' | 'LTE' | 'EQ'; right: CanonicalSeriesAst | CanonicalValueAst }
  | { kind: 'cross'; direction: 'over' | 'under'; left: CanonicalSeriesAst; right: CanonicalSeriesAst | CanonicalValueAst }

export interface CanonicalSeriesAst {
  kind: 'series'
  source: 'price' | 'volume' | 'indicator' | 'memory'
  field?: string
  indicator?: string
  period?: number
  multiplier?: number
  memoryKey?: string
}

export interface CanonicalValueAst {
  kind: 'value'
  value: number
  unit?: string
}
```

In `canonical-strategy-ir.ts`, add equivalent `CanonicalPredicateIr`, `RuntimeRequirements`, and `riskPredicates` properties on the existing IR root type.

- [ ] **Step 5: Implement canonical predicate projection**

In `canonical-spec-builder.service.ts`, add a private method:

```ts
private buildPredicateFromTrigger(trigger: SemanticTriggerState): CanonicalPredicateAst {
  switch (trigger.key) {
    case 'volume.relative_average':
      return {
        kind: 'compare',
        left: { kind: 'series', source: 'volume', field: 'volume' },
        op: 'GT',
        right: { kind: 'series', source: 'indicator', indicator: 'smaVolume', period: Number(trigger.params.lookbackBars), multiplier: Number(trigger.params.multiplier ?? 1) },
      }
    case 'price.rolling_extrema_breakout':
      return {
        kind: 'compare',
        left: { kind: 'series', source: 'price', field: 'close' },
        op: trigger.params.event === 'breakout_down' ? 'LT' : 'GT',
        right: { kind: 'series', source: 'indicator', indicator: trigger.params.extrema === 'low' ? 'rollingLow' : 'rollingHigh', period: Number(trigger.params.lookbackBars) },
      }
    case 'condition.sequence':
      return {
        kind: 'sequence',
        sequenceKind: String(trigger.params.sequenceKind),
        memoryKey: typeof trigger.params.memoryKey === 'string' ? trigger.params.memoryKey : undefined,
        steps: [],
      }
    default:
      return this.buildExistingPredicateFromTrigger(trigger)
  }
}
```

Wire entry triggers with the same phase/side into `allOf`, OR groups into `anyOf`, and risk atoms into `riskPredicates`.

- [ ] **Step 6: Implement AST to IR compiler**

In `canonical-strategy-ir-compiler.service.ts`, add conversion helpers:

```ts
private compilePredicate(predicate: CanonicalPredicateAst): CanonicalPredicateIr {
  if (predicate.kind === 'allOf' || predicate.kind === 'anyOf') {
    return { kind: predicate.kind, items: predicate.items.map(item => this.compilePredicate(item)) }
  }
  if (predicate.kind === 'sequence') {
    return {
      kind: 'sequence',
      sequenceKind: predicate.sequenceKind,
      steps: predicate.steps.map(step => this.compilePredicate(step)),
      ...(predicate.memoryKey ? { memoryKey: predicate.memoryKey } : {}),
    }
  }
  if (predicate.kind === 'compare' || predicate.kind === 'cross') {
    return predicate
  }
  return assertNever(predicate)
}
```

Add runtime requirements collection:

```ts
private collectRuntimeRequirements(predicate: CanonicalPredicateIr, requirements: RuntimeRequirements): void {
  const serialized = JSON.stringify(predicate)
  if (serialized.includes('rollingHigh')) requirements.helpers.push('rollingHigh')
  if (serialized.includes('rollingLow')) requirements.helpers.push('rollingLow')
  if (serialized.includes('smaVolume')) requirements.helpers.push('smaVolume')
  if (serialized.includes('bollinger')) requirements.helpers.push('bollinger')
  if (predicate.kind === 'sequence' && predicate.memoryKey) requirements.stateKeys.push(predicate.memoryKey)
}
```

Deduplicate `helpers` and `stateKeys` before returning IR.

- [ ] **Step 7: Run canonical/IR tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-canonical-ir.spec.ts
```

Expected: PASS.

- [ ] **Step 8: Commit canonical/IR projection**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-ast.ts apps/quantify/src/modules/llm-strategy-codegen/types/canonical-strategy-ir.ts apps/quantify/src/modules/llm-strategy-codegen/services/canonical-spec-builder.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/canonical-strategy-ast-compiler.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/canonical-strategy-ir-compiler.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-canonical-ir.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/fixtures/semantic-state-golden-cases.ts
git commit -F - <<'MSG'
feat: project atomic contracts into predicate IR

变更说明：
- 增加 allOf、anyOf、sequence、compare、cross 的 canonical/AST/IR 表达。
- 将成交量、rolling extrema、breakout retest 和 ATR 风控投影到通用 predicate IR。

Refs: #960
MSG
```

## Task 6: Emit Helper-Based Scripts for New Predicate IR

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/compiled-script-emitter.service.ts`
- Modify: `packages/shared/src/script-engine/helpers/README.md`
- Modify: `packages/shared/src/script-engine/helpers/technical-indicators.ts`
- Modify: `packages/shared/src/script-engine/helpers/signal-helpers.ts`
- Modify: `packages/shared/src/script-engine/helpers/index.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-script-emitter.spec.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/compiled-script-emitter.service.spec.ts`

- [ ] **Step 1: Write emitter tests**

Create `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-script-emitter.spec.ts`:

```ts
import { CompiledScriptEmitterService } from '../compiled-script-emitter.service'
import type { CanonicalStrategyIr } from '../../types/canonical-strategy-ir'

describe('atomic contract script emitter', () => {
  const service = new CompiledScriptEmitterService()

  it('emits rolling high and rolling low helpers', () => {
    const ir: CanonicalStrategyIr = {
      predicates: [
        { kind: 'compare', left: { kind: 'series', source: 'price', field: 'close' }, op: 'GT', right: { kind: 'series', source: 'indicator', indicator: 'rollingHigh', period: 20 } },
      ],
      riskPredicates: [],
      runtimeRequirements: { helpers: ['rollingHigh'], stateKeys: [] },
      actions: [{ kind: 'open_long', positionSizeRatio: 0.1 }],
    }

    const script = service.emit(ir)

    expect(script.content).toContain('rollingHigh')
    expect(script.content).toContain('return')
  })

  it('emits volume SMA and ATR multiple risk helpers', () => {
    const ir: CanonicalStrategyIr = {
      predicates: [
        { kind: 'compare', left: { kind: 'series', source: 'volume', field: 'volume' }, op: 'GT', right: { kind: 'series', source: 'indicator', indicator: 'smaVolume', period: 20, multiplier: 1.5 } },
      ],
      riskPredicates: [
        { kind: 'atrMultipleStop', multiple: 2 },
        { kind: 'atrMultipleTakeProfit', multiple: 3 },
      ],
      runtimeRequirements: { helpers: ['smaVolume', 'atr'], stateKeys: [] },
      actions: [{ kind: 'open_long', positionSizeRatio: 0.1 }],
    }

    const script = service.emit(ir)

    expect(script.content).toContain('smaVolume')
    expect(script.content).toContain('atr')
    expect(script.content).toContain('atrMultipleStop')
    expect(script.content).toContain('atrMultipleTakeProfit')
  })
})
```

- [ ] **Step 2: Run emitter tests and verify they fail**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-script-emitter.spec.ts
```

Expected: FAIL because emitter does not accept the new IR shape or does not emit helper calls.

- [ ] **Step 3: Add helper expression emitter**

In `compiled-script-emitter.service.ts`, add a predicate expression method:

```ts
private emitPredicate(predicate: CanonicalPredicateIr): string {
  if (predicate.kind === 'allOf') return predicate.items.map(item => `(${this.emitPredicate(item)})`).join(' && ')
  if (predicate.kind === 'anyOf') return predicate.items.map(item => `(${this.emitPredicate(item)})`).join(' || ')
  if (predicate.kind === 'sequence') return `sequenceState(${JSON.stringify(predicate.sequenceKind)}, ${JSON.stringify(predicate.memoryKey ?? '')})`
  if (predicate.kind === 'compare') return `${this.emitSeries(predicate.left)} ${this.emitCompareOp(predicate.op)} ${this.emitSeriesOrValue(predicate.right)}`
  if (predicate.kind === 'cross') {
    return predicate.direction === 'over'
      ? `crossesAbove(${this.emitSeries(predicate.left)}, ${this.emitSeriesOrValue(predicate.right)})`
      : `crossesBelow(${this.emitSeries(predicate.left)}, ${this.emitSeriesOrValue(predicate.right)})`
  }
  return assertNever(predicate)
}
```

Add series helpers:

```ts
private emitSeries(series: CanonicalSeriesIr): string {
  if (series.source === 'price') return `ctx.bar.${series.field ?? 'close'}`
  if (series.source === 'volume') return 'ctx.bar.volume'
  if (series.indicator === 'rollingHigh') return `rollingHigh(ctx.bars, ${series.period})`
  if (series.indicator === 'rollingLow') return `rollingLow(ctx.bars, ${series.period})`
  if (series.indicator === 'smaVolume') return `smaVolume(ctx.bars, ${series.period}) * ${series.multiplier ?? 1}`
  if (series.indicator === 'atr') return `atr(ctx.bars, ${series.period ?? 14})`
  if (series.source === 'memory') return `readRememberedLevel(${JSON.stringify(series.memoryKey)})`
  return this.emitExistingSeries(series)
}
```

Use existing naming conventions in the emitter if method names differ.

- [ ] **Step 4: Add helper implementations or exports**

If `packages/shared/src/script-engine/helpers` lacks helpers, add a small helper module:

```ts
export function rollingHigh(bars: Array<{ high: number }>, period: number): number {
  return Math.max(...bars.slice(-period).map(bar => bar.high))
}

export function rollingLow(bars: Array<{ low: number }>, period: number): number {
  return Math.min(...bars.slice(-period).map(bar => bar.low))
}

export function smaVolume(bars: Array<{ volume: number }>, period: number): number {
  const values = bars.slice(-period).map(bar => bar.volume)
  return values.reduce((sum, value) => sum + value, 0) / values.length
}
```

If helpers already exist under different names, export aliases and test those aliases instead of duplicating logic.

- [ ] **Step 5: Emit ATR risk checks**

In the risk emission path, map IR risk predicates:

```ts
if (risk.kind === 'atrMultipleStop') {
  lines.push(`if (ctx.position && ctx.bar.close <= ctx.position.entryPrice - atr(ctx.bars, 14) * ${risk.multiple}) return closeLong('risk.atr_multiple_stop')`)
}
if (risk.kind === 'atrMultipleTakeProfit') {
  lines.push(`if (ctx.position && ctx.bar.close >= ctx.position.entryPrice + atr(ctx.bars, 14) * ${risk.multiple}) return closeLong('risk.atr_multiple_take_profit')`)
}
```

Adjust `ctx.position.entryPrice` to the actual strategy context field used by existing emitted scripts.

- [ ] **Step 6: Run emitter tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-script-emitter.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/compiled-script-emitter.service.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit emitter changes**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/compiled-script-emitter.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-script-emitter.spec.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/compiled-script-emitter.service.spec.ts packages/shared/src/script-engine/helpers/technical-indicators.ts packages/shared/src/script-engine/helpers/signal-helpers.ts packages/shared/src/script-engine/helpers/index.ts
git commit -F - <<'MSG'
feat: emit scripts for atomic predicate IR

变更说明：
- 增加 rolling extrema、volume SMA、ATR multiple、sequence 和 remembered level 的 helper-based script emission。
- 补充新 predicate IR 的 emitted script 单测。

Refs: #960
MSG
```

## Task 7: Preserve Runtime State and Verify Backtest/Deploy Parity

**Files:**
- Modify: `apps/quantify/src/modules/backtesting/core/backtest-runner.service.ts`
- Modify: `apps/quantify/src/modules/strategy-signals/services/signal-generator.service.ts`
- Modify: `apps/quantify/src/modules/strategy-signals/services/runtime-signal-intent.adapter.ts`
- Modify: `apps/quantify/src/modules/strategy-signals/services/strategy-runtime-execution-state.service.ts`
- Modify: `apps/quantify/src/modules/strategy-signals/repositories/strategy-runtime-execution-state.repository.ts`
- Modify: `apps/quantify/src/modules/strategy-instances/services/strategy-instances.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-backtest-runtime-parity.spec.ts`
- Test: `apps/quantify/src/modules/backtesting/core/backtest-runner.service.spec.ts`

- [ ] **Step 1: Write parity test**

Create `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-backtest-runtime-parity.spec.ts`:

```ts
describe('atomic contract backtest/runtime parity', () => {
  it('uses the same emitted predicate script for backtest and runtime signal', async () => {
    const snapshot = buildPublishedSnapshotWithAtomicIr({
      predicates: [
        { kind: 'compare', left: { kind: 'series', source: 'price', field: 'close' }, op: 'GT', right: { kind: 'series', source: 'indicator', indicator: 'rollingHigh', period: 20 } },
      ],
      runtimeRequirements: { helpers: ['rollingHigh'], stateKeys: [] },
    })

    const bars = buildBarsWithFinalCloseAboveRollingHigh()
    const backtestDecision = await runSnapshotBacktestDecision(snapshot, bars)
    const runtimeDecision = await runSnapshotRuntimeSignalDecision(snapshot, bars)

    expect(backtestDecision.direction).toBe(runtimeDecision.direction)
    expect(backtestDecision.signalType).toBe(runtimeDecision.signalType)
    expect(backtestDecision.reason).toBe(runtimeDecision.reason)
  })
})
```

Use the test helper patterns already present in `codegen-conversation.service.spec.ts` and `backtest-runner.service.spec.ts`; keep fixture data local to this spec if helpers are not exported.

- [ ] **Step 2: Run parity test and verify it fails**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-backtest-runtime-parity.spec.ts
```

Expected: FAIL because runtime path does not consume the same helper state or snapshot IR yet.

- [ ] **Step 3: Persist runtime requirements in publication output**

In `codegen-publication-generation.stage.ts`, ensure the generated published snapshot metadata includes:

```ts
compatibilityMetadata: {
  ...existingCompatibilityMetadata,
  atomicContractExecution: {
    schemaVersion: 1,
    runtimeRequirements: compiledIr.runtimeRequirements,
  },
}
```

Use the existing metadata field name if the stage already has a compatibility metadata object.

- [ ] **Step 4: Use semantic runtime keys for state**

In the runtime signal path under `apps/quantify/src/modules/strategy-signals` or `apps/quantify/src/modules/strategy-instances`, resolve state keys from snapshot compatibility metadata:

```ts
const runtimeStateKeys = snapshot.compatibilityMetadata?.atomicContractExecution?.runtimeRequirements?.stateKeys ?? []
for (const stateKey of runtimeStateKeys) {
  await this.runtimeExecutionStateRepository.ensureState({
    strategyInstanceId,
    publishedSnapshotId: snapshot.id,
    executionSemanticKey: stateKey,
  })
}
```

Use the existing repository/service names for strategy runtime execution state.

- [ ] **Step 5: Make backtest runner pass runtime state into strategy context**

In `backtest-runner.service.ts`, ensure each bar execution receives the same memory helpers:

```ts
const strategyContext = this.buildScriptContext({
  ...input,
  runtimeState: positionRuntimeState,
  semanticRuntimeState: this.semanticRuntimeStateStore.snapshot(),
})
```

If `buildScriptContext()` has a different signature, add `semanticRuntimeState` to its existing context object and expose it to emitted scripts as `ctx.semanticRuntimeState`.

- [ ] **Step 6: Run backtest and parity tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/backtesting/core/backtest-runner.service.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-backtest-runtime-parity.spec.ts
```

Expected: PASS.

- [ ] **Step 7: Commit parity changes**

```bash
git add apps/quantify/src/modules/backtesting/core/backtest-runner.service.ts apps/quantify/src/modules/strategy-signals/services/signal-generator.service.ts apps/quantify/src/modules/strategy-signals/services/runtime-signal-intent.adapter.ts apps/quantify/src/modules/strategy-signals/services/strategy-runtime-execution-state.service.ts apps/quantify/src/modules/strategy-signals/repositories/strategy-runtime-execution-state.repository.ts apps/quantify/src/modules/strategy-instances/services/strategy-instances.service.ts apps/quantify/src/modules/llm-strategy-codegen/services/codegen-publication-generation.stage.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-backtest-runtime-parity.spec.ts apps/quantify/src/modules/backtesting/core/backtest-runner.service.spec.ts
git commit -F - <<'MSG'
feat: preserve atomic runtime state across backtest and deploy

变更说明：
- 将 atomic contract runtime requirements 写入发布快照元数据。
- 让回测与部署信号路径共享 emitted script 和 semantic runtime state keys。

Refs: #960
MSG
```

## Task 8: Add Prisma Persistence Metadata Only If Needed

**Files:**
- Modify: `apps/quantify/prisma/schema/llm_strategies.prisma`
- Create: `apps/quantify/prisma/schema/migrations/20260505224500_atomic_contract_execution_metadata/migration.sql`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/repositories/published-strategy-snapshots.repository.ts`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/repositories/published-strategy-snapshots.repository.spec.ts`

- [ ] **Step 1: Check whether existing JSON fields can persist metadata**

Run:

```bash
rg -n "compatibilityMetadata|semanticGraph|strategySummary|publishedSnapshots|runtimeRequirements" apps/quantify/src apps/quantify/prisma/schema/llm_strategies.prisma
```

Expected: identify whether `PublishedStrategySnapshot` already has JSON metadata for compatibility/runtime requirements.

- [ ] **Step 2: If existing JSON metadata exists, write repository persistence test without schema change**

Append to `published-strategy-snapshots.repository.spec.ts`:

```ts
it('persists atomic contract execution metadata in snapshot compatibility metadata', async () => {
  const snapshot = await repository.create({
    id: 'snapshot-atomic-contract',
    strategySummary: { text: 'atomic contract strategy' },
    semanticGraph: { version: 1 },
    compatibilityMetadata: {
      atomicContractExecution: {
        schemaVersion: 1,
        runtimeRequirements: { helpers: ['rollingHigh'], stateKeys: ['breakout'] },
      },
    },
  })

  const found = await repository.findById(snapshot.id)

  expect(found?.compatibilityMetadata).toEqual(expect.objectContaining({
    atomicContractExecution: expect.objectContaining({
      schemaVersion: 1,
      runtimeRequirements: { helpers: ['rollingHigh'], stateKeys: ['breakout'] },
    }),
  }))
})
```

- [ ] **Step 3: If no metadata field exists, add schema field**

In `apps/quantify/prisma/schema/llm_strategies.prisma`, add to `PublishedStrategySnapshot`:

```prisma
atomicContractExecution Json? @map("atomic_contract_execution")
```

Create migration:

```sql
ALTER TABLE "published_strategy_snapshots"
  ADD COLUMN IF NOT EXISTS "atomic_contract_execution" JSONB;
```

- [ ] **Step 4: Update repository mapping**

If a new field was added, update create/read mapping in `published-strategy-snapshots.repository.ts`:

```ts
atomicContractExecution: input.atomicContractExecution ?? Prisma.JsonNull,
```

and on read:

```ts
atomicContractExecution: parseJsonObject(row.atomicContractExecution),
```

Use the existing JSON parse helper used by `semanticGraph` or `strategySummary`.

- [ ] **Step 5: Run Prisma format/generate and repository tests**

Run:

```bash
dx db format
dx db generate
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/repositories/published-strategy-snapshots.repository.spec.ts
```

Expected: PASS.

- [ ] **Step 6: Commit persistence changes**

If no schema change:

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/repositories/published-strategy-snapshots.repository.ts apps/quantify/src/modules/llm-strategy-codegen/repositories/published-strategy-snapshots.repository.spec.ts
git commit -F - <<'MSG'
feat: persist atomic contract execution snapshot metadata

变更说明：
- 在发布快照兼容元数据中持久化 atomic contract execution schema version 与 runtime requirements。
- 覆盖快照恢复时的 metadata round-trip。

Refs: #960
MSG
```

If schema changed, include Prisma files:

```bash
git add apps/quantify/prisma/schema/llm_strategies.prisma apps/quantify/prisma/schema/migrations apps/quantify/src/modules/llm-strategy-codegen/repositories/published-strategy-snapshots.repository.ts apps/quantify/src/modules/llm-strategy-codegen/repositories/published-strategy-snapshots.repository.spec.ts
git commit -F - <<'MSG'
feat: persist atomic contract execution snapshot metadata

变更说明：
- 增加发布快照 atomic contract execution metadata 持久化。
- 增加 Prisma migration 与 repository round-trip 测试。

Refs: #960
MSG
```

## Task 9: Render Atomic Display Graph in Frontend

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts`
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/dto/codegen-session.response.dto.ts`
- Modify: `apps/front/src/lib/api.ts`
- Modify: `apps/front/src/components/ai-quant/DisplayLogicGraphPreview.tsx`
- Modify: `apps/front/src/components/ai-quant/LogicGraphPreview.tsx`
- Create: `apps/front/src/components/ai-quant/display-logic-graph-atomic-contract.test.tsx`
- Test: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts`

- [ ] **Step 1: Add quantify display projection test**

Append to `semantic-state-projection.service.spec.ts`:

```ts
it('projects atomic contract combinations into display logic graph', () => {
  const graph = service.projectDisplayLogicGraph(buildLockedAtomicState('bollinger-volume-entry'))

  expect(graph.blocks).toEqual(expect.arrayContaining([
    expect.objectContaining({
      type: 'IF',
      items: expect.arrayContaining([
        expect.objectContaining({ kind: 'condition', text: expect.stringContaining('布林带下轨') }),
        expect.objectContaining({ kind: 'condition', text: expect.stringContaining('成交量') }),
        expect.objectContaining({ kind: 'action', text: expect.stringContaining('开多') }),
      ]),
    }),
    expect.objectContaining({
      type: 'EXECUTE',
      items: expect.arrayContaining([
        expect.objectContaining({ text: expect.stringContaining('仓位') }),
      ]),
    }),
  ]))
})
```

- [ ] **Step 2: Implement `projectDisplayLogicGraph()`**

In `semantic-state-projection.service.ts`, add:

```ts
projectDisplayLogicGraph(state: SemanticState): SemanticDisplayLogicGraph {
  const blocks: SemanticDisplayLogicGraph['blocks'] = []
  const entryTriggers = state.triggers.filter(trigger => trigger.status !== 'superseded' && trigger.phase === 'entry')
  const exitTriggers = state.triggers.filter(trigger => trigger.status !== 'superseded' && trigger.phase === 'exit')

  if (entryTriggers.length > 0) {
    blocks.push({
      type: 'IF',
      items: [
        ...entryTriggers.map(trigger => ({ kind: 'condition' as const, id: trigger.id, text: this.formatTriggerForDisplay(trigger) })),
        ...state.actions.filter(action => action.key.startsWith('open_')).map(action => ({ kind: 'action' as const, id: action.id, text: this.formatActionForDisplay(action, state.position) })),
      ],
    })
  }

  for (const trigger of exitTriggers) {
    blocks.push({
      type: trigger.key === 'logical.any_of' ? 'OR_THEN' : 'AND_AT_THEN',
      items: [
        { kind: 'condition', id: trigger.id, text: this.formatTriggerForDisplay(trigger) },
        ...state.actions.filter(action => action.key.startsWith('close_')).map(action => ({ kind: 'action' as const, id: action.id, text: this.formatActionForDisplay(action, state.position) })),
      ],
    })
  }

  blocks.push({ type: 'EXECUTE', items: this.formatExecuteItems(state) })
  return { blocks }
}
```

Use existing formatter methods if names already exist; otherwise add focused private methods for trigger/action/context/risk display.

- [ ] **Step 3: Add frontend display graph test**

Create `apps/front/src/components/ai-quant/display-logic-graph-atomic-contract.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { DisplayLogicGraphPreview } from './DisplayLogicGraphPreview'

describe('DisplayLogicGraphPreview atomic contract graph', () => {
  it('renders apps/quantify display graph before legacy condition-key fallback', () => {
    render(
      <DisplayLogicGraphPreview
        graph={{
          blocks: [
            {
              type: 'IF',
              items: [
                { kind: 'condition', id: 'c1', text: '价格触碰布林带下轨' },
                { kind: 'condition', id: 'c2', text: '成交量高于过去 20 根均量的 1.5 倍' },
                { kind: 'action', id: 'a1', text: '开多 10%' },
              ],
            },
            {
              type: 'EXECUTE',
              items: [
                { kind: 'execute', id: 'e1', key: 'timeframe', text: '周期: 15m' },
              ],
            },
          ],
        }}
      />,
    )

    expect(screen.getByText('价格触碰布林带下轨')).toBeInTheDocument()
    expect(screen.getByText('成交量高于过去 20 根均量的 1.5 倍')).toBeInTheDocument()
    expect(screen.queryByText(/不支持的条件/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Update frontend component props**

In `DisplayLogicGraphPreview.tsx`, add a prop:

```ts
type SemanticDisplayLogicGraph = {
  blocks: Array<{
    type: 'IF' | 'AND_AT_THEN' | 'OR_THEN' | 'EXECUTE'
    items: Array<{ kind: 'condition' | 'action' | 'execute'; id: string; key?: string; text: string }>
  }>
}
```

Then render `graph.blocks` directly when present before legacy graph conversion.

- [ ] **Step 5: Wire response DTO and frontend API state**

Add `displayLogicGraph?: SemanticDisplayLogicGraph | null` to `apps/quantify` response DTO and to `apps/front/src/lib/api.ts` conversation/session types. In the page client conversation state, preserve `semanticGraph` and `displayLogicGraph` together:

```ts
displayLogicGraph: response.displayLogicGraph ?? response.specDesc?.displayLogicGraph ?? null,
```

- [ ] **Step 6: Run quantify projection and frontend tests**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts
dx test unit front apps/front/src/components/ai-quant/display-logic-graph-atomic-contract.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Regenerate contracts if DTO changed**

If OpenAPI DTO changed, run:

```bash
dx build quantify --dev
dx build contracts --dev
```

Expected: PASS and generated `packages/api-contracts/src/generated/quantify.ts` updates.

- [ ] **Step 8: Commit frontend/display graph changes**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/semantic-state-projection.service.ts apps/quantify/src/modules/llm-strategy-codegen/dto/codegen-session.response.dto.ts apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/semantic-state-projection.service.spec.ts apps/front/src/lib/api.ts apps/front/src/components/ai-quant/DisplayLogicGraphPreview.tsx apps/front/src/components/ai-quant/LogicGraphPreview.tsx apps/front/src/components/ai-quant/display-logic-graph-atomic-contract.test.tsx packages/api-contracts/src/generated/quantify.ts
git commit -F - <<'MSG'
feat: render atomic contract logic graph

变更说明：
- 由 apps/quantify 输出 atomic display graph，前端优先渲染该结构。
- 增加组合条件、风控、仓位和 context 的逻辑图展示测试。

Refs: #960
MSG
```

## Task 10: End-to-End Conversation, Backtest, Deploy Guardrails

**Files:**
- Modify: `apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts`
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.test.tsx`
- Modify: `apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.deploy-guard.test.tsx`
- Modify: `docs/testing/reports/2026-05-05-ai-quant-atomic-contract-execution-upgrade-verification.md`

- [ ] **Step 1: Add conversation-level tests for no early recommendations**

Append to `codegen-conversation.service.spec.ts`:

```ts
it.each([
  'ETH 15分钟触碰布林带下轨，并且成交量高于过去 20 根均量的 1.5 倍时买入，上轨卖出。',
  'ETH 1小时突破 MA20 买入，止损设为 2 倍 ATR，盈利达到 3 倍 ATR 后止盈',
  'BTC 1小时 MA50 在 MA200 上方时，只在 RSI 跌破 35 后重新上穿 35 买入，RSI 超过 65 卖出。',
])('does not recommend replacement strategy before atomic contract projection for %s', async (message) => {
  const result = await service.startSession({ message, userId: 'user-1' })

  expect(result.unsupportedFallback).toBeNull()
  expect(result.assistantPrompt).not.toContain('是否改用')
  expect(result.semanticState?.triggers?.length ?? 0).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Add frontend state preservation test**

Append to `AiQuantPageClient.test.tsx`:

```tsx
it('preserves atomic display graph after codegen response', async () => {
  mockContinueSession.mockResolvedValueOnce({
    assistantPrompt: '我已识别组合条件，请确认逻辑图。',
    semanticGraph: { version: 1 },
    displayLogicGraph: {
      blocks: [
        { type: 'IF', items: [{ kind: 'condition', id: 'c1', text: '成交量高于过去 20 根均量的 1.5 倍' }] },
      ],
    },
    publishedSnapshotId: null,
  })

  render(<AiQuantPageClient lng="zh" />)
  await userEvent.type(screen.getByRole('textbox'), 'ETH 15分钟触碰布林带下轨，并且成交量高于过去 20 根均量的 1.5 倍时买入，上轨卖出。')
  await userEvent.click(screen.getByRole('button', { name: /发送/ }))

  expect(await screen.findByText('成交量高于过去 20 根均量的 1.5 倍')).toBeInTheDocument()
})
```

Adapt mock names to the local test setup.

- [ ] **Step 3: Add verification report template**

Create `docs/testing/reports/2026-05-05-ai-quant-atomic-contract-execution-upgrade-verification.md`:

```md
# AI Quant Atomic Contract Execution Upgrade Verification

## Scope

- apps/quantify semantic extraction/readiness/canonical/IR/script
- apps/quantify backtest and runtime signal parity
- apps/quantify/prisma snapshot persistence
- apps/front display graph and deploy guard UI

## Required Commands

- dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-combination-semantics.spec.ts
- dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-canonical-ir.spec.ts
- dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-script-emitter.spec.ts
- dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-backtest-runtime-parity.spec.ts
- dx test unit front apps/front/src/components/ai-quant/display-logic-graph-atomic-contract.test.tsx
- dx build quantify --dev
- dx build contracts --dev
```

- [ ] **Step 4: Run final targeted verification**

Run:

```bash
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-combination-semantics.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-canonical-ir.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-script-emitter.spec.ts
dx test unit quantify apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/atomic-contract-backtest-runtime-parity.spec.ts
dx test unit front apps/front/src/components/ai-quant/display-logic-graph-atomic-contract.test.tsx
dx build quantify --dev
dx build contracts --dev
```

Expected: PASS.

- [ ] **Step 5: Commit final guardrails**

```bash
git add apps/quantify/src/modules/llm-strategy-codegen/services/__tests__/codegen-conversation.service.spec.ts apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.test.tsx apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.deploy-guard.test.tsx docs/testing/reports/2026-05-05-ai-quant-atomic-contract-execution-upgrade-verification.md
git commit -F - <<'MSG'
test: guard atomic contract execution end to end

变更说明：
- 增加组合策略不会提前推荐替代策略的会话级测试。
- 增加前端 atomic display graph 状态保持测试与验证报告。

Refs: #960
MSG
```

## Final Verification

- [ ] **Step 1: Run affected lint**

```bash
dx lint
```

Expected: PASS.

- [ ] **Step 2: Run quantify build**

```bash
dx build quantify --dev
```

Expected: PASS.

- [ ] **Step 3: Run front unit tests for AI Quant**

```bash
dx test unit front apps/front/src/components/ai-quant/display-logic-graph-atomic-contract.test.tsx
dx test unit front apps/front/src/app/[lng]/ai-quant/AiQuantPageClient.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Run contracts build**

```bash
dx build contracts --dev
```

Expected: PASS.

- [ ] **Step 5: Check git status**

```bash
git status --short
```

Expected: no uncommitted changes.
