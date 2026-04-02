/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { AiQuantPageClient } from './AiQuantPageClient'

const mockContinueLlmCodegenSession = jest.fn()
const mockFetchBacktestCapabilities = jest.fn()

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('next/navigation', () => ({
  useParams: () => ({ lng: 'zh' }),
  useRouter: () => ({ push: jest.fn() }),
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

jest.mock('@/components/ai-quant/BacktestSummaryCard', () => ({
  BacktestSummaryCard: () => null,
}))

jest.mock('@/components/ai-quant/QuantChatPanel', () => ({
  QuantChatPanel: ({
    canRunBacktest,
  }: {
    canRunBacktest?: boolean
  }) => <button data-testid="run-backtest" disabled={!canRunBacktest}>run</button>,
}))

jest.mock('@/components/ai-quant/LogicGraphPreview', () => ({
  LogicGraphPreview: ({
    graph,
    onConfirm,
    confirmDisabled,
  }: {
    graph: { status: string }
    onConfirm: () => void
    confirmDisabled?: boolean
  }) => (
    <div>
      <div data-testid="graph-status">{graph.status}</div>
      <button data-testid="confirm-graph" disabled={Boolean(confirmDisabled)} onClick={onConfirm}>confirm</button>
    </div>
  ),
}))

jest.mock('@/components/ai-quant/backtest-capability-client', () => ({
  fetchBacktestCapabilities: (...args: unknown[]) => mockFetchBacktestCapabilities(...args),
}))

jest.mock('@/components/ai-quant/backtest-job-client', () => ({
  createBacktestJob: jest.fn(),
  getBacktestJob: jest.fn(),
  getBacktestJobResult: jest.fn(),
}))

jest.mock('@/lib/api', () => ({
  deployAccountAiQuantStrategy: jest.fn(),
  continueLlmCodegenSession: (...args: unknown[]) => mockContinueLlmCodegenSession(...args),
  fetchUserExchangeAccountStatuses: jest.fn(async () => []),
  getLlmCodegenSession: jest.fn(),
  startLlmCodegenSession: jest.fn(),
}))

function seedDraftConversation(now = Date.now()) {
  localStorage.setItem('ai_quant_conversations_v1', JSON.stringify([
    {
      id: 'conv-1',
      title: 'conv',
      messages: [{ id: 'welcome', role: 'assistant', content: 'hello' }],
      params: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        buyWindowMin: 3,
        buyDropPct: 1,
        sellWindowMin: 15,
        sellRisePct: 2,
        positionPct: 10,
      },
      paramSchema: null,
      paramValues: {
        exchange: 'okx',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        buyWindowMin: 3,
        buyDropPct: 1,
        sellWindowMin: 15,
        sellRisePct: 2,
        positionPct: 10,
      },
      backtestResult: null,
      logicGraph: {
        version: 1,
        status: 'draft',
        trigger: [],
        actions: [],
        risk: [],
        meta: {
          exchange: 'okx',
          symbol: 'BTCUSDT',
          timeframe: '15m',
          positionPct: 10,
        },
      },
      llmCodegenSessionId: 'session-1',
      publishedStrategyInstanceId: null,
      latestSignalMessage: null,
      backtestExecutionState: 'idle',
      updatedAt: now,
    },
  ]))
}

describe('AiQuantPageClient codegen confirmation flow', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot> | null

  beforeEach(() => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    localStorage.clear()
    seedDraftConversation(Date.now())
    jest.clearAllMocks()

    mockFetchBacktestCapabilities.mockResolvedValue({
      allowedSymbols: ['BTCUSDT'],
      allowedBaseTimeframes: ['15m'],
    })
    mockContinueLlmCodegenSession.mockResolvedValue({
      id: 'session-1',
      status: 'PUBLISHED',
      strategyInstanceId: 'strategy-1',
      scriptCode: 'return { ok: true }',
      specDesc: {
        entryRules: ['价格达到 66830 时买入'],
        exitRules: ['价格上涨到 66890 时卖出'],
        riskRules: { positionPct: 10, maxDrawdownPct: 20 },
        market: {
          symbols: ['BTCUSDT'],
          timeframes: ['15m'],
        },
      },
    })
  })

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount()
      })
      root = null
    }
    document.body.innerHTML = ''
  })

  it('keeps graph confirmed and enables backtest after codegen is published', async () => {
    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    const initialRunButton = container.querySelector('[data-testid="run-backtest"]') as HTMLButtonElement | null
    expect(initialRunButton?.disabled).toBe(true)

    await act(async () => {
      container.querySelector('[data-testid="confirm-graph"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="graph-status"]')?.textContent).toBe('confirmed')
    const confirmButton = container.querySelector('[data-testid="confirm-graph"]') as HTMLButtonElement | null
    const runButton = container.querySelector('[data-testid="run-backtest"]') as HTMLButtonElement | null
    expect(confirmButton?.disabled).toBe(true)
    expect(runButton?.disabled).toBe(false)
  })

  it('enables backtest even when published response has null strategyInstanceId', async () => {
    mockContinueLlmCodegenSession.mockResolvedValueOnce({
      id: 'session-1',
      status: 'PUBLISHED',
      strategyInstanceId: null,
      scriptCode: 'return { ok: true }',
      specDesc: {
        entryRules: ['价格达到 66830 时买入'],
        exitRules: ['价格上涨到 66890 时卖出'],
        riskRules: { positionPct: 10, maxDrawdownPct: 20 },
        market: {
          symbols: ['BTCUSDT'],
          timeframes: ['15m'],
        },
      },
    })

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    await act(async () => {
      container.querySelector('[data-testid="confirm-graph"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    const runButton = container.querySelector('[data-testid="run-backtest"]') as HTMLButtonElement | null
    expect(runButton?.disabled).toBe(false)
  })
})
