import type { BacktestReportContext } from './backtest-report-data'
import { formatBacktestRange } from '@/components/ai-quant/backtest-date'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { fetchBacktestJobServer } from '@/lib/server-api'
import { BacktestReportClient } from './BacktestReportClient'
import { normalizeBacktestMarketType } from './backtest-result-presentation'

interface CoverageRange {
  fromTs: number
  toTs: number
}

interface BacktestInputSummaryView {
  [key: string]: unknown
  actualBars?: unknown
  allowPartial?: unknown
  appliedRange?: unknown
  barCount?: unknown
  bars?: unknown
  baseTimeframe?: unknown
  dataRange?: unknown
  exchange?: unknown
  expectedBarCount?: unknown
  expectedBars?: unknown
  feeBps?: unknown
  initialCash?: unknown
  isPartial?: unknown
  leverage?: unknown
  marketType?: unknown
  priceSource?: unknown
  requestedRange?: unknown
  slippageBps?: unknown
  symbols?: unknown
  conversationId?: unknown
  publishedSnapshotId?: unknown
  snapshotId?: unknown
  strategyInstanceId?: unknown
  timeframe?: unknown
}

function toBacktestInputSummaryView(value: unknown): BacktestInputSummaryView | null {
  return typeof value === 'object' && value !== null
    ? value as BacktestInputSummaryView
    : null
}

function isCoverageRange(value: unknown): value is CoverageRange {
  return typeof value === 'object'
    && value !== null
    && Number.isFinite((value as CoverageRange).fromTs)
    && Number.isFinite((value as CoverageRange).toTs)
}

function formatCoverageTimestamp(ts: number): string {
  const date = new Date(ts)
  if (Number.isNaN(date.getTime())) {
    return '--'
  }
  return `${date.toISOString().slice(0, 10)} ${date.toISOString().slice(11, 16)} UTC`
}

function formatCoverageRange(range: CoverageRange): string {
  return `${formatCoverageTimestamp(range.fromTs)} ~ ${formatCoverageTimestamp(range.toTs)}`
}

function resolvePartialCoverageNotice(inputSummary: unknown): {
  requestedRange: string
  appliedRange: string
} | null {
  const candidate = toBacktestInputSummaryView(inputSummary)
  if (!candidate) {
    return null
  }

  if (candidate.isPartial !== true) {
    return null
  }

  if (!isCoverageRange(candidate.requestedRange) || !isCoverageRange(candidate.appliedRange)) {
    return null
  }

  return {
    requestedRange: formatCoverageRange(candidate.requestedRange),
    appliedRange: formatCoverageRange(candidate.appliedRange),
  }
}

function resolveBacktestMarketType(inputSummary: unknown): 'spot' | 'perp' {
  const summary = toBacktestInputSummaryView(inputSummary)
  if (!summary) {
    return 'spot'
  }

  return normalizeBacktestMarketType(summary.marketType)
}

function resolveBacktestSymbol(inputSummary: unknown, fallback: string): string {
  const summary = toBacktestInputSummaryView(inputSummary)
  if (!summary) {
    return fallback
  }

  return Array.isArray(summary.symbols) && typeof summary.symbols[0] === 'string' && summary.symbols[0].trim()
    ? summary.symbols[0]
    : fallback
}

function resolveBacktestRangeDisplay(
  inputSummary: unknown,
  fallbackStartAt: string | null,
  fallbackEndAt: string | null,
): string {
  const candidate = toBacktestInputSummaryView(inputSummary)
  if (candidate) {
    const preferredRange =
      isCoverageRange(candidate.appliedRange)
        ? candidate.appliedRange
        : isCoverageRange(candidate.requestedRange)
          ? candidate.requestedRange
          : isCoverageRange(candidate.dataRange)
            ? candidate.dataRange
            : null

    if (preferredRange) {
      return formatBacktestRange(
        new Date(preferredRange.fromTs).toISOString(),
        new Date(preferredRange.toTs).toISOString(),
      )
    }
  }

  return formatBacktestRange(fallbackStartAt, fallbackEndAt)
}

function readStringField(source: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string' && value.trim()) {
      return value.trim()
    }
  }
  return undefined
}

function readNumberField(source: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = source[key]
    if (Number.isFinite(value)) {
      return value as number
    }
  }
  return undefined
}

function readBooleanField(source: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'boolean') {
      return value
    }
  }
  return undefined
}

function resolveBacktestReportContext(inputSummary: unknown, symbol: string, marketType: 'spot' | 'perp'): BacktestReportContext | null {
  const source = toBacktestInputSummaryView(inputSummary)
  if (!source) {
    return null
  }

  const requestedRange = isCoverageRange(source.requestedRange)
    ? formatCoverageRange(source.requestedRange)
    : undefined
  const appliedRange = isCoverageRange(source.appliedRange)
    ? formatCoverageRange(source.appliedRange)
    : undefined

  const barCount = readNumberField(source, ['actualBars', 'barCount', 'bars'])
  const expectedBarCount = readNumberField(source, ['expectedBars', 'expectedBarCount'])
  const isPartial = readBooleanField(source, ['isPartial'])
  const initialCash = readNumberField(source, ['initialCash'])
  const leverage = readNumberField(source, ['leverage'])
  const allowPartial = readBooleanField(source, ['allowPartial'])
  const feeBps = readNumberField(source, ['feeBps'])
  const slippageBps = readNumberField(source, ['slippageBps'])
  const priceSource = readStringField(source, ['priceSource'])

  return {
    strategyInstanceId: readStringField(source, ['strategyInstanceId']),
    publishedSnapshotId: readStringField(source, ['publishedSnapshotId', 'snapshotId']),
    conversationId: readStringField(source, ['conversationId']),
    exchange: readStringField(source, ['exchange']),
    marketType,
    symbol,
    timeframe: readStringField(source, ['baseTimeframe', 'timeframe']),
    requestedRange,
    appliedRange,
    dataCoverage: {
      isPartial,
      barCount,
      expectedBarCount,
    },
    execution: {
      initialCash,
      leverage,
      allowPartial,
      feeBps,
      slippageBps,
      priceSource,
    },
  }
}

export default async function AiQuantBacktestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ lng: string; id: string }> | { lng: string; id: string }
  searchParams?:
    | Promise<{
        symbol?: string | string[]
        startAt?: string | string[]
        endAt?: string | string[]
      }>
    | { symbol?: string | string[]; startAt?: string | string[]; endAt?: string | string[] }
}) {
  const [resolved, resolvedSearch] = await Promise.all([
    Promise.resolve(params),
    Promise.resolve(searchParams ?? {}),
  ])
  const lng = resolved.lng === 'en' ? 'en' : 'zh'
  const fallbackSymbol = typeof resolvedSearch.symbol === 'string' ? resolvedSearch.symbol : 'BTCUSDT'
  const fallbackStartAt = typeof resolvedSearch.startAt === 'string' ? resolvedSearch.startAt : null
  const fallbackEndAt = typeof resolvedSearch.endAt === 'string' ? resolvedSearch.endAt : null

  const job = await fetchBacktestJobServer(resolved.id)
  const symbol = resolveBacktestSymbol(job?.inputSummary, fallbackSymbol)
  const rangeDisplay = resolveBacktestRangeDisplay(job?.inputSummary, fallbackStartAt, fallbackEndAt)
  const partialCoverageNotice = resolvePartialCoverageNotice(job?.inputSummary)
  const marketType = resolveBacktestMarketType(job?.inputSummary)
  const reportContext = resolveBacktestReportContext(job?.inputSummary, symbol, marketType)
  const metrics = job?.resultSummary
      ? {
        maxDrawdownPct: Number(job.resultSummary.maxDrawdownPct.toFixed(2)),
        totalReturnPct: Number(job.resultSummary.netProfitPct.toFixed(2)),
        winRatePct: Number(
          (job.resultSummary.winRate <= 1
            ? job.resultSummary.winRate * 100
            : job.resultSummary.winRate
          ).toFixed(2),
        ),
        tradeCount: job.resultSummary.totalTrades,
        openTradeCount: typeof job.resultSummary.totalOpenTrades === 'number'
          ? job.resultSummary.totalOpenTrades
          : undefined,
        openPnl: typeof job.resultSummary.openPnl === 'number'
          ? Number(job.resultSummary.openPnl.toFixed(2))
          : undefined,
      }
    : null

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--cf-bg)] text-[color:var(--cf-text)]">
      <Navbar />
      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-4 py-8 md:px-8">
        <BacktestReportClient
          lng={lng}
          id={resolved.id}
          symbol={symbol}
          marketType={marketType}
          rangeDisplay={rangeDisplay}
          metrics={metrics}
          reportContext={reportContext}
          partialCoverageNotice={partialCoverageNotice}
        />
      </main>
      <Footer />
    </div>
  )
}
