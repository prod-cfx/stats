import { describe, expect, it, jest } from '@jest/globals'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server.node'
import { fetchBacktestJobResultServer } from '@/lib/server-api'
import AiQuantBacktestDetailPage from './page'

jest.mock('@/lib/server-api', () => ({
  fetchBacktestJobResultServer: jest.fn(async () => null),
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string, children: React.ReactNode }) => <a href={href}>{children}</a>,
}))

jest.mock('@/components/layout/Footer', () => ({
  Footer: () => <footer>footer</footer>,
}))

jest.mock('@/components/layout/Navbar', () => ({
  Navbar: () => <nav>navbar</nav>,
}))

const mockFetchBacktestJobResultServer = fetchBacktestJobResultServer as jest.MockedFunction<typeof fetchBacktestJobResultServer>

describe('AiQuantBacktestDetailPage', () => {
  beforeEach(() => {
    mockFetchBacktestJobResultServer.mockResolvedValue(null)
  })

  it('renders symbol and historical range from searchParams', async () => {
    const element = await AiQuantBacktestDetailPage({
      params: { lng: 'zh', id: 'backtest-1234' },
      searchParams: {
        symbol: 'ETHUSDT',
        startAt: '2026-01-01T00:00:00.000Z',
        endAt: '2026-02-01T00:00:00.000Z',
      },
    })

    const html = renderToStaticMarkup(element)
    expect(html).toContain('ETHUSDT')
    expect(html).toContain('2026-01-01 ~ 2026-02-01')
  })

  it('falls back to dash when dates are invalid', async () => {
    const element = await AiQuantBacktestDetailPage({
      params: { lng: 'zh', id: 'backtest-1234' },
      searchParams: {
        symbol: 'BTCUSDT',
        startAt: 'not-a-date',
        endAt: 'still-not-a-date',
      },
    })

    const html = renderToStaticMarkup(element)
    expect(html).toContain('BTCUSDT')
    expect(html).toContain(' · -')
  })

  it('normalizes ratio winRate to percent display', async () => {
    mockFetchBacktestJobResultServer.mockResolvedValue({
      summary: {
        netProfit: 10,
        netProfitPct: 2,
        maxDrawdownPct: 3,
        winRate: 0.63,
        profitFactor: 1.1,
        totalTrades: 2,
      },
      equityCurve: [],
      trades: [],
    })

    const element = await AiQuantBacktestDetailPage({
      params: { lng: 'zh', id: 'backtest-1001' },
      searchParams: {
        symbol: 'BTCUSDT',
        startAt: '2026-03-01T00:00:00.000Z',
        endAt: '2026-03-30T00:00:00.000Z',
      },
    })

    const html = renderToStaticMarkup(element)
    expect(html).toContain('63%')
  })
})
