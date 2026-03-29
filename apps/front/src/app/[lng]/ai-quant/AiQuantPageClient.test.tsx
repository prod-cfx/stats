/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { AiQuantPageClient } from './AiQuantPageClient'

const mockPush = jest.fn()
const mockFetchBacktestCapabilities = jest.fn()

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key === 'aiQuant.messages.welcome'
      ? '```typescript\r\nreturn { ok: true }\r\n```'
      : key,
  }),
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
    paramValues,
    onParamChange,
    onRunBacktest,
  }: {
    messages: Array<{ id: string, role: string, content: string }>
    paramValues: Record<string, unknown>
    onParamChange: (key: string, value: unknown) => void
    onRunBacktest: () => void
  }) => (
    <div>
      <button
        data-testid="set-invalid-range"
        onClick={() =>
          [
            onParamChange('backtestRangePreset', 'CUSTOM'),
            onParamChange('backtestStart', '2026-02-01T00:00:00.000Z'),
            onParamChange('backtestEnd', '2026-01-01T00:00:00.000Z'),
          ]}
      >
        invalid
      </button>
      <button
        data-testid="set-valid-preset"
        onClick={() =>
          [
            onParamChange('backtestRangePreset', '7D'),
            onParamChange('backtestStart', ''),
            onParamChange('backtestEnd', ''),
          ]}
      >
        valid
      </button>
      <button data-testid="run-backtest" onClick={onRunBacktest}>run</button>
      <div data-testid="params">{JSON.stringify(paramValues)}</div>
      <div data-testid="messages">{messages.map(msg => msg.content).join('|')}</div>
    </div>
  ),
}))

jest.mock('@/components/ai-quant/BacktestSummaryCard', () => ({
  BacktestSummaryCard: ({
    result,
    onOpenFullScreen,
  }: {
    result: { startAt: string, endAt: string }
    onOpenFullScreen: () => void
  }) => (
    <>
      <div data-testid="backtest-summary">{`${result.startAt}|${result.endAt}`}</div>
      <button data-testid="open-fullscreen" onClick={onOpenFullScreen}>open</button>
    </>
  ),
}))

jest.mock('@/components/ai-quant/backtest-job-client', () => ({
  createBacktestJob: jest.fn(async () => ({
    id: 'job-1',
    status: 'succeeded',
    createdAt: '2026-03-24T12:00:00.000Z',
  })),
  getBacktestJob: jest.fn(),
  getBacktestJobResult: jest.fn(async () => ({
    summary: {
      netProfit: 120,
      netProfitPct: 12.34,
      maxDrawdownPct: 9.87,
      winRate: 0.56,
      profitFactor: 1.8,
      totalTrades: 42,
    },
  })),
}))

jest.mock('@/components/ai-quant/backtest-capability-client', () => ({
  fetchBacktestCapabilities: (...args: unknown[]) => mockFetchBacktestCapabilities(...args),
}))

jest.mock('@/lib/api', () => ({
  deployAccountAiQuantStrategy: jest.fn(),
  continueLlmCodegenSession: jest.fn(),
  fetchUserExchangeAccountStatuses: jest.fn(async () => []),
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
    mockFetchBacktestCapabilities.mockResolvedValue({
      allowedSymbols: ['BTCUSDT'],
      allowedBaseTimeframes: ['15m'],
    })
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
    const { createBacktestJob } = jest.requireMock('@/components/ai-quant/backtest-job-client') as {
      createBacktestJob: jest.Mock
    }

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
    expect(createBacktestJob).not.toHaveBeenCalled()
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
    await act(async () => {
      await Promise.resolve()
    })

    const summary = container.querySelector('[data-testid="backtest-summary"]')
    expect(summary).toBeTruthy()
    expect(summary?.textContent).toContain('2026-03-17T12:00:00.000Z')
    expect(summary?.textContent).toContain('2026-03-24T12:00:00.000Z')
  })

  it('passes symbol/startAt/endAt query params when opening backtest full screen', async () => {
    await act(async () => {
      root?.render(<AiQuantPageClient />)
    })

    await act(async () => {
      container.querySelector('[data-testid="set-valid-preset"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    await act(async () => {
      container.querySelector('[data-testid="run-backtest"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      container.querySelector('[data-testid="open-fullscreen"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(mockPush).toHaveBeenCalledTimes(1)
    const pushedUrl = mockPush.mock.calls[0][0] as string
    const [path, queryString] = pushedUrl.split('?')
    expect(path).toContain('/zh/ai-quant/backtest/')

    const query = new URLSearchParams(queryString)
    expect(query.get('symbol')).toBe('BTCUSDT')
    expect(query.get('startAt')).toBe('2026-03-17T12:00:00.000Z')
    expect(query.get('endAt')).toBe('2026-03-24T12:00:00.000Z')
  })

  it('runs backtest directly without rendering legacy confirm dialog', async () => {
    await act(async () => {
      root?.render(<AiQuantPageClient />)
    })

    await act(async () => {
      container.querySelector('[data-testid="run-backtest"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="backtest-confirm"]')).toBeNull()
    expect(container.querySelector('[data-testid="backtest-summary"]')).toBeTruthy()
  })
})
