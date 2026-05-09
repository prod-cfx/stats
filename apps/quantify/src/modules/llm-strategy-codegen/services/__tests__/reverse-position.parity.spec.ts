/**
 * action.reverse_position 七件套闭环 parity spec
 *
 * 覆盖：
 * 1. atom registry: supported_executable + executableSinceVersion + requiredParams
 * 2. seed extractor: fromSide / toSide / sameBarPolicy / sizingSource 提取
 * 3. semantic state: action.reverse_position 状态构建
 * 4. readiness: reverse_position 不额外产生 open_slot（参数自带默认值）
 * 5. canonical spec builder: CLOSE_LONG + OPEN_SHORT 双 action 输出
 * 6. IR compiler: CLOSE_LONG + OPEN_SHORT 在 ruleBlock actions 中；metadata.reversePosition 透传
 * 7. display + presentation: 渲染可读文本
 *
 * A-M2 regression: IR metadata.reversePosition 必须包含 sameBarPolicy + sizingSource（runtime 透传）
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

// ─── Layer 1: atom registry ───────────────────────────────────────────────────

describe('action.reverse_position parity spec', () => {
  describe('Layer 1 — atom registry', () => {
    it('is supported_executable', () => {
      const atom = registry.get('action.reverse_position')
      expect(atom.supportStatus).toBe('supported_executable')
    })

    it('has executableSinceVersion 2026.05.W02', () => {
      const atom = registry.get('action.reverse_position') as { executableSinceVersion?: string }
      expect(atom.executableSinceVersion).toBe('2026.05.W02')
    })

    it('requiredParams includes fromSide, toSide, sameBarPolicy, sizingSource', () => {
      const atom = registry.get('action.reverse_position')
      expect(atom.requiredParams).toContain('fromSide')
      expect(atom.requiredParams).toContain('toSide')
      expect(atom.requiredParams).toContain('sameBarPolicy')
      expect(atom.requiredParams).toContain('sizingSource')
    })

    it('category is action', () => {
      const atom = registry.get('action.reverse_position')
      expect(atom.category).toBe('action')
    })

    it('executableProjection includes canonical_spec_v2', () => {
      const atom = registry.get('action.reverse_position')
      expect(atom.executableProjection).toContain('canonical_spec_v2')
    })

    it('openSlots is empty (no pending slots)', () => {
      const atom = registry.get('action.reverse_position')
      expect(atom.openSlots).toEqual([])
    })
  })

  // ─── Layer 2: seed extractor ────────────────────────────────────────────────

  describe('Layer 2 — seed extractor', () => {
    it('zh long→short: 信号反转时由多翻空，使用当前仓位 → fromSide=long toSide=short sizingSource=current_position', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，MA20 下穿 MA50，信号反转时由多翻空，反手，沿用当前仓位。')
      const action = patch.actions.find(a => a.key === 'action.reverse_position')
      expect(action).toBeDefined()
      expect(action?.params?.fromSide).toBe('long')
      expect(action?.params?.toSide).toBe('short')
      expect(action?.params?.sizingSource).toBe('current_position')
    })

    it('zh short→long next_bar: 平空做多反手 → fromSide=short toSide=long sameBarPolicy=next_bar_only', () => {
      const patch = extractor.extract('平空做多反手')
      const action = patch.actions.find(a => a.key === 'action.reverse_position')
      expect(action).toBeDefined()
      expect(action?.params?.fromSide).toBe('short')
      expect(action?.params?.toSide).toBe('long')
      expect(action?.params?.sameBarPolicy).toBe('next_bar_only')
    })

    it('en same bar: reverse position long to short, same bar → sameBarPolicy=allow', () => {
      const patch = extractor.extract('OKX BTCUSDT 15m, MA20 cross below MA50, reverse position, 允许同一根 K 线反手。')
      const action = patch.actions.find(a => a.key === 'action.reverse_position')
      expect(action).toBeDefined()
      expect(action?.params?.sameBarPolicy).toBe('allow')
    })

    it('zh missing explicit side: 反手 → defaults fromSide=long sameBarPolicy=next_bar_only sizingSource=fixed', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，MA20 下穿 MA50 止损，反手。')
      const action = patch.actions.find(a => a.key === 'action.reverse_position')
      expect(action).toBeDefined()
      // critic round 1 A-C1：sizingSource 默认改为 'fixed'（与 builder readReverseSizingSource 枚举对齐）
      expect(action?.params?.fromSide).toBeDefined()
      expect(action?.params?.sameBarPolicy).toBe('next_bar_only')
      expect(action?.params?.sizingSource).toBe('fixed')
    })

    it('alias 翻仓 is recognized (critic B-M3 regression)', () => {
      // critic round 1 B-M3：'翻仓' alias 已在 presentation 注册但 extractor regex 缺
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，MA20 下穿 MA50，翻仓。')
      const action = patch.actions.find(a => a.key === 'action.reverse_position')
      expect(action).toBeDefined()
    })

    it('alias 反向开仓 is recognized', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，MA20 下穿 MA50，反向开仓。')
      const action = patch.actions.find(a => a.key === 'action.reverse_position')
      expect(action).toBeDefined()
    })
  })

  // ─── Layer 3: semantic state builder ───────────────────────────────────────

  describe('Layer 3 — semantic state', () => {
    it('builds action.reverse_position state from seed patch', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，MA20 下穿 MA50，反手，沿用当前仓位。')
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const action = state?.actions.find(a => a.key === 'action.reverse_position')
      expect(action).toBeDefined()
      expect(action?.params?.sizingSource).toBe('current_position')
    })
  })

  // ─── Layer 4: readiness ─────────────────────────────────────────────────────

  describe('Layer 4 — readiness', () => {
    it('reverse_position with all params → no open_slot for reverse_position', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，MA20 下穿 MA50，反手，沿用当前仓位。')
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const slotKeys = classified.openSlots.map(s => s.slotKey)
      expect(slotKeys).not.toContain('action.reverse_position.same_bar_policy')
      expect(slotKeys).not.toContain('action.reverse_position.sizing_source')
    })

    it('reverse_position atom is not in unsupportedAtoms', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，MA20 下穿 MA50，反手。')
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const unsupported = classified.unsupportedAtoms.map(a => a.key)
      expect(unsupported).not.toContain('action.reverse_position')
    })
  })

  // ─── Layer 5: canonical spec builder ───────────────────────────────────────

  // Utterances that produce exit-phase triggers → builder binds reverse_position action
  // '跌破 MA50' → exit trigger (indicator.below), binding to reverse_position action
  const EXIT_REVERSE_LONG_SHORT = '跌破 MA50 平多并反手做空，反手仓位沿用原仓位，允许同一根 K 线内反手。'

  describe('Layer 5 — canonical spec builder', () => {
    it('long→short: produces CLOSE_LONG + OPEN_SHORT actions', () => {
      const patch = extractor.extract(EXIT_REVERSE_LONG_SHORT)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const normalized = readiness.normalize(classified.state)
      const spec = canonicalBuilder.buildFromSemanticState(normalized.state)
      const actionTypes = spec.rules.flatMap(r => r.actions.map(a => a.type))
      expect(actionTypes).toContain('CLOSE_LONG')
      expect(actionTypes).toContain('OPEN_SHORT')
    })

    it('metadata.reversePosition is set on the rule', () => {
      const patch = extractor.extract(EXIT_REVERSE_LONG_SHORT)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const normalized = readiness.normalize(classified.state)
      const spec = canonicalBuilder.buildFromSemanticState(normalized.state)
      const reverseRule = spec.rules.find(r => r.metadata?.reversePosition)
      expect(reverseRule).toBeDefined()
      expect(reverseRule?.metadata?.reversePosition?.fromSide).toBe('long')
      expect(reverseRule?.metadata?.reversePosition?.toSide).toBe('short')
      expect(reverseRule?.metadata?.reversePosition?.sameBarPolicy).toBe('allow')
      expect(reverseRule?.metadata?.reversePosition?.sizingSource).toBe('current_position')
    })
  })

  // ─── Layer 6: IR compiler ───────────────────────────────────────────────────

  describe('Layer 6 — IR compiler', () => {
    it('IR ruleBlock actions contain CLOSE_LONG + OPEN_SHORT for long→short', () => {
      const patch = extractor.extract(EXIT_REVERSE_LONG_SHORT)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const normalized = readiness.normalize(classified.state)
      const spec = canonicalBuilder.buildFromSemanticState(normalized.state)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '15m', positionPct: 10 },
      })
      const allKinds = ir.ruleBlocks.flatMap(r => r.actions.map(a => a.kind))
      expect(allKinds).toContain('CLOSE_LONG')
      expect(allKinds).toContain('OPEN_SHORT')
      // critic round 1 B-M1：CLOSE_LONG 必须先于 OPEN_SHORT（同 rule 内顺序）
      const reverseRule = ir.ruleBlocks.find(r =>
        r.actions.some(a => a.kind === 'CLOSE_LONG')
        && r.actions.some(a => a.kind === 'OPEN_SHORT'),
      )
      if (reverseRule) {
        const kinds = reverseRule.actions.map(a => a.kind)
        const closeIdx = kinds.indexOf('CLOSE_LONG')
        const openIdx = kinds.indexOf('OPEN_SHORT')
        expect(closeIdx).toBeLessThan(openIdx)
      }
    })

    it('A-C1 regression: IR sizingSource preserves fixed (no silent fallback to position_sizing)', () => {
      // critic round 1 A-C1：原 extractor 写 'explicit'，builder 不识别 → silent fallback 'position_sizing'
      // 修复后 extractor 写 'fixed'，builder 应原样保留
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，跌破 MA50 平多并反手做空。')
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const normalized = readiness.normalize(classified.state)
      const spec = canonicalBuilder.buildFromSemanticState(normalized.state)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '15m', positionPct: 10 },
      })
      const reverseRule = ir.ruleBlocks.find(r => r.metadata?.reversePosition)
      expect(reverseRule).toBeDefined()
      expect(reverseRule?.metadata?.reversePosition?.sizingSource).toBe('fixed')
    })

    // A-M2 regression: metadata.reversePosition must carry sameBarPolicy + sizingSource
    it('A-M2 regression: IR metadata.reversePosition includes sameBarPolicy + sizingSource', () => {
      const patch = extractor.extract(EXIT_REVERSE_LONG_SHORT)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const normalized = readiness.normalize(classified.state)
      const spec = canonicalBuilder.buildFromSemanticState(normalized.state)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '15m', positionPct: 10 },
      })
      const reverseRule = ir.ruleBlocks.find(r => r.metadata?.reversePosition)
      expect(reverseRule).toBeDefined()
      expect(reverseRule?.metadata?.reversePosition?.sameBarPolicy).toBeDefined()
      expect(reverseRule?.metadata?.reversePosition?.sizingSource).toBeDefined()
      expect(reverseRule?.metadata?.reversePosition?.fromSide).toBeDefined()
      expect(reverseRule?.metadata?.reversePosition?.toSide).toBeDefined()
    })

    it('sizingSource=current_position → OPEN action sizing has quantityMode=position_pct', () => {
      const patch = extractor.extract(EXIT_REVERSE_LONG_SHORT)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const normalized = readiness.normalize(classified.state)
      const spec = canonicalBuilder.buildFromSemanticState(normalized.state)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '15m', positionPct: 10 },
      })
      const reverseBlock = ir.ruleBlocks.find(r => r.metadata?.reversePosition)
      const openAction = reverseBlock?.actions.find(a => a.kind === 'OPEN_SHORT')
      expect(openAction?.quantity?.mode).toBe('position_pct')
    })
  })

  // ─── Layer 7: display + presentation ───────────────────────────────────────

  describe('Layer 7 — display + presentation', () => {
    it('renders human-readable display text for reverse_position', () => {
      const display = presentationRegistry.renderDisplay('action.reverse_position', { fromSide: 'long', toSide: 'short' })
      expect(typeof display).toBe('string')
      expect(display.length).toBeGreaterThan(0)
    })

    it('publicName is 反手', () => {
      const entry = presentationRegistry.getEntry('action.reverse_position')
      expect(entry?.publicName).toBe('反手')
    })

    it('aliases include 反向开仓 and 反转持仓', () => {
      const entry = presentationRegistry.getEntry('action.reverse_position')
      expect(entry?.aliases).toContain('反向开仓')
      expect(entry?.aliases).toContain('反转持仓')
    })

    it('goldenUtterances has ≥4 entries', () => {
      const entry = presentationRegistry.getEntry('action.reverse_position')
      expect(entry?.goldenUtterances.length).toBeGreaterThanOrEqual(4)
    })
  })
})
