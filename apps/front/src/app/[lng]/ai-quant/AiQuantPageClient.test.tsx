/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import type { QuantParams } from './AiQuantPageClient'
import React from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { AiQuantPageClient } from './AiQuantPageClient'

const mockPush = jest.fn()

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('next/navigation', () => ({
  useParams: () => ({ lng: 'zh' }),
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string, children: React.ReactNode }) => <a href={href}>{children}</a>,
}))

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    session: { userId: 'u-1' },
    isLoading: false,
  }),
}))

jest.mock('@/components/account/exchange-account-store', () => ({
  listExchangeAccounts: () => [],
}))

jest.mock('@/components/account/ai-quant-strategy-store', () => ({
  upsertStrategyDeployment: jest.fn(),
}))

jest.mock('@/components/ai-quant/ConversationSidebar', () => ({
  ConversationSidebar: () => <div data-testid="sidebar" />,
}))

jest.mock('@/components/ai-quant/DeployDialog', () => ({
  DeployDialog: () => null,
}))

jest.mock('@/components/ai-quant/GuestAiQuantLanding', () => ({
  GuestAiQuantLanding: () => <div data-testid="guest" />,
}))

jest.mock('@/components/ai-quant/LogicGraphPreview', () => ({
  LogicGraphPreview: () => null,
}))

jest.mock('@/components/ai-quant/QuantChatPanel', () => ({
  QuantChatPanel: ({
    messages,
    params,
    onParamsChange,
    onRunBacktest,
  }: {
    messages: Array<{ id: string, role: string, content: string }>
    params: QuantParams
    onParamsChange: (next: QuantParams) => void
    onRunBacktest: () => void
  }) => (
    <div>
      <button
        data-testid="set-invalid-range"
        onClick={() =>
          onParamsChange({
            ...params,
            backtestRangePreset: 'CUSTOM',
            backtestStart: '2026-02-01T00:00:00.000Z',
            backtestEnd: '2026-01-01T00:00:00.000Z',
          })}
      >
        invalid
      </button>
      <button
        data-testid="set-valid-preset"
        onClick={() =>
          onParamsChange({
            ...params,
            backtestRangePreset: '7D',
            backtestStart: '',
            backtestEnd: '',
          })}
      >
        valid
      </button>
      <button data-testid="run-backtest" onClick={onRunBacktest}>run</button>
      <div data-testid="messages">{messages.map(msg => msg.content).join('|')}</div>
    </div>
  ),
}))

jest.mock('@/components/ai-quant/BacktestSummaryCard', () => ({
  BacktestSummaryCard: ({ result }: { result: { startAt: string, endAt: string } }) => (
    <div data-testid="backtest-summary">{`${result.startAt}|${result.endAt}`}</div>
  ),
}))

jest.mock('@/lib/api', () => ({
  deployAccountAiQuantStrategy: jest.fn(),
  continueLlmCodegenSession: jest.fn(),
  getLlmCodegenSession: jest.fn(),
  startLlmCodegenSession: jest.fn(),
}))

describe('AiQuantPageClient backtest range integration', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot> | null

  beforeEach(() => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    localStorage.clear()
    jest.clearAllMocks()
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-03-24T12:00:00.000Z'))
  })

  afterEach(async () => {
    jest.useRealTimers()
    if (root) {
      await act(async () => {
        root?.unmount()
      })
      root = null
    }
    document.body.innerHTML = ''
  })

  it('blocks backtest when custom range is invalid and shows range error message', async () => {
    await act(async () => {
      root?.render(<AiQuantPageClient />)
    })

    await act(async () => {
      container.querySelector('[data-testid="set-invalid-range"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    await act(async () => {
      container.querySelector('[data-testid="run-backtest"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.querySelector('[data-testid="backtest-summary"]')).toBeNull()
    expect(container.textContent).toContain('aiQuant.messages.backtestRangeOrderInvalid')
  })

  it('writes normalized startAt/endAt into backtest result when range is valid', async () => {
    await act(async () => {
      root?.render(<AiQuantPageClient />)
    })

    await act(async () => {
      container.querySelector('[data-testid="set-valid-preset"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    await act(async () => {
      container.querySelector('[data-testid="run-backtest"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const summary = container.querySelector('[data-testid="backtest-summary"]')
    expect(summary).toBeTruthy()
    expect(summary?.textContent).toContain('2026-03-17T12:00:00.000Z')
    expect(summary?.textContent).toContain('2026-03-24T12:00:00.000Z')
  })
})

