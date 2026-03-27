export interface BacktestReportMetrics {
  maxDrawdownPct: number
  totalReturnPct: number
  winRatePct: number
  tradeCount: number
}

export interface EquityPoint {
  time: string
  equity: number
  drawdown: number
}

export interface TradeRecord {
  id: number
  time: string
  type: 'buy-long' | 'sell-close'
  price: number
  profitPct: number
  isProfit: boolean
}

export interface RiskItem {
  label: string
  value: string
}

export interface BacktestReportData {
  equitySeries: EquityPoint[]
  trades: TradeRecord[]
  maxDrawdownAnalysis: RiskItem[]
  volatilitySharpe: RiskItem[]
  insights: string[]
}

function hashString(value: string): number {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0
  }
  return hash
}

export function createBacktestReportData(
  id: string,
  metrics: BacktestReportMetrics
): BacktestReportData {
  const seed = hashString(`${id}:${metrics.tradeCount}:${metrics.totalReturnPct}`)
  const dataCount = 100
  const startEquity = 10000
  const targetEndEquity = startEquity * (1 + metrics.totalReturnPct / 100)
  const steps = Math.max(1, dataCount - 1)
  const trendPerStep = (targetEndEquity - startEquity) / steps
  const volatilityBase = Math.max(0.6, metrics.maxDrawdownPct / 20)
  const endAt = new Date('2025-12-31T00:00:00Z')
  let currentEquity = startEquity
  let peakEquity = startEquity
  const equitySeries: EquityPoint[] = []

  for (let i = 0; i < dataCount; i += 1) {
    const phase = i + (seed % 11)
    const waveA = Math.sin(phase / 8) * 42 * volatilityBase
    const waveB = Math.cos(phase / 17) * 26 * volatilityBase
    const movement = i === 0 ? 0 : trendPerStep + waveA + waveB
    currentEquity = Number((i === 0 ? startEquity : currentEquity + movement).toFixed(2))
    peakEquity = Math.max(peakEquity, currentEquity)
    const drawdown = currentEquity < peakEquity
      ? -((peakEquity - currentEquity) / peakEquity) * 100
      : 0
    const timestamp = new Date(endAt.getTime() - (dataCount - 1 - i) * 24 * 60 * 60 * 1000)
    const time = `${timestamp.getUTCMonth() + 1}-${timestamp.getUTCDate()}`
    equitySeries.push({
      time,
      equity: currentEquity,
      drawdown: Number(drawdown.toFixed(2)),
    })
  }

  const tradeCount = Math.max(metrics.tradeCount, 1)
  const trades: TradeRecord[] = Array.from({ length: tradeCount }, (_, index) => {
    const raw = Math.sin((seed % 37) + index * 1.7) * 3.4 + Math.cos(index * 0.9) * 1.8
    const normalized = Number(raw.toFixed(2))
    const isProfit = normalized >= 0
    const dayOffset = tradeCount - index
    const tradeAt = new Date(endAt.getTime() - dayOffset * 36 * 60 * 60 * 1000)
    const price = 20000 + (seed % 9000) + index * 120 + normalized * 60
    return {
      id: index + 1,
      time: tradeAt.toISOString().slice(0, 16).replace('T', ' '),
      type: index % 2 === 0 ? 'buy-long' : 'sell-close',
      price: Number(price.toFixed(2)),
      profitPct: normalized,
      isProfit,
    }
  })

  const winTrades = trades.filter((trade) => trade.isProfit).length
  const realizedWinRate = tradeCount > 0 ? Number(((winTrades / tradeCount) * 100).toFixed(2)) : 0
  const recoveryDays = Math.max(1, Math.round(metrics.maxDrawdownPct * 1.3))
  const drawdownStartOffset = Math.min(55, 10 + (seed % 25))
  const drawdownEndOffset = Math.max(1, drawdownStartOffset - 12)
  const drawdownStart = new Date(endAt.getTime() - drawdownStartOffset * 24 * 60 * 60 * 1000)
  const drawdownEnd = new Date(endAt.getTime() - drawdownEndOffset * 24 * 60 * 60 * 1000)
  const period = `${drawdownStart.toISOString().slice(0, 10)} ~ ${drawdownEnd.toISOString().slice(0, 10)}`
  const annualizedVolatility = Number((Math.max(8, metrics.maxDrawdownPct * 1.2)).toFixed(2))
  const sharpeRatio = Number((metrics.totalReturnPct / Math.max(annualizedVolatility, 1)).toFixed(2))
  const sortinoRatio = Number((sharpeRatio * 1.28).toFixed(2))
  const maxDrawdownAnalysis: RiskItem[] = [
    { label: 'Max Drawdown', value: `-${metrics.maxDrawdownPct}%` },
    { label: 'Drawdown Period', value: period },
    { label: 'Recovery Days', value: `${recoveryDays} Days` },
  ]
  const volatilitySharpe: RiskItem[] = [
    { label: 'Annualized Volatility', value: `${annualizedVolatility}%` },
    { label: 'Sharpe Ratio', value: `${sharpeRatio}` },
    { label: 'Sortino Ratio', value: `${sortinoRatio}` },
  ]
  const insights = [
    metrics.totalReturnPct > 0
      ? `The strategy for backtest #${id} closed with ${metrics.totalReturnPct}% total return under current parameters.`
      : `The strategy for backtest #${id} ended negative with ${metrics.totalReturnPct}% total return and needs parameter review.`,
    `Realized win rate from ${tradeCount} executed trades is ${realizedWinRate}% with max drawdown ${metrics.maxDrawdownPct}%.`,
    `Risk/reward profile is anchored to backtest #${id}; repeated visits will render identical curves, trades and risk cards.`,
  ]

  return {
    equitySeries,
    trades,
    maxDrawdownAnalysis,
    volatilitySharpe,
    insights,
  }
}
