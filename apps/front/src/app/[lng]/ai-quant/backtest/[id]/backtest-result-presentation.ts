import type { BacktestReportMetrics, OpenPositionRecord, TradeRecord } from './backtest-report-data'

export type BacktestMarketType = 'spot' | 'perp'

export interface SummaryMetricCardModel {
  key: string
  title: string
  value: string
  trend: 'up' | 'down' | 'neutral'
}

export interface BacktestResultPresentationModel {
  marketType: BacktestMarketType
  marketLabel: string
  displaySymbol: string
  summaryCards: SummaryMetricCardModel[]
  tradeSectionTitle: string
  tradeDirectionColumnLabel: string
  tradeDirectionLabel: (direction: TradeRecord['direction']) => string
  emptyTradeMessage: string
  openPositionsTitle: string
  openPositionsBadge: (count: number) => string
  openPositionsColumns: {
    symbol: string
    quantity: string
    avgEntryPrice: string
    unrealizedPnl: string
  }
  openPositionQuantityLabel: string
  openPositionAvgEntryLabel: string
  openPositionPnlLabel: string
  conclusionSummary: {
    good: string
    warning: string
    danger: string
  }
}

function formatSignedPct(value: number): string {
  return `${value > 0 ? '+' : ''}${value}%`
}

function formatSignedPnl(value: number): string {
  const formatted = value.toFixed(2)
  return value > 0 ? `+${formatted}` : formatted
}

export function normalizeBacktestMarketType(value: unknown): BacktestMarketType {
  return value === 'perp' ? 'perp' : 'spot'
}

export function formatBacktestDisplaySymbol(
  symbol: string,
  marketType: BacktestMarketType,
  lng: string = 'zh',
): string {
  const normalized = symbol.replace(':SPOT', '').replace(':PERP', '')
  const isEn = lng === 'en'
  if (marketType === 'spot') {
    return `${normalized} ${isEn ? 'Spot' : '现货'}`
  }
  return `${normalized} ${isEn ? 'Perp' : '合约'}`
}

export function buildBacktestResultPresentation(args: {
  lng: string
  symbol: string
  marketType: BacktestMarketType
  metrics: BacktestReportMetrics | null
}): BacktestResultPresentationModel {
  const { lng, symbol, marketType, metrics } = args
  const isEn = lng === 'en'

  const baseCards: SummaryMetricCardModel[] = marketType === 'spot'
    ? [
        {
          key: 'returnPct',
          title: isEn ? 'Return' : '收益率',
          value: metrics ? formatSignedPct(metrics.totalReturnPct) : '--',
          trend: metrics ? (metrics.totalReturnPct > 0 ? 'up' : metrics.totalReturnPct < 0 ? 'down' : 'neutral') : 'neutral',
        },
        {
          key: 'drawdown',
          title: isEn ? 'Max Drawdown' : '最大回撤',
          value: metrics ? `-${metrics.maxDrawdownPct}%` : '--',
          trend: 'down',
        },
        {
          key: 'completedTrades',
          title: isEn ? 'Completed Trades' : '已完成交易',
          value: metrics ? `${metrics.tradeCount}` : '--',
          trend: 'neutral',
        },
      ]
    : [
        {
          key: 'closedReturn',
          title: isEn ? 'Closed Return' : '已平仓收益',
          value: metrics ? formatSignedPct(metrics.totalReturnPct) : '--',
          trend: metrics ? (metrics.totalReturnPct > 0 ? 'up' : metrics.totalReturnPct < 0 ? 'down' : 'neutral') : 'neutral',
        },
        {
          key: 'maxDrawdown',
          title: isEn ? 'Max Drawdown' : '最大回撤',
          value: metrics ? `-${metrics.maxDrawdownPct}%` : '--',
          trend: 'down',
        },
        {
          key: 'closedWinRate',
          title: isEn ? 'Closed Win Rate' : '已平仓胜率',
          value: metrics ? `${metrics.winRatePct}%` : '--',
          trend: 'neutral',
        },
        {
          key: 'closedTrades',
          title: isEn ? 'Closed Trades' : '已平仓笔数',
          value: metrics ? `${metrics.tradeCount}` : '--',
          trend: 'neutral',
        },
      ]

  const openTradeCard = typeof metrics?.openTradeCount === 'number'
    ? {
        key: 'openTrades',
        title: marketType === 'spot'
          ? (isEn ? 'Current Holdings' : '当前持仓')
          : (isEn ? 'Open Trades' : '未平仓笔数'),
        value: `${metrics.openTradeCount}`,
        trend: 'neutral' as const,
      }
    : null

  const openPnlCard = typeof metrics?.openPnl === 'number'
    ? {
        key: 'openPnl',
        title: marketType === 'spot'
          ? (isEn ? 'Holding P&L' : '持仓浮盈浮亏')
          : (isEn ? 'Open P&L' : '浮动盈亏'),
        value: formatSignedPnl(metrics.openPnl),
        trend: metrics.openPnl > 0 ? 'up' as const : metrics.openPnl < 0 ? 'down' as const : 'neutral' as const,
      }
    : null

  const conclusionSummary = marketType === 'spot'
    ? {
        good: isEn
          ? 'Spot strategy performance is good, current holdings are under control with solid return, recommended to deploy.'
          : '现货策略表现良好，当前持仓风险可控且收益可观，建议部署。',
        warning: isEn
          ? 'Spot strategy performance is average. Review current holdings and holding P&L before deciding whether to deploy.'
          : '表现一般，建议结合当前持仓与持仓浮盈浮亏后再决定是否部署。',
        danger: isEn
          ? 'Spot strategy risk is elevated or overall return is negative, not recommended to deploy.'
          : '现货策略风险较高或整体处于亏损状态，不建议部署。',
      }
    : {
        good: isEn
          ? 'Good performance, controllable risk and considerable return, recommended to deploy.'
          : '策略表现良好，风险可控且收益可观，建议部署。',
        warning: isEn
          ? 'Average performance, consider optimizing parameters before deploying.'
          : '表现一般，建议优化参数后再部署。',
        danger: isEn
          ? 'High risk or in loss, not recommended to deploy.'
          : '策略风险较高或处于亏损状态，不建议部署。',
      }

  return {
    marketType,
    marketLabel: marketType === 'spot'
      ? (isEn ? 'Spot Backtest' : '现货回测')
      : (isEn ? 'Perp Backtest' : '合约回测'),
    displaySymbol: formatBacktestDisplaySymbol(symbol, marketType, lng),
    summaryCards: [...baseCards, ...(openTradeCard ? [openTradeCard] : []), ...(openPnlCard ? [openPnlCard] : [])],
    tradeSectionTitle: isEn ? 'Trade Details' : '交易明细',
    tradeDirectionColumnLabel: marketType === 'spot'
      ? (isEn ? 'Action' : '操作')
      : (isEn ? 'Direction' : '方向'),
    tradeDirectionLabel: (direction) => {
      if (marketType === 'spot') {
        return direction === 'long'
          ? (isEn ? 'Buy' : '买入建仓')
          : (isEn ? 'Sell' : '卖出平仓')
      }
      return direction === 'long'
        ? (isEn ? 'Long' : '做多')
        : (isEn ? 'Short' : '做空')
    },
    emptyTradeMessage: marketType === 'spot'
      ? (isEn ? 'No completed spot trades were closed during this backtest.' : '本次回测区间内暂无已完成交易。')
      : (isEn ? 'No closed trades were completed during this backtest.' : '本次回测区间内暂无已平仓交易。'),
    openPositionsTitle: marketType === 'spot'
      ? (isEn ? 'Current Holdings' : '当前持仓')
      : (isEn ? 'Open Positions' : '未平仓持仓'),
    openPositionsBadge: (count) => marketType === 'spot'
      ? (isEn ? `${count} holding${count > 1 ? 's' : ''} still active` : `回测结束时仍有 ${count} 笔当前持仓`)
      : (isEn ? `${count} active at backtest end` : `回测结束时仍有 ${count} 笔持仓`),
    openPositionsColumns: {
      symbol: isEn ? 'Symbol' : '标的',
      quantity: marketType === 'spot' ? (isEn ? 'Holding Qty' : '当前持仓数量') : (isEn ? 'Quantity' : '持仓数量'),
      avgEntryPrice: marketType === 'spot' ? (isEn ? 'Holding Avg Price' : '持仓均价') : (isEn ? 'Avg Entry Price' : '持仓均价'),
      unrealizedPnl: marketType === 'spot' ? (isEn ? 'Holding P&L' : '持仓浮盈浮亏') : (isEn ? 'Unrealized P&L' : '浮动盈亏'),
    },
    openPositionQuantityLabel: marketType === 'spot' ? (isEn ? 'Holding Qty' : '当前持仓数量') : (isEn ? 'Quantity' : '持仓数量'),
    openPositionAvgEntryLabel: marketType === 'spot' ? (isEn ? 'Holding Avg Price' : '持仓均价') : (isEn ? 'Avg Entry Price' : '持仓均价'),
    openPositionPnlLabel: marketType === 'spot' ? (isEn ? 'Holding P&L' : '持仓浮盈浮亏') : (isEn ? 'Unrealized P&L' : '浮动盈亏'),
    conclusionSummary,
  }
}

export function formatOpenPositionForDisplay(args: {
  lng?: string
  position: OpenPositionRecord
  marketType: BacktestMarketType
}): OpenPositionRecord {
  return {
    ...args.position,
    symbol: formatBacktestDisplaySymbol(args.position.symbol, args.marketType, args.lng),
  }
}
