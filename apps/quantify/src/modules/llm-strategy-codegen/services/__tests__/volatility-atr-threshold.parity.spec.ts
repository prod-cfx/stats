/**
 * volatility.atr_threshold atom 七层 parity spec
 *
 * 验证 volatility.atr_threshold 从 seed-extractor 到 canonical-spec / IR compiler 的完整执行链。
 * 每层断言独立，失败可精确定位层次。
 */
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticStateProjectionService } from '../semantic-state-projection.service'
import { SemanticSupportClassifierService } from '../semantic-support-classifier.service'

const seedExtractor = new SemanticSeedExtractorService()
const seedStateBuilder = new SemanticSeedStateBuilderService()
const atomRegistry = new SemanticAtomRegistryService()
const supportClassifier = new SemanticSupportClassifierService(atomRegistry)
const readiness = new SemanticContractReadinessService()
const stateProjection = new SemanticStateProjectionService()
const canonicalBuilder = new CanonicalSpecBuilderService()
const irCompiler = new CanonicalSpecV2IrCompilerService()

const FULL_UTTERANCE = 'OKX 合约 BTCUSDT 15m，ATR14 大于 50 才开仓，MA20 上穿 MA50 开多，单笔 10%，止损 5%。'

describe('volatility.atr_threshold atom 七层 parity', () => {
  // Layer 1: atom registry status
  it('Layer 1 — atom registry: volatility.atr_threshold is supported_executable', () => {
    const atom = atomRegistry.get('volatility.atr_threshold')
    expect(atom).toMatchObject({
      key: 'volatility.atr_threshold',
      category: 'trigger',
      supportStatus: 'supported_executable',
      requiredParams: ['period', 'threshold', 'thresholdUnit', 'operator'],
    })
    expect(atom.executableProjection).toEqual(expect.arrayContaining(['canonical_spec_v2']))
    expect((atom as { executableSinceVersion?: string }).executableSinceVersion).toBe('2026.05.W02')
  })

  // Layer 2: seed-extractor alias → patch (locked)
  it('Layer 2 — seed-extractor: extracts volatility.atr_threshold with period/threshold/operator', () => {
    const patch = seedExtractor.extract('OKX 合约 BTCUSDT 15m，ATR14 大于 50 才开仓，单笔 10%。')
    const trigger = patch.triggers.find(t => t.key === 'volatility.atr_threshold')
    expect(trigger).toBeDefined()
    expect(trigger?.params).toEqual(expect.objectContaining({
      operator: 'GT',
      period: 14,
      threshold: 50,
      thresholdUnit: 'quote_currency',
    }))
    expect(trigger?.status).toBe('locked')
    expect(trigger?.openSlots).toEqual([])
  })

  it('Layer 2b — seed-extractor: missing threshold value → open slot for threshold', () => {
    const patch = seedExtractor.extract('OKX 合约 BTCUSDT 15m，ATR 大于阈值时过滤开多，单笔 10%。')
    const trigger = patch.triggers.find(t => t.key === 'volatility.atr_threshold')
    expect(trigger).toBeDefined()
    expect(trigger?.params).not.toHaveProperty('threshold')
    expect(trigger?.openSlots).toEqual(expect.arrayContaining([
      expect.objectContaining({ slotKey: 'volatility.atr_threshold.threshold' }),
    ]))
  })

  // Layer 3: state projection (seed-state-builder)
  it('Layer 3 — state-projection: volatility.atr_threshold trigger in semantic state', () => {
    const patch = seedExtractor.extract(FULL_UTTERANCE)
    const state = seedStateBuilder.build(patch)
    expect(state).not.toBeNull()
    const trigger = state?.triggers.find(t => t.key === 'volatility.atr_threshold')
    expect(trigger).toBeDefined()
    expect(trigger?.params).toEqual(expect.objectContaining({ period: 14, threshold: 50, operator: 'GT', thresholdUnit: 'quote_currency' }))
  })

  // Layer 4: readiness gate
  it('Layer 4 — readiness gate: volatility.atr_threshold with all params → not blocking readiness', () => {
    const patch = seedExtractor.extract(FULL_UTTERANCE)
    const state = seedStateBuilder.build(patch)
    expect(state).not.toBeNull()
    const classified = supportClassifier.classify(state!)
    const openSlotKeys = classified.openSlots.map(s => s.slotKey)
    // all required params provided → no open slot for atr_threshold
    expect(openSlotKeys).not.toContain('volatility.atr_threshold.threshold')
    expect(openSlotKeys).not.toContain('volatility.atr_threshold.period')
    // critic round 1 C-A1 验证：seed-extractor 写 'period' 字段名（与 builder 约定一致），
    // builder/IR 才能拿到正确周期
    const trigger = state?.triggers.find(t => t.key === 'volatility.atr_threshold')
    expect(trigger?.params.period).toBe(14)
    // should not appear in unsupported atoms
    const unsupportedKeys = classified.unsupportedAtoms.map(a => a.key)
    expect(unsupportedKeys).not.toContain('volatility.atr_threshold')
  })

  // Layer 5: canonical-spec-builder (direct, bypasses open-slot routing)
  it('Layer 5 — canonical-spec-builder: volatility.atr_threshold compiles to gate rule', () => {
    const state = seedStateBuilder.build({
      triggers: [{
        id: 'gate-atr-threshold',
        key: 'volatility.atr_threshold',
        phase: 'gate',
        sideScope: 'long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        params: { period: 14, threshold: 50, thresholdUnit: 'quote_currency', operator: 'GT' },
      }],
      actions: [
        { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
      ],
    })
    expect(state).not.toBeNull()
    const spec = canonicalBuilder.buildFromSemanticState(state!)
    expect(spec).toEqual(expect.objectContaining({ version: 2 }))
    const gateRule = spec.rules.find(r =>
      r.phase === 'gate'
      && r.condition?.kind === 'atom'
      && r.condition.key === 'volatility.atr_threshold',
    )
    expect(gateRule).toBeDefined()
    expect(gateRule?.condition).toEqual(expect.objectContaining({
      kind: 'atom',
      key: 'volatility.atr_threshold',
      op: 'GT',
    }))
    expect(gateRule?.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'BLOCK_NEW_ENTRY' }),
    ]))
  })

  // Layer 6: canonical-spec-v2 IR compiler
  it('Layer 6 — IR compiler: volatility.atr_threshold compiles to predicate', () => {
    const state = seedStateBuilder.build({
      triggers: [{
        id: 'gate-atr-threshold',
        key: 'volatility.atr_threshold',
        phase: 'gate',
        sideScope: 'long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        params: { period: 14, threshold: 50, thresholdUnit: 'quote_currency', operator: 'GT' },
      }],
      actions: [
        { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
        { id: 'close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
      ],
    })
    expect(state).not.toBeNull()
    const spec = canonicalBuilder.buildFromSemanticState(state!)
    const result = irCompiler.compile({
      canonicalSpec: spec,
      fallback: {
        exchange: 'okx',
        symbol: 'BTC-USDT-SWAP',
        baseTimeframe: '15m',
        positionPct: 10,
      },
    })
    expect(result).toBeDefined()
    // volatility.atr_threshold should produce a predicate
    const predicateIds = result.ir.signalCatalog.predicates.map((p: { id: string }) => p.id)
    const atrPredicate = predicateIds.find((id: string) =>
      id.includes('atr') || id.includes('volatility'),
    )
    expect(atrPredicate).toBeDefined()
  })

  // Layer 7: display renderer
  it('Layer 7 — display renderer: volatility.atr_threshold renders human-readable text', () => {
    const { SemanticPresentationRegistryService } = require('../semantic-presentation-registry.service')
    const registry = new SemanticPresentationRegistryService(atomRegistry)
    const display = registry.renderDisplay('volatility.atr_threshold', {
      operator: 'GT',
      period: 14,
      threshold: 50,
      thresholdUnit: 'quote_currency',
    })
    expect(display).toContain('ATR14')
    expect(display).toContain('大于')
    expect(display).toContain('50')
  })
})
