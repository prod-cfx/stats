/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { WhalePositionsTable } from './WhalePositionsTable'

jest.mock('next/dynamic', () => () => {
  const DynamicMock = (props: { isOpen?: boolean; address?: string }) => (
    props.isOpen ? <div data-testid="stats-modal">{props.address}</div> : null
  )
  return DynamicMock
})

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>{children}</a>
  ),
}))

jest.mock('next/navigation', () => ({
  useParams: () => ({ lng: 'zh' }),
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => options?.count == null ? key : `${key}:${options.count}`,
  }),
}))

jest.mock('@/components/ui/FilterButton', () => ({
  FilterButton: () => <button type="button">filter</button>,
}))

jest.mock('@/components/ui/loading', () => ({
  LoadingState: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

jest.mock('@/hooks/use-async', () => ({
  useAsync: () => ({
    data: [
      {
        userAddress: '0x1234567890abcdef1234567890abcdef12345678',
        symbol: 'BTC',
        side: 'LONG',
        positionValueUsd: 1_500_000,
        positionSize: 12.5,
        entryPrice: 100_000,
        liquidationPrice: 80_000,
        pnl: 25_000,
        roe: 0.12,
        leverage: 5,
        snapshotTime: new Date().toISOString(),
      },
    ],
    loading: false,
    error: null,
    execute: jest.fn(),
  }),
}))

jest.mock('@/lib/api', () => ({
  fetchWhaleHoldings: jest.fn(),
}))

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
  configurable: true,
  value: true,
})

describe('WhalePositionsTable', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('does not open stats when keyboard events bubble from mobile child controls', async () => {
    await act(async () => {
      root.render(<WhalePositionsTable />)
    })

    await act(async () => {
      container.querySelector('[data-testid="holdings-mobile-copy"]')?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      )
    })

    expect(container.querySelector('[data-testid="stats-modal"]')).toBeNull()
  })
})
