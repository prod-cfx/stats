import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  evaluateOrchestrationPortfolioRisks,
  type CompiledOrchestrationPortfolioRisk,
} from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-portfolio-risks'

/**
 * Phase 5 S7 Task 14 (issue #984) — live-signal fast path 接入 portfolio risk evaluator。
 *
 * 与 backtest 共用同一 evaluator import path，行为同源。本 spec 做 light
 * integration：验证 wiring + evaluator 行为；端到端的 OPEN_*→NOOP 行为由
 * run-decision-programs.spec.ts 覆盖，不在此重复。
 *
 * Drawdown 数据源 read-only：当前 ctx.accountDrawdownPct 暂未由 live infra 注入，
 * enforce 模式缺数据走 fail-closed double block，与 plan Task 14.1 一致。
 */
describe('signalGeneratorService portfolio risk gate (live-signal fast path)', () => {
  describe('evaluator wiring (projection.orchestrationPortfolioRisks → state)', () => {
    const risks: CompiledOrchestrationPortfolioRisk[] = [
      {
        id: 'risk_account_drawdown',
        scope: 'portfolio',
        mode: 'enforce',
        thresholdPct: 10,
        effectWhenTriggered: 'block_new_entries',
      },
    ]

    it('14.2.A: drawdownPct=5 < threshold=10, enforce → 不阻断', () => {
      const state = evaluateOrchestrationPortfolioRisks(risks, { drawdownPct: 5 })
      expect(state.blockEntryLong).toBe(false)
      expect(state.blockEntryShort).toBe(false)
      expect(state.observedBreaches).toEqual([])
    })

    it('14.2.B: drawdownPct=12 ≥ threshold=10, enforce → blockLong/Short=true', () => {
      const state = evaluateOrchestrationPortfolioRisks(risks, { drawdownPct: 12 })
      expect(state.blockEntryLong).toBe(true)
      expect(state.blockEntryShort).toBe(true)
      expect(state.observedBreaches).toEqual([])
    })

    it('14.2.C: drawdownPct=12 ≥ threshold=10, observe → 不阻断 + observedBreaches 含 id', () => {
      const observeRisks: CompiledOrchestrationPortfolioRisk[] = [
        {
          id: 'risk_account_drawdown',
          scope: 'portfolio',
          mode: 'observe',
          thresholdPct: 10,
          effectWhenTriggered: 'block_new_entries',
        },
      ]
      const state = evaluateOrchestrationPortfolioRisks(observeRisks, { drawdownPct: 12 })
      expect(state.blockEntryLong).toBe(false)
      expect(state.blockEntryShort).toBe(false)
      expect(state.observedBreaches).toContain('risk_account_drawdown')
    })

    it('14.2.D: drawdownPct=undefined, enforce → fail-closed double block', () => {
      const state = evaluateOrchestrationPortfolioRisks(risks, { drawdownPct: undefined })
      expect(state.blockEntryLong).toBe(true)
      expect(state.blockEntryShort).toBe(true)
    })
  })

  describe('source wiring (signal-generator.service.ts)', () => {
    const src = readFileSync(resolve(__dirname, 'signal-generator.service.ts'), 'utf8')

    it('imports evaluateOrchestrationPortfolioRisks from shared compiled-runtime', () => {
      expect(src).toContain('evaluateOrchestrationPortfolioRisks')
      expect(src).toContain('@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-portfolio-risks')
    })

    it('调用 evaluateOrchestrationPortfolioRisks 并 fallback 到 []', () => {
      expect(src).toMatch(/evaluateOrchestrationPortfolioRisks\([\s\S]*?orchestrationPortfolioRisks[\s\S]*?\?\?\s*\[\]/)
    })

    it('evaluator 接收 ctx.accountDrawdownPct 作为 drawdownPct 数据源', () => {
      expect(src).toMatch(/drawdownPct:\s*ctx\.accountDrawdownPct/)
    })

    it('runDecisionPrograms 接收 portfolioRiskState 作为第 7 参数', () => {
      expect(src).toMatch(/runDecisionPrograms\([\s\S]*?orchestrationGateState[\s\S]*?portfolioRiskState[\s\S]*?\)/)
    })
  })
})
