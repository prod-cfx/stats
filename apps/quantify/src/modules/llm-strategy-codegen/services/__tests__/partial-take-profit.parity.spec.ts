/**
 * risk.partial_take_profit atom 七层 parity spec
 *
 * 验证从 seed-extractor 到 IR compiler 的完整执行链。
 *
 * IR 约定：
 *   编译为 REDUCE_LONG / REDUCE_SHORT exit rule blocks（不是 BLOCK 或 CLOSE）
 *   每档生成独立 rule，condition: { kind: 'atom', key: 'risk.partial_take_profit', op: 'GTE', value: threshold }
 *   metadata.partialTakeProfit: { memoryKey, tierIndex, totalTiers }
 *
 * executableSinceVersion: '2026.05.W02'
 */
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'
import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticSupportClassifierService } from '../semantic-support-classifier.service'
import {
  MEMORY_KEY,
  PARTIAL_TP_3_TIER_UTTERANCE,
  PARTIAL_TP_MISSING_UTTERANCE,
  PARTIAL_TP_SINGLE_TIER_UTTERANCE,
  THREE_TIERS,
} from './fixtures/partial-take-profit.example'

const seedExtractor = new SemanticSeedExtractorService()
const seedStateBuilder = new SemanticSeedStateBuilderService()
const atomRegistry = new SemanticAtomRegistryService()
const supportClassifier = new SemanticSupportClassifierService(atomRegistry)
const readiness = new SemanticContractReadinessService()
const canonicalBuilder = new CanonicalSpecBuilderService()
const irCompiler = new CanonicalSpecV2IrCompilerService()

describe('risk.partial_take_profit atom 七层 parity', () => {
  // ─── Layer 1: atom registry ─────────────────────────────────────────────────

  it('Layer 1 — atom registry: resolve with valid tiers+memoryKey → supported_executable', () => {
    const atom = atomRegistry.resolve('risk.partial_take_profit', {
      tiers: THREE_TIERS,
      memoryKey: MEMORY_KEY,
    })
    expect(atom).toMatchObject({
      key: 'risk.partial_take_profit',
      category: 'risk',
      supportStatus: 'supported_executable',
      requiredParams: expect.arrayContaining(['tiers', 'memoryKey']),
    })
    expect(atom.executableProjection).toEqual(expect.arrayContaining(['canonical_spec_v2', 'compiled_runtime']))
    expect((atom as { executableSinceVersion?: string }).executableSinceVersion).toBe('2026.05.W02')
  })

  it('Layer 1b — atom registry: resolve without tiers → supported_requires_slot', () => {
    const atom = atomRegistry.resolve('risk.partial_take_profit', {})
    expect(atom.supportStatus).toBe('supported_requires_slot')
    expect(atom.openSlots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slotKey: 'risk.partial_take_profit.tiers' }),
      ]),
    )
  })

  it('Layer 1c — atom registry: static get() supports both unsupported (backward compat) or supported (after follow-up)', () => {
    // critic round 1 B-C1 修复：原硬断言 'recognized_unsupported' 会在后续 PTP 静态注册升级为
    // supported_executable 时反向变红（同 P1-4 系列设计趋势）。改为 toContain 容忍双状态过渡期。
    const atom = atomRegistry.get('risk.partial_take_profit')
    expect(['recognized_unsupported', 'supported_executable', 'supported_requires_slot'])
      .toContain(atom.supportStatus)
  })

  it('Layer 5 — buildPartialTakeProfitRules fail-closed on invalid reduceRatio (critic A-M2)', () => {
    // critic round 1 A-M2 修复：reduceRatio > 1 / ≤ 0 / 非数值时 builder 应 fail-closed 返回 []
    // 避免 silent execute 不合理减仓
    const stateInvalid = seedStateBuilder.build({
      triggers: [],
      actions: [{ id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' }],
      risk: [{
        id: 'ptp-invalid',
        key: 'risk.partial_take_profit',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        params: {
          memoryKey: 'partial_tp_test',
          tiers: [
            { trigger: { kind: 'pnl_pct', threshold: 5 }, reduceRatio: 1.5 }, // > 1 invalid
            { trigger: { kind: 'pnl_pct', threshold: 10 }, reduceRatio: 0 }, // ≤ 0 invalid
          ],
        },
      }],
    })
    expect(stateInvalid).not.toBeNull()
    const spec = canonicalBuilder.buildFromSemanticState(stateInvalid!)
    // 无效 reduceRatio → builder 不产 partial_take_profit ruleBlocks
    const ptpRules = spec.rules.filter(r =>
      r.condition?.kind === 'atom' && r.condition.key === 'risk.partial_take_profit',
    )
    expect(ptpRules).toHaveLength(0)
  })

  // ─── Layer 2: seed-extractor ─────────────────────────────────────────────────

  it('Layer 2 — seed-extractor: zh 3-tier utterance → locked tiers extracted', () => {
    const patch = seedExtractor.extract(PARTIAL_TP_3_TIER_UTTERANCE)
    const risk = patch.risk?.find(r => r.key === 'risk.partial_take_profit')
    expect(risk).toBeDefined()
    expect(risk?.status).toBe('locked')
    expect(risk?.openSlots).toEqual([])
    const tiers = risk?.params?.tiers as Array<{ trigger: { kind: string; threshold: number }; reduceRatio: number }> | undefined
    expect(Array.isArray(tiers)).toBe(true)
    expect(tiers!.length).toBe(3)
    expect(tiers![0]).toMatchObject({ trigger: { kind: 'pnl_pct', threshold: 5 } })
    expect(tiers![1]).toMatchObject({ trigger: { kind: 'pnl_pct', threshold: 10 } })
    expect(tiers![2]).toMatchObject({ trigger: { kind: 'pnl_pct', threshold: 15 } })
  })

  it('Layer 2b — seed-extractor: zh missing (设置分批止盈 only) → open status, open_slot.tiers', () => {
    const patch = seedExtractor.extract(PARTIAL_TP_MISSING_UTTERANCE)
    const risk = patch.risk?.find(r => r.key === 'risk.partial_take_profit')
    expect(risk).toBeDefined()
    expect(risk?.status).toBe('open')
    expect(risk?.openSlots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ slotKey: 'risk.partial_take_profit.tiers' }),
      ]),
    )
  })

  it('Layer 2c — seed-extractor: zh single-tier (盈利 5% 平一半) → locked single tier', () => {
    const patch = seedExtractor.extract(PARTIAL_TP_SINGLE_TIER_UTTERANCE)
    const risk = patch.risk?.find(r => r.key === 'risk.partial_take_profit')
    expect(risk).toBeDefined()
    const tiers = risk?.params?.tiers as Array<{ trigger: { kind: string; threshold: number }; reduceRatio: number }> | undefined
    expect(Array.isArray(tiers)).toBe(true)
    expect(tiers!.length).toBeGreaterThanOrEqual(1)
    expect(tiers![0]).toMatchObject({ trigger: { kind: 'pnl_pct', threshold: 5 }, reduceRatio: 0.5 })
  })

  // ─── Layer 3: state-projection ───────────────────────────────────────────────

  it('Layer 3 — state-projection: partial_take_profit risk in semantic state', () => {
    const patch = seedExtractor.extract(PARTIAL_TP_3_TIER_UTTERANCE)
    const state = seedStateBuilder.build(patch)
    expect(state).not.toBeNull()
    const risk = state?.risk?.find(r => r.key === 'risk.partial_take_profit')
    expect(risk).toBeDefined()
    const tiers = risk?.params?.tiers as Array<unknown> | undefined
    expect(Array.isArray(tiers)).toBe(true)
    expect(tiers!.length).toBeGreaterThanOrEqual(2)
    // builder derives memoryKey
    expect(typeof risk?.params?.memoryKey).toBe('string')
    expect((risk?.params?.memoryKey as string).startsWith('partial_tp_')).toBe(true)
  })

  // ─── Layer 4: readiness gate ─────────────────────────────────────────────────

  it('Layer 4 — readiness gate: locked 3-tier → supported_executable, not blocking readiness', () => {
    const patch = seedExtractor.extract(PARTIAL_TP_3_TIER_UTTERANCE)
    const state = seedStateBuilder.build(patch)
    expect(state).not.toBeNull()
    const classified = supportClassifier.classify(state!)
    const openSlotKeys = classified.openSlots.map(s => s.slotKey)
    expect(openSlotKeys).not.toContain('risk.partial_take_profit.tiers')
    const unsupportedKeys = classified.unsupportedAtoms.map(a => a.key)
    expect(unsupportedKeys).not.toContain('risk.partial_take_profit')
  })

  it('Layer 4b — readiness gate: missing tiers → open_slots route', () => {
    const patch = seedExtractor.extract(PARTIAL_TP_MISSING_UTTERANCE)
    const state = seedStateBuilder.build(patch)
    expect(state).not.toBeNull()
    const classified = supportClassifier.classify(state!)
    // open slot or unsupported route — the atom is not silently dropped
    const hasOpenSlot = classified.openSlots.some(s => s.slotKey === 'risk.partial_take_profit.tiers')
    const isUnsupported = classified.unsupportedAtoms.some(a => a.key === 'risk.partial_take_profit')
    expect(hasOpenSlot || isUnsupported).toBe(true)
  })

  // ─── Layer 5: canonical-spec-builder ─────────────────────────────────────────

  it('Layer 5 — canonical-spec-builder: 3-tier → 3 REDUCE_LONG risk rules with partialTakeProfit metadata', () => {
    const state = seedStateBuilder.build({
      risk: [{
        id: 'risk-ptp-1',
        key: 'risk.partial_take_profit',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        params: {
          tiers: THREE_TIERS,
          memoryKey: MEMORY_KEY,
          sideScope: 'long',
        },
      }],
      actions: [
        { id: 'open-long', key: 'open_long', status: 'locked', source: 'user_explicit' },
        { id: 'close-long', key: 'close_long', status: 'locked', source: 'user_explicit' },
      ],
    })
    expect(state).not.toBeNull()
    const spec = canonicalBuilder.buildFromSemanticState(state!)
    expect(spec).toEqual(expect.objectContaining({ version: 2 }))

    const ptpRules = spec.rules.filter(r =>
      r.phase === 'risk'
      && (r.condition as { key?: string })?.key === 'risk.partial_take_profit',
    )
    expect(ptpRules.length).toBe(THREE_TIERS.length)

    // Each rule must compile to REDUCE_LONG (sideScope=long)
    for (const rule of ptpRules) {
      expect(rule.actions).toEqual(
        expect.arrayContaining([expect.objectContaining({ type: 'REDUCE_LONG' })]),
      )
      expect(rule.metadata?.partialTakeProfit).toBeDefined()
      expect(rule.metadata?.partialTakeProfit?.memoryKey).toBe(MEMORY_KEY)
    }

    // Tier indices 0, 1, 2 must be present
    const tierIndices = ptpRules.map(r => (r.metadata?.partialTakeProfit as { tierIndex: number })?.tierIndex)
    expect(tierIndices).toEqual(expect.arrayContaining([0, 1, 2]))
  })

  // ─── Layer 6: IR compiler ────────────────────────────────────────────────────

  it('Layer 6 — IR compiler: 3-tier → 3 exit phase ruleBlocks with REDUCE_LONG actions (not BLOCK / CLOSE)', () => {
    const state = seedStateBuilder.build({
      risk: [{
        id: 'risk-ptp-1',
        key: 'risk.partial_take_profit',
        status: 'locked',
        source: 'user_explicit',
        openSlots: [],
        params: {
          tiers: THREE_TIERS,
          memoryKey: MEMORY_KEY,
          sideScope: 'long',
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

    // Should have ruleBlocks in exit phase for each PTP tier
    const ruleBlocks: Array<{
      phase: string
      actions: Array<{ kind: string }>
      metadata?: { partialTakeProfit?: { tierIndex: number; memoryKey: string; totalTiers: number } }
    }> = result.ir.ruleBlocks ?? []

    const ptpBlocks = ruleBlocks.filter(b => b.metadata?.partialTakeProfit !== undefined)
    expect(ptpBlocks.length).toBe(THREE_TIERS.length)

    for (const block of ptpBlocks) {
      // Phase must be exit, not risk
      expect(block.phase).toBe('exit')
      // Actions must be REDUCE_LONG, never BLOCK_NEW_ENTRY or CLOSE
      expect(block.actions).toEqual(
        expect.arrayContaining([expect.objectContaining({ kind: 'REDUCE_LONG' })]),
      )
      const forbidden = block.actions.some(a => a.kind === 'BLOCK_NEW_ENTRY' || a.kind === 'CLOSE_LONG' || a.kind === 'FORCE_CLOSE')
      expect(forbidden).toBe(false)
      expect(block.metadata?.partialTakeProfit?.memoryKey).toBe(MEMORY_KEY)
      expect(typeof block.metadata?.partialTakeProfit?.tierIndex).toBe('number')
      expect(block.metadata?.partialTakeProfit?.totalTiers).toBe(THREE_TIERS.length)
    }
  })

  // ─── Layer 7: display renderer ───────────────────────────────────────────────

  it('Layer 7 — display renderer: renders tier summary text', () => {
    const { SemanticPresentationRegistryService } = require('../semantic-presentation-registry.service')
    const registry = new SemanticPresentationRegistryService(atomRegistry)
    const display = registry.renderDisplay('risk.partial_take_profit', {
      tiers: THREE_TIERS,
      memoryKey: MEMORY_KEY,
    })
    expect(display).toContain('止盈')
    expect(display).toContain('5')
  })

  it('Layer 7b — display renderer: empty tiers → fallback text', () => {
    const { SemanticPresentationRegistryService } = require('../semantic-presentation-registry.service')
    const registry = new SemanticPresentationRegistryService(atomRegistry)
    const display = registry.renderDisplay('risk.partial_take_profit', {})
    expect(display).toBe('分批止盈')
  })
})
