import type { StrategyPlazaTemplate } from '@/lib/api'
import { createOfficialBacktestReportData } from './official-backtest-report-data'

const template: StrategyPlazaTemplate = {
  id: 'ma-cross',
  name: 'MA Cross Demo',
  description: 'Use moving averages.',
  logicDescription: 'Fast MA crosses slow MA.',
  tags: ['trend'],
  riskLevel: 'medium',
  scenario: 'trend_following',
  exchange: 'okx',
  environment: 'demo',
  marketType: 'perp',
  symbol: 'BTC-USDT-SWAP',
  timeframe: '15m',
  positionPct: 0.25,
  leverage: 3,
  status: 'live',
  displayOrder: 1,
  displayMetrics: {
    label: 'official_sample_backtest',
    returnPct: 1.78,
    winRatePct: 58.14,
    maxDrawdownPct: 0.78,
    tradeCount: 43,
  },
  officialBacktest: {
    generatedAt: '2026-06-10T04:45:41.674Z',
    backtestFrom: Date.parse('2026-03-12T04:00:00.000Z'),
    backtestTo: Date.parse('2026-06-10T04:00:00.000Z'),
    source: 'https://www.okx.com/api/v5/market/history-candles',
    dataSource: {
      exchange: 'okx',
      marketType: 'swap',
      endpoint: 'https://www.okx.com/api/v5/market/history-candles',
      fixedEndTs: 1777168800000,
      pagination: { parameter: 'after', pageLimit: 300, pageCount: 8 },
    },
    candleCount: 2400,
    metrics: { returnPct: 1.78, winRatePct: 58.14, maxDrawdownPct: 0.78, tradeCount: 43 },
    equityCurve: [
      { ts: Date.parse('2026-03-12T04:00:00.000Z'), equity: 10000 },
      { ts: Date.parse('2026-03-13T04:00:00.000Z'), equity: 10100 },
      { ts: Date.parse('2026-03-14T04:00:00.000Z'), equity: 10050 },
    ],
    trades: [{
      id: 'ma-cross-1',
      side: 'LONG',
      entryTs: Date.parse('2026-03-12T08:00:00.000Z'),
      entryPrice: 100.5,
      exitTs: Date.parse('2026-03-13T12:00:00.000Z'),
      exitPrice: 103.2,
      returnPct: 2.69,
      reasonOpen: 'fast_ma_cross_up',
      reasonClose: 'fast_ma_cross_down',
    }],
    confidence: { level: 'high', reasons: ['样本回测满足官方基础准入条件。'] },
    disclaimer: '历史回测不代表未来收益。该结果基于固定历史窗口和官方参数，不等同于实盘表现。',
  },
}

describe('official backtest report data', () => {
  it('maps official plaza evidence into report presentation data', () => {
    const data = createOfficialBacktestReportData(template, 'zh')

    expect(data.title).toBe('MA Cross Demo')
    expect(data.metrics).toEqual({ returnPct: 1.78, winRatePct: 58.14, maxDrawdownPct: 0.78, tradeCount: 43 })
    expect(data.equitySeries).toEqual([
      { time: '03-12', equity: 10000, drawdown: 0 },
      { time: '03-13', equity: 10100, drawdown: 0 },
      { time: '03-14', equity: 10050, drawdown: -0.5 },
    ])
    expect(data.evidenceRows).toEqual(expect.arrayContaining([
      { label: '回测区间', value: '2026-03-12 - 2026-06-10' },
      { label: '数据源', value: 'OKX swap' },
      { label: 'K 线数量', value: '2400' },
    ]))
    expect(data.disclaimer).toContain('历史回测不代表未来收益')
    expect(data.detailedReport?.trades).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'ma-cross-1',
        direction: 'long',
        entryTime: '2026-03-12 08:00',
        exitTime: '2026-03-13 12:00',
        profitPct: 2.69,
      }),
    ]))
    expect(data.detailedReport?.insights.length).toBeGreaterThan(0)
    expect(data.detailedReport?.maxDrawdownAnalysis.length).toBeGreaterThan(0)
    expect(data.detailedReport?.volatilitySharpe.length).toBeGreaterThan(0)
  })
})
