export interface BacktestReportMetrics {
  maxDrawdownPct: number
  totalReturnPct: number
  winRatePct: number
  tradeCount: number
  openTradeCount?: number
  openPnl?: number
}

export interface EquityPoint {
  time: string
  equity: number
  drawdown: number
}

export interface TradeRecord {
  id: string
  direction: 'long' | 'short'
  entryTime: string
  entryPrice: number | null
  exitTime: string
  exitPrice: number
  profitPct: number
  isProfit: boolean
  reasonOpen?: string
  reasonClose?: string
}

export interface RiskItem {
  label: string
  value: string
}

export interface OpenPositionRecord {
  symbol: string
  qty: number
  avgEntryPrice: number
  unrealizedPnl: number
  isProfit: boolean
}

export interface BacktestReportData {
  equitySeries: EquityPoint[]
  trades: TradeRecord[]
  openPositions: OpenPositionRecord[]
  maxDrawdownAnalysis: RiskItem[]
  volatilitySharpe: RiskItem[]
  insights: string[]
}

export interface LiveBacktestReportInput {
  equityCurve?: Array<{ ts: number, equity: number }> | null
  trades?: Array<{
    id: string
    side: 'LONG' | 'SHORT'
    entryTs?: number
    entryPrice?: number
    exitTs: number
    exitPrice: number
    returnPct: number
    reasonOpen?: string
    reasonClose?: string
  }> | null
  openPositions?: Array<{
    symbol: string
    qty: number
    avgEntryPrice: number
    unrealizedPnl: number
  }> | null
}

interface NormalizedEquityPoint {
  ts: number
  equity: number
}

interface DrawdownSnapshot {
  maxDrawdownPct: number
  periodStart: string
  periodEnd: string
  recoveryDays: string
  summary: string
}

const MS_PER_DAY = 24 * 60 * 60 * 1000
const DAYS_PER_YEAR = 365

export function createBacktestReportDataFromLive(
  id: string,
  metrics: BacktestReportMetrics,
  report: LiveBacktestReportInput,
): BacktestReportData | null {
  if (!Array.isArray(report.equityCurve) || !Array.isArray(report.trades)) {
    return null
  }

  const normalizedEquity = normalizeEquityCurve(report.equityCurve)
  const equitySeries = mapLiveEquitySeries(normalizedEquity)
  const trades = mapLiveTrades(report.trades)
  const openPositions = mapLiveOpenPositions(report.openPositions)
  if (!isDetailedReportConsistent(metrics, normalizedEquity, trades)) {
    return null
  }
  const drawdown = analyzeDrawdown(normalizedEquity)
  const performanceStats = analyzePerformance(normalizedEquity)
  const realizedWinRate = trades.length === 0
    ? 0
    : (trades.filter(trade => trade.isProfit).length / trades.length) * 100
  const bestTrade = trades.reduce<TradeRecord | null>((best, trade) => (
    !best || trade.profitPct > best.profitPct ? trade : best
  ), null)
  const worstTrade = trades.reduce<TradeRecord | null>((worst, trade) => (
    !worst || trade.profitPct < worst.profitPct ? trade : worst
  ), null)

  return {
    equitySeries,
    trades,
    openPositions,
    maxDrawdownAnalysis: [
      { label: 'Max Drawdown', value: formatDrawdownPct(drawdown.maxDrawdownPct) },
      { label: 'Drawdown Period', value: `${drawdown.periodStart} ~ ${drawdown.periodEnd}` },
      { label: 'Recovery Days', value: drawdown.recoveryDays },
    ],
    volatilitySharpe: [
      {
        label: 'Annualized Volatility',
        value: performanceStats.annualizedVolatilityPct === null
          ? '--'
          : `${performanceStats.annualizedVolatilityPct.toFixed(2)}%`,
      },
      {
        label: 'Sharpe Ratio',
        value: performanceStats.sharpeRatio === null ? '--' : performanceStats.sharpeRatio.toFixed(2),
      },
      {
        label: 'Sortino Ratio',
        value: performanceStats.sortinoRatio === null ? '--' : performanceStats.sortinoRatio.toFixed(2),
      },
    ],
    insights: [
      metrics.totalReturnPct >= 0
        ? `Backtest #${id} closed with ${metrics.totalReturnPct.toFixed(2)}% realized return across ${trades.length} closed trades.`
        : `Backtest #${id} closed with ${metrics.totalReturnPct.toFixed(2)}% realized return and needs parameter review.`,
      `Realized win rate from live trades was ${realizedWinRate.toFixed(2)}%, with maximum drawdown ${drawdown.maxDrawdownPct.toFixed(2)}%.`,
      bestTrade && worstTrade
        ? `Best closed trade returned ${formatSignedPct(bestTrade.profitPct)} while the weakest closed trade returned ${formatSignedPct(worstTrade.profitPct)}. ${drawdown.summary}`
        : openPositions.length > 0
          ? `${openPositions.length} open position${openPositions.length > 1 ? 's were' : ' was'} still active at the end of the backtest, with ${formatSignedPnl(metrics.openPnl ?? 0)} unrealized P&L.`
          : 'No closed trades were recorded in the live backtest report.',
    ],
  }
}

function isDetailedReportConsistent(
  metrics: BacktestReportMetrics,
  equityCurve: NormalizedEquityPoint[],
  trades: TradeRecord[],
): boolean {
  if (equityCurve.length === 0) {
    if (trades.length > 0 || metrics.tradeCount > 0) {
      return false
    }
    if (metrics.maxDrawdownPct !== 0 || metrics.totalReturnPct !== 0) {
      return false
    }
  }

  if (trades.length === 0 && metrics.tradeCount > 0) {
    return false
  }

  return true
}

function normalizeEquityCurve(
  equityCurve: LiveBacktestReportInput['equityCurve'],
): NormalizedEquityPoint[] {
  if (!Array.isArray(equityCurve)) {
    return []
  }

  return equityCurve
    .filter(point => Number.isFinite(point?.ts) && Number.isFinite(point?.equity))
    .map(point => ({
      ts: point.ts,
      equity: point.equity,
    }))
    .sort((left, right) => left.ts - right.ts)
}

function mapLiveEquitySeries(equityCurve: NormalizedEquityPoint[]): EquityPoint[] {
  if (equityCurve.length === 0) {
    return []
  }

  let peak = Number.NEGATIVE_INFINITY
  return equityCurve.map((point) => {
    peak = Math.max(peak, point.equity)
    const drawdown = peak > 0 ? -((peak - point.equity) / peak) * 100 : 0
    return {
      time: formatMonthDay(point.ts),
      equity: Number(point.equity.toFixed(2)),
      drawdown: Number(drawdown.toFixed(2)),
    }
  })
}

function mapLiveTrades(trades: LiveBacktestReportInput['trades']): TradeRecord[] {
  if (!Array.isArray(trades) || trades.length === 0) {
    return []
  }

  return trades
    .filter(trade => Number.isFinite(trade?.exitTs) && Number.isFinite(trade?.exitPrice) && Number.isFinite(trade?.returnPct))
    .sort((left, right) => left.exitTs - right.exitTs)
    .map((trade) => {
      const profitPct = Number(trade.returnPct.toFixed(2))
      return {
        id: trade.id,
        direction: trade.side === 'LONG' ? 'long' : 'short',
        entryTime: formatDateTime(trade.entryTs),
        entryPrice: Number.isFinite(trade.entryPrice) ? Number(trade.entryPrice!.toFixed(2)) : null,
        exitTime: formatDateTime(trade.exitTs),
        exitPrice: Number(trade.exitPrice.toFixed(2)),
        profitPct,
        isProfit: profitPct >= 0,
        reasonOpen: sanitizeReason(trade.reasonOpen),
        reasonClose: sanitizeReason(trade.reasonClose),
      }
    })
}

function mapLiveOpenPositions(
  openPositions: LiveBacktestReportInput['openPositions'],
): OpenPositionRecord[] {
  if (!Array.isArray(openPositions) || openPositions.length === 0) {
    return []
  }

  return openPositions
    .filter(position => (
      typeof position?.symbol === 'string'
      && Number.isFinite(position?.qty)
      && Number.isFinite(position?.avgEntryPrice)
      && Number.isFinite(position?.unrealizedPnl)
    ))
    .map(position => ({
      symbol: position.symbol,
      qty: Number(position.qty.toFixed(8)),
      avgEntryPrice: Number(position.avgEntryPrice.toFixed(2)),
      unrealizedPnl: Number(position.unrealizedPnl.toFixed(2)),
      isProfit: position.unrealizedPnl >= 0,
    }))
}

function analyzeDrawdown(equityCurve: NormalizedEquityPoint[]): DrawdownSnapshot {
  if (equityCurve.length === 0) {
    return {
      maxDrawdownPct: 0,
      periodStart: '-',
      periodEnd: '-',
      recoveryDays: '--',
      summary: 'No live equity data was available for drawdown analysis.',
    }
  }

  let peakIndex = 0
  let peakEquity = equityCurve[0]!.equity
  let maxDrawdownPct = 0
  let drawdownStartIndex = 0
  let troughIndex = 0
  let drawdownPeakEquity = peakEquity

  for (let index = 0; index < equityCurve.length; index += 1) {
    const point = equityCurve[index]!
    if (point.equity > peakEquity) {
      peakEquity = point.equity
      peakIndex = index
    }

    const drawdownPct = peakEquity > 0 ? ((peakEquity - point.equity) / peakEquity) * 100 : 0
    if (drawdownPct > maxDrawdownPct) {
      maxDrawdownPct = drawdownPct
      drawdownStartIndex = peakIndex
      troughIndex = index
      drawdownPeakEquity = peakEquity
    }
  }

  const drawdownStart = equityCurve[drawdownStartIndex]!
  const trough = equityCurve[troughIndex]!
  let recoveryDays = 'Not recovered'
  let summary = 'The deepest drawdown had not fully recovered by the end of the backtest.'

  if (maxDrawdownPct === 0) {
    recoveryDays = '0 Days'
    summary = 'Equity never fell below its running peak during the recorded period.'
  } else {
    const recoveryPoint = equityCurve
      .slice(troughIndex + 1)
      .find(point => point.equity >= drawdownPeakEquity)

    if (recoveryPoint) {
      const elapsedDays = Math.max(0, Math.round((recoveryPoint.ts - trough.ts) / MS_PER_DAY))
      recoveryDays = `${elapsedDays} Days`
      summary = `The deepest drawdown recovered in ${recoveryDays.toLowerCase()}.`
    }
  }

  return {
    maxDrawdownPct: Number(maxDrawdownPct.toFixed(2)),
    periodStart: formatDate(drawdownStart.ts),
    periodEnd: formatDate(trough.ts),
    recoveryDays,
    summary,
  }
}

function analyzePerformance(equityCurve: NormalizedEquityPoint[]): {
  annualizedVolatilityPct: number | null
  sharpeRatio: number | null
  sortinoRatio: number | null
} {
  if (equityCurve.length < 2) {
    return {
      annualizedVolatilityPct: null,
      sharpeRatio: null,
      sortinoRatio: null,
    }
  }

  const returns = buildReturnSeries(equityCurve)
  const intervalMs = resolveMedianIntervalMs(equityCurve)
  if (returns.length === 0 || intervalMs === null) {
    return {
      annualizedVolatilityPct: null,
      sharpeRatio: null,
      sortinoRatio: null,
    }
  }

  const periodsPerYear = (DAYS_PER_YEAR * MS_PER_DAY) / intervalMs
  const meanReturn = average(returns)
  const stdDev = Math.sqrt(average(returns.map(value => (value - meanReturn) ** 2)))
  const downsideDev = Math.sqrt(average(returns.map(value => Math.min(value, 0) ** 2)))
  const annualization = Math.sqrt(periodsPerYear)

  return {
    annualizedVolatilityPct: Number((stdDev * annualization * 100).toFixed(2)),
    sharpeRatio: stdDev > 0 ? Number(((meanReturn / stdDev) * annualization).toFixed(2)) : null,
    sortinoRatio: downsideDev > 0 ? Number(((meanReturn / downsideDev) * annualization).toFixed(2)) : null,
  }
}

function buildReturnSeries(equityCurve: NormalizedEquityPoint[]): number[] {
  const returns: number[] = []
  for (let index = 1; index < equityCurve.length; index += 1) {
    const previous = equityCurve[index - 1]!
    const current = equityCurve[index]!
    if (previous.equity <= 0) {
      continue
    }
    returns.push((current.equity - previous.equity) / previous.equity)
  }
  return returns
}

function resolveMedianIntervalMs(equityCurve: NormalizedEquityPoint[]): number | null {
  const intervals = equityCurve
    .slice(1)
    .map((point, index) => point.ts - equityCurve[index]!.ts)
    .filter(interval => interval > 0)
    .sort((left, right) => left - right)

  if (intervals.length === 0) {
    return null
  }

  return intervals[Math.floor(intervals.length / 2)] ?? null
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function formatMonthDay(ts: number): string {
  const date = new Date(ts)
  return Number.isNaN(date.getTime()) ? '-' : `${date.getUTCMonth() + 1}-${date.getUTCDate()}`
}

function formatDate(ts: number): string {
  const date = new Date(ts)
  return Number.isNaN(date.getTime()) ? '-' : date.toISOString().slice(0, 10)
}

function formatDateTime(ts: number | undefined): string {
  if (!Number.isFinite(ts)) {
    return '-'
  }
  const date = new Date(ts!)
  return Number.isNaN(date.getTime()) ? '-' : date.toISOString().slice(0, 16).replace('T', ' ')
}

function sanitizeReason(value: string | undefined): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function formatDrawdownPct(value: number): string {
  if (Math.abs(value) < 0.005) {
    return '0.00%'
  }
  return `-${value.toFixed(2)}%`
}

function formatSignedPct(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

function formatSignedPnl(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`
}
