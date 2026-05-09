/**
 * price.chart_pattern atom 七层 parity spec
 *
 * 覆盖：
 * 1. atom registry: supported_executable + executableSinceVersion + requiredParams
 * 2. seed extractor: 4 patterns 提取；主观文本负向；非白名单形态 → price.pattern fallback
 * 3. semantic state: trigger 状态构建
 * 4. readiness: 满参 → not blocking；缺参 → open_slots
 * 5. canonical spec builder: price.chart_pattern atom condition 输出
 * 6. IR compiler: CHART_PATTERN 系列 + EQ predicate
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
const HNS_BULLISH_UTTERANCE = 'OKX 合约 BTCUSDT 1h，出现头肩底形态后开多，5% 止损，单笔 10%。'
const DOUBLE_TOP_UTTERANCE = 'OKX 合约 BTCUSDT 1h，double top 形态确认后开空，5% 止损，单笔 10%。'
const DOUBLE_BOTTOM_UTTERANCE = 'OKX 合约 BTCUSDT 1h，double bottom 形态出现时做多，5% 止损，单笔 10%。'
const TRIANGLE_BULLISH_UTTERANCE = 'OKX 合约 BTCUSDT 1h，bullish triangle breakout 后开多，5% 止损，单笔 10%。'

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

function findChartAtom(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null
  const n = node as Record<string, unknown>
  if (n['key'] === 'price.chart_pattern') return n
  const nested = [
    ...(Array.isArray(n['conditions']) ? n['conditions'] as unknown[] : []),
    ...(Array.isArray(n['children']) ? n['children'] as unknown[] : []),
  ]
  for (const child of nested) {
    const found = findChartAtom(child)
    if (found) return found
  }
  return null
}

describe('price.chart_pattern atom 七层 parity', () => {
  // ─── Layer 1: atom registry ──────────────────────────────────────────────────

  describe('Layer 1 — atom registry', () => {
    it('price.chart_pattern is supported_executable', () => {
      const atom = atomRegistry.get('price.chart_pattern')
      expect(atom.supportStatus).toBe('supported_executable')
    })

    it('executableSinceVersion is 2026.05.W02', () => {
      const atom = atomRegistry.get('price.chart_pattern') as { executableSinceVersion?: string }
      expect(atom.executableSinceVersion).toBe('2026.05.W02')
    })

    it('requiredParams includes pattern and direction', () => {
      const atom = atomRegistry.get('price.chart_pattern')
      expect(atom.requiredParams).toContain('pattern')
      expect(atom.requiredParams).toContain('direction')
    })

    it('category is trigger', () => {
      const atom = atomRegistry.get('price.chart_pattern')
      expect(atom.category).toBe('trigger')
    })

    it('executableProjection includes canonical_spec_v2', () => {
      const atom = atomRegistry.get('price.chart_pattern')
      expect(atom.executableProjection).toEqual(expect.arrayContaining(['canonical_spec_v2']))
    })
  })

  // ─── Layer 2: seed extractor ─────────────────────────────────────────────────

  describe('Layer 2 — seed extractor', () => {
    it('head_and_shoulders bullish (头肩底): pattern=head_and_shoulders, direction=bullish, status=locked', () => {
      const patch = seedExtractor.extract(HNS_BULLISH_UTTERANCE)
      const trigger = patch.triggers?.find(t => t.key === 'price.chart_pattern')
      expect(trigger).toBeDefined()
      expect(trigger?.params?.pattern).toBe('head_and_shoulders')
      expect(trigger?.params?.direction).toBe('bullish')
      expect(trigger?.status).toBe('locked')
      expect(trigger?.openSlots).toEqual([])
    })

    it('double_top: pattern=double_top, direction=bearish (intrinsic), status=locked', () => {
      const patch = seedExtractor.extract(DOUBLE_TOP_UTTERANCE)
      const trigger = patch.triggers?.find(t => t.key === 'price.chart_pattern')
      expect(trigger).toBeDefined()
      expect(trigger?.params?.pattern).toBe('double_top')
      expect(trigger?.params?.direction).toBe('bearish')
      expect(trigger?.status).toBe('locked')
      expect(trigger?.openSlots).toEqual([])
    })

    it('double_bottom: pattern=double_bottom, direction=bullish (intrinsic), status=locked', () => {
      const patch = seedExtractor.extract(DOUBLE_BOTTOM_UTTERANCE)
      const trigger = patch.triggers?.find(t => t.key === 'price.chart_pattern')
      expect(trigger).toBeDefined()
      expect(trigger?.params?.pattern).toBe('double_bottom')
      expect(trigger?.params?.direction).toBe('bullish')
      expect(trigger?.status).toBe('locked')
      expect(trigger?.openSlots).toEqual([])
    })

    it('triangle bullish: pattern=triangle, direction=bullish, status=locked', () => {
      const patch = seedExtractor.extract(TRIANGLE_BULLISH_UTTERANCE)
      const trigger = patch.triggers?.find(t => t.key === 'price.chart_pattern')
      expect(trigger).toBeDefined()
      expect(trigger?.params?.pattern).toBe('triangle')
      expect(trigger?.params?.direction).toBe('bullish')
      expect(trigger?.status).toBe('locked')
      expect(trigger?.openSlots).toEqual([])
    })

    it('negative: "看起来像头肩" 主观文本 → 不产生 price.chart_pattern trigger', () => {
      const patch = seedExtractor.extract('OKX 合约 BTCUSDT 1h，K 线看起来像头肩，MA20 开多，5% 止损。')
      const trigger = patch.triggers?.find(t => t.key === 'price.chart_pattern')
      expect(trigger).toBeUndefined()
    })

    it('negative: "疑似双顶" 主观文本 → 不产生 price.chart_pattern trigger', () => {
      const patch = seedExtractor.extract('OKX 合约 BTCUSDT 1h，疑似双顶形态，观望，MA20 开多。')
      const trigger = patch.triggers?.find(t => t.key === 'price.chart_pattern')
      expect(trigger).toBeUndefined()
    })

    it('negative: English subjective phrases → 不产生 price.chart_pattern trigger', () => {
      const utterances = [
        'OKX BTCUSDT 1h, looks like a bullish triangle, open long only after MA20 confirmation.',
        'OKX BTCUSDT 1h, kind of head and shoulders pattern, wait for confirmation.',
        'OKX BTCUSDT 1h, maybe double bottom, open long later.',
        // critic round 1 P4-3 B1 回归：h&s 主观文本同样应被拒绝
        'OKX BTCUSDT 1h, looks like h&s, wait for MA20 confirmation.',
        'OKX BTCUSDT 1h, kind of bearish h&s here, hold off.',
      ]
      for (const utterance of utterances) {
        const patch = seedExtractor.extract(utterance)
        const trigger = patch.triggers?.find(t => t.key === 'price.chart_pattern')
        expect(trigger).toBeUndefined()
      }
    })

    it('triangle without direction → open_slot for direction', () => {
      const patch = seedExtractor.extract('OKX 合约 BTCUSDT 1h，triangle 形态确认后入场，5% 止损。')
      const trigger = patch.triggers?.find(t => t.key === 'price.chart_pattern')
      expect(trigger).toBeDefined()
      expect(trigger?.params?.pattern).toBe('triangle')
      expect(trigger?.params?.direction).toBeUndefined()
      expect(trigger?.status).toBe('open')
      expect(trigger?.openSlots).toEqual(expect.arrayContaining([
        expect.objectContaining({ slotKey: 'price.chart_pattern.direction' }),
      ]))
    })

    it('negative: 非白名单形态（楔形）→ 不产生 price.chart_pattern trigger，走 price.pattern unsupported', () => {
      const patch = seedExtractor.extract('OKX 合约 BTCUSDT 1h，出现楔形形态后开多，5% 止损。')
      const chartTrigger = patch.triggers?.find(t => t.key === 'price.chart_pattern')
      expect(chartTrigger).toBeUndefined()
      const fallbackTrigger = patch.triggers?.find(t => t.key === 'price.pattern')
      expect(fallbackTrigger).toBeDefined()
    })

    it('白名单 pattern 命中时 price.pattern fallback 被抑制（避免双 trigger）', () => {
      const patch = seedExtractor.extract(HNS_BULLISH_UTTERANCE)
      const chartTrigger = patch.triggers?.find(t => t.key === 'price.chart_pattern')
      expect(chartTrigger).toBeDefined()
      const fallbackTrigger = patch.triggers?.find(t => t.key === 'price.pattern')
      expect(fallbackTrigger).toBeUndefined()
    })
  })

  // ─── Layer 3: semantic state ─────────────────────────────────────────────────

  describe('Layer 3 — semantic state builder', () => {
    it('builds price.chart_pattern trigger in semantic state (head_and_shoulders bullish)', () => {
      const patch = seedExtractor.extract(HNS_BULLISH_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const trigger = state?.triggers?.find(t => t.key === 'price.chart_pattern')
      expect(trigger).toBeDefined()
      expect(trigger?.params?.pattern).toBe('head_and_shoulders')
      expect(trigger?.params?.direction).toBe('bullish')
    })

    it('trigger status is locked for full HNS utterance', () => {
      const patch = seedExtractor.extract(HNS_BULLISH_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      const trigger = state?.triggers?.find(t => t.key === 'price.chart_pattern')
      expect(trigger?.status).toBe('locked')
    })
  })

  // ─── Layer 4: readiness ──────────────────────────────────────────────────────

  describe('Layer 4 — readiness gate', () => {
    it('HNS bullish full params → not in unsupportedAtoms', () => {
      const patch = seedExtractor.extract(HNS_BULLISH_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = supportClassifier.classify(state!)
      const unsupportedKeys = classified.unsupportedAtoms.map(a => a.key)
      expect(unsupportedKeys).not.toContain('price.chart_pattern')
    })

    it('HNS bullish full params → no open_slots for chart_pattern', () => {
      const patch = seedExtractor.extract(HNS_BULLISH_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = supportClassifier.classify(state!)
      const openSlotKeys = classified.openSlots.map(s => s.slotKey)
      expect(openSlotKeys).not.toContain('price.chart_pattern.pattern')
      expect(openSlotKeys).not.toContain('price.chart_pattern.direction')
    })
  })

  // ─── Layer 5: canonical spec builder ────────────────────────────────────────

  describe('Layer 5 — canonical spec builder', () => {
    it('HNS bullish: produces rule with atom key price.chart_pattern', () => {
      const spec = buildCanonicalSpecFromUtterance(HNS_BULLISH_UTTERANCE)
      const allConditionKeys = spec.rules.flatMap(r => collectConditionKeys(r.condition))
      expect(allConditionKeys).toContain('price.chart_pattern')
    })

    it('HNS bullish: condition params carry pattern=head_and_shoulders, direction=bullish', () => {
      const spec = buildCanonicalSpecFromUtterance(HNS_BULLISH_UTTERANCE)
      const rule = spec.rules.find(r => findChartAtom(r.condition))
      expect(rule).toBeDefined()
      const atom = findChartAtom(rule!.condition)
      const params = atom?.['params'] as Record<string, unknown> | undefined
      expect(params?.pattern).toBe('head_and_shoulders')
      expect(params?.direction).toBe('bullish')
    })

    it('double_top bearish: condition params carry pattern=double_top, direction=bearish', () => {
      const spec = buildCanonicalSpecFromUtterance(DOUBLE_TOP_UTTERANCE)
      const rule = spec.rules.find(r => findChartAtom(r.condition))
      expect(rule).toBeDefined()
      const atom = findChartAtom(rule!.condition)
      const params = atom?.['params'] as Record<string, unknown> | undefined
      expect(params?.pattern).toBe('double_top')
      expect(params?.direction).toBe('bearish')
    })
  })

  // ─── Layer 6: IR compiler ────────────────────────────────────────────────────

  describe('Layer 6 — IR compiler', () => {
    it('HNS bullish: IR series contain CHART_PATTERN kind', () => {
      const spec = buildCanonicalSpecFromUtterance(HNS_BULLISH_UTTERANCE)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '1h', positionPct: 10 },
      })
      const allSeriesKinds = ir.signalCatalog.series.map(s => s.kind)
      expect(allSeriesKinds).toContain('CHART_PATTERN')
    })

    it('HNS bullish: CHART_PATTERN series params carry pattern=head_and_shoulders, direction=bullish', () => {
      const spec = buildCanonicalSpecFromUtterance(HNS_BULLISH_UTTERANCE)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '1h', positionPct: 10 },
      })
      const series = ir.signalCatalog.series.find(s => s.kind === 'CHART_PATTERN')
      expect(series).toBeDefined()
      expect(series?.params?.pattern).toBe('head_and_shoulders')
      expect(series?.params?.direction).toBe('bullish')
    })

    it('CHART_PATTERN predicate uses EQ operator', () => {
      const spec = buildCanonicalSpecFromUtterance(DOUBLE_TOP_UTTERANCE)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '1h', positionPct: 10 },
      })
      const predicate = ir.signalCatalog.predicates.find(
        (p: { id: string; op?: string }) => p.id.includes('chart_pattern'),
      )
      expect(predicate).toBeDefined()
      expect((predicate as { kind?: string })?.kind).toBe('EQ')
    })

    it('runtimeRequirements.helpers includes chartPatternDetector', () => {
      const spec = buildCanonicalSpecFromUtterance(TRIANGLE_BULLISH_UTTERANCE)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '1h', positionPct: 10 },
      })
      expect(ir.runtimeRequirements.helpers).toContain('chartPatternDetector')
    })
  })

  // ─── Layer 7: display + clarification renderer ───────────────────────────────

  describe('Layer 7 — display + clarification renderer', () => {
    it('displayRenderer: HNS bullish → "看涨头肩形态"', () => {
      const display = presentationRegistry.renderDisplay('price.chart_pattern', {
        pattern: 'head_and_shoulders',
        direction: 'bullish',
      })
      expect(display).toContain('看涨')
      expect(display).toContain('头肩')
    })

    it('displayRenderer: double_top bearish → "看跌双顶形态"', () => {
      const display = presentationRegistry.renderDisplay('price.chart_pattern', {
        pattern: 'double_top',
        direction: 'bearish',
      })
      expect(display).toContain('看跌')
      expect(display).toContain('双顶')
    })

    it('displayRenderer: triangle bullish → "看涨三角形形态"', () => {
      const display = presentationRegistry.renderDisplay('price.chart_pattern', {
        pattern: 'triangle',
        direction: 'bullish',
      })
      expect(display).toContain('三角形')
    })

    it('publicName is 图形形态', () => {
      const entry = presentationRegistry.getEntry('price.chart_pattern')
      expect(entry?.publicName).toBe('图形形态')
    })

    it('goldenUtterances has ≥ 4 entries', () => {
      const entry = presentationRegistry.getEntry('price.chart_pattern')
      expect(entry?.goldenUtterances?.length).toBeGreaterThanOrEqual(4)
    })

    it('clarificationRenderer: price.chart_pattern.pattern slot → pattern selection prompt', () => {
      const text = presentationRegistry.renderClarification('price.chart_pattern', 'price.chart_pattern.pattern', {})
      expect(typeof text).toBe('string')
      expect(text.length).toBeGreaterThan(0)
      expect(text).toContain('head_and_shoulders')
    })

    it('clarificationRenderer: price.chart_pattern.direction slot → direction prompt', () => {
      const text = presentationRegistry.renderClarification('price.chart_pattern', 'price.chart_pattern.direction', {})
      expect(typeof text).toBe('string')
      expect(text).toContain('bullish')
    })
  })
})
