/**
 * price.candle_pattern atom 七层 parity spec
 *
 * 覆盖：
 * 1. atom registry: supported_executable + executableSinceVersion + requiredParams
 * 2. seed extractor: 4 patterns 提取；主观文本负向；非白名单形态 → open_slot.pattern
 * 3. semantic state: trigger 状态构建
 * 4. readiness: 满参 → not blocking；缺参 → open_slots
 * 5. canonical spec builder: price.candle_pattern atom condition 输出
 * 6. IR compiler: CANDLE_PATTERN 系列 + EQ predicate
 * 7. display + clarification renderer
 */

import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'
import { SemanticPresentationRegistryService } from '../semantic-presentation-registry.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticSupportClassifierService } from '../semantic-support-classifier.service'

const atomRegistry = new SemanticAtomRegistryService()
const seedExtractor = new SemanticSeedExtractorService()
const seedStateBuilder = new SemanticSeedStateBuilderService()
const supportClassifier = new SemanticSupportClassifierService(atomRegistry)
const readiness = new SemanticContractReadinessService()
const canonicalBuilder = new CanonicalSpecBuilderService()
const irCompiler = new CanonicalSpecV2IrCompilerService()
const presentationRegistry = new SemanticPresentationRegistryService(atomRegistry)

// 满参 utterances（一种 pattern 各一句）
const ENGULFING_BULLISH_UTTERANCE = 'OKX 合约 BTCUSDT 15m，出现看涨吞没形态后开多，5% 止损，单笔 10%。'
const HAMMER_BEARISH_UTTERANCE = 'OKX 合约 BTCUSDT 15m，bearish hammer 形态确认后开空，5% 止损，单笔 10%。'
const DOJI_BULLISH_UTTERANCE = 'OKX 合约 BTCUSDT 15m，bullish doji 形态出现时开多，5% 止损，单笔 10%。'
const CONSECUTIVE_BODY_BULLISH_UTTERANCE = 'OKX 合约 BTCUSDT 15m，bullish consecutive body 连续 3 根后做多，5% 止损，单笔 10%。'

describe('price.candle_pattern atom 七层 parity', () => {
  // ─── Layer 1: atom registry ──────────────────────────────────────────────────

  describe('Layer 1 — atom registry', () => {
    it('price.candle_pattern is supported_executable', () => {
      const atom = atomRegistry.get('price.candle_pattern')
      expect(atom.supportStatus).toBe('supported_executable')
    })

    it('executableSinceVersion is 2026.05.W02', () => {
      const atom = atomRegistry.get('price.candle_pattern') as { executableSinceVersion?: string }
      expect(atom.executableSinceVersion).toBe('2026.05.W02')
    })

    it('requiredParams includes pattern and direction', () => {
      const atom = atomRegistry.get('price.candle_pattern')
      expect(atom.requiredParams).toContain('pattern')
      expect(atom.requiredParams).toContain('direction')
    })

    it('category is trigger', () => {
      const atom = atomRegistry.get('price.candle_pattern')
      expect(atom.category).toBe('trigger')
    })

    it('executableProjection includes canonical_spec_v2', () => {
      const atom = atomRegistry.get('price.candle_pattern')
      expect(atom.executableProjection).toEqual(expect.arrayContaining(['canonical_spec_v2']))
    })
  })

  // ─── Layer 2: seed extractor ─────────────────────────────────────────────────

  describe('Layer 2 — seed extractor', () => {
    it('engulfing bullish: pattern=engulfing, direction=bullish, status=locked', () => {
      const patch = seedExtractor.extract(ENGULFING_BULLISH_UTTERANCE)
      const trigger = patch.triggers?.find(t => t.key === 'price.candle_pattern')
      expect(trigger).toBeDefined()
      expect(trigger?.params?.pattern).toBe('engulfing')
      expect(trigger?.params?.direction).toBe('bullish')
      expect(trigger?.status).toBe('locked')
      expect(trigger?.openSlots).toEqual([])
    })

    it('hammer bearish: pattern=hammer, direction=bearish, status=locked', () => {
      const patch = seedExtractor.extract(HAMMER_BEARISH_UTTERANCE)
      const trigger = patch.triggers?.find(t => t.key === 'price.candle_pattern')
      expect(trigger).toBeDefined()
      expect(trigger?.params?.pattern).toBe('hammer')
      expect(trigger?.params?.direction).toBe('bearish')
      expect(trigger?.status).toBe('locked')
      expect(trigger?.openSlots).toEqual([])
    })

    it('doji bullish: pattern=doji, direction=bullish, status=locked', () => {
      const patch = seedExtractor.extract(DOJI_BULLISH_UTTERANCE)
      const trigger = patch.triggers?.find(t => t.key === 'price.candle_pattern')
      expect(trigger).toBeDefined()
      expect(trigger?.params?.pattern).toBe('doji')
      expect(trigger?.params?.direction).toBe('bullish')
      expect(trigger?.status).toBe('locked')
      expect(trigger?.openSlots).toEqual([])
    })

    it('consecutive_body bullish minBars=3: pattern=consecutive_body, direction=bullish, minBars=3, status=locked', () => {
      const patch = seedExtractor.extract(CONSECUTIVE_BODY_BULLISH_UTTERANCE)
      const trigger = patch.triggers?.find(t => t.key === 'price.candle_pattern')
      expect(trigger).toBeDefined()
      expect(trigger?.params?.pattern).toBe('consecutive_body')
      expect(trigger?.params?.direction).toBe('bullish')
      expect(trigger?.params?.minBars).toBe(3)
      expect(trigger?.status).toBe('locked')
      expect(trigger?.openSlots).toEqual([])
    })

    it('negative: "看起来像锤子" 主观文本 → 不产生 price.candle_pattern trigger (A-M1 同款)', () => {
      const patch = seedExtractor.extract('OKX 合约 BTCUSDT 15m，K 线看起来像锤子，MA20 开多，5% 止损。')
      const trigger = patch.triggers?.find(t => t.key === 'price.candle_pattern')
      expect(trigger).toBeUndefined()
    })

    it('negative: "疑似吞没" 主观文本 → 不产生 price.candle_pattern trigger', () => {
      const patch = seedExtractor.extract('OKX 合约 BTCUSDT 15m，疑似吞没形态，观望，MA20 开多。')
      const trigger = patch.triggers?.find(t => t.key === 'price.candle_pattern')
      expect(trigger).toBeUndefined()
    })

    it('negative: 非白名单形态（三只乌鸦）→ 不产生 price.candle_pattern trigger，走 price.pattern open_slot', () => {
      // 三只乌鸦是图形形态，不在 candle_pattern 白名单；seed extractor 应把含有 "形态/pattern" 的文本
      // 路由到 price.pattern unsupported，而不是产生 price.candle_pattern trigger
      const patch = seedExtractor.extract('OKX 合约 BTCUSDT 15m，出现三只乌鸦形态后开空，5% 止损。')
      const candleTrigger = patch.triggers?.find(t => t.key === 'price.candle_pattern')
      expect(candleTrigger).toBeUndefined()
    })

    it('consecutive_body missing minBars → open_slot for price.candle_pattern.minBars', () => {
      const patch = seedExtractor.extract('OKX 合约 BTCUSDT 15m，bullish consecutive body 后做多，5% 止损。')
      const trigger = patch.triggers?.find(t => t.key === 'price.candle_pattern')
      expect(trigger).toBeDefined()
      const slotKeys = trigger?.openSlots?.map(s => s.slotKey) ?? []
      expect(slotKeys).toContain('price.candle_pattern.minBars')
    })
  })

  // ─── Layer 3: semantic state ─────────────────────────────────────────────────

  describe('Layer 3 — semantic state builder', () => {
    it('builds price.candle_pattern trigger in semantic state (engulfing bullish)', () => {
      const patch = seedExtractor.extract(ENGULFING_BULLISH_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const trigger = state?.triggers?.find(t => t.key === 'price.candle_pattern')
      expect(trigger).toBeDefined()
      expect(trigger?.params?.pattern).toBe('engulfing')
      expect(trigger?.params?.direction).toBe('bullish')
    })

    it('trigger status is locked for full engulfing utterance', () => {
      const patch = seedExtractor.extract(ENGULFING_BULLISH_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      const trigger = state?.triggers?.find(t => t.key === 'price.candle_pattern')
      expect(trigger?.status).toBe('locked')
    })
  })

  // ─── Layer 4: readiness ──────────────────────────────────────────────────────

  describe('Layer 4 — readiness gate', () => {
    it('engulfing bullish full params → not in unsupportedAtoms', () => {
      const patch = seedExtractor.extract(ENGULFING_BULLISH_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = supportClassifier.classify(state!)
      const unsupportedKeys = classified.unsupportedAtoms.map(a => a.key)
      expect(unsupportedKeys).not.toContain('price.candle_pattern')
    })

    it('engulfing bullish full params → no open_slots for candle_pattern', () => {
      const patch = seedExtractor.extract(ENGULFING_BULLISH_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = supportClassifier.classify(state!)
      const openSlotKeys = classified.openSlots.map(s => s.slotKey)
      expect(openSlotKeys).not.toContain('price.candle_pattern.pattern')
      expect(openSlotKeys).not.toContain('price.candle_pattern.direction')
    })
  })

  // ─── Layer 5: canonical spec builder ────────────────────────────────────────

  describe('Layer 5 — canonical spec builder', () => {
    it('engulfing bullish: produces rule with atom key price.candle_pattern', () => {
      const state = seedStateBuilder.build({
        triggers: [{
          id: 'entry-candle-engulfing',
          key: 'price.candle_pattern',
          phase: 'entry',
          sideScope: 'long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          params: { pattern: 'engulfing', direction: 'bullish' },
        }],
        actions: [
          { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
        ],
      })
      expect(state).not.toBeNull()
      const spec = canonicalBuilder.buildFromSemanticState(state!)
      function collectKeys(node: unknown): string[] {
        if (!node || typeof node !== 'object') return []
        const n = node as Record<string, unknown>
        if (typeof n['key'] === 'string') return [n['key']]
        if (Array.isArray(n['children'])) return (n['children'] as unknown[]).flatMap(c => collectKeys(c))
        return []
      }
      const allConditionKeys = spec.rules.flatMap(r => collectKeys(r.condition))
      expect(allConditionKeys).toContain('price.candle_pattern')
    })

    it('engulfing bullish: condition params carry pattern=engulfing, direction=bullish', () => {
      const state = seedStateBuilder.build({
        triggers: [{
          id: 'entry-candle-engulfing',
          key: 'price.candle_pattern',
          phase: 'entry',
          sideScope: 'long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          params: { pattern: 'engulfing', direction: 'bullish' },
        }],
        actions: [
          { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
          { id: 'close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
        ],
      })
      expect(state).not.toBeNull()
      const spec = canonicalBuilder.buildFromSemanticState(state!)
      function findCandleAtom(node: unknown): Record<string, unknown> | null {
        if (!node || typeof node !== 'object') return null
        const n = node as Record<string, unknown>
        if (n['key'] === 'price.candle_pattern') return n
        if (Array.isArray(n['children'])) {
          for (const c of n['children'] as unknown[]) {
            const found = findCandleAtom(c)
            if (found) return found
          }
        }
        return null
      }
      const rule = spec.rules.find(r => findCandleAtom(r.condition))
      expect(rule).toBeDefined()
      const atom = findCandleAtom(rule!.condition)
      const params = atom?.['params'] as Record<string, unknown> | undefined
      expect(params?.pattern).toBe('engulfing')
      expect(params?.direction).toBe('bullish')
    })

    it('consecutive_body bullish: condition carries minBars=3', () => {
      const state = seedStateBuilder.build({
        triggers: [{
          id: 'entry-candle-consec',
          key: 'price.candle_pattern',
          phase: 'entry',
          sideScope: 'long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          params: { pattern: 'consecutive_body', direction: 'bullish', minBars: 3 },
        }],
        actions: [
          { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
          { id: 'close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
        ],
      })
      expect(state).not.toBeNull()
      const spec = canonicalBuilder.buildFromSemanticState(state!)
      function findCandleAtom(node: unknown): Record<string, unknown> | null {
        if (!node || typeof node !== 'object') return null
        const n = node as Record<string, unknown>
        if (n['key'] === 'price.candle_pattern') return n
        if (Array.isArray(n['children'])) {
          for (const c of n['children'] as unknown[]) {
            const found = findCandleAtom(c)
            if (found) return found
          }
        }
        return null
      }
      const rule = spec.rules.find(r => findCandleAtom(r.condition))
      expect(rule).toBeDefined()
      const atom = findCandleAtom(rule!.condition)
      const params = atom?.['params'] as Record<string, unknown> | undefined
      expect(params?.minBars).toBe(3)
    })
  })

  // ─── Layer 6: IR compiler ────────────────────────────────────────────────────

  describe('Layer 6 — IR compiler', () => {
    function buildStateWithCandle(pattern: string, direction: string, minBars?: number) {
      return seedStateBuilder.build({
        triggers: [{
          id: `entry-candle-${pattern}`,
          key: 'price.candle_pattern',
          phase: 'entry',
          sideScope: direction === 'bullish' ? 'long' : 'short',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          params: {
            pattern,
            direction,
            ...(minBars !== undefined ? { minBars } : {}),
          },
        }],
        actions: [
          { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
          { id: 'close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
        ],
      })
    }

    it('engulfing bullish: IR series contain CANDLE_PATTERN kind', () => {
      const state = buildStateWithCandle('engulfing', 'bullish')
      expect(state).not.toBeNull()
      const spec = canonicalBuilder.buildFromSemanticState(state!)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '15m', positionPct: 10 },
      })
      const allSeriesKinds = ir.signalCatalog.series.map(s => s.kind)
      expect(allSeriesKinds).toContain('CANDLE_PATTERN')
    })

    it('engulfing bullish: CANDLE_PATTERN series params carry pattern=engulfing, direction=bullish', () => {
      const state = buildStateWithCandle('engulfing', 'bullish')
      expect(state).not.toBeNull()
      const spec = canonicalBuilder.buildFromSemanticState(state!)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '15m', positionPct: 10 },
      })
      const series = ir.signalCatalog.series.find(s => s.kind === 'CANDLE_PATTERN')
      expect(series).toBeDefined()
      expect(series?.params?.pattern).toBe('engulfing')
      expect(series?.params?.direction).toBe('bullish')
    })

    it('consecutive_body bullish minBars=3: CANDLE_PATTERN series carries minBars=3', () => {
      const state = buildStateWithCandle('consecutive_body', 'bullish', 3)
      expect(state).not.toBeNull()
      const spec = canonicalBuilder.buildFromSemanticState(state!)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '15m', positionPct: 10 },
      })
      const series = ir.signalCatalog.series.find(s => s.kind === 'CANDLE_PATTERN')
      expect(series).toBeDefined()
      expect(series?.params?.minBars).toBe(3)
    })

    it('CANDLE_PATTERN predicate uses EQ operator', () => {
      const state = buildStateWithCandle('hammer', 'bearish')
      expect(state).not.toBeNull()
      const spec = canonicalBuilder.buildFromSemanticState(state!)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '15m', positionPct: 10 },
      })
      const predicate = ir.signalCatalog.predicates.find(
        (p: { id: string; op?: string }) => p.id.includes('candle_pattern'),
      )
      expect(predicate).toBeDefined()
      expect((predicate as { op?: string })?.op).toBe('EQ')
    })

    it('runtimeRequirements.helpers includes candlePatternDetector', () => {
      const state = buildStateWithCandle('doji', 'bullish')
      expect(state).not.toBeNull()
      const spec = canonicalBuilder.buildFromSemanticState(state!)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '15m', positionPct: 10 },
      })
      expect(ir.runtimeRequirements.helpers).toContain('candlePatternDetector')
    })
  })

  // ─── Layer 7: display + clarification renderer ───────────────────────────────

  describe('Layer 7 — display + clarification renderer', () => {
    it('displayRenderer: engulfing bullish → "看涨吞没形态"', () => {
      const display = presentationRegistry.renderDisplay('price.candle_pattern', {
        pattern: 'engulfing',
        direction: 'bullish',
      })
      expect(display).toContain('看涨')
      expect(display).toContain('吞没')
    })

    it('displayRenderer: hammer bearish → "看跌锤子线形态"', () => {
      const display = presentationRegistry.renderDisplay('price.candle_pattern', {
        pattern: 'hammer',
        direction: 'bearish',
      })
      expect(display).toContain('看跌')
      expect(display).toContain('锤子线')
    })

    it('displayRenderer: consecutive_body bullish minBars=3 → mentions "≥3"', () => {
      const display = presentationRegistry.renderDisplay('price.candle_pattern', {
        pattern: 'consecutive_body',
        direction: 'bullish',
        minBars: 3,
      })
      expect(display).toContain('连续实体')
      expect(display).toContain('3')
    })

    it('displayRenderer: doji bullish → "看涨十字星形态"', () => {
      const display = presentationRegistry.renderDisplay('price.candle_pattern', {
        pattern: 'doji',
        direction: 'bullish',
      })
      expect(display).toContain('十字星')
    })

    it('publicName is K 线形态', () => {
      const entry = presentationRegistry.getEntry('price.candle_pattern')
      expect(entry?.publicName).toBe('K 线形态')
    })

    it('goldenUtterances has ≥ 4 entries', () => {
      const entry = presentationRegistry.getEntry('price.candle_pattern')
      expect(entry?.goldenUtterances?.length).toBeGreaterThanOrEqual(4)
    })

    it('clarificationRenderer: price.candle_pattern.pattern slot → pattern selection prompt', () => {
      const text = presentationRegistry.renderClarification('price.candle_pattern', 'price.candle_pattern.pattern', {})
      expect(typeof text).toBe('string')
      expect(text.length).toBeGreaterThan(0)
      expect(text).toContain('engulfing')
    })

    it('clarificationRenderer: price.candle_pattern.direction slot → direction prompt', () => {
      const text = presentationRegistry.renderClarification('price.candle_pattern', 'price.candle_pattern.direction', {})
      expect(typeof text).toBe('string')
      expect(text).toContain('bullish')
    })

    it('clarificationRenderer: price.candle_pattern.minBars slot → minBars prompt', () => {
      const text = presentationRegistry.renderClarification('price.candle_pattern', 'price.candle_pattern.minBars', {})
      expect(typeof text).toBe('string')
      expect(text).toContain('minBars')
    })
  })
})
