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
  const symbol = typeof resolvedSearch.symbol === 'string' ? resolvedSearch.symbol : 'BTCUSDT'
  const startAt = typeof resolvedSearch.startAt === 'string' ? resolvedSearch.startAt : null
  const endAt = typeof resolvedSearch.endAt === 'string' ? resolvedSearch.endAt : null
  const rangeDisplay = formatBacktestRange(startAt, endAt)

  const job = await fetchBacktestJobServer(resolved.id)
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
