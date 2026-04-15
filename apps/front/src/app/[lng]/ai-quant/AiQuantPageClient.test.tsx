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
  ConversationSidebar: ({
    items,
    onDelete,
  }: {
    items: Array<{ id: string, title: string }>
    onDelete?: (id: string) => void
  }) => (
    <div data-testid="sidebar">
      {items.map(item => (
        <button
          key={`delete-${item.id}`}
          data-testid={`delete-${item.id}`}
          onClick={() => onDelete?.(item.id)}
        >
          delete-{item.title}
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

jest.mock('@/components/ai-quant/backtest-symbol-support-client', () => ({
  checkBacktestSymbolSupport: jest.fn(async () => ({ status: 'supported' })),
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
  deleteAiQuantConversation: jest.fn(async () => undefined),
  continueLlmCodegenSession: jest.fn(),
  fetchUserExchangeAccountStatuses: jest.fn(async () => []),
  listAiQuantConversations: jest.fn(async () => []),
  getLlmCodegenSession: jest.fn(),
  listLlmCodegenSessions: jest.fn(async () => []),
  startLlmCodegenSession: jest.fn(),
}))

function seedConfirmedConversation(now = Date.now()) {
  localStorage.setItem('ai_quant_conversations_v1', JSON.stringify([
    {
      id: 'conv-1',
      title: 'conv',
      messages: [{ id: 'welcome', role: 'assistant', content: '```typescript\nreturn { ok: true }\n```' }],
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
        backtestInitialCash: 10000,
        backtestLeverage: 1,
        backtestSlippageBps: 10,
        backtestFeeBps: 5,
        backtestPriceSource: 'close',
        backtestAllowPartial: true,
      },
      backtestResult: null,
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
      publishedSnapshotStrategyConfig: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        positionPct: 10,
      },
      publishedSnapshotParamValues: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        baseTimeframe: '15m',
        buyWindowMin: 3,
        buyDropPct: 1,
        sellWindowMin: 15,
        sellRisePct: 2,
        positionPct: 10,
        backtestInitialCash: 10000,
        backtestLeverage: 1,
        backtestSlippageBps: 10,
        backtestFeeBps: 5,
        backtestPriceSource: 'close',
        backtestAllowPartial: true,
      },
      publishedSnapshotBacktestConfigDefaults: {
        initialCash: 10000,
        leverage: 1,
        slippageBps: 10,
        feeBps: 5,
        priceSource: 'close',
        allowPartial: true,
      },
      publishedSnapshotCompatibilityMetadata: {
        isLegacySnapshot: false,
        missingBacktestConfigDefaults: false,
        missingDeploymentExecutionDefaults: false,
        missingDeploymentExecutionConstraints: false,
        requiresRepublishForBacktest: false,
        requiresRepublishForDeploy: false,
      },
      publishedScriptGraphVersion: 1,
      backtestExecutionConfigExplicit: true,
      latestSignalMessage: null,
      backtestExecutionState: 'idle',
      updatedAt: now,
    },
  ]))
}

function buildPersistedConversation(now = Date.now()) {
  return {
    id: 'conv-1',
    title: 'persisted-conv',
    messages: [{ id: 'persisted', role: 'assistant', content: 'persisted-message' }],
    params: {
      exchange: 'binance',
      symbol: 'ETHUSDT',
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
      symbol: 'ETHUSDT',
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
      status: 'confirmed',
      trigger: [],
      actions: [],
      risk: [],
      meta: {
        exchange: 'binance',
        symbol: 'ETHUSDT',
        timeframe: '15m',
        positionPct: 10,
      },
    },
    llmCodegenSessionId: null,
    publishedStrategyInstanceId: 'strategy-1',
    publishedSnapshotId: 'snapshot-1',
    publishedSnapshotStrategyConfig: {
      exchange: 'binance',
      symbol: 'ETHUSDT',
      baseTimeframe: '15m',
      positionPct: 10,
    },
    publishedSnapshotParamValues: {
      exchange: 'binance',
      symbol: 'ETHUSDT',
      baseTimeframe: '15m',
      buyWindowMin: 3,
      buyDropPct: 1,
      sellWindowMin: 15,
      sellRisePct: 2,
      positionPct: 10,
      backtestInitialCash: 10000,
      backtestLeverage: 1,
      backtestSlippageBps: 10,
      backtestFeeBps: 5,
      backtestPriceSource: 'close',
      backtestAllowPartial: true,
    },
    publishedSnapshotBacktestConfigDefaults: {
      initialCash: 10000,
      leverage: 1,
      slippageBps: 10,
      feeBps: 5,
      priceSource: 'close',
      allowPartial: true,
    },
    publishedSnapshotCompatibilityMetadata: {
      isLegacySnapshot: false,
      missingBacktestConfigDefaults: false,
      missingDeploymentExecutionDefaults: false,
      missingDeploymentExecutionConstraints: false,
      requiresRepublishForBacktest: false,
      requiresRepublishForDeploy: false,
    },
    publishedScriptGraphVersion: 1,
    backtestExecutionConfigExplicit: true,
    latestSignalMessage: null,
    backtestExecutionState: 'idle',
    updatedAt: now,
  }
}

function seedVersionedConversation(version: string, now = Date.now()) {
  localStorage.setItem(
    'ai_quant_conversations_v1',
    JSON.stringify({
      version,
      conversations: [buildPersistedConversation(now)],
    }),
  )
}

function createDeferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((innerResolve, innerReject) => {
    resolve = innerResolve
    reject = innerReject
  })
  return { promise, resolve, reject }
}

describe('AiQuantPageClient backtest range integration', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot> | null

  beforeEach(() => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    localStorage.clear()
    seedConfirmedConversation(Date.now())
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
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      container.querySelector('[data-testid="set-invalid-range"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    await act(async () => {
      container.querySelector('[data-testid="run-backtest"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="backtest-summary"]')).toBeNull()
    expect(container.textContent).toContain('aiQuant.messages.backtestRangeOrderInvalid')
    expect(createBacktestJob).not.toHaveBeenCalled()
  })

  it('writes normalized startAt/endAt into backtest result when range is valid', async () => {
    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      container.querySelector('[data-testid="set-valid-preset"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    await act(async () => {
      container.querySelector('[data-testid="run-backtest"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => {
      await Promise.resolve()
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
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      container.querySelector('[data-testid="set-valid-preset"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    await act(async () => {
      container.querySelector('[data-testid="run-backtest"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    await act(async () => {
      await Promise.resolve()
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
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      container.querySelector('[data-testid="run-backtest"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="backtest-confirm"]')).toBeNull()
    expect(container.querySelector('[data-testid="backtest-summary"]')).toBeTruthy()
  })

  it('uses shrink-safe layout classes for the chat column', async () => {
    await act(async () => {
      root?.render(<AiQuantPageClient />)
    })

    const grid = container.querySelector('main > div + div')
    expect(grid?.className).toContain('md:grid-cols-[280px_minmax(0,1fr)]')

    const contentColumn = grid?.lastElementChild
    expect(contentColumn?.className).toContain('min-w-0')
  })

  it('restores persisted conversations when the stored deploy version matches', async () => {
    localStorage.clear()
    seedVersionedConversation('deploy-current', Date.now())

    await act(async () => {
      root?.render(<AiQuantPageClient deployVersion="deploy-current" />)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain('persisted-message')
    expect(container.textContent).toContain('"symbol":"ETHUSDT"')
  })

  it('drops persisted conversations when the stored deploy version is stale', async () => {
    localStorage.clear()
    seedVersionedConversation('deploy-old', Date.now())

    await act(async () => {
      root?.render(<AiQuantPageClient deployVersion="deploy-current" />)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).not.toContain('persisted-message')
    expect(container.textContent).toContain('"symbol":"BTCUSDT"')
  })

  it('prefers backend-owned sessions over persisted local AI Quant conversations', async () => {
    localStorage.clear()
    seedVersionedConversation('deploy-current', Date.now())

    const { listAiQuantConversations, listLlmCodegenSessions } = jest.requireMock('@/lib/api') as {
      listAiQuantConversations: jest.Mock
      listLlmCodegenSessions: jest.Mock
    }
    listAiQuantConversations.mockResolvedValue([
      {
        id: 'session-1',
        status: 'CHECKLIST_GATE',
        updatedAt: '2026-04-10T12:00:00.000Z',
        conversationTitle: 'server-conv',
        conversationMessages: [
          { role: 'assistant', content: 'server-message' },
        ],
      },
    ])

    await act(async () => {
      root?.render(<AiQuantPageClient deployVersion="deploy-current" serverOwnedConversations />)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(listAiQuantConversations).toHaveBeenCalled()
    expect(listLlmCodegenSessions).not.toHaveBeenCalled()
    expect(container.textContent).toContain('server-message')
    expect(container.textContent).not.toContain('persisted-message')
  })

  it('shows a dedicated loading state while server-owned conversations are syncing', async () => {
    localStorage.clear()
    seedVersionedConversation('deploy-current', Date.now())

    const { listAiQuantConversations } = jest.requireMock('@/lib/api') as {
      listAiQuantConversations: jest.Mock
    }
    const deferred = createDeferred<Array<Record<string, unknown>>>()
    listAiQuantConversations.mockReturnValue(deferred.promise)

    await act(async () => {
      root?.render(<AiQuantPageClient deployVersion="deploy-current" serverOwnedConversations />)
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="conversation-sync-loading"]')).toBeTruthy()
    expect(container.querySelector('[data-testid="sidebar"]')).toBeNull()
    expect(container.textContent).not.toContain('persisted-message')

    await act(async () => {
      deferred.resolve([])
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="conversation-sync-loading"]')).toBeNull()
  })

  it('clears stale local cache and shows an error state when server conversation hydration fails', async () => {
    localStorage.clear()
    seedVersionedConversation('deploy-current', Date.now())

    const { listAiQuantConversations } = jest.requireMock('@/lib/api') as {
      listAiQuantConversations: jest.Mock
    }
    listAiQuantConversations.mockRejectedValue(new Error('gateway'))

    await act(async () => {
      root?.render(<AiQuantPageClient deployVersion="deploy-current" serverOwnedConversations />)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(localStorage.getItem('ai_quant_conversations_v1')).toBeNull()
    expect(container.querySelector('[data-testid="conversation-sync-error"]')).toBeTruthy()
    expect(container.textContent).not.toContain('persisted-message')
  })

  it('deletes a server-owned conversation through the backend and keeps it removed locally', async () => {
    localStorage.clear()

    const { listAiQuantConversations, deleteAiQuantConversation } = jest.requireMock('@/lib/api') as {
      listAiQuantConversations: jest.Mock
      deleteAiQuantConversation: jest.Mock
    }

    listAiQuantConversations.mockResolvedValue([
      {
        id: 'conv-1',
        status: 'CHECKLIST_GATE',
        updatedAt: '2026-04-10T12:00:00.000Z',
        conversationTitle: 'server-conv-1',
        conversationMessages: [{ role: 'assistant', content: 'server-message-1' }],
      },
      {
        id: 'conv-2',
        status: 'CHECKLIST_GATE',
        updatedAt: '2026-04-10T12:01:00.000Z',
        conversationTitle: 'server-conv-2',
        conversationMessages: [{ role: 'assistant', content: 'server-message-2' }],
      },
    ])

    await act(async () => {
      root?.render(<AiQuantPageClient deployVersion="deploy-current" serverOwnedConversations />)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain('server-message-1')

    await act(async () => {
      (container.querySelector('[data-testid="delete-conv-1"]') as HTMLButtonElement).click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(deleteAiQuantConversation).toHaveBeenCalledWith('conv-1')
    expect(container.textContent).not.toContain('server-message-1')
    expect(container.textContent).toContain('server-message-2')
  })

})
