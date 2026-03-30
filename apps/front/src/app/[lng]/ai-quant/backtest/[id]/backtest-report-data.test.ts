import { describe, expect, it } from '@jest/globals'
import { createBacktestReportData, createBacktestReportDataFromLive } from './backtest-report-data'

describe('backtest-report-data live mapping', () => {
  it('maps live equity curve and trades to display format', () => {
    const data = createBacktestReportDataFromLive(
      'btjob-1',
      {
        maxDrawdownPct: 10,
        totalReturnPct: 20,
        winRatePct: 60,
        tradeCount: 2,
      },
      {
        equityCurve: [
          { ts: Date.parse('2026-03-01T00:00:00.000Z'), equity: 10000 },
          { ts: Date.parse('2026-03-02T00:00:00.000Z'), equity: 9500 },
          { ts: Date.parse('2026-03-03T00:00:00.000Z'), equity: 11000 },
        ],
        trades: [
          {
            id: 't1',
            side: 'LONG',
            exitTs: Date.parse('2026-03-02T12:00:00.000Z'),
            exitPrice: 102.5,
            returnPct: 5.1234,
          },
          {
            id: 't2',
            side: 'SHORT',
            exitTs: Date.parse('2026-03-03T12:00:00.000Z'),
            exitPrice: 95.8,
            returnPct: -3.2,
          },
        ],
      },
    )

    expect(data).not.toBeNull()
    expect(data?.equitySeries).toEqual([
      { time: '3-1', equity: 10000, drawdown: 0 },
      { time: '3-2', equity: 9500, drawdown: -5 },
      { time: '3-3', equity: 11000, drawdown: 0 },
    ])
    expect(data?.trades).toEqual([
      {
        id: 1,
        time: '2026-03-02 12:00',
        type: 'buy-long',
        price: 102.5,
        profitPct: 5.12,
        isProfit: true,
      },
      {
        id: 2,
        time: '2026-03-03 12:00',
        type: 'sell-close',
        price: 95.8,
        profitPct: -3.2,
        isProfit: false,
      },
    ])
  })

  it('keeps empty live arrays and only falls back when fields are missing', () => {
    const emptyArrays = createBacktestReportDataFromLive(
      'btjob-2',
      { maxDrawdownPct: 10, totalReturnPct: 20, winRatePct: 60, tradeCount: 0 },
      { equityCurve: [], trades: [] },
    )
    const missingTrades = createBacktestReportDataFromLive(
      'btjob-3',
      { maxDrawdownPct: 10, totalReturnPct: 20, winRatePct: 60, tradeCount: 2 },
      { equityCurve: [{ ts: Date.now(), equity: 10000 }], trades: undefined },
    )
    const missingEquity = createBacktestReportDataFromLive(
      'btjob-4',
      { maxDrawdownPct: 10, totalReturnPct: 20, winRatePct: 60, tradeCount: 2 },
      { equityCurve: undefined, trades: [{ id: 't1', side: 'LONG', exitTs: Date.now(), exitPrice: 100, returnPct: 1 }] },
    )

    expect(emptyArrays).not.toBeNull()
    expect(emptyArrays?.trades).toEqual([])
    expect(emptyArrays?.equitySeries).toEqual([])
    expect(missingTrades).toBeNull()
    expect(missingEquity).toBeNull()
  })

  it('does not generate fake trades when tradeCount is zero', () => {
    const data = createBacktestReportData('btjob-5', {
      maxDrawdownPct: 10,
      totalReturnPct: 5,
      winRatePct: 0,
      tradeCount: 0,
    })

    expect(data.trades).toEqual([])
  })
})
