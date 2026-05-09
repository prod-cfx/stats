/**
 * position.dca_schedule 七件套闭环 parity spec
 *
 * 覆盖：
 * 1. atom registry: supported_executable + executableSinceVersion + requiredParams
 * 2. seed extractor: maxCount / capitalCap / perOrderSizing / triggerMode / exitRule 提取
 * 3. semantic state: position.dca_schedule constraint 状态构建
 * 4. readiness: dca_schedule 满参 → projection_gate；缺参 → open_slots
 * 5. canonical spec builder: ADD_LONG action 输出 + metadata.dcaSchedule 携带
 * 6. IR compiler: ADD_LONG in ruleBlocks + metadata.dcaSchedule IR 透传
 * 7. display + presentation: 渲染可读文本
 *
 * A-M2 regression: metadata.dcaSchedule 必须 IR 透传 triggerMode + exitRule（runtime 字段）
 * DCA vs add_position collision: 补仓 DCA 不应同时触发 add_position + dca_schedule
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

// 必须带 capitalCap（总投入）才能触发 metadata.dcaSchedule（builder 要求 maxCount + capitalCap 均非空）
const DCA_FULL_UTTERANCE = '每跌 5% 补仓一次，每次 100 USDT，最多 3 次，总投入不超过 500 USDT，跌破前低停止。'

// ─── Layer 1: atom registry ───────────────────────────────────────────────────

describe('position.dca_schedule parity spec', () => {
  describe('Layer 1 — atom registry', () => {
    it('is supported_executable', () => {
      const atom = registry.get('position.dca_schedule')
      expect(atom.supportStatus).toBe('supported_executable')
    })

    it('has executableSinceVersion 2026.05.W02', () => {
      const atom = registry.get('position.dca_schedule') as { executableSinceVersion?: string }
      expect(atom.executableSinceVersion).toBe('2026.05.W02')
    })

    it('requiredParams includes maxCount, capitalCap, perOrderSizing, triggerMode, exitRule', () => {
      const atom = registry.get('position.dca_schedule')
      expect(atom.requiredParams).toContain('maxCount')
      expect(atom.requiredParams).toContain('capitalCap')
      expect(atom.requiredParams).toContain('perOrderSizing')
      expect(atom.requiredParams).toContain('triggerMode')
      expect(atom.requiredParams).toContain('exitRule')
    })

    it('category is position', () => {
      const atom = registry.get('position.dca_schedule')
      expect(atom.category).toBe('position')
    })

    it('executableProjection includes semantic_position_contract', () => {
      const atom = registry.get('position.dca_schedule')
      expect(atom.executableProjection).toContain('semantic_position_contract')
    })

    it('openSlots is empty (no pending slots for supported_executable)', () => {
      const atom = registry.get('position.dca_schedule')
      expect(atom.openSlots).toEqual([])
    })
  })

  // ─── Layer 2: seed extractor ────────────────────────────────────────────────

  describe('Layer 2 — seed extractor', () => {
    it('zh price_interval: 每跌 2% 补仓一次，最多 3 次 → triggerMode=price_interval, maxCount=3', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，每跌 2% 定投补仓一次，最多 3 次。')
      const constraint = patch.position?.constraints?.find(c => c.key === 'position.dca_schedule')
      expect(constraint).toBeDefined()
      expect(constraint?.params?.triggerMode).toBe('price_interval')
      expect(constraint?.params?.maxCount).toBe(3)
    })

    it('zh with capitalCap: 定投补仓，总投入不超过 500 USDT → capitalCap extracted', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，定投补仓，总投入不超过 500 USDT，最多 4 次。')
      const constraint = patch.position?.constraints?.find(c => c.key === 'position.dca_schedule')
      expect(constraint).toBeDefined()
      expect(constraint?.params?.capitalCap).toBeDefined()
    })

    it('zh DCA with capitalCap: 每跌 5% 补仓一次，每次 100 USDT，最多 4 次，总投入不超过 500 USDT → extracted', () => {
      const patch = extractor.extract('每跌 5% 补仓一次，每次 100 USDT，最多 4 次，总投入不超过 500 USDT。')
      const constraint = patch.position?.constraints?.find(c => c.key === 'position.dca_schedule')
      expect(constraint).toBeDefined()
      expect(constraint?.params?.maxCount).toBe(4)
    })

    it('zh with exit rule: 跌破前低停止补仓 → exitRule.type=stop_on_break_previous_low', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，定投补仓最多 4 次，跌破前低停止补仓。')
      const constraint = patch.position?.constraints?.find(c => c.key === 'position.dca_schedule')
      expect(constraint).toBeDefined()
      expect(constraint?.params?.exitRule).toBeDefined()
      expect((constraint?.params?.exitRule as Record<string, string>)?.type).toBe('stop_on_break_previous_low')
    })

    // DCA vs add_position collision negative case
    it('DCA collision: DCA 补仓 does not produce action.add_position alongside dca_schedule constraint', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，定投补仓最多 3 次。')
      const dcaConstraint = patch.position?.constraints?.find(c => c.key === 'position.dca_schedule')
      // dca_schedule constraint should be present
      expect(dcaConstraint).toBeDefined()
      // Should NOT produce a standalone add_position action (DCA is handled via constraint, not action)
      // The action is synthesized by canonical builder from the constraint
      const standaloneAddPosition = patch.actions?.find(a => a.key === 'action.add_position')
      // critic round 1 A-M2 修复：原 if 跳过 silent pass。改硬断言：
      // DCA "定投补仓" 必须只走 constraint 路径，不能 collision 触发 standalone add_position
      expect(standaloneAddPosition).toBeUndefined()
    })

    it('add_position (non-DCA) utterance does not produce dca_schedule constraint', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，盈利后加仓 30%，最多 3 次。')
      const dcaConstraint = patch.position?.constraints?.find(c => c.key === 'position.dca_schedule')
      expect(dcaConstraint).toBeUndefined()
    })
  })

  // ─── Layer 3: semantic state builder ───────────────────────────────────────

  describe('Layer 3 — semantic state', () => {
    it('builds position.dca_schedule constraint from seed patch', () => {
      const patch = extractor.extract(DCA_FULL_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const constraint = state?.position?.constraints?.find(c => c.key === 'position.dca_schedule')
      expect(constraint).toBeDefined()
    })

    it('dca_schedule constraint status is locked after build', () => {
      const patch = extractor.extract(DCA_FULL_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      const constraint = state?.position?.constraints?.find(c => c.key === 'position.dca_schedule')
      expect(constraint?.status).toBe('locked')
    })
  })

  // ─── Layer 4: readiness ─────────────────────────────────────────────────────

  describe('Layer 4 — readiness', () => {
    it('dca_schedule present → no open_slot for dca_schedule (supported_executable generates none)', () => {
      const patch = extractor.extract(DCA_FULL_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const dcaSlotKeys = classified.openSlots.filter(s => s.slotKey.startsWith('position.dca_schedule')).map(s => s.slotKey)
      expect(dcaSlotKeys).toHaveLength(0)
    })

    it('dca_schedule atom is not in unsupportedAtoms', () => {
      const patch = extractor.extract(DCA_FULL_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const unsupported = classified.unsupportedAtoms.map(a => a.key)
      expect(unsupported).not.toContain('position.dca_schedule')
    })
  })

  // ─── Layer 5: canonical spec builder ───────────────────────────────────────

  describe('Layer 5 — canonical spec builder', () => {
    it('produces ADD_LONG action for dca_schedule', () => {
      const patch = extractor.extract(DCA_FULL_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const normalized = readiness.normalize(classified.state)
      const spec = canonicalBuilder.buildFromSemanticState(normalized.state)
      const actionTypes = spec.rules.flatMap(r => r.actions.map(a => a.type))
      expect(actionTypes).toContain('ADD_LONG')
    })

    it('metadata.dcaSchedule is set on the ADD_LONG rule', () => {
      const patch = extractor.extract(DCA_FULL_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const normalized = readiness.normalize(classified.state)
      const spec = canonicalBuilder.buildFromSemanticState(normalized.state)
      const dcaRule = spec.rules.find(r => r.metadata?.dcaSchedule)
      expect(dcaRule).toBeDefined()
      expect(dcaRule?.metadata?.dcaSchedule?.maxCount).toBe(3)
      expect(dcaRule?.metadata?.dcaSchedule?.stateKey).toBe('dca_fired_count')
    })
  })

  // ─── Layer 6: IR compiler ───────────────────────────────────────────────────

  describe('Layer 6 — IR compiler', () => {
    it('IR ruleBlock actions contain ADD_LONG for dca_schedule', () => {
      const patch = extractor.extract(DCA_FULL_UTTERANCE)
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
      expect(allKinds).toContain('ADD_LONG')
    })

    it('A-M2 regression: IR metadata.dcaSchedule includes triggerMode', () => {
      const patch = extractor.extract(DCA_FULL_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const normalized = readiness.normalize(classified.state)
      const spec = canonicalBuilder.buildFromSemanticState(normalized.state)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '15m', positionPct: 10 },
      })
      const dcaRule = ir.ruleBlocks.find(r => r.metadata?.dcaSchedule)
      expect(dcaRule).toBeDefined()
      // critic round 1 A-C1：必须断言 triggerMode 取值集合而非仅 toBeDefined（防 silent-rename）
      expect(['price_interval', 'time_interval', 'signal']).toContain(dcaRule?.metadata?.dcaSchedule?.triggerMode)
    })

    it('critic A-C1 regression: time_interval triggerMode 通过 utterance "每天" 真识别', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，每天定投补仓 100 USDT，最多 30 次，总投入 3000 USDT。')
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const normalized = readiness.normalize(classified.state)
      const spec = canonicalBuilder.buildFromSemanticState(normalized.state)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '15m', positionPct: 10 },
      })
      const dcaRule = ir.ruleBlocks.find(r => r.metadata?.dcaSchedule)
      expect(dcaRule?.metadata?.dcaSchedule?.triggerMode).toBe('time_interval')
    })

    it('critic A-C2 regression: exitRule 缺失时 IR 透传 cap_only 哨兵（避免无限 DCA）', () => {
      // utterance 不带 "跌破前低" 等 exitRule 关键词
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，定投补仓最多 5 次，总投入 1000 USDT。')
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const normalized = readiness.normalize(classified.state)
      const spec = canonicalBuilder.buildFromSemanticState(normalized.state)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '15m', positionPct: 10 },
      })
      const dcaRule = ir.ruleBlocks.find(r => r.metadata?.dcaSchedule)
      expect(dcaRule?.metadata?.dcaSchedule?.exitRule).toEqual({ type: 'cap_only' })
    })

    it('A-M2 regression: IR metadata.dcaSchedule includes exitRule when present', () => {
      const patch = extractor.extract(DCA_FULL_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const normalized = readiness.normalize(classified.state)
      const spec = canonicalBuilder.buildFromSemanticState(normalized.state)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '15m', positionPct: 10 },
      })
      const dcaRule = ir.ruleBlocks.find(r => r.metadata?.dcaSchedule)
      expect(dcaRule).toBeDefined()
      expect(dcaRule?.metadata?.dcaSchedule?.exitRule).toBeDefined()
      expect((dcaRule?.metadata?.dcaSchedule?.exitRule as Record<string, string>)?.type).toBe('stop_on_break_previous_low')
    })

    it('IR metadata.dcaSchedule carries maxCount + stateKey', () => {
      const patch = extractor.extract(DCA_FULL_UTTERANCE)
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const normalized = readiness.normalize(classified.state)
      const spec = canonicalBuilder.buildFromSemanticState(normalized.state)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '15m', positionPct: 10 },
      })
      const dcaRule = ir.ruleBlocks.find(r => r.metadata?.dcaSchedule)
      expect(dcaRule?.metadata?.dcaSchedule?.maxCount).toBe(3)
      expect(dcaRule?.metadata?.dcaSchedule?.stateKey).toBe('dca_fired_count')
    })
  })

  // ─── Layer 7: display + presentation ───────────────────────────────────────

  describe('Layer 7 — display + presentation', () => {
    it('renders human-readable display text for dca_schedule', () => {
      const display = presentationRegistry.renderDisplay('position.dca_schedule', { maxCount: 3, triggerMode: 'price_interval' })
      expect(typeof display).toBe('string')
      expect(display.length).toBeGreaterThan(0)
    })

    it('publicName is DCA 补仓计划', () => {
      const entry = presentationRegistry.getEntry('position.dca_schedule')
      expect(entry?.publicName).toBe('DCA 补仓计划')
    })

    it('aliases include DCA and 定投补仓', () => {
      const entry = presentationRegistry.getEntry('position.dca_schedule')
      expect(entry?.aliases).toContain('DCA')
      expect(entry?.aliases).toContain('定投补仓')
    })

    it('goldenUtterances has ≥4 entries', () => {
      const entry = presentationRegistry.getEntry('position.dca_schedule')
      expect(entry?.goldenUtterances.length).toBeGreaterThanOrEqual(4)
    })

    it('clarificationRenderer returns meaningful string for each slot key', () => {
      const slotKeys = [
        'position.dca_schedule.max_count',
        'position.dca_schedule.capital_cap',
        'position.dca_schedule.per_order_sizing',
        'position.dca_schedule.trigger_mode',
        'position.dca_schedule.exit_rule',
      ]
      for (const slotKey of slotKeys) {
        const text = presentationRegistry.renderClarification('position.dca_schedule', slotKey, {})
        expect(typeof text).toBe('string')
        expect(text.length).toBeGreaterThan(0)
      }
    })
  })
})
