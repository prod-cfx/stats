/**
 * volume.threshold atom 七层 parity spec
 *
 * 验证 volume.threshold 从 seed-extractor 到 canonical-spec / IR compiler 的完整执行链。
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

const FULL_UTTERANCE = 'OKX 合约 BTCUSDT 15m，成交量大于 1000 时开多，MA20 上穿 MA50 平多，单笔 10%，止损 5%。'

describe('volume.threshold atom 七层 parity', () => {
  // Layer 1: atom registry status
  it('Layer 1 — atom registry: volume.threshold is supported_executable', () => {
    const atom = atomRegistry.get('volume.threshold')
    expect(atom).toMatchObject({
      key: 'volume.threshold',
      category: 'trigger',
      supportStatus: 'supported_executable',
      requiredParams: ['value', 'operator', 'metric'],
    })
    expect(atom.executableProjection).toEqual(expect.arrayContaining(['canonical_spec_v2']))
  })

  // Layer 2: seed-extractor alias → patch
  it('Layer 2 — seed-extractor: extracts volume.threshold with value/operator/metric', () => {
    const patch = seedExtractor.extract('OKX 合约 BTCUSDT 15m，成交量大于 1000 时开多，单笔 10%。')
    const trigger = patch.triggers.find(t => t.key === 'volume.threshold')
    expect(trigger).toBeDefined()
    expect(trigger?.params).toEqual(expect.objectContaining({
      operator: 'GT',
      metric: 'base_volume',
      value: 1000,
    }))
    expect(trigger?.status).toBe('locked')
    expect(trigger?.openSlots).toEqual([])
  })

  it('Layer 2b — seed-extractor: missing numeric value → open slot for value', () => {
    const patch = seedExtractor.extract('OKX 合约 BTCUSDT 15m，成交量超过阈值时开多，单笔 10%。')
    const trigger = patch.triggers.find(t => t.key === 'volume.threshold')
    expect(trigger).toBeDefined()
    expect(trigger?.params).not.toHaveProperty('value')
    expect(trigger?.openSlots).toEqual(expect.arrayContaining([
      expect.objectContaining({ slotKey: 'volume.threshold.value' }),
    ]))
  })

  // Layer 3: state projection (seed-state-builder)
  it('Layer 3 — state-projection: volume.threshold trigger in semantic state', () => {
    const patch = seedExtractor.extract(FULL_UTTERANCE)
    const state = seedStateBuilder.build(patch)
    expect(state).not.toBeNull()
    const trigger = state?.triggers.find(t => t.key === 'volume.threshold')
    expect(trigger).toBeDefined()
    expect(trigger?.params).toEqual(expect.objectContaining({ value: 1000, operator: 'GT', metric: 'base_volume' }))
  })

  // Layer 4: readiness gate
  it('Layer 4 — readiness gate: volume.threshold with all params → not blocking readiness', () => {
    const patch = seedExtractor.extract(FULL_UTTERANCE)
    const state = seedStateBuilder.build(patch)
    expect(state).not.toBeNull()
    const classified = supportClassifier.classify(state!)
    const openSlotKeys = classified.openSlots.map(s => s.slotKey)
    // volume.threshold value is provided → no open slot for it
    expect(openSlotKeys).not.toContain('volume.threshold.value')
    // volume.threshold should not appear in unsupported atoms
    const unsupportedKeys = classified.unsupportedAtoms.map(a => a.key)
    expect(unsupportedKeys).not.toContain('volume.threshold')
  })

  // Layer 5: canonical-spec-builder (direct, bypasses open-slot routing)
  it('Layer 5 — canonical-spec-builder: volume.threshold compiles to gate rule', () => {
    const state = seedStateBuilder.build({
      triggers: [{
        id: 'gate-volume-threshold',
        key: 'volume.threshold',
        phase: 'gate',
        sideScope: 'long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        params: { metric: 'base_volume', operator: 'GT', value: 1000 },
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
      && r.condition.key === 'volume.threshold',
    )
    expect(gateRule).toBeDefined()
    expect(gateRule?.condition).toEqual(expect.objectContaining({
      kind: 'atom',
      key: 'volume.threshold',
      op: 'GT',
      value: 1000,
      params: expect.objectContaining({ metric: 'base_volume' }),
    }))
    expect(gateRule?.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'BLOCK_NEW_ENTRY' }),
    ]))
  })

  // Layer 6: canonical-spec-v2 IR compiler
  it('Layer 6 — IR compiler: volume.threshold compiles to EXPRESSION_GUARD predicate', () => {
    const state = seedStateBuilder.build({
      triggers: [{
        id: 'gate-volume-threshold',
        key: 'volume.threshold',
        phase: 'gate',
        sideScope: 'long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        params: { metric: 'base_volume', operator: 'GT', value: 1000 },
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
    // volume.threshold should produce a predicate with volume_threshold in id
    const predicateIds = result.ir.signalCatalog.predicates.map((p: { id: string }) => p.id)
    const volumePredicate = predicateIds.find((id: string) => id.includes('volume_threshold'))
    expect(volumePredicate).toBeDefined()
  })

  // Layer 7: display renderer
  it('Layer 7 — display renderer: volume.threshold renders human-readable text', () => {
    const { SemanticPresentationRegistryService } = require('../semantic-presentation-registry.service')
    const registry = new SemanticPresentationRegistryService(atomRegistry)
    const display = registry.renderDisplay('volume.threshold', { operator: 'GT', metric: 'base_volume', value: 1000 })
    expect(display).toContain('成交量')
    expect(display).toContain('大于')
    expect(display).toContain('1000')
  })
})
