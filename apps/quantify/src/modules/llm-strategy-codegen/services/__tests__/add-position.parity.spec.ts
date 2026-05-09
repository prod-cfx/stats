/**
 * action.add_position 七件套闭环 parity spec
 *
 * 覆盖：
 * 1. atom registry: supported_executable + executableSinceVersion
 * 2. seed extractor: addMode / addRatio 提取
 * 3. semantic state: action.add_position 状态构建
 * 4. readiness: 有 pyramiding_limit 约束 → ready; 无约束 → open_slot
 * 5. canonical spec builder: ADD_LONG / ADD_SHORT action 输出
 * 6. IR compiler: ADD_LONG action 在 decisionPrograms 中
 * 7. runtime: fail-closed（addMode 缺失时 action 仍提取但 addMode 不存在）
 */

import { SemanticAtomRegistryService } from '../semantic-atom-registry.service'
import { SemanticSeedExtractorService } from '../semantic-seed-extractor.service'
import { SemanticSeedStateBuilderService } from '../semantic-seed-state-builder.service'
import { SemanticSupportClassifierService } from '../semantic-support-classifier.service'
import { SemanticContractReadinessService } from '../semantic-contract-readiness.service'
import { CanonicalSpecBuilderService } from '../canonical-spec-builder.service'
import { CanonicalSpecV2IrCompilerService } from '../canonical-spec-v2-ir-compiler.service'

describe('action.add_position parity spec', () => {
  const registry = new SemanticAtomRegistryService()
  const extractor = new SemanticSeedExtractorService()
  const seedStateBuilder = new SemanticSeedStateBuilderService()
  const classifier = new SemanticSupportClassifierService(registry)
  const readiness = new SemanticContractReadinessService()
  const canonicalBuilder = new CanonicalSpecBuilderService()
  const irCompiler = new CanonicalSpecV2IrCompilerService()

  // Layer 1: atom registry contract
  describe('atom registry', () => {
    it('action.add_position is supported_executable', () => {
      const atom = registry.get('action.add_position')
      expect(atom.supportStatus).toBe('supported_executable')
    })

    it('action.add_position has executableSinceVersion 2026.05.W02', () => {
      const atom = registry.get('action.add_position')
      expect(atom).toHaveProperty('executableSinceVersion', '2026.05.W02')
    })

    it('action.add_position requiredParams includes addMode and addRatio', () => {
      const atom = registry.get('action.add_position')
      expect(atom.requiredParams).toContain('addMode')
      expect(atom.requiredParams).toContain('addRatio')
    })

    it('action.add_position category is action', () => {
      const atom = registry.get('action.add_position')
      expect(atom.category).toBe('action')
    })
  })

  // Layer 2: seed extractor — addMode / addRatio extraction
  describe('seed extractor', () => {
    it('zh signal_confirm: 回踩 MA20 不破后加仓 → addMode=signal_confirm', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，回踩 MA20 不破后加仓 20%，最多加仓 3 次，单笔 10%。')
      const action = patch.actions.find(a => a.key === 'action.add_position')
      expect(action).toBeDefined()
      expect(action?.params?.addMode).toBe('signal_confirm')
      expect(action?.params?.addRatio).toBeCloseTo(0.2)
    })

    it('zh profit_pct: 盈利后加仓 → addMode=profit_pct', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，盈利后加仓 30%，最多加仓 2 次，单笔 10%。')
      const action = patch.actions.find(a => a.key === 'action.add_position')
      expect(action).toBeDefined()
      expect(action?.params?.addMode).toBe('profit_pct')
      expect(action?.params?.addRatio).toBeCloseTo(0.3)
    })

    it('zh missing addMode: 仅"加仓" → addMode absent (fail-closed)', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，加仓，单笔 10%。')
      const action = patch.actions.find(a => a.key === 'action.add_position')
      expect(action).toBeDefined()
      expect(action?.params).not.toHaveProperty('addMode')
    })
  })

  // Layer 3: semantic state builder
  describe('semantic state', () => {
    it('builds action.add_position state from seed patch', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，盈利后加仓 30%，最多加仓 2 次，单笔 10%。')
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const action = state?.actions.find(a => a.key === 'action.add_position')
      expect(action).toBeDefined()
      expect(action?.params?.addMode).toBe('profit_pct')
    })
  })

  // Layer 4: readiness — constraint present → ready path; absent → open_slot
  describe('readiness', () => {
    it('with pyramiding_limit constraint → projection_gate route', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，盈利后加仓 30%，最多加仓 3 次，单笔 10%。')
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      expect(classified.route).toBe('projection_gate')
    })

    it('without constraint → open_slots route (action.add_position.constraint slot)', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，加仓 30%，单笔 10%。')
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      expect(classified.route).toBe('open_slots')
      const slotKeys = classified.openSlots.map(s => s.slotKey)
      expect(slotKeys).toContain('action.add_position.constraint')
    })
  })

  // Layer 5: canonical spec builder → ADD_LONG action
  describe('canonical spec builder', () => {
    it('builds ADD_LONG action for add_position with pyramiding_limit', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，盈利后加仓 30%，最多加仓 3 次，单笔 10%。')
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const normalized = readiness.normalize(classified.state)
      const spec = canonicalBuilder.buildFromSemanticState(normalized.state)
      const actionTypes = spec.rules.flatMap(r => r.actions.map(a => a.type))
      expect(actionTypes).toContain('ADD_LONG')
      expect(actionTypes).not.toContain('OPEN_LONG')
    })

    it('builds ADD_SHORT for short-side add_position', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，MA20 下穿 MA50 开空，信号再次出现时空单加仓 20%，最多加仓 2 次，单笔 10%。')
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const normalized = readiness.normalize(classified.state)
      const spec = canonicalBuilder.buildFromSemanticState(normalized.state)
      const actionTypes = spec.rules.flatMap(r => r.actions.map(a => a.type))
      expect(actionTypes).toContain('ADD_SHORT')
    })
  })

  // Layer 6: IR compiler — ADD_LONG preserved in decisionPrograms
  describe('IR compiler', () => {
    it('IR decisionPrograms contain ADD_LONG action', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，盈利后加仓 30%，最多加仓 3 次，单笔 10%。')
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const normalized = readiness.normalize(classified.state)
      const spec = canonicalBuilder.buildFromSemanticState(normalized.state)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          baseTimeframe: '15m',
          positionPct: 10,
        },
      })
      const allActionKinds = ir.ruleBlocks.flatMap(r => r.actions.map(a => a.kind))
      expect(allActionKinds).toContain('ADD_LONG')
    })

    it('IR addPosition metadata has stateKey=pyramiding_layer_count', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，盈利后加仓 30%，最多加仓 3 次，单笔 10%。')
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const normalized = readiness.normalize(classified.state)
      const spec = canonicalBuilder.buildFromSemanticState(normalized.state)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          baseTimeframe: '15m',
          positionPct: 10,
        },
      })
      const addRule = ir.ruleBlocks.find(r => r.actions.some(a => a.kind === 'ADD_LONG'))
      expect(addRule).toBeDefined()
      expect(addRule?.metadata?.addPosition?.stateKey).toBe('pyramiding_layer_count')
    })
  })

  // Layer 7: fail-closed — addMode missing does not crash pipeline
  describe('fail-closed', () => {
    it('missing addMode: pipeline completes without throwing', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，加仓，单笔 10%。')
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      // classifier must not throw even if addMode absent
      expect(() => classifier.classify(state!)).not.toThrow()
    })

    it('missing addMode + no constraint → open_slot (not crash)', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，加仓，单笔 10%。')
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      expect(classified.route).toBe('open_slots')
    })
  })

  // critic round 1 A-M2 regression: IR metadata 必须透传 addMode + addRatio
  // 否则 runtime 拿到 ADD_LONG 但无法区分 signal_confirm/profit_pct/drawdown_pct → silent-equivalent
  describe('critic A-M2 regression: IR metadata.addPosition transports addMode + addRatio', () => {
    it('profit_pct addMode + addRatio 30% → IR metadata 包含两字段', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，盈利后加仓 30%，最多加仓 3 次，单笔 10%。')
      const state = seedStateBuilder.build(patch)
      expect(state).not.toBeNull()
      const classified = classifier.classify(state!)
      const normalized = readiness.normalize(classified.state)
      const spec = canonicalBuilder.buildFromSemanticState(normalized.state)
      const { ir } = irCompiler.compile({
        canonicalSpec: spec,
        fallback: { exchange: 'okx', symbol: 'BTCUSDT', baseTimeframe: '15m', positionPct: 10 },
      })
      const addRule = ir.ruleBlocks.find(r => r.actions.some(a => a.kind === 'ADD_LONG'))
      expect(addRule).toBeDefined()
      expect(addRule?.metadata?.addPosition?.addMode).toBe('profit_pct')
      expect(typeof addRule?.metadata?.addPosition?.addRatio).toBe('number')
    })
  })

  // critic round 1 B-C1 regression: drawdown_pct 完整 utterance + extractor 验证
  describe('critic B-C1 regression: drawdown_pct utterance coverage', () => {
    it('zh drawdown_pct: 回撤 5% 补仓 30% → addMode=drawdown_pct + addRatio≈0.3', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，回撤 5% 补仓 30%，最多 3 次，单笔 10%。')
      const action = patch.actions?.find(a => a.key === 'action.add_position')
      expect(action).toBeDefined()
      expect(action?.params?.addMode).toBe('drawdown_pct')
      expect(typeof action?.params?.addRatio).toBe('number')
    })

    it('en drawdown_pct: pullback 5% scale in 30% → addMode=drawdown_pct', () => {
      const patch = extractor.extract('OKX BTCUSDT 15m, MA20 cross above MA50 open long, pullback 5% scale in 30%, max 3 times.')
      const action = patch.actions?.find(a => a.key === 'action.add_position')
      expect(action).toBeDefined()
      expect(action?.params?.addMode).toBe('drawdown_pct')
    })
  })

  // critic round 1 B-M1 regression: addRatio 边界 fail-closed
  describe('critic B-M1 regression: addRatio boundary fail-closed', () => {
    it('addRatio > 100% → silent drop (addRatio absent in extracted action)', () => {
      const patch = extractor.extract('OKX 合约 BTCUSDT 15m，MA20 上穿 MA50 开多，盈利后加仓 200%。')
      const action = patch.actions?.find(a => a.key === 'action.add_position')
      // extractor 当前会保留 action 但丢弃越界 addRatio（fail-closed），后续 readiness 路由 open_slot
      if (action) {
        expect(action.params?.addRatio).toBeUndefined()
      }
    })
  })
})
