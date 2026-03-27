import { formatBacktestRange } from '@/components/ai-quant/backtest-date'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
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

  const seed = Number(resolved.id.slice(-4)) || 1024
  const maxDrawdownPct = Number((8 + (seed % 17)).toFixed(2))
  const totalReturnPct = Number((10 + (seed % 23) * 0.9).toFixed(2))
  const winRatePct = Number((38 + (seed % 31) * 0.8).toFixed(2))
  const tradeCount = 10 + (seed % 40)

  return (
    <div className="flex min-h-screen flex-col bg-[color:var(--cf-bg)] text-[color:var(--cf-text)]">
      <Navbar />
      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col px-4 py-8 md:px-8">
        <BacktestReportClient 
          lng={lng}
          id={resolved.id}
          symbol={symbol}
          rangeDisplay={rangeDisplay}
          metrics={{
            maxDrawdownPct,
            totalReturnPct,
            winRatePct,
            tradeCount
          }}
        />
      </main>
      <Footer />
    </div>
  )
}
