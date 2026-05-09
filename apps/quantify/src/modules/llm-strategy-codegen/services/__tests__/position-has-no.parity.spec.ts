/**
 * position.has_position / position.no_position atom 七层 parity spec
 *
 * 两个 atom 共享同一文件，验证从 seed-extractor 到 IR compiler 的完整执行链。
 *
 * IR 约定：
 *   gate rule condition: { kind: 'atom', key: 'position.has_position' | 'position.no_position', op: 'EQ', value: false }
 *   IR guard: { kind: 'MAX_POSITION_PCT', scope: 'position', value: 0, onBreach: 'BLOCK_NEW_ENTRY' }
 */
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticSupportClassifierService } from '../semantic-support-classifier.service'

const seedExtractor = new SemanticSeedExtractorService()
const seedStateBuilder = new SemanticSeedStateBuilderService()
const atomRegistry = new SemanticAtomRegistryService()
const supportClassifier = new SemanticSupportClassifierService(atomRegistry)
const readiness = new SemanticContractReadinessService()
const canonicalBuilder = new CanonicalSpecBuilderService()
const irCompiler = new CanonicalSpecV2IrCompilerService()

const HAS_POSITION_UTTERANCE = 'OKX 合约 BTCUSDT 15m，已有多头仓位时不再开多，MA20 上穿 MA50 开多，单笔 10%，止损 5%。'
const NO_POSITION_UTTERANCE = 'OKX 合约 BTCUSDT 15m，无多头仓位才开多，MA20 上穿 MA50 开多，单笔 10%，止损 5%。'

// ─── position.has_position ───────────────────────────────────────────────────

describe('position.has_position atom 七层 parity', () => {
  // Layer 1: atom registry
  it('Layer 1 — atom registry: position.has_position is supported_executable', () => {
    const atom = atomRegistry.get('position.has_position')
    expect(atom).toMatchObject({
      key: 'position.has_position',
      category: 'trigger',
      supportStatus: 'supported_executable',
      requiredParams: ['sideScope'],
    })
    expect(atom.executableProjection).toEqual(expect.arrayContaining(['canonical_spec_v2']))
    expect((atom as { executableSinceVersion?: string }).executableSinceVersion).toBe('2026.05.W02')
  })

  // Layer 2: seed-extractor (locked with sideScope)
  it('Layer 2 — seed-extractor: 已有多头仓位 → has_position locked sideScope=long', () => {
    const patch = seedExtractor.extract(HAS_POSITION_UTTERANCE)
    const trigger = patch.triggers?.find(t => t.key === 'position.has_position')
    expect(trigger).toBeDefined()
    expect(trigger?.params).toMatchObject({ sideScope: 'long' })
    expect(trigger?.status).toBe('locked')
    expect(trigger?.openSlots).toEqual([])
    expect(trigger?.phase).toBe('gate')
  })

  it('Layer 2b — seed-extractor: no explicit direction → defaults to sideScope=both (locked)', () => {
    const patch = seedExtractor.extract('OKX 合约 BTCUSDT 15m，已有仓位时不再开仓，MA20 上穿 MA50 开多，单笔 10%。')
    const trigger = patch.triggers?.find(t => t.key === 'position.has_position')
    expect(trigger).toBeDefined()
    expect(trigger?.params).toMatchObject({ sideScope: 'both' })
    expect(trigger?.status).toBe('locked')
    expect(trigger?.openSlots).toEqual([])
  })

  it('Layer 2c — seed-extractor: 已有空头仓位 → has_position locked sideScope=short', () => {
    const patch = seedExtractor.extract('OKX 合约 BTCUSDT 15m，已有空头仓位时不再开空，MA20 下穿 MA50 开空，单笔 10%。')
    const trigger = patch.triggers?.find(t => t.key === 'position.has_position')
    expect(trigger).toBeDefined()
    expect(trigger?.params).toMatchObject({ sideScope: 'short' })
    expect(trigger?.status).toBe('locked')
  })

  it('Layer 2d — seed-extractor: block entries when in position → has_position locked sideScope=both', () => {
    const patch = seedExtractor.extract('OKX BTCUSDT 15m, block entries when in position, MA20 cross above MA50, position 10%.')
    const trigger = patch.triggers?.find(t => t.key === 'position.has_position')
    expect(trigger).toBeDefined()
    expect(trigger?.params).toMatchObject({ sideScope: 'both' })
    expect(trigger?.status).toBe('locked')
    expect(trigger?.openSlots).toEqual([])
  })

  // Layer 3: state-projection
  it('Layer 3 — state-projection: has_position trigger in semantic state', () => {
    const patch = seedExtractor.extract(HAS_POSITION_UTTERANCE)
    const state = seedStateBuilder.build(patch)
    expect(state).not.toBeNull()
    const trigger = state?.triggers.find(t => t.key === 'position.has_position')
    expect(trigger).toBeDefined()
    expect(trigger?.params).toMatchObject({ sideScope: 'long' })
  })

  // Layer 4: readiness gate
  it('Layer 4 — readiness gate: has_position with sideScope → not blocking readiness', () => {
    const patch = seedExtractor.extract(HAS_POSITION_UTTERANCE)
    const state = seedStateBuilder.build(patch)
    expect(state).not.toBeNull()
    const classified = supportClassifier.classify(state!)
    const openSlotKeys = classified.openSlots.map(s => s.slotKey)
    expect(openSlotKeys).not.toContain('position.has_position.sideScope')
    const unsupportedKeys = classified.unsupportedAtoms.map(a => a.key)
    expect(unsupportedKeys).not.toContain('position.has_position')
  })

  // Layer 5: canonical-spec-builder
  it('Layer 5 — canonical-spec-builder: has_position compiles to gate rule with BLOCK_NEW_ENTRY', () => {
    const state = seedStateBuilder.build({
      triggers: [{
        id: 'gate-has-position',
        key: 'position.has_position',
        phase: 'gate',
        sideScope: 'long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        params: { sideScope: 'long' },
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
      && (r.condition as { key?: string })?.key === 'position.has_position',
    )
    expect(gateRule).toBeDefined()
    expect(gateRule?.condition as unknown).toEqual(expect.objectContaining({
      kind: 'atom',
      key: 'position.has_position',
      op: 'EQ',
      value: false,
    }))
    expect(gateRule?.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'BLOCK_NEW_ENTRY' }),
    ]))
  })

  // Layer 6: IR compiler
  it('Layer 6 — IR compiler: has_position compiles to MAX_POSITION_PCT guard', () => {
    const state = seedStateBuilder.build({
      triggers: [{
        id: 'gate-has-position',
        key: 'position.has_position',
        phase: 'gate',
        sideScope: 'long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        params: { sideScope: 'long' },
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
    const guards: Array<{ kind: string; value?: number; onBreach?: string }> = result.ir.riskPolicy?.guards ?? []
    const posGuard = guards.find(g => g.kind === 'MAX_POSITION_PCT')
    expect(posGuard).toBeDefined()
    expect(posGuard?.value).toBe(0)
    expect(posGuard?.onBreach).toBe('BLOCK_NEW_ENTRY')
  })

  // Layer 7: display renderer
  it('Layer 7 — display renderer: has_position renders human-readable text', () => {
    const { SemanticPresentationRegistryService } = require('../semantic-presentation-registry.service')
    const registry = new SemanticPresentationRegistryService(atomRegistry)
    const display = registry.renderDisplay('position.has_position', { sideScope: 'long' })
    expect(display).toContain('多头')
  })
})

// ─── position.no_position ────────────────────────────────────────────────────

describe('position.no_position atom 七层 parity', () => {
  // Layer 1: atom registry
  it('Layer 1 — atom registry: position.no_position is supported_executable', () => {
    const atom = atomRegistry.get('position.no_position')
    expect(atom).toMatchObject({
      key: 'position.no_position',
      category: 'trigger',
      supportStatus: 'supported_executable',
      requiredParams: ['sideScope'],
    })
    expect(atom.executableProjection).toEqual(expect.arrayContaining(['canonical_spec_v2']))
    expect((atom as { executableSinceVersion?: string }).executableSinceVersion).toBe('2026.05.W02')
  })

  // Layer 2: seed-extractor (locked with sideScope)
  it('Layer 2 — seed-extractor: 无多头仓位才开多 → no_position locked sideScope=long', () => {
    const patch = seedExtractor.extract(NO_POSITION_UTTERANCE)
    const trigger = patch.triggers?.find(t => t.key === 'position.no_position')
    expect(trigger).toBeDefined()
    expect(trigger?.params).toMatchObject({ sideScope: 'long' })
    expect(trigger?.status).toBe('locked')
    expect(trigger?.openSlots).toEqual([])
    expect(trigger?.phase).toBe('gate')
  })

  it('Layer 2b — seed-extractor: no explicit direction → defaults to sideScope=both (locked)', () => {
    const patch = seedExtractor.extract('OKX 合约 BTCUSDT 15m，无仓位时才开仓，MA20 上穿 MA50 开多，单笔 10%。')
    const trigger = patch.triggers?.find(t => t.key === 'position.no_position')
    expect(trigger).toBeDefined()
    expect(trigger?.params).toMatchObject({ sideScope: 'both' })
    expect(trigger?.status).toBe('locked')
    expect(trigger?.openSlots).toEqual([])
  })

  it('Layer 2c — seed-extractor: 无空头仓位 → no_position locked sideScope=short', () => {
    const patch = seedExtractor.extract('OKX 合约 BTCUSDT 15m，无空头仓位时开空，MA20 下穿 MA50 开空，单笔 10%。')
    const trigger = patch.triggers?.find(t => t.key === 'position.no_position')
    expect(trigger).toBeDefined()
    expect(trigger?.params).toMatchObject({ sideScope: 'short' })
    expect(trigger?.status).toBe('locked')
  })

  it('Layer 2d — seed-extractor: enter only when flat → no_position locked sideScope=both', () => {
    const patch = seedExtractor.extract('OKX BTCUSDT 15m, enter only when flat, MA20 cross above MA50, position 10%.')
    const trigger = patch.triggers?.find(t => t.key === 'position.no_position')
    expect(trigger).toBeDefined()
    expect(trigger?.params).toMatchObject({ sideScope: 'both' })
    expect(trigger?.status).toBe('locked')
    expect(trigger?.openSlots).toEqual([])
  })

  // Layer 3: state-projection
  it('Layer 3 — state-projection: no_position trigger in semantic state', () => {
    const patch = seedExtractor.extract(NO_POSITION_UTTERANCE)
    const state = seedStateBuilder.build(patch)
    expect(state).not.toBeNull()
    const trigger = state?.triggers.find(t => t.key === 'position.no_position')
    expect(trigger).toBeDefined()
    expect(trigger?.params).toMatchObject({ sideScope: 'long' })
  })

  // Layer 4: readiness gate
  it('Layer 4 — readiness gate: no_position with sideScope → not blocking readiness', () => {
    const patch = seedExtractor.extract(NO_POSITION_UTTERANCE)
    const state = seedStateBuilder.build(patch)
    expect(state).not.toBeNull()
    const classified = supportClassifier.classify(state!)
    const openSlotKeys = classified.openSlots.map(s => s.slotKey)
    expect(openSlotKeys).not.toContain('position.no_position.sideScope')
    const unsupportedKeys = classified.unsupportedAtoms.map(a => a.key)
    expect(unsupportedKeys).not.toContain('position.no_position')
  })

  // Layer 5: canonical-spec-builder
  it('Layer 5 — canonical-spec-builder: no_position compiles to gate rule with BLOCK_NEW_ENTRY', () => {
    const state = seedStateBuilder.build({
      triggers: [{
        id: 'gate-no-position',
        key: 'position.no_position',
        phase: 'gate',
        sideScope: 'long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        params: { sideScope: 'long' },
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
      && (r.condition as { key?: string })?.key === 'position.no_position',
    )
    expect(gateRule).toBeDefined()
    expect(gateRule?.condition as unknown).toEqual(expect.objectContaining({
      kind: 'atom',
      key: 'position.no_position',
      op: 'EQ',
      value: false,
    }))
    expect(gateRule?.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'BLOCK_NEW_ENTRY' }),
    ]))
  })

  // Layer 6: IR compiler
  it('Layer 6 — IR compiler: no_position compiles to MAX_POSITION_PCT guard', () => {
    const state = seedStateBuilder.build({
      triggers: [{
        id: 'gate-no-position',
        key: 'position.no_position',
        phase: 'gate',
        sideScope: 'long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        params: { sideScope: 'long' },
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
    const guards: Array<{ kind: string; value?: number; onBreach?: string }> = result.ir.riskPolicy?.guards ?? []
    const posGuard = guards.find(g => g.kind === 'MAX_POSITION_PCT')
    expect(posGuard).toBeDefined()
    expect(posGuard?.value).toBe(0)
    expect(posGuard?.onBreach).toBe('BLOCK_NEW_ENTRY')
  })

  // Layer 7: display renderer
  it('Layer 7 — display renderer: no_position renders human-readable text', () => {
    const { SemanticPresentationRegistryService } = require('../semantic-presentation-registry.service')
    const registry = new SemanticPresentationRegistryService(atomRegistry)
    const display = registry.renderDisplay('position.no_position', { sideScope: 'long' })
    expect(display).toContain('多头')
  })
})
