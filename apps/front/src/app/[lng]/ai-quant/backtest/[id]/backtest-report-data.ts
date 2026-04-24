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
  entryPriceDisplay: string
  exitTime: string
  exitPrice: number
  exitPriceDisplay: string
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
  confidence: {
    level: 'high' | 'medium' | 'low'
    title: string
    summary: string
    items: RiskItem[]
  }
  strategyFit: {
    title: string
    summary: string
    items: RiskItem[]
  }
  marketCapabilityNotes: string[]
}

export interface BacktestReportContext {
  exchange?: string
  marketType?: string
  symbol?: string
  timeframe?: string
  requestedRange?: string
  appliedRange?: string
  dataCoverage?: {
    isPartial?: boolean
    barCount?: number
    expectedBarCount?: number
  }
  execution?: {
    initialCash?: number
    leverage?: number
    allowPartial?: boolean
    feeBps?: number
    slippageBps?: number
    priceSource?: string
  }
  derivativeRisk?: {
    fundingIncluded?: boolean
    liquidationChecked?: boolean
    marginMode?: string
  }
}

export interface CreateBacktestReportOptions {
  lng?: 'en' | 'zh' | string
  context?: BacktestReportContext | null
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
    reasonOpenCode?: string
    reasonCloseCode?: string
    reasonOpenDisplay?: string
    reasonCloseDisplay?: string
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
  options: CreateBacktestReportOptions = {},
): BacktestReportData | null {
  if (!Array.isArray(report.equityCurve) || !Array.isArray(report.trades)) {
    return null
  }

  const normalizedEquity = normalizeEquityCurve(report.equityCurve)
  const equitySeries = mapLiveEquitySeries(normalizedEquity)
  const lng = options.lng === 'zh' ? 'zh' : 'en'
  const trades = mapLiveTrades(report.trades, lng)
  const openPositions = mapLiveOpenPositions(report.openPositions)
  const openPnl = calculateRawOpenPositionsUnrealizedPnl(report.openPositions) ?? metrics.openPnl ?? 0
  if (!isDetailedReportConsistent(metrics, normalizedEquity, trades, openPositions, openPnl)) {
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
    insights: buildReportInsights({
      id,
      lng,
      metrics,
      trades,
      openPositions,
      openPnl,
      realizedWinRate,
      drawdown,
      bestTrade,
      worstTrade,
    }),
    confidence: buildReportConfidence(lng, metrics, trades, options.context),
    strategyFit: buildStrategyFit(lng, trades, options.context),
    marketCapabilityNotes: buildMarketCapabilityNotes(lng, options.context),
  }
}

function isDetailedReportConsistent(
  metrics: BacktestReportMetrics,
  equityCurve: NormalizedEquityPoint[],
  trades: TradeRecord[],
  openPositions: OpenPositionRecord[],
  openPnl: number,
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

  if (typeof metrics.openTradeCount === 'number' && metrics.openTradeCount !== openPositions.length) {
    return false
  }

  if (typeof metrics.openPnl === 'number' && Math.abs(metrics.openPnl - openPnl) > 0.01) {
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

function mapLiveTrades(
  trades: LiveBacktestReportInput['trades'],
  lng: 'en' | 'zh',
): TradeRecord[] {
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
        entryPrice: Number.isFinite(trade.entryPrice) ? normalizePrice(trade.entryPrice!) : null,
        entryPriceDisplay: Number.isFinite(trade.entryPrice) ? formatPrice(trade.entryPrice!) : '--',
        exitTime: formatDateTime(trade.exitTs),
        exitPrice: normalizePrice(trade.exitPrice),
        exitPriceDisplay: formatPrice(trade.exitPrice),
        profitPct,
        isProfit: profitPct >= 0,
        reasonOpen: resolveTradeReason({
          code: trade.reasonOpenCode,
          display: trade.reasonOpenDisplay,
          legacyReason: trade.reasonOpen,
          lng,
        }),
        reasonClose: resolveTradeReason({
          code: trade.reasonCloseCode,
          display: trade.reasonCloseDisplay,
          legacyReason: trade.reasonClose,
          lng,
        }),
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

function calculateRawOpenPositionsUnrealizedPnl(
  openPositions: LiveBacktestReportInput['openPositions'],
): number | null {
  if (!Array.isArray(openPositions) || openPositions.length === 0) {
    return null
  }

  const total = openPositions.reduce((sum, position) => {
    if (!Number.isFinite(position?.unrealizedPnl)) {
      return sum
    }
    return sum + position.unrealizedPnl
  }, 0)

  return Number(total.toFixed(2))
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

function resolveTradeReason(args: {
  code?: string
  display?: string
  legacyReason?: string
  lng: 'en' | 'zh'
}): string | undefined {
  const normalizedCode = normalizeReasonCode(args.code)
  if (normalizedCode) {
    return formatReasonCode(normalizedCode, args.lng)
  }

  if (typeof args.display === 'string' && args.display.trim()) {
    return args.display.trim()
  }

  return sanitizeLegacyReason(args.legacyReason, args.lng)
}

function normalizeReasonCode(value: string | undefined): string | null {
  if (typeof value !== 'string' || !value.trim()) {
    return null
  }
  return value.trim().toUpperCase().replace(/[\s.-]+/g, '_')
}

function formatReasonCode(code: string, lng: 'en' | 'zh'): string {
  const labels: Record<string, { en: string; zh: string }> = {
    ENTRY_ON_START: {
      en: 'Entered once when the strategy started',
      zh: '策略启动后首次入场',
    },
    TAKE_PROFIT: {
      en: 'Take-profit condition triggered',
      zh: '达到止盈条件',
    },
    TAKE_PROFIT_PCT: {
      en: 'Take-profit condition triggered',
      zh: '达到止盈条件',
    },
    STOP_LOSS: {
      en: 'Stop loss condition triggered',
      zh: '达到止损条件',
    },
    STOP_LOSS_PCT: {
      en: 'Stop loss condition triggered',
      zh: '达到止损条件',
    },
    TRAILING_STOP: {
      en: 'Trailing stop condition triggered',
      zh: '达到移动止损条件',
    },
    TRAILING_STOP_PCT: {
      en: 'Trailing stop condition triggered',
      zh: '达到移动止损条件',
    },
    FORCE_EXIT: {
      en: 'Forced exit condition triggered',
      zh: '达到强制平仓条件',
    },
    STRATEGY_CONDITION: {
      en: 'Strategy logic condition triggered',
      zh: '策略逻辑条件触发',
    },
  }

  return labels[code]?.[lng] ?? (lng === 'zh' ? '策略逻辑条件触发' : 'Strategy logic condition triggered')
}

function sanitizeLegacyReason(value: string | undefined, lng: 'en' | 'zh' = 'en'): string | undefined {
  if (typeof value !== 'string' || !value.trim()) {
    return undefined
  }

  const normalized = value.trim()
  const lower = normalized.toLowerCase()
  if (lower.includes('execution-on_start') || lower.includes('on_start')) {
    return lng === 'zh' ? '策略启动后首次入场' : 'Entered once when the strategy started'
  }
  if (lower.includes('take-profit')) {
    return lng === 'zh' ? '达到止盈条件' : 'Take-profit condition triggered'
  }
  if (lower.includes('stop-loss')) {
    return lng === 'zh' ? '达到止损条件' : 'Stop loss condition triggered'
  }
  if (lower.startsWith('compiled.')) {
    return lng === 'zh' ? '策略逻辑条件触发' : 'Strategy logic condition triggered'
  }
  return normalized
}

function normalizePrice(value: number): number {
  return value
}

function formatPrice(value: number): string {
  const abs = Math.abs(value)
  if (abs === 0) {
    return '0.00'
  }
  if (abs < 1) {
    return value.toFixed(6)
  }
  if (abs < 100) {
    return value.toFixed(4).replace(/\.?0+$/, '')
  }
  return value.toFixed(2)
}

function isDerivativeMarket(marketType: string | undefined): boolean {
  return ['perp', 'perpetual', 'futures', 'future', 'swap', 'delivery'].includes(String(marketType ?? '').toLowerCase())
}

function buildReportConfidence(
  lng: 'en' | 'zh',
  metrics: BacktestReportMetrics,
  trades: TradeRecord[],
  context?: BacktestReportContext | null,
): BacktestReportData['confidence'] {
  const isZh = lng === 'zh'
  const isPartial = context?.dataCoverage?.isPartial === true
  const hasNoClosedTrades = trades.length === 0
  const lowSample = trades.length > 0 && trades.length < 5
  const level: 'high' | 'medium' | 'low' = isPartial || hasNoClosedTrades ? 'low' : lowSample ? 'medium' : 'high'
  const dataCoverageValue = isPartial
    ? (isZh ? '部分覆盖' : 'Partial coverage')
    : (isZh ? '完整覆盖' : 'Full coverage')
  const sampleValue = trades.length === 0
    ? (isZh ? '暂无闭合交易' : 'No closed trades')
    : lowSample
      ? (isZh ? `${trades.length} 笔闭合交易，统计意义有限` : `${trades.length} closed trade${trades.length > 1 ? 's' : ''}; limited statistical confidence`)
      : (isZh ? `${trades.length} 笔闭合交易` : `${trades.length} closed trades`)

  return {
    level,
    title: isZh ? '报告可信度' : 'Report Confidence',
    summary: buildConfidenceSummary({
      isZh,
      isPartial,
      hasNoClosedTrades,
      lowSample,
    }),
    items: [
      { label: isZh ? '数据覆盖' : 'Data Coverage', value: dataCoverageValue },
      { label: isZh ? '样本量' : 'Sample Size', value: sampleValue },
      {
        label: isZh ? '最大回撤' : 'Max Drawdown',
        value: `${metrics.maxDrawdownPct.toFixed(2)}%`,
      },
      ...(typeof context?.dataCoverage?.barCount === 'number'
        ? [{ label: isZh ? 'K线数量' : 'Bars', value: `${context.dataCoverage.barCount}` }]
        : []),
    ],
  }
}

function buildStrategyFit(
  lng: 'en' | 'zh',
  trades: TradeRecord[],
  context?: BacktestReportContext | null,
): BacktestReportData['strategyFit'] {
  const isZh = lng === 'zh'
  const firstTrade = trades[0]
  const longCount = trades.filter(trade => trade.direction === 'long').length
  const shortCount = trades.filter(trade => trade.direction === 'short').length
  const items: RiskItem[] = [
    {
      label: isZh ? '入场解释' : 'Entry Explanation',
      value: firstTrade?.reasonOpen ?? (isZh ? '本次回测未产生可解释入场' : 'No readable entry reason was recorded'),
    },
    {
      label: isZh ? '平仓解释' : 'Exit Explanation',
      value: firstTrade?.reasonClose ?? (isZh ? '本次回测未产生可解释平仓' : 'No readable exit reason was recorded'),
    },
  ]

  if (isDerivativeMarket(context?.marketType)) {
    items.push({
      label: isZh ? '多空拆分' : 'Long / Short Split',
      value: isZh
        ? `${longCount} 笔多单 / ${shortCount} 笔空单已平仓`
        : `${longCount} long / ${shortCount} short closed trades`,
    })
  }

  return {
    title: isZh ? '策略执行匹配' : 'Strategy Execution Fit',
    summary: isZh
      ? '根据回测成交记录解释本次开仓、平仓是否符合策略逻辑。'
      : 'Explains whether the recorded entries and exits match the strategy execution logic.',
    items,
  }
}

function buildConfidenceSummary(args: {
  isZh: boolean
  isPartial: boolean
  hasNoClosedTrades: boolean
  lowSample: boolean
}): string {
  if (args.isZh) {
    if (args.hasNoClosedTrades) {
      return `本次报告数据${args.isPartial ? '存在缺口' : '覆盖完整'}，但没有闭合交易，不能形成可靠交易结论。`
    }
    return `本次报告数据${args.isPartial ? '存在缺口' : '覆盖完整'}，样本量${args.lowSample ? '偏少，需要结合更长周期验证' : '可用于观察策略表现'}。`
  }

  if (args.hasNoClosedTrades) {
    return `This report has ${args.isPartial ? 'partial' : 'full'} data coverage, but no closed trades were recorded, so it cannot support a reliable trading conclusion.`
  }
  return `This report has ${args.isPartial ? 'partial' : 'full'} data coverage and ${args.lowSample ? 'limited sample size' : 'enough closed trades for review'}.`
}

function buildMarketCapabilityNotes(
  lng: 'en' | 'zh',
  context?: BacktestReportContext | null,
): string[] {
  const isZh = lng === 'zh'
  if (isDerivativeMarket(context?.marketType)) {
    return [
      isZh
        ? '合约报告关注杠杆、保证金、资金费率、强平风险和多空拆分。'
        : 'Derivative report focuses on leverage, margin, funding, liquidation risk, and long/short split.',
      context?.derivativeRisk?.fundingIncluded || context?.derivativeRisk?.liquidationChecked
        ? (isZh ? '本次回测已提供部分合约风险字段。' : 'This backtest provided some derivative risk fields.')
        : (isZh ? '当前回测模型未提供资金费率和强平检查数据。' : 'Funding and liquidation data were not provided by this backtest model.'),
    ]
  }

  return [
    isZh
      ? '现货报告关注持仓、成本、未实现盈亏和资金占用，不展示强平风险。'
      : 'Spot report focuses on holdings, cost basis, unrealized P&L, and capital usage; liquidation risk is not shown.',
  ]
}

function buildReportInsights(args: {
  id: string
  lng: 'en' | 'zh'
  metrics: BacktestReportMetrics
  trades: TradeRecord[]
  openPositions: OpenPositionRecord[]
  openPnl: number
  realizedWinRate: number
  drawdown: DrawdownSnapshot
  bestTrade: TradeRecord | null
  worstTrade: TradeRecord | null
}): string[] {
  if (args.lng === 'zh') {
    return [
      `本次回测基于 ${args.trades.length} 笔闭合交易，已实现收益率为 ${args.metrics.totalReturnPct.toFixed(2)}%。`,
      `闭合交易胜率为 ${args.realizedWinRate.toFixed(2)}%，最大回撤为 ${args.drawdown.maxDrawdownPct.toFixed(2)}%。`,
      args.bestTrade && args.worstTrade
        ? `最佳单笔收益为 ${formatSignedPct(args.bestTrade.profitPct)}，最弱单笔收益为 ${formatSignedPct(args.worstTrade.profitPct)}。`
        : args.openPositions.length > 0
          ? `回测结束时仍有 ${args.openPositions.length} 笔持仓，浮动盈亏为 ${formatSignedPnl(args.openPnl)}。`
          : '本次回测没有闭合交易，不能用胜率判断策略质量。',
    ]
  }

  return [
    args.metrics.totalReturnPct >= 0
      ? `Backtest #${args.id} closed with ${args.metrics.totalReturnPct.toFixed(2)}% realized return across ${args.trades.length} closed trades.`
      : `Backtest #${args.id} closed with ${args.metrics.totalReturnPct.toFixed(2)}% realized return and needs parameter review.`,
    `Realized win rate from live trades was ${args.realizedWinRate.toFixed(2)}%, with maximum drawdown ${args.drawdown.maxDrawdownPct.toFixed(2)}%.`,
    args.bestTrade && args.worstTrade
      ? `Best closed trade returned ${formatSignedPct(args.bestTrade.profitPct)} while the weakest closed trade returned ${formatSignedPct(args.worstTrade.profitPct)}. ${args.drawdown.summary}`
      : args.openPositions.length > 0
        ? `${args.openPositions.length} open position${args.openPositions.length > 1 ? 's were' : ' was'} still active at the end of the backtest, with ${formatSignedPnl(args.openPnl)} unrealized P&L.`
        : 'No closed trades were recorded in the live backtest report.',
  ]
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
