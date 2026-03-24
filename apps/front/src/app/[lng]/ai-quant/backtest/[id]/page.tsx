import Link from 'next/link'
import { formatBacktestRange } from '@/components/ai-quant/backtest-date'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'

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
      <main className="mx-auto flex w-full max-w-[1120px] flex-1 flex-col gap-6 px-4 py-8 md:px-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-[color:var(--cf-text-strong)]">回测详情</h1>
          <Link
            href={`/${lng}/ai-quant`}
            className="rounded-xl border border-[color:var(--cf-border)] px-4 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)]"
          >
            返回 AI量化
          </Link>
        </div>

        <section className="grid gap-4 rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5 md:grid-cols-4">
          <div>
            <p className="text-xs text-[color:var(--cf-muted)]">最大回撤</p>
            <p className="mt-1 text-xl font-semibold text-[color:var(--cf-text-strong)]">{maxDrawdownPct}%</p>
          </div>
          <div>
            <p className="text-xs text-[color:var(--cf-muted)]">总收益</p>
            <p className="mt-1 text-xl font-semibold text-[color:var(--cf-text-strong)]">{totalReturnPct}%</p>
          </div>
          <div>
            <p className="text-xs text-[color:var(--cf-muted)]">胜率</p>
            <p className="mt-1 text-xl font-semibold text-[color:var(--cf-text-strong)]">{winRatePct}%</p>
          </div>
          <div>
            <p className="text-xs text-[color:var(--cf-muted)]">交易次数</p>
            <p className="mt-1 text-xl font-semibold text-[color:var(--cf-text-strong)]">{tradeCount}</p>
          </div>
        </section>

        <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
          <p className="text-xs text-[color:var(--cf-muted)]">交易标的</p>
          <p className="mt-1 text-base font-semibold text-[color:var(--cf-text-strong)]">{symbol}</p>
          <p className="mt-3 text-xs text-[color:var(--cf-muted)]">历史回测区间</p>
          <p className="mt-1 text-base font-semibold text-[color:var(--cf-text-strong)]">
            {rangeDisplay}
          </p>
        </section>

        <section className="rounded-2xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-5">
          <h2 className="text-lg font-semibold text-[color:var(--cf-text-strong)]">净值曲线（MVP 占位）</h2>
          <div className="mt-4 h-64 rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)]" />
        </section>
      </main>
      <Footer />
    </div>
  )
}
