/**
 * strategy.time_window atom 七层 parity spec
 *
 * 验证 strategy.time_window 从 seed-extractor 到 canonical-spec / IR compiler 的完整执行链。
 * 每层断言独立，失败可精确定位层次。
 *
 * IR 约定：
 *   atom.params.timezone — IANA timezone string
 *   atom.params.windows  — JSON-encoded string of Array<{start: string; end: string}>
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

const FULL_UTTERANCE = 'OKX 合约 BTCUSDT 15m，北京时间 9:30 到 11:30 内允许开仓，MA20 上穿 MA50 开多，单笔 10%，止损 5%。'

describe('strategy.time_window atom 七层 parity', () => {
  // Layer 1: atom registry status
  it('Layer 1 — atom registry: strategy.time_window is supported_executable', () => {
    const atom = atomRegistry.get('strategy.time_window')
    expect(atom).toMatchObject({
      key: 'strategy.time_window',
      category: 'trigger',
      supportStatus: 'supported_executable',
      requiredParams: ['timezone', 'windows'],
    })
    expect(atom.executableProjection).toEqual(expect.arrayContaining(['canonical_spec_v2']))
    expect((atom as { executableSinceVersion?: string }).executableSinceVersion).toBe('2026.05.W02')
  })

  // Layer 2: seed-extractor alias → patch (locked)
  it('Layer 2 — seed-extractor: extracts strategy.time_window with timezone + windows (locked)', () => {
    const patch = seedExtractor.extract('OKX 合约 BTCUSDT 15m，北京时间 9:30 到 11:30 内允许开仓，单笔 10%。')
    const trigger = patch.triggers.find(t => t.key === 'strategy.time_window')
    expect(trigger).toBeDefined()
    expect(trigger?.params).toMatchObject({ timezone: 'Asia/Shanghai' })
    // windows is stored as Array in seed extractor; builder will JSON-encode it
    expect(Array.isArray(trigger?.params?.windows)).toBe(true)
    expect(trigger?.params?.windows).toEqual([{ start: '09:30', end: '11:30' }])
    expect(trigger?.status).toBe('locked')
    expect(trigger?.openSlots).toEqual([])
  })

  it('Layer 2b — seed-extractor: missing timezone → open_slot.timezone', () => {
    const patch = seedExtractor.extract('OKX 合约 BTCUSDT 15m，时间窗口 9:30 到 11:30 内开仓，单笔 10%。')
    const trigger = patch.triggers.find(t => t.key === 'strategy.time_window')
    expect(trigger).toBeDefined()
    expect(trigger?.params).not.toHaveProperty('timezone')
    expect(trigger?.openSlots).toEqual(expect.arrayContaining([
      expect.objectContaining({ slotKey: 'strategy.time_window.timezone' }),
    ]))
  })

  it('Layer 2c — seed-extractor: missing windows → open_slot.windows', () => {
    const patch = seedExtractor.extract('OKX 合约 BTCUSDT 15m，只在 Asia/Shanghai 时区内开仓，单笔 10%。')
    const trigger = patch.triggers.find(t => t.key === 'strategy.time_window')
    expect(trigger).toBeDefined()
    expect(trigger?.params).toMatchObject({ timezone: 'Asia/Shanghai' })
    expect(trigger?.openSlots).toEqual(expect.arrayContaining([
      expect.objectContaining({ slotKey: 'strategy.time_window.windows' }),
    ]))
  })

  // Layer 3: state projection (seed-state-builder)
  it('Layer 3 — state-projection: strategy.time_window trigger in semantic state', () => {
    const patch = seedExtractor.extract(FULL_UTTERANCE)
    const state = seedStateBuilder.build(patch)
    expect(state).not.toBeNull()
    const trigger = state?.triggers.find(t => t.key === 'strategy.time_window')
    expect(trigger).toBeDefined()
    expect(trigger?.params).toMatchObject({ timezone: 'Asia/Shanghai' })
    expect(Array.isArray(trigger?.params?.windows)).toBe(true)
  })

  // Layer 4: readiness gate
  it('Layer 4 — readiness gate: strategy.time_window with all params → not blocking readiness', () => {
    const patch = seedExtractor.extract(FULL_UTTERANCE)
    const state = seedStateBuilder.build(patch)
    expect(state).not.toBeNull()
    const classified = supportClassifier.classify(state!)
    const openSlotKeys = classified.openSlots.map(s => s.slotKey)
    expect(openSlotKeys).not.toContain('strategy.time_window.timezone')
    expect(openSlotKeys).not.toContain('strategy.time_window.windows')
    // not in unsupported atoms
    const unsupportedKeys = classified.unsupportedAtoms.map(a => a.key)
    expect(unsupportedKeys).not.toContain('strategy.time_window')
  })

  // Layer 5: canonical-spec-builder (direct, bypasses open-slot routing)
  it('Layer 5 — canonical-spec-builder: strategy.time_window compiles to gate rule', () => {
    const state = seedStateBuilder.build({
      triggers: [{
        id: 'gate-time-window',
        key: 'strategy.time_window',
        phase: 'gate',
        sideScope: 'long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        params: {
          timezone: 'Asia/Shanghai',
          // builder reads windows as Array; it JSON-encodes it in the canonical condition
          windows: [{ start: '09:30', end: '11:30' }],
        },
      }],
      actions: [
        { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
      ],
    })
    expect(state).not.toBeNull()
    const spec = canonicalBuilder.buildFromSemanticState(state!)
    expect(spec).toEqual(expect.objectContaining({ version: 2 }))
    const gateRule = spec.rules.find(r => r.phase === 'gate' && (r.condition as { key?: string })?.key === 'strategy.time_window')
    expect(gateRule).toBeDefined()
    expect(gateRule?.condition as unknown).toEqual(expect.objectContaining({
      kind: 'atom',
      key: 'strategy.time_window',
    }))
    expect(gateRule?.actions).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'BLOCK_NEW_ENTRY' }),
    ]))
  })

  // Layer 6: canonical-spec-v2 IR compiler
  it('Layer 6 — IR compiler: strategy.time_window compiles to IN_TIME_WINDOW predicate', () => {
    const state = seedStateBuilder.build({
      triggers: [{
        id: 'gate-time-window',
        key: 'strategy.time_window',
        phase: 'gate',
        sideScope: 'long',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        params: {
          timezone: 'Asia/Shanghai',
          // builder reads Array, encodes to JSON string in canonical condition for IR
          windows: [{ start: '09:30', end: '11:30' }],
        },
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
    // strategy.time_window should produce an IN_TIME_WINDOW series in the signal catalog
    // signalCatalog.series is an Array of SeriesDef objects (not a Map)
    const seriesArray: Array<{ id: string; kind: string }> = result.ir.signalCatalog.series
    const timeWindowSeries = seriesArray.find((s) => s.id.includes('in_time_window') || s.kind === 'IN_TIME_WINDOW')
    expect(timeWindowSeries).toBeDefined()
  })

  // Layer 7: display renderer
  it('Layer 7 — display renderer: strategy.time_window renders human-readable text', () => {
    const { SemanticPresentationRegistryService } = require('../semantic-presentation-registry.service')
    const registry = new SemanticPresentationRegistryService(atomRegistry)
    // Display renderer receives params with windows as JSON string (canonical condition format)
    const display = registry.renderDisplay('strategy.time_window', {
      timezone: 'Asia/Shanghai',
      windows: JSON.stringify([{ start: '09:30', end: '11:30' }]),
    })
    expect(display).toContain('09:30')
    expect(display).toContain('11:30')
    expect(display).toContain('Asia/Shanghai')
  })
})
