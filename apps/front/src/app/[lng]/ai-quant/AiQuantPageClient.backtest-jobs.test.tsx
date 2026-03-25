/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { AiQuantPageClient } from './AiQuantPageClient'

const mockPush = jest.fn()
const mockCreateBacktestJob = jest.fn()
const mockGetBacktestJob = jest.fn()
const mockGetBacktestJobResult = jest.fn()
const mockBuildBacktestPayload = jest.fn()

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
  ConversationSidebar: ({ onCreate, onSwitch, items }: {
    onCreate: () => void
    onSwitch: (id: string) => void
    items: Array<{ id: string }>
  }) => (
    <div data-testid="sidebar">
      <button data-testid="sidebar-create" onClick={onCreate}>create</button>
      {items.map((item, index) => (
        <button
          key={item.id}
          data-testid={`sidebar-switch-${index}`}
          onClick={() => onSwitch(item.id)}
        >
          switch
        </button>
      ))}
    </div>
  ),
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
    onRunBacktest,
    canRunBacktest,
  }: {
    messages: Array<{ id: string, role: string, content: string }>
    onRunBacktest: () => void
    canRunBacktest?: boolean
  }) => (
    <div>
      <button data-testid="run-backtest" disabled={!canRunBacktest} onClick={onRunBacktest}>run</button>
      <div data-testid="messages">{messages.map(msg => msg.content).join('|')}</div>
    </div>
  ),
}))

jest.mock('@/components/ai-quant/BacktestSummaryCard', () => ({
  BacktestSummaryCard: ({
    result,
  }: {
    result: {
      id: string
      symbol?: string
      startAt?: string
      endAt?: string
      maxDrawdownPct: number
      totalReturnPct: number
      winRatePct: number
      tradeCount: number
    }
  }) => (
    <div data-testid="backtest-summary">
      {`${result.id}|${result.symbol}|${result.startAt}|${result.endAt}|${result.maxDrawdownPct}|${result.totalReturnPct}|${result.winRatePct}|${result.tradeCount}`}
    </div>
  ),
}))

jest.mock('@/components/ai-quant/backtest-payload-builder', () => ({
  buildBacktestPayload: (...args: unknown[]) => mockBuildBacktestPayload(...args),
  isBacktestPayloadBuilderError: (error: unknown) => Boolean((error as { __builderError?: boolean })?.__builderError),
}))

jest.mock('@/components/ai-quant/backtest-job-client', () => ({
  createBacktestJob: (...args: unknown[]) => mockCreateBacktestJob(...args),
  getBacktestJob: (...args: unknown[]) => mockGetBacktestJob(...args),
  getBacktestJobResult: (...args: unknown[]) => mockGetBacktestJobResult(...args),
}))

jest.mock('@/lib/api', () => ({
  deployAccountAiQuantStrategy: jest.fn(),
  continueLlmCodegenSession: jest.fn(),
  getLlmCodegenSession: jest.fn(),
  startLlmCodegenSession: jest.fn(),
}))

function defaultPayload() {
  return {
    symbols: ['BTCUSDT'],
    baseTimeframe: '15m',
    stateTimeframes: ['15m'],
    initialCash: 10000,
    leverage: 1,
    execution: {
      slippageBps: 10,
      feeBps: 5,
      priceSource: 'close',
    },
    strategy: {
      id: 'session-1',
      protocolVersion: 'v1',
      scriptCode: 'return {}',
      params: {},
    },
    dataRange: {
      fromTs: Date.parse('2026-03-01T00:00:00.000Z'),
      toTs: Date.parse('2026-03-24T00:00:00.000Z'),
    },
    bars: [],
  }
}

describe('AiQuantPageClient backtest jobs integration', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot> | null

  beforeEach(() => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-03-24T12:00:00.000Z'))
    localStorage.clear()
    jest.clearAllMocks()

    mockBuildBacktestPayload.mockReturnValue(defaultPayload())
    mockCreateBacktestJob.mockResolvedValue({
      id: 'job-1',
      status: 'queued',
      createdAt: '2026-03-24T12:00:01.000Z',
    })
    mockGetBacktestJob.mockResolvedValue({
      id: 'job-1',
      status: 'succeeded',
      createdAt: '2026-03-24T12:00:01.000Z',
    })
    mockGetBacktestJobResult.mockResolvedValue({
      summary: {
        netProfit: 100,
        netProfitPct: 12.5,
        maxDrawdownPct: 9.6,
        winRate: 0.61,
        profitFactor: 1.8,
        totalTrades: 18,
      },
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

  it('success path: create job -> poll -> fetch result -> show summary', async () => {
    await act(async () => {
      root?.render(<AiQuantPageClient />)
    })

    await act(async () => {
      container.querySelector('[data-testid="run-backtest"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    await act(async () => {
      jest.advanceTimersByTime(1500)
      await Promise.resolve()
    })

    expect(mockCreateBacktestJob).toHaveBeenCalledTimes(1)
    expect(mockGetBacktestJob).toHaveBeenCalledTimes(1)
    expect(mockGetBacktestJobResult).toHaveBeenCalledWith('job-1')

    const summary = container.querySelector('[data-testid="backtest-summary"]')
    expect(summary).toBeTruthy()
    expect(summary?.textContent).toContain('job-1')
    expect(summary?.textContent).toContain('BTCUSDT')
    expect(summary?.textContent).toContain('2026-03-01T00:00:00.000Z')
    expect(summary?.textContent).toContain('2026-03-24T00:00:00.000Z')
  })

  it('failed path: job failed appends feedback and does not write success result', async () => {
    mockGetBacktestJob.mockResolvedValue({
      id: 'job-1',
      status: 'failed',
      error: 'worker_failed',
      createdAt: '2026-03-24T12:00:01.000Z',
    })

    await act(async () => {
      root?.render(<AiQuantPageClient />)
    })

    await act(async () => {
      container.querySelector('[data-testid="run-backtest"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    await act(async () => {
      jest.advanceTimersByTime(1500)
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="backtest-summary"]')).toBeNull()
    expect(container.querySelector('[data-testid="messages"]')?.textContent).toContain('aiQuant.messages.backtestPayloadInvalid')
    expect(mockGetBacktestJobResult).not.toHaveBeenCalled()
  })

  it('running state disables backtest button', async () => {
    let resolvePoll: ((value: unknown) => void) | null = null
    const pollPromise = new Promise(resolve => {
      resolvePoll = resolve
    })
    mockGetBacktestJob.mockReturnValue(pollPromise)

    await act(async () => {
      root?.render(<AiQuantPageClient />)
    })

    await act(async () => {
      container.querySelector('[data-testid="run-backtest"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    const runButton = container.querySelector('[data-testid="run-backtest"]') as HTMLButtonElement | null
    expect(runButton?.disabled).toBe(true)

    resolvePoll?.({ id: 'job-1', status: 'succeeded', createdAt: '2026-03-24T12:00:01.000Z' })
    await act(async () => {
      await Promise.resolve()
    })
  })

  it.each(['submitting', 'running', 'timeout'] as const)(
    'hydrates transient execution state %s to idle to avoid refresh lock',
    async (state) => {
      const now = Date.now()
      localStorage.setItem('ai_quant_conversations_v1', JSON.stringify([
        {
          id: 'conv-1',
          title: 'conv',
          messages: [{ id: 'welcome', role: 'assistant', content: 'hello' }],
          params: {
            exchange: 'binance',
            symbol: 'BTCUSDT',
            buyWindowMin: 3,
            buyDropPct: 1,
            sellWindowMin: 15,
            sellRisePct: 2,
            positionPct: 10,
          },
          paramSchema: null,
          paramValues: {},
          backtestResult: null,
          logicGraph: null,
          llmCodegenSessionId: null,
          latestSignalMessage: null,
          backtestExecutionState: state,
          updatedAt: now,
        },
      ]))

      await act(async () => {
        root?.render(<AiQuantPageClient />)
      })

      const runButton = container.querySelector('[data-testid="run-backtest"]') as HTMLButtonElement | null
      expect(runButton?.disabled).toBe(false)
    },
  )

  it('timeout path shows timeout feedback message', async () => {
    mockGetBacktestJob.mockResolvedValue({
      id: 'job-1',
      status: 'running',
      createdAt: '2026-03-24T12:00:01.000Z',
    })

    await act(async () => {
      root?.render(<AiQuantPageClient />)
    })

    await act(async () => {
      container.querySelector('[data-testid="run-backtest"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    await act(async () => {
      jest.advanceTimersByTime(180000)
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="backtest-summary"]')).toBeNull()
    expect(container.querySelector('[data-testid="messages"]')?.textContent).toContain('aiQuant.messages.backtestPayloadInvalid')
    expect(mockGetBacktestJobResult).not.toHaveBeenCalled()
    expect(mockGetBacktestJob.mock.calls.length).toBeLessThanOrEqual(50)
  })

  it('builder payload failure blocks execution and shows message', async () => {
    mockBuildBacktestPayload.mockImplementation(() => {
      const error = new Error('missing_script_code')
      ;(error as Error & { __builderError: boolean; code: string }).__builderError = true
      ;(error as Error & { __builderError: boolean; code: string }).code = 'missing_script_code'
      throw error
    })

    await act(async () => {
      root?.render(<AiQuantPageClient />)
    })

    await act(async () => {
      container.querySelector('[data-testid="run-backtest"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(mockCreateBacktestJob).not.toHaveBeenCalled()
    expect(container.querySelector('[data-testid="backtest-summary"]')).toBeNull()
    expect(container.querySelector('[data-testid="messages"]')?.textContent).toContain('aiQuant.messages.backtestMissingScriptCode')
  })

  it('double click triggers only one create job call', async () => {
    await act(async () => {
      root?.render(<AiQuantPageClient />)
    })

    await act(async () => {
      const button = container.querySelector('[data-testid="run-backtest"]')
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      button?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    await act(async () => {
      jest.advanceTimersByTime(1500)
      await Promise.resolve()
    })

    expect(mockCreateBacktestJob).toHaveBeenCalledTimes(1)
  })

  it('unmount while running does not emit react unmount update warning', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
    let resolvePoll: ((value: unknown) => void) | null = null
    const pollPromise = new Promise(resolve => {
      resolvePoll = resolve
    })
    mockGetBacktestJob.mockReturnValue(pollPromise)

    await act(async () => {
      root?.render(<AiQuantPageClient />)
    })

    await act(async () => {
      container.querySelector('[data-testid="run-backtest"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    await act(async () => {
      root?.unmount()
      root = null
    })

    resolvePoll?.({ id: 'job-1', status: 'succeeded', createdAt: '2026-03-24T12:00:01.000Z' })
    await act(async () => {
      await Promise.resolve()
    })

    const unmountWarnings = consoleErrorSpy.mock.calls
      .flatMap(call => call.map(arg => String(arg)))
      .filter(msg => msg.includes('unmounted') || msg.includes('state update'))
    expect(unmountWarnings).toHaveLength(0)
    consoleErrorSpy.mockRestore()
  })
})
