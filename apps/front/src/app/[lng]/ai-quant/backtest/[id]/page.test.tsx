import { describe, expect, it, jest } from '@jest/globals'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server.node'
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

describe('AiQuantBacktestDetailPage', () => {
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
})
