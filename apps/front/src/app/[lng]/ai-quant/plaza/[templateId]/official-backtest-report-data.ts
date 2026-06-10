import type { StrategyPlazaTemplate } from '@/lib/api'
import type { EquityPoint } from '../../backtest/[id]/backtest-report-data'

export interface OfficialBacktestReportData {
  title: string
  description: string
  symbol: string
  timeframe: string
  marketType: string
  metrics: {
    returnPct: number | null
    winRatePct: number | null
    maxDrawdownPct: number | null
    tradeCount: number | null
  }
  confidence: StrategyPlazaTemplate['officialBacktest']['confidence']
  equitySeries: EquityPoint[]
  evidenceRows: Array<{ label: string, value: string }>
  disclaimer: string
}

function formatDate(value: string | number): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toISOString().slice(0, 10)
}

function formatPointDate(value: number, lng: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '--'
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0')
  const day = `${date.getUTCDate()}`.padStart(2, '0')
  return lng === 'en' ? `${month}/${day}` : `${month}-${day}`
}

function formatDataSource(template: StrategyPlazaTemplate): string {
  const source = template.officialBacktest.dataSource
  const exchange = typeof source.exchange === 'string' ? source.exchange.toUpperCase() : template.exchange.toUpperCase()
  const marketType = typeof source.marketType === 'string' ? source.marketType : template.marketType
  return `${exchange} ${marketType}`
}

function buildEquitySeries(template: StrategyPlazaTemplate, lng: string): EquityPoint[] {
  let peak = Number.NEGATIVE_INFINITY
  return template.officialBacktest.equityCurve.map(point => {
    peak = Math.max(peak, point.equity)
    const drawdown = peak > 0 ? ((point.equity - peak) / peak) * 100 : 0
    return {
      time: formatPointDate(point.ts, lng),
      equity: point.equity,
      drawdown: Number(drawdown.toFixed(2)),
    }
  })
}

export function createOfficialBacktestReportData(
  template: StrategyPlazaTemplate,
  lng: 'zh' | 'en' | string,
): OfficialBacktestReportData {
  const official = template.officialBacktest
  const isEn = lng === 'en'
  return {
    title: template.name,
    description: template.description,
    symbol: template.symbol,
    timeframe: template.timeframe,
    marketType: template.marketType,
    metrics: official.metrics,
    confidence: official.confidence,
    equitySeries: buildEquitySeries(template, lng),
    evidenceRows: [
      { label: isEn ? 'Backtest range' : '回测区间', value: `${formatDate(official.backtestFrom)} - ${formatDate(official.backtestTo)}` },
      { label: isEn ? 'Data source' : '数据源', value: formatDataSource(template) },
      { label: isEn ? 'Generated at' : '生成时间', value: formatDate(official.generatedAt) },
      { label: isEn ? 'Candles' : 'K 线数量', value: String(official.candleCount) },
    ],
    disclaimer: official.disclaimer,
  }
}
