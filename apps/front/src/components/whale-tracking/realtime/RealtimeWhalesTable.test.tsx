/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { RealtimeWhalesTable } from './RealtimeWhalesTable'

jest.mock('next/dynamic', () => () => {
  const DynamicMock = (props: { isOpen?: boolean; address?: string }) => (
    props.isOpen ? <div data-testid="stats-modal">{props.address}</div> : null
  )
  return DynamicMock
})

const mockPush = jest.fn()

jest.mock('next/navigation', () => ({
  useParams: () => ({ lng: 'zh' }),
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number }) => options?.count == null ? key : `${key}:${options.count}`,
  }),
}))

jest.mock('@/features/whale-notification/api/whale-notification-api', () => ({
  createWhaleNotificationRule: jest.fn(),
}))

jest.mock('@/features/whale-notification/guards/monitor-auth-guard', () => ({
  ensureMonitorAuth: () => true,
}))

jest.mock('@/lib/toast', () => ({
  toast: { error: jest.fn(), success: jest.fn() },
}))

jest.mock('@/utils/clipboard', () => ({
  copyTextToClipboard: jest.fn(async () => true),
}))

jest.mock('@/utils/logger', () => ({
  logger: { error: jest.fn() },
}))

jest.mock('@/lib/api', () => ({
  fetchWhaleTradesRealtime: jest.fn(async () => [
    {
      user_address: '0xabcdef1234567890abcdef1234567890abcdef12',
      symbol: 'ETH',
      side: 'Long',
      trade_value_usd: 20_000,
      trade_size: 3.25,
      price: 3500,
      trade_time: new Date().toISOString(),
      leverage: 10,
    },
  ]),
}))

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
  configurable: true,
  value: true,
})

describe('RealtimeWhalesTable', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    jest.useFakeTimers()
    mockPush.mockReset()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
    jest.useRealTimers()
  })

  it('does not open stats when keyboard events bubble from mobile child controls', async () => {
    await act(async () => {
      root.render(<RealtimeWhalesTable />)
      await Promise.resolve()
    })

    await act(async () => {
      container.querySelector('[data-testid="realtime-mobile-copy"]')?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
      )
    })

    expect(container.querySelector('[data-testid="stats-modal"]')).toBeNull()
  })
})
