import { describe, expect, it } from '@jest/globals'
import { createBacktestReportDataFromLive } from './backtest-report-data'

describe('backtest-report-data live mapping', () => {
  it('maps live equity curve, analytics, and trade details from the live report', () => {
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
            entryTs: Date.parse('2026-03-01T08:00:00.000Z'),
            entryPrice: 100.5,
            exitTs: Date.parse('2026-03-02T12:00:00.000Z'),
            exitPrice: 102.5,
            returnPct: 5.1234,
            reasonOpen: '价格 <= 入场价',
            reasonClose: '价格 >= 止盈价',
          },
          {
            id: 't2',
            side: 'SHORT',
            entryTs: Date.parse('2026-03-02T08:00:00.000Z'),
            entryPrice: 99.2,
            exitTs: Date.parse('2026-03-03T12:00:00.000Z'),
            exitPrice: 95.8,
            returnPct: -3.2,
            reasonOpen: '价格 >= 开空阈值',
            reasonClose: '价格 <= 平空阈值',
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
        id: 't1',
        direction: 'long',
        entryTime: '2026-03-01 08:00',
        entryPrice: 100.5,
        exitTime: '2026-03-02 12:00',
        exitPrice: 102.5,
        profitPct: 5.12,
        isProfit: true,
        reasonOpen: '价格 <= 入场价',
        reasonClose: '价格 >= 止盈价',
      },
      {
        id: 't2',
        direction: 'short',
        entryTime: '2026-03-02 08:00',
        entryPrice: 99.2,
        exitTime: '2026-03-03 12:00',
        exitPrice: 95.8,
        profitPct: -3.2,
        isProfit: false,
        reasonOpen: '价格 >= 开空阈值',
        reasonClose: '价格 <= 平空阈值',
      },
    ])
    expect(data?.maxDrawdownAnalysis).toEqual([
      { label: 'Max Drawdown', value: '-5.00%' },
      { label: 'Drawdown Period', value: '2026-03-01 ~ 2026-03-02' },
      { label: 'Recovery Days', value: '1 Days' },
    ])
    expect(data?.volatilitySharpe).toEqual([
      { label: 'Annualized Volatility', value: '198.59%' },
      { label: 'Sharpe Ratio', value: '9.92' },
      { label: 'Sortino Ratio', value: '29.15' },
    ])
  })

  it('keeps empty live arrays and only falls back when fields are missing', () => {
    const emptyArrays = createBacktestReportDataFromLive(
      'btjob-2',
      { maxDrawdownPct: 0, totalReturnPct: 0, winRatePct: 0, tradeCount: 0 },
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

  it('returns null when empty detailed arrays conflict with non-empty summary metrics', () => {
    expect(createBacktestReportDataFromLive(
      'btjob-6',
      {
        maxDrawdownPct: 0.45,
        totalReturnPct: 1.37,
        winRatePct: 100,
        tradeCount: 9,
      },
      {
        equityCurve: [],
        trades: [],
      },
    )).toBeNull()
  })

  it('returns null for incomplete live reports instead of synthesizing fallback charts', () => {
    expect(createBacktestReportDataFromLive(
      'btjob-5',
      {
        maxDrawdownPct: 10,
        totalReturnPct: 5,
        winRatePct: 0,
        tradeCount: 0,
      },
      {
        equityCurve: null,
        trades: [],
      },
    )).toBeNull()
  })

  it('preserves open positions for reports that have no closed trades yet', () => {
    const data = createBacktestReportDataFromLive(
      'btjob-open-only',
      {
        maxDrawdownPct: 0.32,
        totalReturnPct: 0,
        winRatePct: 0,
        tradeCount: 0,
        openTradeCount: 1,
        openPnl: 2.39,
      },
      {
        equityCurve: [
          { ts: Date.parse('2026-04-01T00:00:00.000Z'), equity: 1000 },
          { ts: Date.parse('2026-04-02T00:00:00.000Z'), equity: 1002.39 },
        ],
        trades: [],
        openPositions: [
          {
            symbol: 'BTCUSDT:PERP',
            qty: 0.0013702196462092872,
            avgEntryPrice: 72238.52313,
            unrealizedPnl: 2.3882611501623687,
          },
        ],
      },
    )

    expect(data).not.toBeNull()
    expect(data?.openPositions).toEqual([
      {
        symbol: 'BTCUSDT:PERP',
        qty: 0.00137022,
        avgEntryPrice: 72238.52,
        unrealizedPnl: 2.39,
        isProfit: true,
      },
    ])
  })
})
