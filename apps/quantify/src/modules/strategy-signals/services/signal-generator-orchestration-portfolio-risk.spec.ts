import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  evaluateOrchestrationPortfolioRisks,
  type CompiledOrchestrationPortfolioRisk,
} from '@ai/shared/script-engine/compiled-runtime/evaluate-orchestration-portfolio-risks'
import { SignalGenerationDecisionStage } from './signal-generation-decision.stage'

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

    it('#1058 Mn3: drawdownPct=NaN, enforce → fail-closed double block (防退化)', () => {
      const state = evaluateOrchestrationPortfolioRisks(risks, { drawdownPct: Number.NaN })
      expect(state.blockEntryLong).toBe(true)
      expect(state.blockEntryShort).toBe(true)
    })

    it('#1058 R1: drawdownPct=Infinity, enforce → fail-closed double block', () => {
      const state = evaluateOrchestrationPortfolioRisks(risks, { drawdownPct: Number.POSITIVE_INFINITY })
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
      // Phase 5 S8 (#1119): evaluator 输入路径变为 filterPortfolioRisksForLiveSignal(orchestrationPortfolioRisks ?? [])
      //   - orchestrationPortfolioRisks ?? [] 仍是 fallback 起点
      //   - evaluateOrchestrationPortfolioRisks(...) 仍被调用
      expect(src).toMatch(/orchestrationPortfolioRisks[\s\S]*?\?\?\s*\[\]/)
      expect(src).toMatch(/evaluateOrchestrationPortfolioRisks\(/)
    })

    it('evaluator 接收 ctx.accountDrawdownPct 作为 drawdownPct 数据源', () => {
      expect(src).toMatch(/drawdownPct:\s*ctx\.accountDrawdownPct/)
    })

    it('runDecisionProgramsSubStrategyFanOut 接收 portfolioRiskState 作为第 7 参数', () => {
      // Phase 5 S10 follow-up (#1131) 之后，signal-generator 改走
      // runDecisionProgramsSubStrategyFanOut 包装；portfolioRiskState 仍紧跟
      // orchestrationGateState 之后透传，第 7 参数语义保持。
      expect(src).toMatch(/runDecisionProgramsSubStrategyFanOut\([\s\S]*?orchestrationGateState[\s\S]*?portfolioRiskState[\s\S]*?\)/)
    })

    it('#1058 R3 A_new: buildPublishedStrategyContext 注入 instance.drawdownPct 直接读（无 cast）', () => {
      // 验证 consumer 端真实读取 StrategyInstance.drawdownPct（caller R3 决策 A_new）；
      // 不允许 `(instance as { drawdownPct?... }).drawdownPct` 类型断言绕过
      expect(src).toMatch(/accountDrawdownPct:\s*instance\.drawdownPct\s*\?\?\s*undefined/)
      expect(src).not.toMatch(/instance as \{\s*drawdownPct/)
    })
  })

  describe('Task 10 live published strategy runtime context', () => {
    it('builds data.primary 15m/1h/4h through shared runtime context assembler by primary close timestamp', () => {
      const stage = new SignalGenerationDecisionStage(
        {},
        { error: jest.fn(), warn: jest.fn(), debug: jest.fn(), log: jest.fn() },
      )
      const context = stage.buildPublishedStrategyContext({
        bars: [],
        symbol: 'BTCUSDT',
        timeframe: '15m',
        indicators: {},
        currentPrice: 110,
        timestamp: 18_000_000,
        params: { marketType: 'perp' },
        runtimeBarsByTimeframe: {
          '15m': [
            { symbol: 'BTCUSDT', timeframe: '15m', openTime: 17_100_000, closeTime: 18_000_000, open: 100, high: 112, low: 99, close: 110, volume: 1 },
          ],
          '1h': [
            { symbol: 'BTCUSDT', timeframe: '1h', openTime: 14_400_000, closeTime: 18_000_000, open: 101, high: 113, low: 98, close: 109, volume: 10 },
            { symbol: 'BTCUSDT', timeframe: '1h', openTime: 18_000_000, closeTime: 21_600_000, open: 109, high: 116, low: 107, close: 114, volume: 11 },
          ],
          '4h': [
            { symbol: 'BTCUSDT', timeframe: '4h', openTime: 0, closeTime: 14_400_000, open: 90, high: 115, low: 89, close: 108, volume: 40 },
            { symbol: 'BTCUSDT', timeframe: '4h', openTime: 14_400_000, closeTime: 28_800_000, open: 108, high: 118, low: 106, close: 116, volume: 42 },
          ],
        },
      } as Parameters<SignalGenerationDecisionStage['buildPublishedStrategyContext']>[0] & {
        runtimeBarsByTimeframe: Record<string, unknown[]>
      })

      expect(context.data.primary['15m'].bars.map(bar => bar.timestamp)).toEqual([18_000_000])
      expect(context.data.primary['1h'].bars.map(bar => bar.timestamp)).toEqual([18_000_000])
      expect(context.data.primary['4h'].bars.map(bar => bar.timestamp)).toEqual([14_400_000])
      expect(context.dataRequirements.primary).toEqual(['15m', '1h', '4h'])
      expect(context.execution.timeframe).toBe('15m')
    })

    it('keeps legacy fields when runtime market context has no base bars', () => {
      const stage = new SignalGenerationDecisionStage(
        {},
        { error: jest.fn(), warn: jest.fn(), debug: jest.fn(), log: jest.fn() },
      )
      const legacyBars = [
        { open: 100, high: 112, low: 99, close: 110, volume: 1, timestamp: 18_000_000 },
      ]

      const context = stage.buildPublishedStrategyContext({
        bars: legacyBars,
        symbol: 'BTCUSDT',
        timeframe: '15m',
        indicators: { ema20: 108 },
        currentPrice: 110,
        timestamp: 18_000_000,
        params: { marketType: 'perp' },
        runtimeBarsByTimeframe: {
          '1h': [],
        },
      } as Parameters<SignalGenerationDecisionStage['buildPublishedStrategyContext']>[0] & {
        runtimeBarsByTimeframe: Record<string, unknown[]>
      })

      expect(context.bars).toBe(legacyBars)
      expect(context.symbol).toBe('BTCUSDT')
      expect(context.timeframe).toBe('15m')
      expect(context.currentPrice).toBe(110)
      expect(context.indicators).toEqual({ ema20: 108 })
    })

    it('loads published snapshot runtime bars from all dataRequirements timeframes', () => {
      const src = readFileSync(resolve(__dirname, 'signal-generator.service.ts'), 'utf8')

      expect(src).toMatch(/const runtimeTimeframes = this\.resolvePublishedRuntimeTimeframes\(strategy, timeframe\)/)
      expect(src).toMatch(/runtimeBarsByTimeframe:\s*runtimeBarsByTimeframe\.marketBarsByTimeframe/)
    })
  })
})
