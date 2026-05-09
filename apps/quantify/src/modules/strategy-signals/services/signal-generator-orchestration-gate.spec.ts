import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { evaluateOrchestrationGates } from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-gates'

/**
 * Phase 5 S1 Task 15 (US-013) — live-signal fast path 接入 orchestration gate。
 *
 * 行为同源 backtest（US-012），共用同一 evaluator import path。本 spec 做 light
 * integration，验证 wiring + evaluator 行为；端到端的 OPEN_LONG / NOOP / W5
 * CLOSE_SHORT 行为分别由 US-010 (evaluator)、US-011 (decision program gate)、
 * US-012 (backtest 对称)、US-014 (parity) 覆盖，不在此重复。
 */
describe('signalGeneratorService orchestration gate (live-signal fast path)', () => {
  describe('evaluator wiring (projection.orchestrationGates → state)', () => {
    const gates = [
      {
        id: 'gate_regime_long',
        exprId: 'expr_gate_long',
        target: { phase: 'entry' as const, sideScope: 'long' as const },
        effectWhenFalse: 'block_new_entries' as const,
      },
    ]

    it('15.1.A: gate=true → state 不阻断 long entry', () => {
      const state = evaluateOrchestrationGates(gates, { expr_gate_long: true })
      expect(state.blockEntryLong).toBe(false)
    })

    it('15.1.B: gate=false → state.blockEntryLong=true', () => {
      const state = evaluateOrchestrationGates(gates, { expr_gate_long: false })
      expect(state.blockEntryLong).toBe(true)
    })

    it('15.1.C (W5): gate sideScope=long 不阻断 short 侧 → 不影响 CLOSE_SHORT', () => {
      const state = evaluateOrchestrationGates(gates, { expr_gate_long: false })
      expect(state.blockEntryLong).toBe(true)
      expect(state.blockEntryShort).toBe(false)
    })

    it('空 gate 列表 → state 全 false', () => {
      const state = evaluateOrchestrationGates([], {})
      expect(state.blockEntryLong).toBe(false)
      expect(state.blockEntryShort).toBe(false)
    })
  })

  describe('source wiring (signal-generator.service.ts)', () => {
    const src = readFileSync(resolve(__dirname, 'signal-generator.service.ts'), 'utf8')

    it('imports evaluateOrchestrationGates from shared compiled-runtime', () => {
      expect(src).toContain('evaluateOrchestrationGates')
      expect(src).toContain('@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-gates')
    })

    it('调用 evaluateOrchestrationGates 并 fallback 到 []', () => {
      expect(src).toMatch(/evaluateOrchestrationGates\([\s\S]*?orchestrationGates[\s\S]*?\?\?\s*\[\]/)
    })

    it('runDecisionPrograms 接收 orchestrationGateState 作为参数', () => {
      expect(src).toMatch(/runDecisionPrograms\([\s\S]*?orchestrationGateState[\s\S]*?\)/)
    })
  })
})
