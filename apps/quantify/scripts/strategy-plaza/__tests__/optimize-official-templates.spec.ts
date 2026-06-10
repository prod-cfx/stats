import type {
  OptimizerBar,
  TemplateOptimizationCandidate,
} from '../optimize-official-templates'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  calculateBacktestMetrics,
  downsampleEquityCurveForEvidence,
  renderEvidenceConstantSource,
  runMovingAverageLongOnly,
  selectBestCandidate,
  validateOfficialEvidenceForWrite,
} from '../optimize-official-templates'
import { OFFICIAL_STRATEGY_PLAZA_TEMPLATES } from '../../../src/modules/strategy-plaza/constants/official-strategy-plaza-templates'

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
  it('downsamples equity curves while preserving first and last points', () => {
    const points = Array.from({ length: 130 }, (_, index) => ({
      ts: 1_700_000_000_000 + index * 60_000,
      equity: 10_000 + index,
    }))

    const result = downsampleEquityCurveForEvidence(points, 64)

    expect(result).toHaveLength(64)
    expect(result[0]).toEqual(points[0])
    expect(result.at(-1)).toEqual(points.at(-1))
    expect(result.every(point => Number.isFinite(point.ts) && Number.isFinite(point.equity))).toBe(true)
  })

  it('renders official evidence constants with equity curve payloads', () => {
    const source = renderEvidenceConstantSource({
      status: 'VERIFIED',
      generatedAt: '2026-06-06T13:06:23.170Z',
      generatedBy: 'apps/quantify/scripts/strategy-plaza/optimize-official-templates.ts',
      admission: {
        maxDrawdownPctCeiling: 20,
        minWinRate: 0.52,
        minTradeCount: 20,
        minTotalReturnPct: 0.5,
      },
      templates: [{
        templateId: 'ma-cross',
        parameterSearchId: 'search-1',
        exchange: 'okx',
        symbol: 'BTC-USDT-SWAP',
        interval: '15m',
        marketType: 'swap',
        source: 'https://www.okx.com/api/v5/market/history-candles',
        dataSource: {
          exchange: 'okx',
          marketType: 'swap',
          endpoint: 'https://www.okx.com/api/v5/market/history-candles',
          fixedEndTs: 1777168800000,
          pagination: { parameter: 'after', pageLimit: 300, pageCount: 8 },
        },
        backtestFrom: 1775008800000,
        backtestTo: 1777167900000,
        admission: {
          maxDrawdownPctCeiling: 20,
          minWinRate: 0.52,
          minTradeCount: 20,
          minTotalReturnPct: 0.5,
        },
        candidateCount: 1,
        candleCount: 2400,
        fromTs: 1775008800000,
        toTs: 1777167900000,
        params: { positionPct: 35 },
        metrics: { winRate: 0.58, maxDrawdownPct: 0.78, totalReturnPct: 1.78, tradeCount: 43 },
        trades: [{
          id: 'ma-cross-1',
          side: 'LONG',
          entryTs: 1775008800000,
          entryPrice: 100,
          exitTs: 1775009700000,
          exitPrice: 101,
          returnPct: 1,
          reasonOpen: 'fast_ma_cross_up',
          reasonClose: 'fast_ma_cross_down',
        }],
        equityCurve: [{ ts: 1775008800000, equity: 10000 }, { ts: 1777167900000, equity: 10178 }],
        best: {
          params: { positionPct: 35 },
          metrics: { winRate: 0.58, maxDrawdownPct: 0.78, totalReturnPct: 1.78, tradeCount: 43 },
        },
      }],
    })

    expect(source).toContain('equityCurve')
    expect(source).toContain('10178')
  })

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
        { side: 'LONG', entryTs: 1, exitTs: 2, entryPrice: 100, exitPrice: 105, pnlPct: 5 },
        { side: 'LONG', entryTs: 3, exitTs: 4, entryPrice: 100, exitPrice: 98, pnlPct: -2 },
      ],
    })

    expect(metrics.winRate).toBe(0.5)
    expect(metrics.maxDrawdownPct).toBeCloseTo(6.67, 2)
    expect(metrics.totalReturnPct).toBe(12)
    expect(metrics.tradeCount).toBe(2)
  })

  it('rejects official evidence with empty trades or invalid metrics before writing output', () => {
    const evidence = {
      status: 'VERIFIED' as const,
      generatedAt: '2026-06-10T00:00:00.000Z',
      generatedBy: 'test',
      admission: {
        maxDrawdownPctCeiling: 20,
        minWinRate: 0.52,
        minTradeCount: 20,
        minTotalReturnPct: 0.5,
      },
      templates: OFFICIAL_STRATEGY_PLAZA_TEMPLATES.map((template, index) => ({
        templateId: template.id,
        parameterSearchId: `official-template-search:${template.id}`,
        exchange: 'okx' as const,
        symbol: template.runConfig.symbol,
        interval: template.runConfig.timeframe,
        marketType: template.runConfig.marketType === 'spot' ? 'spot' as const : 'swap' as const,
        source: 'https://www.okx.com/api/v5/market/history-candles',
        dataSource: {
          exchange: 'okx' as const,
          marketType: template.runConfig.marketType === 'spot' ? 'spot' as const : 'swap' as const,
          endpoint: 'https://www.okx.com/api/v5/market/history-candles',
          fixedEndTs: 1777168800000,
          pagination: { parameter: 'after', pageLimit: 300, pageCount: 8 },
        },
        backtestFrom: 1775008800000,
        backtestTo: 1777167900000,
        admission: {
          maxDrawdownPctCeiling: 20,
          minWinRate: 0.52,
          minTradeCount: 20,
          minTotalReturnPct: 0.5,
        },
        candidateCount: 20,
        candleCount: 2400,
        fromTs: 1775008800000,
        toTs: 1777167900000,
        params: { positionPct: template.runConfig.positionPct },
        metrics: index === 0
          ? { winRate: 0, maxDrawdownPct: 0, totalReturnPct: 0, tradeCount: 0 }
          : { winRate: 0.6, maxDrawdownPct: 1, totalReturnPct: 1, tradeCount: 1 },
        trades: index === 0
          ? []
          : [{
              id: `${template.id}-1`,
              side: 'LONG' as const,
              entryTs: 1775008800000,
              entryPrice: 100,
              exitTs: 1775009700000,
              exitPrice: 101,
              returnPct: 1,
            }],
        equityCurve: [{ ts: 1775008800000, equity: 10000 }, { ts: 1777167900000, equity: 10100 }],
        best: {
          params: { positionPct: template.runConfig.positionPct },
          metrics: index === 0
            ? { winRate: 0, maxDrawdownPct: 0, totalReturnPct: 0, tradeCount: 0 }
            : { winRate: 0.6, maxDrawdownPct: 1, totalReturnPct: 1, tradeCount: 1 },
        },
      })),
    }

    expect(() => validateOfficialEvidenceForWrite(evidence)).toThrow(/tradeCount|trades/i)
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

  it('commits auditable fixed-window evidence for every live official template', () => {
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
        eventDataSources?: Array<{
          schemaRef: string
          endpoint: string
          sampleCount: number
        }>
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
        trades?: Array<{
          id: string
          side: 'LONG' | 'SHORT'
          entryTs: number
          entryPrice: number
          exitTs: number
          exitPrice: number
          returnPct: number
        }>
      }>
    }

    expect(evidence.status).toBe('VERIFIED')
    expect(evidence.admission.maxDrawdownPctCeiling).toBeLessThanOrEqual(20)
    expect(evidence.admission.minWinRate).toBeGreaterThanOrEqual(0.52)
    expect(evidence.admission.minTradeCount).toBeGreaterThanOrEqual(20)
    expect(evidence.admission.minTotalReturnPct).toBeGreaterThanOrEqual(0.5)
    const liveTemplateIds = OFFICIAL_STRATEGY_PLAZA_TEMPLATES
      .filter(template => template.status === 'live')
      .map(template => template.id)
    expect(evidence.templates.map(template => template.templateId).sort()).toEqual(liveTemplateIds.slice().sort())

    for (const template of evidence.templates) {
      expect(template.parameterSearchId).toMatch(/^official-template-search:/)
      expect(template.dataSource?.fixedEndTs).toEqual(expect.any(Number))
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
      expect(template.trades).toHaveLength(template.metrics?.tradeCount ?? 0)
    }

    for (const template of evidence.templates) {
      expect(template.exchange).toBe('okx')
      const plazaTemplate = OFFICIAL_STRATEGY_PLAZA_TEMPLATES.find(item => item.id === template.templateId)
      expect(template.interval.toLowerCase()).toBe(plazaTemplate?.runConfig.timeframe.toLowerCase())
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

    for (const templateId of ['orderbook-imbalance-long', 'orderbook-spread-post-only', 'orderbook-depth-ratio-confirm']) {
      const evidenceTemplate = evidence.templates.find(template => template.templateId === templateId)
      expect(evidenceTemplate?.eventDataSources).toEqual(expect.arrayContaining([
        expect.objectContaining({ schemaRef: 'orderbook', endpoint: 'https://www.okx.com/api/v5/market/books', sampleCount: expect.any(Number) }),
      ]))
    }

    for (const [templateId, schemaRef, endpoint] of [
      ['funding-rate-mean-reversion', 'funding', 'https://www.okx.com/api/v5/public/funding-rate-history'],
      ['open-interest-breakout', 'open_interest', 'https://www.okx.com/api/v5/rubik/stat/contracts/open-interest-history'],
      ['liquidation-cascade-short', 'liquidation', 'https://www.okx.com/api/v5/public/liquidation-orders'],
      ['funding-oi-confirmation', 'funding', 'https://www.okx.com/api/v5/public/funding-rate-history'],
      ['funding-oi-confirmation', 'open_interest', 'https://www.okx.com/api/v5/rubik/stat/contracts/open-interest-history'],
    ] as const) {
      const evidenceTemplate = evidence.templates.find(template => template.templateId === templateId)
      expect(evidenceTemplate?.eventDataSources).toEqual(expect.arrayContaining([
        expect.objectContaining({ schemaRef, endpoint, sampleCount: expect.any(Number) }),
      ]))
    }
  })

  it('does not publish duplicated backtest evidence across official templates', () => {
    const evidence = JSON.parse(readFileSync(evidencePath, 'utf8')) as {
      templates: Array<{
        templateId: string
        params?: Record<string, number | string | boolean>
        metrics?: Record<string, number>
        trades?: Array<{
          side: 'LONG' | 'SHORT'
          entryTs: number
          exitTs: number
          entryPrice: number
          exitPrice: number
          returnPct: number
        }>
        equityCurve?: Array<{ ts: number, equity: number }>
      }>
    }

    const seen = new Map<string, string>()
    const duplicates: string[] = []

    for (const template of evidence.templates) {
      const signature = JSON.stringify({
        params: template.params,
        metrics: template.metrics,
        trades: template.trades?.map(trade => ({
          side: trade.side,
          entryTs: trade.entryTs,
          exitTs: trade.exitTs,
          entryPrice: trade.entryPrice,
          exitPrice: trade.exitPrice,
          returnPct: trade.returnPct,
        })),
        equityCurve: template.equityCurve,
      })
      const duplicateOf = seen.get(signature)
      if (duplicateOf) {
        duplicates.push(`${template.templateId} duplicates ${duplicateOf}`)
      }
      else {
        seen.set(signature, template.templateId)
      }
    }

    expect(duplicates).toEqual([])
  })

  it('does not publish duplicated display metrics across official templates', () => {
    const evidence = JSON.parse(readFileSync(evidencePath, 'utf8')) as {
      templates: Array<{
        templateId: string
        metrics?: {
          winRate: number
          maxDrawdownPct: number
          totalReturnPct: number
          tradeCount: number
        }
      }>
    }

    const seen = new Map<string, string>()
    const duplicates: string[] = []

    for (const template of evidence.templates) {
      const signature = JSON.stringify(template.metrics)
      const duplicateOf = seen.get(signature)
      if (duplicateOf) {
        duplicates.push(`${template.templateId} duplicates ${duplicateOf}`)
      }
      else {
        seen.set(signature, template.templateId)
      }
    }

    expect(duplicates).toEqual([])
  })

  it('keeps the generated TS evidence constant synchronized with the JSON evidence', () => {
    const evidence = JSON.parse(readFileSync(evidencePath, 'utf8'))
    const evidenceConstantSource = readFileSync(evidenceConstantPath, 'utf8')

    expect(evidenceConstantSource).toBe(renderEvidenceConstantSource(evidence))
  })
})
