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
        entryPriceDisplay: '100.50',
        exitTime: '2026-03-02 12:00',
        exitPrice: 102.5,
        exitPriceDisplay: '102.50',
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
        entryPriceDisplay: '99.2',
        exitTime: '2026-03-03 12:00',
        exitPrice: 95.8,
        exitPriceDisplay: '95.8',
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

  it('returns null when open-position summary conflicts with detailed open positions', () => {
    expect(createBacktestReportDataFromLive(
      'btjob-open-mismatch',
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
        openPositions: [],
      },
    )).toBeNull()
  })

  it('accepts open pnl consistency based on raw position totals before display rounding', () => {
    const data = createBacktestReportDataFromLive(
      'btjob-open-rounding',
      {
        maxDrawdownPct: 0.12,
        totalReturnPct: 0,
        winRatePct: 0,
        tradeCount: 0,
        openTradeCount: 2,
        openPnl: 0.02,
      },
      {
        equityCurve: [
          { ts: Date.parse('2026-04-01T00:00:00.000Z'), equity: 1000 },
          { ts: Date.parse('2026-04-02T00:00:00.000Z'), equity: 1000.02 },
        ],
        trades: [],
        openPositions: [
          {
            symbol: 'BTCUSDT:PERP',
            qty: 1,
            avgEntryPrice: 100,
            unrealizedPnl: 0.014,
          },
          {
            symbol: 'ETHUSDT:PERP',
            qty: 1,
            avgEntryPrice: 100,
            unrealizedPnl: 0.005,
          },
        ],
      },
    )

    expect(data).not.toBeNull()
    expect(data?.openPositions).toEqual([
      {
        symbol: 'BTCUSDT:PERP',
        qty: 1,
        avgEntryPrice: 100,
        unrealizedPnl: 0.01,
        isProfit: true,
      },
      {
        symbol: 'ETHUSDT:PERP',
        qty: 1,
        avgEntryPrice: 100,
        unrealizedPnl: 0.01,
        isProfit: true,
      },
    ])
  })

  it('builds localized decision context without exchange-specific assumptions', () => {
    const data = createBacktestReportDataFromLive(
      'btjob-doge',
      {
        maxDrawdownPct: 0.18,
        totalReturnPct: 0.19,
        winRatePct: 100,
        tradeCount: 1,
      },
      {
        equityCurve: [
          { ts: Date.parse('2026-04-17T00:00:00.000Z'), equity: 10000 },
          { ts: Date.parse('2026-04-24T00:00:00.000Z'), equity: 10019 },
        ],
        trades: [
          {
            id: 'trade-doge',
            side: 'LONG',
            entryTs: Date.parse('2026-04-18T06:31:00.000Z'),
            entryPrice: 0.09803794,
            exitTs: Date.parse('2026-04-18T11:31:00.000Z'),
            exitPrice: 0.10000989,
            returnPct: 2.0114,
            reasonOpen: 'compiled.decision_01_entry-execution-on_start-210',
            reasonClose: 'compiled.decision_03_risk-take-profit',
          },
        ],
      },
      {
        lng: 'zh',
        context: {
          exchange: 'binance',
          marketType: 'spot',
          symbol: 'DOGEUSDT',
          timeframe: '3m',
          requestedRange: '2026-04-17 00:00 UTC ~ 2026-04-24 00:00 UTC',
          appliedRange: '2026-04-17 00:00 UTC ~ 2026-04-24 00:00 UTC',
          dataCoverage: {
            isPartial: false,
            barCount: 3361,
          },
          execution: {
            initialCash: 10000,
            leverage: 1,
            allowPartial: false,
          },
        },
      },
    )

    expect(data).not.toBeNull()
    expect(data?.trades[0]).toEqual(expect.objectContaining({
      entryPrice: 0.09803794,
      entryPriceDisplay: '0.098038',
      exitPrice: 0.10000989,
      exitPriceDisplay: '0.100010',
      reasonOpen: '策略启动后首次入场',
      reasonClose: '达到止盈条件',
    }))
    expect(data?.confidence.level).toBe('medium')
    expect(data?.confidence.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: '数据覆盖', value: '完整覆盖' }),
      expect.objectContaining({ label: '样本量', value: '1 笔闭合交易，统计意义有限' }),
    ]))
    expect(data?.strategyFit.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: '入场解释', value: '策略启动后首次入场' }),
      expect.objectContaining({ label: '平仓解释', value: '达到止盈条件' }),
    ]))
    expect(data?.marketCapabilityNotes).toEqual(expect.arrayContaining([
      '现货报告关注持仓、成本、未实现盈亏和资金占用，不展示强平风险。',
    ]))
    expect(data?.insights.join('\n')).toContain('本次回测基于 1 笔闭合交易')
    expect(data?.insights.join('\n')).not.toContain('Backtest #')
  })

  it('adds derivative capability notes without coupling the report to OKX', () => {
    const data = createBacktestReportDataFromLive(
      'btjob-perp',
      {
        maxDrawdownPct: 5,
        totalReturnPct: 3,
        winRatePct: 50,
        tradeCount: 2,
      },
      {
        equityCurve: [
          { ts: Date.parse('2026-04-20T00:00:00.000Z'), equity: 10000 },
          { ts: Date.parse('2026-04-21T00:00:00.000Z'), equity: 10300 },
        ],
        trades: [
          {
            id: 'long-1',
            side: 'LONG',
            exitTs: Date.parse('2026-04-21T00:00:00.000Z'),
            exitPrice: 88888.12,
            returnPct: 3,
            reasonClose: 'compiled.decision_02_exit-risk-stop-loss',
          },
          {
            id: 'short-1',
            side: 'SHORT',
            exitTs: Date.parse('2026-04-21T01:00:00.000Z'),
            exitPrice: 88111.12,
            returnPct: -1,
          },
        ],
      },
      {
        lng: 'en',
        context: {
          exchange: 'binance',
          marketType: 'perp',
          symbol: 'BTCUSDT',
          execution: {
            leverage: 5,
            allowPartial: false,
          },
        },
      },
    )

    expect(data).not.toBeNull()
    expect(data?.marketCapabilityNotes).toEqual(expect.arrayContaining([
      'Derivative report focuses on leverage, margin, funding, liquidation risk, and long/short split.',
      'Funding and liquidation data were not provided by this backtest model.',
    ]))
    expect(data?.strategyFit.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: 'Long / Short Split', value: '1 long / 1 short closed trades' }),
    ]))
    expect(data?.trades[0].reasonClose).toBe('Stop loss condition triggered')
  })

  it('marks reports with no closed trades as low confidence', () => {
    const data = createBacktestReportDataFromLive(
      'btjob-no-trades',
      {
        maxDrawdownPct: 0,
        totalReturnPct: 0,
        winRatePct: 0,
        tradeCount: 0,
      },
      {
        equityCurve: [
          { ts: Date.parse('2026-04-20T00:00:00.000Z'), equity: 10000 },
          { ts: Date.parse('2026-04-21T00:00:00.000Z'), equity: 10000 },
        ],
        trades: [],
      },
      {
        lng: 'zh',
        context: {
          marketType: 'spot',
          dataCoverage: {
            isPartial: false,
            barCount: 25,
          },
        },
      },
    )

    expect(data).not.toBeNull()
    expect(data?.confidence).toEqual(expect.objectContaining({
      level: 'low',
      summary: '本次报告数据覆盖完整，但没有闭合交易，不能形成可靠交易结论。',
    }))
    expect(data?.confidence.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: '样本量', value: '暂无闭合交易' }),
    ]))
  })
})
