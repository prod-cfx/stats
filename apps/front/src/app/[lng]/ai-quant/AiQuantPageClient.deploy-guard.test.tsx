/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { AiQuantPageClient } from './AiQuantPageClient'

const mockPush = jest.fn()
const mockDeployAccountAiQuantStrategy = jest.fn()
const mockFetchUserExchangeAccountStatuses = jest.fn()

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
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

jest.mock('@/components/ai-quant/ConversationSidebar', () => ({
  ConversationSidebar: () => <div data-testid="sidebar" />,
}))

jest.mock('@/components/ai-quant/GuestAiQuantLanding', () => ({
  GuestAiQuantLanding: () => <div data-testid="guest" />,
}))

jest.mock('@/components/ai-quant/LogicGraphPreview', () => ({
  LogicGraphPreview: () => null,
}))

jest.mock('@/components/ai-quant/QuantChatPanel', () => ({
  QuantChatPanel: () => <div data-testid="chat" />,
}))

jest.mock('@/components/ai-quant/BacktestSummaryCard', () => ({
  BacktestSummaryCard: ({ onDeploy }: { onDeploy: () => void }) => (
    <button data-testid="open-deploy" onClick={onDeploy}>open deploy</button>
  ),
}))

jest.mock('@/components/ai-quant/DeployDialog', () => ({
  DeployDialog: ({
    open,
    exchange,
    selectedAccountId,
    deploySubmitting,
    onSelectExchange,
    onSelectAccount,
    onConfirmDeploy,
  }: {
    open: boolean
    exchange: 'binance' | 'okx' | 'hyperliquid'
    selectedAccountId: string
    deploySubmitting: boolean
    onSelectExchange: (exchange: 'binance' | 'okx' | 'hyperliquid') => void
    onSelectAccount: (accountId: string) => void
    onConfirmDeploy: () => Promise<void> | void
  }) => (
    open
      ? (
          <div>
            <div data-testid="selected-exchange">{exchange}</div>
            <button data-testid="select-hyperliquid" onClick={() => onSelectExchange('hyperliquid')}>
              select hyperliquid
            </button>
            <button data-testid="select-account" onClick={() => onSelectAccount('acct-hyper-1')}>
              select account
            </button>
            <button
              data-testid="confirm-deploy"
              disabled={!selectedAccountId || deploySubmitting}
              onClick={() => void onConfirmDeploy()}
            >
              confirm deploy
            </button>
          </div>
        )
      : null
  ),
}))

jest.mock('@/components/ai-quant/backtest-symbol-support-client', () => ({
  checkBacktestSymbolSupport: jest.fn(async () => ({ status: 'supported' })),
}))

jest.mock('@/components/ai-quant/backtest-job-client', () => ({
  createBacktestJob: jest.fn(),
  getBacktestJob: jest.fn(),
  getBacktestJobResult: jest.fn(),
}))

jest.mock('@/components/ai-quant/backtest-capability-client', () => ({
  fetchBacktestCapabilities: jest.fn(async () => ({
    allowedSymbols: ['BTCUSDT'],
    allowedBaseTimeframes: ['15m'],
  })),
}))

jest.mock('@/lib/api', () => ({
  deployAccountAiQuantStrategy: (...args: unknown[]) => mockDeployAccountAiQuantStrategy(...args),
  continueLlmCodegenSession: jest.fn(),
  fetchUserExchangeAccountStatuses: (...args: unknown[]) => mockFetchUserExchangeAccountStatuses(...args),
  getLlmCodegenSession: jest.fn(),
  startLlmCodegenSession: jest.fn(),
}))

function seedDeployableConversation(now = Date.now()) {
  localStorage.setItem('ai_quant_conversations_v1', JSON.stringify([
    {
      id: 'conv-1',
      title: 'Binance strategy',
      messages: [{ id: 'm-1', role: 'assistant', content: 'ready' }],
      params: {
        exchange: 'binance',
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
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        buyWindowMin: 3,
        buyDropPct: 1,
        sellWindowMin: 15,
        sellRisePct: 2,
        positionPct: 10,
      },
      backtestResult: {
        id: 'bt-1',
        netProfit: 120,
        returnPct: 12,
        maxDrawdownPct: 9.5,
        winRatePct: 55,
        totalTrades: 42,
        profitFactor: 1.8,
        startAt: '2026-03-17T12:00:00.000Z',
        endAt: '2026-03-24T12:00:00.000Z',
        symbol: 'BTCUSDT',
      },
      logicGraph: {
        version: 1,
        status: 'confirmed',
        trigger: [],
        actions: [],
        risk: [],
        meta: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          timeframe: '15m',
          positionPct: 10,
        },
      },
      llmCodegenSessionId: null,
      publishedStrategyInstanceId: 'strategy-1',
      latestSignalMessage: null,
      backtestExecutionState: 'idle',
      updatedAt: now,
    },
  ]))
}

describe('AiQuantPageClient deploy guard', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot> | null

  beforeEach(() => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    localStorage.clear()
    seedDeployableConversation(Date.now())
    jest.clearAllMocks()
    mockFetchUserExchangeAccountStatuses.mockResolvedValueOnce([
      {
        id: 'acct-binance-1',
        exchangeId: 'binance',
        isBound: true,
        name: 'Binance Main',
        maskedCredential: 'BIN****01',
        isTestnet: false,
        lastValidatedAt: null,
        createdAt: null,
      },
    ])
    mockFetchUserExchangeAccountStatuses.mockResolvedValueOnce([])
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

  it('rechecks exchange binding before deploy and redirects to API config when the selected exchange is no longer bound', async () => {
    await act(async () => {
      root?.render(<AiQuantPageClient />)
    })

    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      container.querySelector('[data-testid="open-deploy"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      container.querySelector('[data-testid="confirm-deploy"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(mockFetchUserExchangeAccountStatuses).toHaveBeenCalledTimes(2)
    expect(mockDeployAccountAiQuantStrategy).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalledWith('/zh/account?tab=ai-quant#exchange-api')
  })

  it('submits hyperliquid when the user switches deploy exchange to hyperliquid', async () => {
    mockFetchUserExchangeAccountStatuses.mockReset()
    mockDeployAccountAiQuantStrategy.mockReset()
    mockFetchUserExchangeAccountStatuses.mockResolvedValue([
      {
        id: 'acct-binance-1',
        exchangeId: 'binance',
        isBound: true,
        name: 'Binance Main',
        maskedCredential: 'BIN****01',
        isTestnet: false,
        lastValidatedAt: null,
        createdAt: null,
      },
      {
        id: 'acct-hyper-1',
        exchangeId: 'hyperliquid',
        isBound: true,
        name: 'Hyper Testnet',
        maskedCredential: 'HYP****01',
        isTestnet: true,
        lastValidatedAt: null,
        createdAt: null,
      },
    ])

    await act(async () => {
      root?.render(<AiQuantPageClient />)
    })

    await act(async () => {
      await Promise.resolve()
    })

    await act(async () => {
      container.querySelector('[data-testid="open-deploy"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.querySelector('[data-testid="selected-exchange"]')?.textContent).toBe('binance')

    await act(async () => {
      container.querySelector('[data-testid="select-hyperliquid"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.querySelector('[data-testid="selected-exchange"]')?.textContent).toBe('hyperliquid')

    await act(async () => {
      container.querySelector('[data-testid="select-account"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    await act(async () => {
      container.querySelector('[data-testid="confirm-deploy"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(mockDeployAccountAiQuantStrategy).toHaveBeenCalledWith(
      expect.objectContaining({
        exchange: 'hyperliquid',
        exchangeAccountId: 'acct-hyper-1',
        exchangeAccountName: 'Hyper Testnet',
      }),
    )
  })
})
