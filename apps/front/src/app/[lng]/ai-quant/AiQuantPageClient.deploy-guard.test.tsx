/** @jest-environment jsdom */
/* eslint-disable react-hooks-extra/no-unnecessary-use-prefix */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { AiQuantPageClient } from './AiQuantPageClient'

const mockPush = jest.fn()
const mockDeployAccountAiQuantStrategy = jest.fn()
const mockFetchAccountAiQuantDeployResult = jest.fn()
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
    <button type="button" data-testid="open-deploy" onClick={onDeploy}>open deploy</button>
  ),
}))

jest.mock('@/components/ai-quant/DeployDialog', () => ({
  DeployDialog: ({
    open,
    exchange,
    selectedAccountId,
    selectedLeverage,
    deploySubmitting,
    onSelectExchange,
    onSelectAccount,
    onSelectLeverage,
    onConfirmDeploy,
  }: {
    open: boolean
    exchange: 'binance' | 'okx' | 'hyperliquid'
    selectedAccountId: string
    selectedLeverage?: number
    deploySubmitting: boolean
    onSelectExchange: (exchange: 'binance' | 'okx' | 'hyperliquid') => void
    onSelectAccount: (accountId: string) => void
    onSelectLeverage?: (leverage: number) => void
    onConfirmDeploy: () => Promise<void> | void
  }) => (
    open
      ? (
            <div>
            <div data-testid="selected-exchange">{exchange}</div>
            <div data-testid="selected-leverage">{selectedLeverage ?? ''}</div>
            <button type="button" data-testid="select-hyperliquid" onClick={() => onSelectExchange('hyperliquid')}>
              select hyperliquid
            </button>
            <button type="button" data-testid="select-account" onClick={() => onSelectAccount('acct-hyper-1')}>
              select account
            </button>
            <button type="button" data-testid="select-leverage" onClick={() => onSelectLeverage?.(4)}>
              select leverage
            </button>
            <button
              type="button"
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
  fetchAccountAiQuantDeployResult: (...args: unknown[]) => mockFetchAccountAiQuantDeployResult(...args),
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
      publishedSnapshotId: 'snapshot-1',
      publishedSnapshotDeploymentExecutionDefaults: {
        leverage: 2,
        priceSource: 'mark',
        orderType: 'market',
        timeInForce: 'IOC',
      },
      publishedSnapshotDeploymentExecutionConstraints: {
        effectiveAllowedLeverageRange: {
          min: 1,
          max: 5,
        },
        constraintExplanation: '最终只允许 1-5x。',
      },
      publishedScriptCode: 'return { ok: true }',
      publishedScriptGraphVersion: 1,
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
    mockFetchAccountAiQuantDeployResult.mockReset()
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
        publishedSnapshotId: 'snapshot-1',
        exchangeAccountId: 'acct-hyper-1',
        exchangeAccountName: 'Hyper Testnet',
      }),
    )
    expect(mockDeployAccountAiQuantStrategy).toHaveBeenCalledWith(
      expect.not.objectContaining({
        strategyInstanceId: expect.anything(),
      }),
    )
  })

  it('submits selected deployment leverage with the deploy request', async () => {
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

    await act(async () => {
      container.querySelector('[data-testid="select-account"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      container.querySelector('[data-testid="select-leverage"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.querySelector('[data-testid="selected-leverage"]')?.textContent).toBe('4')

    await act(async () => {
      container.querySelector('[data-testid="confirm-deploy"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(mockDeployAccountAiQuantStrategy).toHaveBeenCalledWith(
      expect.objectContaining({
        deploymentExecutionConfig: expect.objectContaining({
          leverage: 4,
        }),
      }),
    )
  })

  it('blocks deploy and records a republish-required message when snapshot compatibility requires republish', async () => {
    localStorage.clear()
    seedDeployableConversation(Date.now())
    const stored = JSON.parse(localStorage.getItem('ai_quant_conversations_v1') ?? '[]')
    stored[0].publishedSnapshotCompatibilityMetadata = {
      isLegacySnapshot: true,
      missingStrategyInstanceBinding: true,
      missingBacktestConfigDefaults: false,
      missingDeploymentExecutionDefaults: false,
      missingDeploymentExecutionConstraints: false,
      requiresRepublishForBacktest: false,
      requiresRepublishForDeploy: true,
    }
    localStorage.setItem('ai_quant_conversations_v1', JSON.stringify(stored))

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

    await act(async () => {
      container.querySelector('[data-testid="select-account"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    await act(async () => {
      container.querySelector('[data-testid="confirm-deploy"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(mockDeployAccountAiQuantStrategy).not.toHaveBeenCalled()
    expect(mockFetchUserExchangeAccountStatuses).toHaveBeenCalledTimes(1)
  })

  it('reconciles transient deploy failure by deployRequestId and records success instead of failure', async () => {
    mockFetchUserExchangeAccountStatuses.mockReset()
    mockDeployAccountAiQuantStrategy.mockReset()
    mockFetchAccountAiQuantDeployResult.mockReset()

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
    ])

    const transientError = Object.assign(new Error('deploy transient failed'), {
      code: 'SERVICE_TEMPORARILY_UNAVAILABLE',
      status: 503,
      details: {
        error: {
          code: 'SERVICE_TEMPORARILY_UNAVAILABLE',
          requestId: 'deploy-req-503',
        },
      },
      message: 'Backtesting upstream temporarily unavailable (SERVICE_TEMPORARILY_UNAVAILABLE, HTTP 503, requestId deploy-req-503)',
    })

    mockDeployAccountAiQuantStrategy.mockRejectedValue(transientError)
    mockFetchAccountAiQuantDeployResult.mockResolvedValue({
      id: 'strategy-1',
      name: 'Binance strategy',
      status: 'running',
      exchange: 'binance',
      symbol: 'BTCUSDT',
      timeframe: '15m',
      positionPct: 10,
      isSubscribed: true,
      metrics: {
        returnPct: 0,
        maxDrawdownPct: 0,
        winRatePct: 0,
        tradeCount: 0,
      },
      updatedAt: '2026-04-17T00:00:00.000Z',
      totalPnl: 0,
      todayPnl: 0,
      equitySeries: [],
      timeline: [],
      latestOrders: [],
      snapshot: {
        publishedSnapshotId: 'snapshot-1',
        snapshotHash: 'hash-1',
        exchange: 'binance',
        symbol: 'BTCUSDT',
        timeframe: '15m',
        positionPct: 10,
        paramSchema: null,
        paramValues: null,
        schemaVersion: null,
        deployAccountName: 'Binance Main',
        deployAt: null,
        strategyConfig: null,
        backtestConfigDefaults: null,
        deploymentExecutionBaseline: null,
        deploymentExecutionCurrent: null,
        deploymentExecutionConstraints: null,
        effectiveAllowedLeverageRange: null,
        compatibilityMetadata: null,
        consistencySummary: {
          isConsistent: true,
          driftReasons: [],
          consistencyScore: 100,
        },
        executionConfigVersion: 1,
      },
      accountOverview: {
        initialBalance: null,
        totalEquity: null,
        availableBalance: null,
        totalPnl: null,
        todayPnl: null,
        baseCurrency: null,
      },
      positionOverview: {
        openPositionsCount: null,
        closedPositionsCount: null,
        totalRealizedPnl: null,
        totalUnrealizedPnl: null,
      },
      deployment: null,
    })

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
      container.querySelector('[data-testid="select-account"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    await act(async () => {
      container.querySelector('[data-testid="confirm-deploy"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockDeployAccountAiQuantStrategy).toHaveBeenCalledTimes(1)
    expect(mockFetchAccountAiQuantDeployResult).toHaveBeenCalledTimes(1)
  })
})
