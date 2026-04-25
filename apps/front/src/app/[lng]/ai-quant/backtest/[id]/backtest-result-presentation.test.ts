import { describe, expect, it } from '@jest/globals'
import { buildBacktestResultPresentation, formatBacktestDisplaySymbol, formatOpenPositionForDisplay, normalizeBacktestMarketType } from './backtest-result-presentation'

describe('backtest-result-presentation', () => {
  it('maps spot summary fields into holding-oriented labels', () => {
    const model = buildBacktestResultPresentation({
      lng: 'zh',
      symbol: 'BTCUSDT:SPOT',
      marketType: 'spot',
      metrics: {
        maxDrawdownPct: 0.31,
        totalReturnPct: 0,
        winRatePct: 0,
        tradeCount: 0,
        openTradeCount: 1,
        openPnl: 3.73,
      },
    })

    expect(model.marketLabel).toBe('现货回测')
    expect(model.summaryCards).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'completedTrades', title: '已完成交易', value: '0' }),
      expect.objectContaining({ key: 'openTrades', title: '当前持仓', value: '1' }),
      expect.objectContaining({ key: 'openPnl', title: '持仓浮盈浮亏', value: '+3.73' }),
    ]))
    expect(model.tradeDirectionLabel('long')).toBe('买入建仓')
    expect(model.tradeDirectionLabel('short')).toBe('卖出平仓')
    expect(model.conclusionSummary.warning).toBe('表现一般，建议结合当前持仓与持仓浮盈浮亏后再决定是否部署。')
  })

  it('keeps perp labels in futures-oriented wording', () => {
    const model = buildBacktestResultPresentation({
      lng: 'zh',
      symbol: 'BTCUSDT:PERP',
      marketType: 'perp',
      metrics: {
        maxDrawdownPct: 1,
        totalReturnPct: 5,
        winRatePct: 50,
        tradeCount: 2,
        openTradeCount: 1,
        openPnl: 2,
      },
    })

    expect(model.marketLabel).toBe('合约回测')
    expect(model.summaryCards).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: 'closedReturn', title: '已平仓收益' }),
      expect.objectContaining({ key: 'closedTrades', title: '已平仓笔数' }),
      expect.objectContaining({ key: 'openTrades', title: '未平仓笔数' }),
    ]))
    expect(model.tradeDirectionLabel('long')).toBe('做多')
    expect(model.tradeDirectionLabel('short')).toBe('做空')
    expect(model.conclusionSummary.warning).toBe('表现一般，建议优化参数后再部署。')
  })

  it('formats spot symbols and open positions for display', () => {
    expect(formatBacktestDisplaySymbol('BTCUSDT:SPOT', 'spot')).toBe('BTCUSDT 现货')
    expect(formatBacktestDisplaySymbol('BTCUSDT:PERP', 'perp')).toBe('BTCUSDT 合约')
    expect(formatBacktestDisplaySymbol('BTCUSDT:SPOT', 'spot', 'en')).toBe('BTCUSDT Spot')
    expect(formatBacktestDisplaySymbol('BTCUSDT:PERP', 'perp', 'en')).toBe('BTCUSDT Perp')

    expect(formatOpenPositionForDisplay({
      lng: 'en',
      marketType: 'spot',
      position: {
        symbol: 'BTCUSDT:SPOT',
        qty: 1,
        avgEntryPrice: 100,
        unrealizedPnl: 5,
        isProfit: true,
      },
    })).toEqual(expect.objectContaining({
      symbol: 'BTCUSDT Spot',
    }))
  })

  it('normalizes derivative aliases without requiring exchange-specific UI branches', () => {
    expect(normalizeBacktestMarketType('perp')).toBe('perp')
    expect(normalizeBacktestMarketType('perpetual')).toBe('perp')
    expect(normalizeBacktestMarketType('futures')).toBe('perp')
    expect(normalizeBacktestMarketType('swap')).toBe('perp')
    expect(normalizeBacktestMarketType('spot')).toBe('spot')
    expect(normalizeBacktestMarketType('unknown')).toBe('spot')
  })
})
