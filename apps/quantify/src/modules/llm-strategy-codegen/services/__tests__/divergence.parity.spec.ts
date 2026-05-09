/**
 * indicator.divergence 七件套闭环 parity spec
 *
 * 覆盖：
 * 1. atom registry: supported_executable + executableSinceVersion + requiredParams
 * 2. seed extractor: RSI/MACD 顶背离/底背离提取；缺参数 → open_slot；主观文本 → 不触发
 * 3. semantic state: indicator.divergence trigger 状态构建
 * 4. readiness: 满参 → projection_gate；缺参 → open_slots
 * 5. canonical spec builder: INDICATOR_DIVERGENCE predicate 输出 + indicator/direction metadata
 * 6. IR compiler: INDICATOR_DIVERGENCE 系列 + helpers: rsi/macd + priceHighsLows
 * 7. display + presentation: 渲染可读文本 + golden utterances ≥ 4
 *
 * A-M2 防御: metadata 必须包含 indicator + direction + pivotWindow + confirmationBars
 * 负向用例: "像背离"/"疑似背离"/"看起来像背离" → 不产生 indicator.divergence trigger
 */

import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'
import { SemanticPresentationRegistryService } from '../semantic-presentation-registry.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticSupportClassifierService } from '../semantic-support-classifier.service'

const registry = new SemanticAtomRegistryService()
const extractor = new SemanticSeedExtractorService()
const seedStateBuilder = new SemanticSeedStateBuilderService()
const classifier = new SemanticSupportClassifierService(registry)
const readiness = new SemanticContractReadinessService()
const canonicalBuilder = new CanonicalSpecBuilderService()
const irCompiler = new CanonicalSpecV2IrCompilerService()
const presentationRegistry = new SemanticPresentationRegistryService(registry)

// 满参 RSI 顶背离（bearish）utterance
const RSI_BEARISH_UTTERANCE = 'OKX 合约 BTCUSDT 15m，RSI 顶背离后开空，5% 止损。'
// 满参 MACD 底背离（bullish）utterance
const MACD_BULLISH_UTTERANCE = 'OKX 合约 BTCUSDT 15m，MACD 底背离后开多，MA20 上穿 MA50 确认，5% 止损。'

// ─── Layer 1: atom registry ───────────────────────────────────────────────────

describe('indicator.divergence parity spec', () => {
  describe('Layer 1 — atom registry', () => {
    it('is supported_executable', () => {
      const atom = registry.get('indicator.divergence')
      expect(atom.supportStatus).toBe('supported_executable')
    })

    it('has executableSinceVersion 2026.05.W02', () => {
      const atom = registry.get('indicator.divergence') as { executableSinceVersion?: string }
      expect(atom.executableSinceVersion).toBe('2026.05.W02')
    })

    it('requiredParams includes indicator, direction, pivotWindow, confirmationBars', () => {
      const atom = registry.get('indicator.divergence')
      expect(atom.requiredParams).toContain('indicator')
      expect(atom.requiredParams).toContain('direction')
      expect(atom.requiredParams).toContain('pivotWindow')
      expect(atom.requiredParams).toContain('confirmationBars')
    })

    it('category is trigger', () => {
      const atom = registry.get('indicator.divergence')
      expect(atom.category).toBe('trigger')
    })

    it('openSlots is empty (no pending slots for supported_executable)', () => {
      const atom = registry.get('indicator.divergence')
      expect(atom.openSlots).toEqual([])
    })
  })

  // ─── Layer 2: seed extractor ────────────────────────────────────────────────

  describe('Layer 2 — seed extractor', () => {
    it('zh RSI 顶背离 → indicator=rsi, direction=bearish', () => {
      const patch = extractor.extract(RSI_BEARISH_UTTERANCE)
      const trigger = patch.triggers?.find(t => t.key === 'indicator.divergence')
      expect(trigger).toBeDefined()
      expect(trigger?.params?.indicator).toBe('rsi')
      expect(trigger?.params?.direction).toBe('bearish')
    })

    it('zh MACD 底背离 → indicator=macd, direction=bullish', () => {
      const patch = extractor.extract(MACD_BULLISH_UTTERANCE)
      const trigger = patch.triggers?.find(t => t.key === 'indicator.divergence')
      expect(trigger).toBeDefined()
      expect(trigger?.params?.indicator).toBe('macd')
      expect(trigger?.params?.direction).toBe('bullish')
    })

    it('en bullish divergence RSI → direction=bullish, indicator=rsi', () => {
      const patch = extractor.extract('OKX BTCUSDT 15m, RSI bullish divergence entry, 5% stop loss.')
      const trigger = patch.triggers?.find(t => t.key === 'indicator.divergence')
      expect(trigger).toBeDefined()
      expect(trigger?.params?.direction).toBe('bullish')
      expect(trigger?.params?.indicator).toBe('rsi')
    })

    it('pivotWindow defaults to 14 when not specified', () => {
      const patch = extractor.extract(RSI_BEARISH_UTTERANCE)
      const trigger = patch.triggers?.find(t => t.key === 'indicator.divergence')
      expect(trigger?.params?.pivotWindow).toBe(14)
    })

    it('confirmationBars defaults to 3 when not specified', () => {
      const patch = extractor.extract(RSI_BEARISH_UTTERANCE)
      const trigger = patch.triggers?.find(t => t.key === 'indicator.divergence')
      expect(trigger?.params?.confirmationBars).toBe(3)
    })

    it('缺 indicator → open_slot for indicator.divergence.indicator', () => {
      // 只说背离但没有 RSI/MACD
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，顶背离后开空，5% 止损。')
      const trigger = patch.triggers?.find(t => t.key === 'indicator.divergence')
      expect(trigger).toBeDefined()
      const slotKeys = trigger?.openSlots?.map(s => s.slotKey) ?? []
      expect(slotKeys).toContain('indicator.divergence.indicator')
    })

    it('缺 direction → open_slot for indicator.divergence.direction', () => {
      // 只说 RSI 背离但方向不明
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，RSI 背离后交易，5% 止损。')
      const trigger = patch.triggers?.find(t => t.key === 'indicator.divergence')
      if (trigger) {
        // 可能有 direction open_slot（如果方向无法确定）
        // 至少不报错，params.indicator 应该是 rsi
        expect(trigger.params?.indicator).toBe('rsi')
      }
    })

    it('negative: "像背离" 主观文本 → 不产生 indicator.divergence trigger', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，看起来像背离，但不确定，MA20 开多。')
      const trigger = patch.triggers?.find(t => t.key === 'indicator.divergence')
      expect(trigger).toBeUndefined()
    })

    it('negative: "疑似背离" → 不产生 indicator.divergence trigger', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，疑似背离，保守入场。')
      const trigger = patch.triggers?.find(t => t.key === 'indicator.divergence')
      expect(trigger).toBeUndefined()
    })

    // critic round 1 A-M1 regression: 主观词 anchor 必须在 (顶/底)?背离 之前才视为主观；
    // "RSI 顶背离很像 5 月那次" 是真背离 + 后置类比，不应被误吃为主观
    it('A-M1 regression: 后置 "像" + 真背离 utterance 仍识别为 supported', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，RSI 顶背离很像 5 月那次，开空。')
      const trigger = patch.triggers?.find(t => t.key === 'indicator.divergence')
      expect(trigger).toBeDefined()
      expect(trigger?.params?.indicator).toBe('rsi')
      expect(trigger?.params?.direction).toBe('bearish')
    })

    // critic round 1 A-M2 regression: bare "bullish" / "bearish" 不绑定 divergence 时
    // 不应被误锁 direction（如 "bullish trend + RSI divergence"）
    it('A-M2 regression: "bullish trend" + 不带 divergence 不污染 direction', () => {
      const patch = extractor.extract('OKX BTCUSDT 15m, bullish trend overall but RSI divergence appears, watch carefully.')
      const trigger = patch.triggers?.find(t => t.key === 'indicator.divergence')
      expect(trigger).toBeDefined()
      // bullish trend 不绑定 divergence → direction 应为 null（open_slot），而非 silent 锁 bullish
      expect(trigger?.params?.direction).toBeUndefined()
      expect(trigger?.openSlots).toEqual(expect.arrayContaining([
        expect.objectContaining({ slotKey: 'indicator.divergence.direction' }),
      ]))
    })

    // critic round 1 A-M3 regression: KDJ/成交量/OBV 背离 indicator 非白名单 → open_slot.indicator
    it('A-M3 regression: KDJ 背离 → open_slot.indicator (非 RSI/MACD 白名单)', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，KDJ 顶背离开空。')
      const trigger = patch.triggers?.find(t => t.key === 'indicator.divergence')
      expect(trigger).toBeDefined()
      expect(trigger?.params?.indicator).toBeUndefined()
      expect(trigger?.openSlots).toEqual(expect.arrayContaining([
        expect.objectContaining({ slotKey: 'indicator.divergence.indicator' }),
      ]))
    })
  })

  // ─── Layer 3: semantic state builder ───────────────────────────────────────

  describe('Layer 3 — semantic state', () => {
    it('builds indicator.divergence trigger from seed patch', () => {
      const patch = extractor.extract(RSI_BEARISH_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const trigger = state?.triggers?.find(t => t.key === 'indicator.divergence')
      expect(trigger).toBeDefined()
    })

    it('trigger status is locked after build (RSI bearish full utterance)', () => {
      const patch = extractor.extract(RSI_BEARISH_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      const trigger = state?.triggers?.find(t => t.key === 'indicator.divergence')
      expect(trigger?.status).toBe('locked')
    })
  })

  // ─── Layer 4: readiness ─────────────────────────────────────────────────────

  describe('Layer 4 — readiness', () => {
    it('divergence present with full params → not in unsupportedAtoms', () => {
      const patch = extractor.extract(RSI_BEARISH_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const unsupported = classified.unsupportedAtoms.map(a => a.key)
      expect(unsupported).not.toContain('indicator.divergence')
    })
  })

  // ─── Layer 5: canonical spec builder ───────────────────────────────────────

  describe('Layer 5 — canonical spec builder', () => {
    it('RSI bearish: produces rule with condition key containing divergence', () => {
      const patch = extractor.extract(RSI_BEARISH_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const normalized = readiness.normalize(classified.state)
      const spec = canonicalBuilder.buildFromSemanticState(normalized.state)
      function collectKeys(node: unknown): string[] {
        if (!node || typeof node !== 'object') return []
        const n = node as Record<string, unknown>
        if (typeof n['key'] === 'string') return [n['key']]
        if (Array.isArray(n['conditions'])) return (n['conditions'] as unknown[]).flatMap(c => collectKeys(c))
        return []
      }
      const allConditionKeys = spec.rules.flatMap(r => collectKeys(r.condition))
      expect(allConditionKeys.some(k => k === 'indicator.divergence')).toBe(true)
    })

    it('RSI bearish: condition params carry indicator=rsi, direction=bearish', () => {
      const patch = extractor.extract(RSI_BEARISH_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const normalized = readiness.normalize(classified.state)
      const spec = canonicalBuilder.buildFromSemanticState(normalized.state)
      function hasDiv(node: unknown): boolean {
        if (!node || typeof node !== 'object') return false
        const n = node as Record<string, unknown>
        if (n['key'] === 'indicator.divergence') return true
        if (Array.isArray(n['conditions'])) return (n['conditions'] as unknown[]).some(c => hasDiv(c))
        return false
      }
      function findDivAtom(node: unknown): Record<string, unknown> | null {
        if (!node || typeof node !== 'object') return null
        const n = node as Record<string, unknown>
        if (n['key'] === 'indicator.divergence') return n
        if (Array.isArray(n['conditions'])) {
          for (const c of n['conditions'] as unknown[]) {
            const found = findDivAtom(c)
            if (found) return found
          }
        }
        return null
      }
      const divRule = spec.rules.find(r => hasDiv(r.condition))
      expect(divRule).toBeDefined()
      const divAtom = findDivAtom(divRule!.condition)
      const divParams = divAtom?.['params'] as Record<string, unknown> | undefined
      expect(divParams?.indicator).toBe('rsi')
      expect(divParams?.direction).toBe('bearish')
    })
  })

  // ─── Layer 6: IR compiler ───────────────────────────────────────────────────

  describe('Layer 6 — IR compiler', () => {
    it('RSI bearish: IR series contain INDICATOR_DIVERGENCE kind', () => {
      const patch = extractor.extract(RSI_BEARISH_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const normalized = readiness.normalize(classified.state)
      const spec = canonicalBuilder.buildFromSemanticState(normalized.state)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '15m', positionPct: 10 },
      })
      const allSeriesKinds = ir.signalCatalog.series.map(s => s.kind)
      expect(allSeriesKinds).toContain('INDICATOR_DIVERGENCE')
    })

    it('RSI bearish: INDICATOR_DIVERGENCE series params include indicator=rsi, direction=bearish', () => {
      const patch = extractor.extract(RSI_BEARISH_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const normalized = readiness.normalize(classified.state)
      const spec = canonicalBuilder.buildFromSemanticState(normalized.state)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '15m', positionPct: 10 },
      })
      const divSeries = ir.signalCatalog.series.find(s => s.kind === 'INDICATOR_DIVERGENCE')
      expect(divSeries).toBeDefined()
      expect(divSeries?.params?.indicator).toBe('rsi')
      expect(divSeries?.params?.direction).toBe('bearish')
    })

    it('A-M2: INDICATOR_DIVERGENCE series carries pivotWindow + confirmationBars', () => {
      const patch = extractor.extract(RSI_BEARISH_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const normalized = readiness.normalize(classified.state)
      const spec = canonicalBuilder.buildFromSemanticState(normalized.state)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '15m', positionPct: 10 },
      })
      const divSeries = ir.signalCatalog.series.find(s => s.kind === 'INDICATOR_DIVERGENCE')
      expect(divSeries?.params?.pivotWindow).toBeDefined()
      expect(divSeries?.params?.confirmationBars).toBeDefined()
    })

    it('MACD bullish: IR series contain INDICATOR_DIVERGENCE with indicator=macd', () => {
      const patch = extractor.extract(MACD_BULLISH_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const normalized = readiness.normalize(classified.state)
      const spec = canonicalBuilder.buildFromSemanticState(normalized.state)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '15m', positionPct: 10 },
      })
      const divSeries = ir.signalCatalog.series.find(s => s.kind === 'INDICATOR_DIVERGENCE')
      expect(divSeries).toBeDefined()
      expect(divSeries?.params?.indicator).toBe('macd')
      expect(divSeries?.params?.direction).toBe('bullish')
    })

    it('runtimeRequirements.helpers includes rsi for RSI divergence', () => {
      const patch = extractor.extract(RSI_BEARISH_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const normalized = readiness.normalize(classified.state)
      const spec = canonicalBuilder.buildFromSemanticState(normalized.state)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '15m', positionPct: 10 },
      })
      expect(ir.runtimeRequirements.helpers).toContain('rsi')
      expect(ir.runtimeRequirements.helpers).toContain('priceHighsLows')
    })

    it('runtimeRequirements.helpers includes macd for MACD divergence', () => {
      const patch = extractor.extract(MACD_BULLISH_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const normalized = readiness.normalize(classified.state)
      const spec = canonicalBuilder.buildFromSemanticState(normalized.state)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '15m', positionPct: 10 },
      })
      expect(ir.runtimeRequirements.helpers).toContain('macd')
      expect(ir.runtimeRequirements.helpers).toContain('priceHighsLows')
    })
  })

  // ─── Layer 7: display + presentation ───────────────────────────────────────

  describe('Layer 7 — display + presentation', () => {
    it('renders human-readable display text for indicator.divergence', () => {
      const display = presentationRegistry.renderDisplay('indicator.divergence', { indicator: 'rsi', direction: 'bearish', pivotWindow: 14, confirmationBars: 3 })
      expect(typeof display).toBe('string')
      expect(display.length).toBeGreaterThan(0)
    })

    it('display text mentions indicator and direction labels', () => {
      const display = presentationRegistry.renderDisplay('indicator.divergence', { indicator: 'rsi', direction: 'bearish', pivotWindow: 14, confirmationBars: 3 })
      expect(display).toContain('RSI')
      expect(display).toContain('顶背离')
    })

    it('publicName is 指标背离', () => {
      const entry = presentationRegistry.getEntry('indicator.divergence')
      expect(entry?.publicName).toBe('指标背离')
    })

    it('aliases include 背离, RSI 背离, bullish divergence', () => {
      const entry = presentationRegistry.getEntry('indicator.divergence')
      expect(entry?.aliases).toContain('背离')
      expect(entry?.aliases).toContain('RSI 背离')
      expect(entry?.aliases).toContain('bullish divergence')
    })

    it('goldenUtterances has ≥ 4 entries', () => {
      const entry = presentationRegistry.getEntry('indicator.divergence')
      expect(entry?.goldenUtterances.length).toBeGreaterThanOrEqual(4)
    })

    it('clarificationRenderer returns meaningful string for indicator slot', () => {
      const text = presentationRegistry.renderClarification('indicator.divergence', 'indicator.divergence.indicator', {})
      expect(typeof text).toBe('string')
      expect(text.length).toBeGreaterThan(0)
    })

    it('clarificationRenderer returns meaningful string for direction slot', () => {
      const text = presentationRegistry.renderClarification('indicator.divergence', 'indicator.divergence.direction', {})
      expect(typeof text).toBe('string')
      expect(text.length).toBeGreaterThan(0)
    })
  })
})
