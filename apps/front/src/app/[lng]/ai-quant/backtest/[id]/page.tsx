import { formatBacktestRange } from '@/components/ai-quant/backtest-date'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { fetchBacktestJobResultServer } from '@/lib/server-api'
import { BacktestReportClient } from './BacktestReportClient'

export default async function AiQuantBacktestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ lng: string, id: string }> | { lng: string, id: string }
  searchParams?:
    | Promise<{ symbol?: string | string[], startAt?: string | string[], endAt?: string | string[] }>
    | { symbol?: string | string[], startAt?: string | string[], endAt?: string | string[] }
}) {
  const resolved = await Promise.resolve(params)
  const resolvedSearch = await Promise.resolve(searchParams ?? {})
  const lng = resolved.lng === 'en' ? 'en' : 'zh'
  const symbol = typeof resolvedSearch.symbol === 'string' ? resolvedSearch.symbol : 'BTCUSDT'
  const startAt = typeof resolvedSearch.startAt === 'string' ? resolvedSearch.startAt : null
  const endAt = typeof resolvedSearch.endAt === 'string' ? resolvedSearch.endAt : null
  const rangeDisplay = formatBacktestRange(startAt, endAt)

  const summary = await fetchBacktestJobResultServer(resolved.id)
  const metrics = summary?.summary
    ? {
        maxDrawdownPct: Number(summary.summary.maxDrawdownPct.toFixed(2)),
        totalReturnPct: Number(summary.summary.netProfitPct.toFixed(2)),
        winRatePct: Number((summary.summary.winRate <= 1
          ? summary.summary.winRate * 100
          : summary.summary.winRate).toFixed(2)),
        tradeCount: summary.summary.totalTrades,
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
          rangeDisplay={rangeDisplay}
          metrics={metrics}
          report={summary
            ? {
                equityCurve: summary.equityCurve ?? [],
                trades: summary.trades?.map(trade => ({
                  id: trade.id,
                  side: trade.side,
                  exitTs: trade.exitTs,
                  exitPrice: trade.exitPrice,
                  returnPct: trade.returnPct,
                })) ?? [],
              }
            : null}
        />
      </main>
      <Footer />
    </div>
  )
}
