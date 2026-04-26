import type {
  OptimizerBar,
  TemplateOptimizationCandidate,
} from '../optimize-official-templates'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  calculateBacktestMetrics,
  renderEvidenceConstantSource,
  runMovingAverageLongOnly,
  selectBestCandidate,
} from '../optimize-official-templates'

const bars: OptimizerBar[] = [
  { ts: 1, open: 100, high: 102, low: 99, close: 101, volume: 1 },
  { ts: 2, open: 101, high: 104, low: 100, close: 103, volume: 1 },
  { ts: 3, open: 103, high: 106, low: 102, close: 105, volume: 1 },
  { ts: 4, open: 105, high: 108, low: 104, close: 107, volume: 1 },
  { ts: 5, open: 107, high: 109, low: 95, close: 96, volume: 1 },
  { ts: 6, open: 96, high: 99, low: 94, close: 98, volume: 1 },
  { ts: 7, open: 98, high: 102, low: 97, close: 101, volume: 1 },
  { ts: 8, open: 101, high: 106, low: 100, close: 105, volume: 1 },
  { ts: 9, open: 105, high: 110, low: 104, close: 109, volume: 1 },
  { ts: 10, open: 109, high: 111, low: 90, close: 92, volume: 1 },
]

const evidencePath = resolve(
  __dirname,
  '../../../src/modules/strategy-plaza/constants/official-strategy-plaza-backtest-evidence.json',
)
const evidenceConstantPath = resolve(
  __dirname,
  '../../../src/modules/strategy-plaza/constants/official-strategy-plaza-backtest-evidence.constant.ts',
)

describe('strategy plaza optimizer', () => {
  it('calculates reproducible backtest metrics from closed trades and equity', () => {
    const metrics = calculateBacktestMetrics({
      initialCash: 10000,
      equityCurve: [
        { ts: 1, equity: 10000 },
        { ts: 2, equity: 10500 },
        { ts: 3, equity: 9800 },
        { ts: 4, equity: 11200 },
      ],
      trades: [
        { entryTs: 1, exitTs: 2, entryPrice: 100, exitPrice: 105, pnlPct: 5 },
        { entryTs: 3, exitTs: 4, entryPrice: 100, exitPrice: 98, pnlPct: -2 },
      ],
    })

    expect(metrics.winRate).toBe(0.5)
    expect(metrics.maxDrawdownPct).toBeCloseTo(6.67, 2)
    expect(metrics.totalReturnPct).toBe(12)
    expect(metrics.tradeCount).toBe(2)
  })

  it('runs a deterministic MA long-only candidate', () => {
    const result = runMovingAverageLongOnly(bars, {
      fastPeriod: 2,
      slowPeriod: 3,
      stopLossPct: 5,
      takeProfitPct: 12,
      positionPct: 10,
    })

    expect(result.equityCurve.length).toBeGreaterThan(0)
    expect(result.trades.length).toBeGreaterThanOrEqual(1)
  })

  it('selects candidates that pass admission by score', () => {
    const candidates: TemplateOptimizationCandidate[] = [
      {
        templateId: 'a',
        params: { fastPeriod: 5 },
        metrics: { winRate: 0.55, maxDrawdownPct: 18, totalReturnPct: 10, tradeCount: 50 },
      },
      {
        templateId: 'a',
        params: { fastPeriod: 8 },
        metrics: { winRate: 0.62, maxDrawdownPct: 12, totalReturnPct: 18, tradeCount: 60 },
      },
    ]

    expect(selectBestCandidate(candidates, {
      maxDrawdownPctCeiling: 20,
      minWinRate: 0.52,
      minTradeCount: 40,
    })?.params).toEqual({ fastPeriod: 8 })
  })

  it('commits auditable fixed-window evidence for exactly six official templates', () => {
    const evidence = JSON.parse(readFileSync(evidencePath, 'utf8')) as {
      status: string
      admission: {
        maxDrawdownPctCeiling: number
        minWinRate: number
        minTradeCount: number
        minTotalReturnPct: number
      }
      templates: Array<{
        templateId: string
        parameterSearchId?: string
        exchange?: string
        symbol: string
        interval: string
        marketType?: string
        source?: string
        dataSource?: {
          exchange: string
          marketType: string
          endpoint: string
          fixedEndTs: number
        }
        backtestFrom?: number
        backtestTo?: number
        admission?: {
          maxDrawdownPctCeiling: number
          minWinRate: number
          minTradeCount: number
        }
        candidateCount?: number
        candleCount: number
        params?: Record<string, number | string | boolean>
        metrics?: {
          winRate: number
          maxDrawdownPct: number
          totalReturnPct: number
          tradeCount: number
        }
        best?: {
          params: Record<string, number | string | boolean>
          metrics: {
            winRate: number
            maxDrawdownPct: number
            totalReturnPct: number
            tradeCount: number
          }
        }
      }>
    }

    expect(evidence.status).toBe('VERIFIED')
    expect(evidence.admission.maxDrawdownPctCeiling).toBeLessThanOrEqual(20)
    expect(evidence.admission.minWinRate).toBeGreaterThanOrEqual(0.52)
    expect(evidence.admission.minTradeCount).toBeGreaterThanOrEqual(20)
    expect(evidence.admission.minTotalReturnPct).toBeGreaterThanOrEqual(0.5)
    expect(evidence.templates.map(template => template.templateId)).toEqual([
      'ma-cross',
      'bollinger-reversion',
      'grid-range',
      'breakout-follow',
      'rsi-reversal',
      'macd-cross',
    ])

    for (const template of evidence.templates) {
      expect(template.parameterSearchId).toMatch(/^official-template-search:/)
      expect(template.dataSource?.fixedEndTs).toBe(evidence.templates[0].dataSource?.fixedEndTs)
      expect(template.backtestFrom).toEqual(expect.any(Number))
      expect(template.backtestTo).toEqual(expect.any(Number))
      expect(template.backtestTo).toBeLessThanOrEqual(template.dataSource?.fixedEndTs ?? 0)
      expect(template.admission).toEqual(evidence.admission)
      expect(template.candidateCount).toBeGreaterThanOrEqual(evidence.admission.minTradeCount)
      expect(template.best?.params).toEqual(template.params)
      expect(template.best?.metrics).toEqual(template.metrics)
      expect(template.metrics?.maxDrawdownPct).toBeLessThanOrEqual(evidence.admission.maxDrawdownPctCeiling)
      expect(template.metrics?.winRate).toBeGreaterThanOrEqual(evidence.admission.minWinRate)
      expect(template.metrics?.tradeCount).toBeGreaterThanOrEqual(evidence.admission.minTradeCount)
      expect(template.metrics?.totalReturnPct).toBeGreaterThanOrEqual(evidence.admission.minTotalReturnPct)
    }

    for (const template of evidence.templates) {
      expect(template.exchange).toBe('okx')
      expect(template.interval).toBe('15m')
      expect(template.dataSource).toMatchObject({
        exchange: 'okx',
        endpoint: 'https://www.okx.com/api/v5/market/history-candles',
      })
    }

    expect(evidence.templates.find(template => template.templateId === 'grid-range')).toMatchObject({
      symbol: 'BTC-USDT',
      marketType: 'spot',
    })
    expect(evidence.templates.find(template => template.templateId === 'rsi-reversal')).toMatchObject({
      symbol: 'ETH-USDT',
      marketType: 'spot',
    })
    expect(evidence.templates.find(template => template.templateId === 'macd-cross')).toMatchObject({
      symbol: 'ETH-USDT-SWAP',
      marketType: 'swap',
    })
  })

  it('keeps the generated TS evidence constant synchronized with the JSON evidence', () => {
    const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'))
    const evidenceConstantSource = readFileSync(evidenceConstantPath, 'utf8')

    expect(evidenceConstantSource).toBe(renderEvidenceConstantSource(evidence))
  })
})
