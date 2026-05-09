/**
 * liquidity.sweep atom 七层 parity spec
 *
 * 覆盖：
 * 1. atom registry: supported_executable + executableSinceVersion + requiredParams
 * 2. seed extractor: 4 reference 提取；主观文本负向；非白名单 reference → open_slot
 * 3. semantic state: trigger 状态构建
 * 4. readiness: 满参 → not blocking；缺参 → open_slots
 * 5. canonical spec builder: liquidity.sweep atom condition 输出
 * 6. IR compiler: LIQUIDITY_SWEEP 系列 + EQ predicate
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

// 满参 utterances（reference / direction 各典型一句）
const PREV_LOW_BULLISH_UTTERANCE = 'OKX 合约 BTCUSDT 15m，扫前低后 3 根内反弹做多，5% 止损，单笔 10%。'
const PREV_HIGH_BEARISH_UTTERANCE = 'OKX 合约 BTCUSDT 15m，bearish liquidity sweep at prev high, reclaim within 3 bars, open short, 5% stop loss, position 10%.'
const SESSION_LOW_BULLISH_UTTERANCE = 'OKX 合约 BTCUSDT 15m，session low 流动性扫荡 reclaim 5 根后做多，5% 止损。'
const SESSION_HIGH_BEARISH_UTTERANCE = 'OKX BTCUSDT 15m, bearish stop hunt at session high, reclaim within 3 bars, open short, 5% stop loss, position 10%.'

function buildCanonicalSpecFromUtterance(utterance: string) {
  const patch = seedExtractor.extract(utterance)
  const state = seedStateBuilder.build(patch)
  expect(state).not.toBeNull()
  const classified = supportClassifier.classify(state!)
  const normalized = readiness.normalize(classified.state)
  return canonicalBuilder.buildFromSemanticState(normalized.state)
}

function collectConditionKeys(node: unknown): string[] {
  if (!node || typeof node !== 'object') return []
  const n = node as Record<string, unknown>
  const ownKeys = typeof n['key'] === 'string' ? [n['key']] : []
  const nestedConditions = Array.isArray(n['conditions'])
    ? (n['conditions'] as unknown[]).flatMap(c => collectConditionKeys(c))
    : []
  const nestedChildren = Array.isArray(n['children'])
    ? (n['children'] as unknown[]).flatMap(c => collectConditionKeys(c))
    : []
  return [...ownKeys, ...nestedConditions, ...nestedChildren]
}

function findSweepAtom(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null
  const n = node as Record<string, unknown>
  if (n['key'] === 'liquidity.sweep') return n
  const nested = [
    ...(Array.isArray(n['conditions']) ? n['conditions'] as unknown[] : []),
    ...(Array.isArray(n['children']) ? n['children'] as unknown[] : []),
  ]
  for (const child of nested) {
    const found = findSweepAtom(child)
    if (found) return found
  }
  return null
}

describe('liquidity.sweep atom 七层 parity', () => {
  // ─── Layer 1: atom registry ──────────────────────────────────────────────────

  describe('Layer 1 — atom registry', () => {
    it('liquidity.sweep is supported_executable', () => {
      const atom = atomRegistry.get('liquidity.sweep')
      expect(atom.supportStatus).toBe('supported_executable')
    })

    it('executableSinceVersion is 2026.05.W02', () => {
      const atom = atomRegistry.get('liquidity.sweep') as { executableSinceVersion?: string }
      expect(atom.executableSinceVersion).toBe('2026.05.W02')
    })

    it('requiredParams includes direction and reference', () => {
      const atom = atomRegistry.get('liquidity.sweep')
      expect(atom.requiredParams).toContain('direction')
      expect(atom.requiredParams).toContain('reference')
    })

    it('category is trigger', () => {
      const atom = atomRegistry.get('liquidity.sweep')
      expect(atom.category).toBe('trigger')
    })

    it('executableProjection includes canonical_spec_v2', () => {
      const atom = atomRegistry.get('liquidity.sweep')
      expect(atom.executableProjection).toEqual(expect.arrayContaining(['canonical_spec_v2']))
    })
  })

  // ─── Layer 2: seed extractor ─────────────────────────────────────────────────

  describe('Layer 2 — seed extractor', () => {
    it('扫前低 bullish reclaim 3: direction=bullish, reference=prev_low, reclaimBars=3, status=locked', () => {
      const patch = seedExtractor.extract(PREV_LOW_BULLISH_UTTERANCE)
      const trigger = patch.triggers?.find(t => t.key === 'liquidity.sweep')
      expect(trigger).toBeDefined()
      expect(trigger?.params?.direction).toBe('bullish')
      expect(trigger?.params?.reference).toBe('prev_low')
      expect(trigger?.params?.reclaimBars).toBe(3)
      expect(trigger?.status).toBe('locked')
      expect(trigger?.openSlots).toEqual([])
    })

    it('en prev high bearish: direction=bearish, reference=prev_high, status=locked', () => {
      const patch = seedExtractor.extract(PREV_HIGH_BEARISH_UTTERANCE)
      const trigger = patch.triggers?.find(t => t.key === 'liquidity.sweep')
      expect(trigger).toBeDefined()
      expect(trigger?.params?.direction).toBe('bearish')
      expect(trigger?.params?.reference).toBe('prev_high')
      expect(trigger?.status).toBe('locked')
      expect(trigger?.openSlots).toEqual([])
    })

    it('session_low bullish reclaim 5: direction=bullish (intrinsic from ref), reference=session_low', () => {
      const patch = seedExtractor.extract(SESSION_LOW_BULLISH_UTTERANCE)
      const trigger = patch.triggers?.find(t => t.key === 'liquidity.sweep')
      expect(trigger).toBeDefined()
      expect(trigger?.params?.direction).toBe('bullish')
      expect(trigger?.params?.reference).toBe('session_low')
      expect(trigger?.params?.reclaimBars).toBe(5)
      expect(trigger?.status).toBe('locked')
    })

    it('en session_high bearish stop hunt: direction=bearish, reference=session_high', () => {
      const patch = seedExtractor.extract(SESSION_HIGH_BEARISH_UTTERANCE)
      const trigger = patch.triggers?.find(t => t.key === 'liquidity.sweep')
      expect(trigger).toBeDefined()
      expect(trigger?.params?.direction).toBe('bearish')
      expect(trigger?.params?.reference).toBe('session_high')
      expect(trigger?.status).toBe('locked')
    })

    it('negative: "看起来像扫荡" 主观文本 → 不产生 liquidity.sweep trigger', () => {
      const patch = seedExtractor.extract('OKX 合约 BTCUSDT 15m，K 线看起来像流动性扫荡，但不确定，MA20 开多，5% 止损。')
      const trigger = patch.triggers?.find(t => t.key === 'liquidity.sweep')
      expect(trigger).toBeUndefined()
    })

    it('negative: English subjective phrases → 不产生 liquidity.sweep trigger', () => {
      const utterances = [
        'OKX BTCUSDT 15m, looks like a liquidity sweep, open long after MA20 confirmation.',
        'OKX BTCUSDT 15m, kind of stop hunt here, wait for confirmation.',
        'OKX BTCUSDT 15m, maybe sweep, hold off.',
      ]
      for (const utterance of utterances) {
        const patch = seedExtractor.extract(utterance)
        const trigger = patch.triggers?.find(t => t.key === 'liquidity.sweep')
        expect(trigger).toBeUndefined()
      }
    })

    it('sweep without explicit reference → open_slot for reference', () => {
      const patch = seedExtractor.extract('OKX 合约 BTCUSDT 15m，假突破后入场，5% 止损。')
      const trigger = patch.triggers?.find(t => t.key === 'liquidity.sweep')
      expect(trigger).toBeDefined()
      expect(trigger?.params?.reference).toBeUndefined()
      expect(trigger?.status).toBe('open')
      expect(trigger?.openSlots).toEqual(expect.arrayContaining([
        expect.objectContaining({ slotKey: 'liquidity.sweep.reference' }),
      ]))
    })

    // critic round 1 A1 回归：缺方向时 sideScope 必须为 undefined，不得静默归类为 long
    it('A1 sideScope undefined when direction is missing (假突破)', () => {
      const patch = seedExtractor.extract('OKX 合约 BTCUSDT 15m，假突破后入场，5% 止损。')
      const trigger = patch.triggers?.find(t => t.key === 'liquidity.sweep')
      expect(trigger).toBeDefined()
      expect(trigger?.params?.direction).toBeUndefined()
      expect(trigger?.sideScope).toBeUndefined()
    })

    // critic round 1 A2 回归：explicit direction 与 ref-derived direction 冲突 → 丢弃 direction，
    // open_slot.direction 提示冲突；不让 explicit 静默覆盖 ref-derived
    it('A2 direction conflict (bearish + prev low) → drop direction, open_slot with conflict hint', () => {
      const patch = seedExtractor.extract('OKX BTCUSDT 15m, bearish liquidity sweep at prev low, reclaim within 3 bars, open short, 5% stop loss.')
      const trigger = patch.triggers?.find(t => t.key === 'liquidity.sweep')
      expect(trigger).toBeDefined()
      expect(trigger?.params?.direction).toBeUndefined()
      expect(trigger?.params?.reference).toBe('prev_low')
      expect(trigger?.status).toBe('open')
      const directionSlot = trigger?.openSlots?.find(s => s.slotKey === 'liquidity.sweep.direction')
      expect(directionSlot?.questionHint).toContain('冲突')
    })
  })

  // ─── Layer 3: semantic state ─────────────────────────────────────────────────

  describe('Layer 3 — semantic state builder', () => {
    it('builds liquidity.sweep trigger in semantic state (prev_low bullish)', () => {
      const patch = seedExtractor.extract(PREV_LOW_BULLISH_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const trigger = state?.triggers?.find(t => t.key === 'liquidity.sweep')
      expect(trigger).toBeDefined()
      expect(trigger?.params?.direction).toBe('bullish')
      expect(trigger?.params?.reference).toBe('prev_low')
    })

    it('trigger status is locked for full prev_low utterance', () => {
      const patch = seedExtractor.extract(PREV_LOW_BULLISH_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      const trigger = state?.triggers?.find(t => t.key === 'liquidity.sweep')
      expect(trigger?.status).toBe('locked')
    })
  })

  // ─── Layer 4: readiness ──────────────────────────────────────────────────────

  describe('Layer 4 — readiness gate', () => {
    it('prev_low bullish full params → not in unsupportedAtoms', () => {
      const patch = seedExtractor.extract(PREV_LOW_BULLISH_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = supportClassifier.classify(state!)
      const unsupportedKeys = classified.unsupportedAtoms.map(a => a.key)
      expect(unsupportedKeys).not.toContain('liquidity.sweep')
    })

    it('prev_low bullish full params → no open_slots for liquidity.sweep', () => {
      const patch = seedExtractor.extract(PREV_LOW_BULLISH_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = supportClassifier.classify(state!)
      const openSlotKeys = classified.openSlots.map(s => s.slotKey)
      expect(openSlotKeys).not.toContain('liquidity.sweep.direction')
      expect(openSlotKeys).not.toContain('liquidity.sweep.reference')
    })
  })

  // ─── Layer 5: canonical spec builder ────────────────────────────────────────

  describe('Layer 5 — canonical spec builder', () => {
    it('prev_low bullish: produces rule with atom key liquidity.sweep', () => {
      const spec = buildCanonicalSpecFromUtterance(PREV_LOW_BULLISH_UTTERANCE)
      const allConditionKeys = spec.rules.flatMap(r => collectConditionKeys(r.condition))
      expect(allConditionKeys).toContain('liquidity.sweep')
    })

    it('prev_low bullish: condition params carry direction/reference/reclaimBars', () => {
      const spec = buildCanonicalSpecFromUtterance(PREV_LOW_BULLISH_UTTERANCE)
      const rule = spec.rules.find(r => findSweepAtom(r.condition))
      expect(rule).toBeDefined()
      const atom = findSweepAtom(rule!.condition)
      const params = atom?.['params'] as Record<string, unknown> | undefined
      expect(params?.direction).toBe('bullish')
      expect(params?.reference).toBe('prev_low')
      expect(params?.reclaimBars).toBe(3)
    })

    it('reclaimBars defaults to 3 when not specified', () => {
      const spec = buildCanonicalSpecFromUtterance(PREV_HIGH_BEARISH_UTTERANCE)
      const rule = spec.rules.find(r => findSweepAtom(r.condition))
      expect(rule).toBeDefined()
      const atom = findSweepAtom(rule!.condition)
      const params = atom?.['params'] as Record<string, unknown> | undefined
      expect(params?.reclaimBars).toBe(3)
    })

    // critic round 1 A2 回归：builder 拒绝 4 个 SMC 语义不可能的 direction × reference 组合
    it.each([
      { direction: 'bullish', reference: 'prev_high' },
      { direction: 'bullish', reference: 'session_high' },
      { direction: 'bearish', reference: 'prev_low' },
      { direction: 'bearish', reference: 'session_low' },
    ])('A2 builder rejects impossible combo $direction × $reference', ({ direction, reference }) => {
      const seed = seedStateBuilder.build({
        triggers: [{
          id: 'entry-sweep',
          key: 'liquidity.sweep',
          phase: 'entry',
          sideScope: direction === 'bearish' ? 'short' : 'long',
          status: 'locked',
          source: 'user_explicit',
          openSlots: [],
          params: { direction, reference, reclaimBars: 3 },
        }],
        actions: [{ id: 'open', key: direction === 'bearish' ? 'open_short' : 'open_long', status: 'locked', source: 'user_explicit' }],
      })
      expect(seed).not.toBeNull()
      const spec = canonicalBuilder.buildFromSemanticState(seed!)
      const allConditionKeys = spec.rules.flatMap(r => collectConditionKeys(r.condition))
      expect(allConditionKeys).not.toContain('liquidity.sweep')
    })
  })

  // ─── Layer 6: IR compiler ────────────────────────────────────────────────────

  describe('Layer 6 — IR compiler', () => {
    it('prev_low bullish: IR series contain LIQUIDITY_SWEEP kind', () => {
      const spec = buildCanonicalSpecFromUtterance(PREV_LOW_BULLISH_UTTERANCE)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '15m', positionPct: 10 },
      })
      const allSeriesKinds = ir.signalCatalog.series.map(s => s.kind)
      expect(allSeriesKinds).toContain('LIQUIDITY_SWEEP')
    })

    it('prev_low bullish: LIQUIDITY_SWEEP series carries direction/reference/reclaimBars', () => {
      const spec = buildCanonicalSpecFromUtterance(PREV_LOW_BULLISH_UTTERANCE)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '15m', positionPct: 10 },
      })
      const series = ir.signalCatalog.series.find(s => s.kind === 'LIQUIDITY_SWEEP')
      expect(series).toBeDefined()
      expect(series?.params?.direction).toBe('bullish')
      expect(series?.params?.reference).toBe('prev_low')
      expect(series?.params?.reclaimBars).toBe(3)
    })

    it('LIQUIDITY_SWEEP predicate uses EQ operator', () => {
      const spec = buildCanonicalSpecFromUtterance(PREV_HIGH_BEARISH_UTTERANCE)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '15m', positionPct: 10 },
      })
      const predicate = ir.signalCatalog.predicates.find(
        (p: { id: string; op?: string }) => p.id.includes('liquidity_sweep'),
      )
      expect(predicate).toBeDefined()
      expect((predicate as { kind?: string })?.kind).toBe('EQ')
    })

    it('runtimeRequirements.helpers includes liquiditySweepDetector', () => {
      const spec = buildCanonicalSpecFromUtterance(SESSION_HIGH_BEARISH_UTTERANCE)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '15m', positionPct: 10 },
      })
      expect(ir.runtimeRequirements.helpers).toContain('liquiditySweepDetector')
    })
  })

  // ─── Layer 7: display + clarification renderer ───────────────────────────────

  describe('Layer 7 — display + clarification renderer', () => {
    it('displayRenderer: prev_low bullish reclaim 3 → "看涨流动性扫荡 前低（3 根内 reclaim）"', () => {
      const display = presentationRegistry.renderDisplay('liquidity.sweep', {
        direction: 'bullish',
        reference: 'prev_low',
        reclaimBars: 3,
      })
      expect(display).toContain('看涨')
      expect(display).toContain('前低')
      expect(display).toContain('3')
    })

    it('displayRenderer: prev_high bearish → "看跌流动性扫荡 前高"', () => {
      const display = presentationRegistry.renderDisplay('liquidity.sweep', {
        direction: 'bearish',
        reference: 'prev_high',
      })
      expect(display).toContain('看跌')
      expect(display).toContain('前高')
    })

    it('displayRenderer: session_high bearish → "看跌流动性扫荡 日内高"', () => {
      const display = presentationRegistry.renderDisplay('liquidity.sweep', {
        direction: 'bearish',
        reference: 'session_high',
      })
      expect(display).toContain('日内高')
    })

    it('publicName is 流动性扫荡', () => {
      const entry = presentationRegistry.getEntry('liquidity.sweep')
      expect(entry?.publicName).toBe('流动性扫荡')
    })

    it('goldenUtterances has ≥ 4 entries', () => {
      const entry = presentationRegistry.getEntry('liquidity.sweep')
      expect(entry?.goldenUtterances?.length).toBeGreaterThanOrEqual(4)
    })

    it('clarificationRenderer: liquidity.sweep.direction slot → direction prompt', () => {
      const text = presentationRegistry.renderClarification('liquidity.sweep', 'liquidity.sweep.direction', {})
      expect(typeof text).toBe('string')
      expect(text.length).toBeGreaterThan(0)
      expect(text).toContain('bullish')
    })

    it('clarificationRenderer: liquidity.sweep.reference slot → reference prompt', () => {
      const text = presentationRegistry.renderClarification('liquidity.sweep', 'liquidity.sweep.reference', {})
      expect(typeof text).toBe('string')
      expect(text).toContain('prev_low')
    })
  })
})
