import { formatBacktestRange } from '@/components/ai-quant/backtest-date'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { fetchBacktestJobServer } from '@/lib/server-api'
import { BacktestReportClient } from './BacktestReportClient'

interface CoverageRange {
  fromTs: number
  toTs: number
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
  if (typeof inputSummary !== 'object' || inputSummary === null) {
    return null
  }

  const candidate = inputSummary as {
    isPartial?: unknown
    requestedRange?: unknown
    appliedRange?: unknown
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
  if (typeof inputSummary !== 'object' || inputSummary === null) {
    return 'spot'
  }

  const marketType = (inputSummary as { marketType?: unknown }).marketType
  return marketType === 'perp' ? 'perp' : 'spot'
}

function resolveBacktestSymbol(inputSummary: unknown, fallback: string): string {
  if (typeof inputSummary !== 'object' || inputSummary === null) {
    return fallback
  }

  const symbols = (inputSummary as { symbols?: unknown }).symbols
  return Array.isArray(symbols) && typeof symbols[0] === 'string' && symbols[0].trim()
    ? symbols[0]
    : fallback
}

function resolveBacktestRangeDisplay(
  inputSummary: unknown,
  fallbackStartAt: string | null,
  fallbackEndAt: string | null,
): string {
  if (typeof inputSummary === 'object' && inputSummary !== null) {
    const candidate = inputSummary as {
      appliedRange?: unknown
      requestedRange?: unknown
      dataRange?: unknown
    }
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
          partialCoverageNotice={partialCoverageNotice}
        />
      </main>
      <Footer />
    </div>
  )
}
