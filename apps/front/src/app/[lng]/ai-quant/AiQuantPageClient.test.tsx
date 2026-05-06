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

jest.mock('@/components/ai-quant/DisplayLogicGraphPreview', () => ({
  DisplayLogicGraphPreview: ({ graph }: { graph: Record<string, unknown> }) => (
    <div data-testid="display-logic-graph">{JSON.stringify(graph)}</div>
  ),
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
    onConfirmBacktestParams,
    onSend,
    onRunBacktest,
  }: {
    messages: Array<{ id: string, role: string, content: string }>
    paramValues: Record<string, unknown>
    onConfirmBacktestParams: (nextValues: Record<string, unknown>) => void
    onSend: (input: string) => void | Promise<void>
    onRunBacktest: () => void
  }) => (
    <div>
      <button
        data-testid="set-invalid-range"
        onClick={() =>
          onConfirmBacktestParams({
            ...paramValues,
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
          onConfirmBacktestParams({
            ...paramValues,
            backtestRangePreset: '7D',
            backtestStart: '',
            backtestEnd: '',
          })}
      >
        valid
      </button>
      <button
        data-testid="set-backtest-execution"
        onClick={() => onConfirmBacktestParams({ ...paramValues, backtestInitialCash: 25000 })}
      >
        execution
      </button>
      <button data-testid="send-semantic-edit" onClick={() => onSend('把止损改成 3%')}>
        semantic-edit
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
  deleteAccountAiQuantStrategy: jest.fn(async () => undefined),
  deleteAiQuantConversation: jest.fn(async () => undefined),
  continueLlmCodegenSession: jest.fn(),
  fetchAccountAiQuantStrategyDetail: jest.fn(async () => ({
    id: 'strategy-1',
    status: 'stopped',
    positionOverview: { openPositionsCount: 0, totalUnrealizedPnl: 0 },
    latestOrders: [],
  })),
  fetchUserExchangeAccountStatuses: jest.fn(async () => []),
  listAiQuantConversations: jest.fn(async () => []),
  getLlmCodegenSession: jest.fn(),
  listLlmCodegenSessions: jest.fn(async () => []),
  performAccountAiQuantStrategyAction: jest.fn(async () => ({
    id: 'strategy-1',
    status: 'stopped',
    positionOverview: { openPositionsCount: 0, totalUnrealizedPnl: 0 },
    latestOrders: [],
  })),
  recoverAiQuantEditConversation: jest.fn(),
  startLlmCodegenSession: jest.fn(),
  updateAiQuantConversationBacktestDraft: jest.fn(async () => undefined),
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
        marketType: 'perp',
        baseTimeframe: '15m',
        positionPct: 10,
      },
      publishedSnapshotParamValues: {
        exchange: 'binance',
        symbol: 'BTCUSDT',
        marketType: 'perp',
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
      marketType: 'perp',
      baseTimeframe: '15m',
      positionPct: 10,
    },
    publishedSnapshotParamValues: {
      exchange: 'binance',
      symbol: 'ETHUSDT',
      marketType: 'perp',
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

async function waitForCondition(assertion: () => void, attempts = 20) {
  let lastError: unknown
  for (let i = 0; i < attempts; i += 1) {
    try {
      assertion()
      return
    } catch (error) {
      lastError = error
      await act(async () => {
        await Promise.resolve()
      })
    }
  }
  throw lastError
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

  it('keeps confirmed logic graph and published snapshot when changing backtest execution params', async () => {
    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      container.querySelector('[data-testid="set-backtest-execution"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    const raw = localStorage.getItem('ai_quant_conversations_v1')
    expect(raw).toBeTruthy()
    const parsed = JSON.parse(raw ?? '{}') as {
      version: string
      conversations: Array<{
        publishedSnapshotId: string | null
        logicGraph?: { status?: string }
        paramValues?: Record<string, unknown>
      }>
    }
    expect(parsed.conversations[0]?.publishedSnapshotId).toBe('snapshot-1')
    expect(parsed.conversations[0]?.logicGraph?.status).toBe('confirmed')
    expect(parsed.conversations[0]?.paramValues?.backtestInitialCash).toBe(25000)
  })

  it.each([
    ['plaza-run'],
    ['plaza-edit'],
  ] as const)('keeps %s intent without resuming legacy preset actions', async (type) => {
    localStorage.setItem('ai_quant_return_intent_v1', JSON.stringify({
      type,
      templateId: 'ma-cross',
      ts: Date.now(),
    }))

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(localStorage.getItem('ai_quant_return_intent_v1')).toContain(`"type":"${type}"`)
    expect(container.textContent).not.toContain('aiQuant.messages.intentMiss')
  })

  it('keeps strategy edit session intent without resuming legacy preset actions', async () => {
    localStorage.setItem('ai_quant_return_intent_v1', JSON.stringify({
      type: 'strategy-edit-session',
      strategyInstanceId: 'strategy-1',
      publishedSnapshotId: 'snapshot-1',
      conversationId: 'conversation-1',
      sessionId: 'session-1',
      source: 'account-detail',
      ts: Date.now(),
    }))

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(localStorage.getItem('ai_quant_return_intent_v1')).toContain('"type":"strategy-edit-session"')
    expect(container.textContent).not.toContain('aiQuant.messages.intentMiss')
  })

  it.each([
    ['chat', { type: 'chat', draft: 'resume draft' }],
    ['run', { type: 'run', strategyId: 'momentum-steady' }],
    ['edit', { type: 'edit', strategyId: 'momentum-steady' }],
  ])('clears legacy %s intent when resuming it', async (_label, intent) => {
    localStorage.setItem('ai_quant_return_intent_v1', JSON.stringify({
      ...intent,
      ts: Date.now(),
    }))

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(localStorage.getItem('ai_quant_return_intent_v1')).toBeNull()
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
        status: 'CONFIRM_GATE',
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

  it('semantic edit clears published/backtest artifacts and refreshes graph state from CONFIRM_GATE response', async () => {
    localStorage.clear()
    localStorage.setItem(
      'ai_quant_conversations_v1',
      JSON.stringify({
        version: 'deploy-current',
        conversations: [{
          ...buildPersistedConversation(Date.now()),
          llmCodegenSessionId: 'session-edit',
          backtestResult: {
            id: 'bt-old',
            startAt: '2026-03-01T00:00:00.000Z',
            endAt: '2026-03-08T00:00:00.000Z',
            maxDrawdownPct: 5,
            totalReturnPct: 12,
            winRatePct: 60,
            tradeCount: 8,
          },
          publishedScriptCode: 'export default function oldStrategy() { return true }',
          publishedSnapshotDeploymentExecutionDefaults: {
            leverage: 2,
            priceSource: 'close',
            orderType: 'market',
            timeInForce: 'gtc',
          },
          publishedSnapshotDeploymentExecutionConstraints: {
            effectiveAllowedLeverageRange: { min: 1, max: 3 },
            supportedPriceSources: ['close'],
            supportedOrderTypes: ['market'],
            supportedTimeInForce: ['gtc'],
            constraintExplanation: 'old constraints',
          },
          publicationGate: { passed: true, blockingMismatches: [] },
        }],
      }),
    )

    const newSpecDesc = {
      canonicalDigest: 'sha256:new-semantic-digest',
      market: {
        symbols: ['ETHUSDT'],
        timeframes: ['15m'],
      },
      rules: [
        {
          id: 'risk-stop-loss',
          phase: 'risk',
          condition: {
            key: 'position_loss_pct',
            value: 0.03,
          },
          actions: [{ type: 'FORCE_EXIT' }],
        },
      ],
    }
    const newSemanticGraph = {
      version: 2,
      nodes: [
        {
          id: 'risk-stop-loss',
          label: '3% stop loss',
        },
      ],
      edges: [],
    }

    const { continueLlmCodegenSession } = jest.requireMock('@/lib/api') as {
      continueLlmCodegenSession: jest.Mock
    }
    continueLlmCodegenSession.mockResolvedValue({
      id: 'session-edit',
      conversationId: 'conv-1',
      conversationTitle: 'edited strategy',
      status: 'CONFIRM_GATE',
      updatedAt: '2026-04-10T12:00:00.000Z',
      canonicalDigest: 'sha256:new-semantic-digest',
      specDesc: newSpecDesc,
      semanticGraph: newSemanticGraph,
      validationReport: { ok: true, errors: [] },
      publicationGate: null,
      assistantPrompt: '已更新为 3% stop loss，请确认逻辑图。',
      conversationMessages: [
        { role: 'user', content: '把止损改成 3%' },
        { role: 'assistant', content: '已更新为 3% stop loss，请确认逻辑图。' },
      ],
    })

    await act(async () => {
      root?.render(<AiQuantPageClient deployVersion="deploy-current" />)
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      ;(container.querySelector('[data-testid="send-semantic-edit"]') as HTMLButtonElement).click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await waitForCondition(() => {
      const stored = localStorage.getItem('ai_quant_conversations_v1')
      expect(stored).toBeTruthy()
      const parsed = JSON.parse(stored ?? '{}') as {
        conversations: Array<Record<string, unknown>>
      }
      const conversation = parsed.conversations[0]
      expect(conversation?.codegenSpecDesc).toEqual(newSpecDesc)
      expect(conversation?.semanticGraph).toEqual(newSemanticGraph)
      expect(conversation?.pendingCanonicalDigest).toBe('sha256:new-semantic-digest')
      expect(conversation?.publishedStrategyInstanceId).toBeNull()
      expect(conversation?.publishedSnapshotId).toBeNull()
      expect(conversation?.publishedSnapshotParamValues).toBeNull()
      expect(conversation?.publishedSnapshotStrategyConfig).toBeNull()
      expect(conversation?.publishedSnapshotBacktestConfigDefaults).toBeNull()
      expect(conversation?.publishedSnapshotDeploymentExecutionDefaults).toBeNull()
      expect(conversation?.publishedSnapshotDeploymentExecutionConstraints).toBeNull()
      expect(conversation?.publishedSnapshotCompatibilityMetadata).toBeNull()
      expect(conversation?.publishedScriptCode).toBeNull()
      expect(conversation?.publishedScriptGraphVersion).toBeNull()
      expect(conversation?.publicationGate).toBeNull()
      expect(conversation?.backtestResult).toBeNull()
      expect(JSON.stringify(conversation?.logicGraph)).toContain('亏损达到 3%')
    })
    expect(container.querySelector('[data-testid="backtest-summary"]')).toBeNull()
    expect(container.textContent).toContain('3% stop loss')
  })

  it('preserves atomic server display graph text in state and on the page after codegen response', async () => {
    localStorage.clear()
    localStorage.setItem(
      'ai_quant_conversations_v1',
      JSON.stringify({
        version: 'deploy-current',
        conversations: [{
          ...buildPersistedConversation(Date.now()),
          llmCodegenSessionId: 'session-edit',
          displayLogicGraph: {
            blocks: [
              {
                type: 'IF',
                items: [{ id: 'legacy-fallback', kind: 'condition', text: '不支持的条件，待补充' }],
              },
            ],
          },
        }],
      }),
    )

    const atomicDisplayGraph = {
      blocks: [
        {
          type: 'IF',
          items: [
            { kind: 'condition', id: 'condition-bollinger', text: '触及布林带下轨（20, 2）' },
            { kind: 'condition', id: 'condition-volume', text: '成交量高于过去 20 根均量的 1.5 倍' },
            { kind: 'action', id: 'action-entry', text: '开多 10%' },
          ],
        },
        {
          type: 'EXECUTE',
          items: [
            { kind: 'execute', id: 'execute-symbol', key: 'symbol', value: 'ETHUSDT', text: '标的: ETHUSDT' },
          ],
        },
      ],
    }
    const { continueLlmCodegenSession } = jest.requireMock('@/lib/api') as {
      continueLlmCodegenSession: jest.Mock
    }
    continueLlmCodegenSession.mockResolvedValue({
      id: 'session-edit',
      conversationId: 'conv-1',
      conversationTitle: 'atomic display graph',
      status: 'CONFIRM_GATE',
      updatedAt: '2026-04-10T12:00:00.000Z',
      canonicalDigest: 'sha256:atomic-display-digest',
      specDesc: {
        displayLogicGraph: atomicDisplayGraph,
        rules: [
          {
            id: 'legacy-atomic-key',
            phase: 'entry',
            condition: { key: 'condition.expression' },
            actions: [{ type: 'OPEN_LONG' }],
          },
        ],
      },
      semanticGraph: {
        version: 3,
        nodes: [{ id: 'condition-volume', label: 'relative volume' }],
        edges: [],
      },
      validationReport: { ok: true, errors: [] },
      publicationGate: null,
      assistantPrompt: '逻辑图已更新。请确认逻辑图。',
      conversationMessages: [
        { role: 'user', content: '把止损改成 3%' },
        { role: 'assistant', content: '逻辑图已更新。请确认逻辑图。' },
      ],
    })

    await act(async () => {
      root?.render(<AiQuantPageClient deployVersion="deploy-current" />)
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      ;(container.querySelector('[data-testid="send-semantic-edit"]') as HTMLButtonElement).click()
      await Promise.resolve()
      await Promise.resolve()
      await Promise.resolve()
    })

    await waitForCondition(() => {
      const stored = localStorage.getItem('ai_quant_conversations_v1')
      expect(stored).toBeTruthy()
      const parsed = JSON.parse(stored ?? '{}') as {
        conversations: Array<{
          displayLogicGraph?: unknown
        }>
      }
      const displayGraphText = JSON.stringify(parsed.conversations[0]?.displayLogicGraph)
      expect(displayGraphText).toContain('成交量高于过去 20 根均量的 1.5 倍')
      expect(displayGraphText).not.toContain('不支持的条件')
    })
    expect(container.querySelector('[data-testid="display-logic-graph"]')?.textContent)
      .toContain('成交量高于过去 20 根均量的 1.5 倍')
    expect(container.querySelector('[data-testid="display-logic-graph"]')?.textContent)
      .not.toContain('不支持的条件')
  })

  it('activates a plaza edit session conversation without appending to the existing conversation', async () => {
    localStorage.clear()
    localStorage.setItem('ai_quant_return_intent_v1', JSON.stringify({
      type: 'plaza-chat-session',
      sessionId: 'plaza-session-1',
      ts: Date.now(),
    }))

    const { listAiQuantConversations } = jest.requireMock('@/lib/api') as {
      listAiQuantConversations: jest.Mock
    }
    listAiQuantConversations.mockResolvedValue([
      {
        id: 'existing-conv',
        status: 'DRAFTING',
        activeCodegenSessionId: 'existing-session',
        updatedAt: '2026-04-10T12:00:00.000Z',
        conversationTitle: 'existing',
        conversationMessages: [
          { role: 'assistant', content: 'existing-message' },
        ],
      },
      {
        id: 'plaza-conv',
        status: 'DRAFTING',
        activeCodegenSessionId: 'plaza-session-1',
        updatedAt: '2026-04-10T12:01:00.000Z',
        conversationTitle: 'plaza edit',
        conversationMessages: [
          { role: 'user', content: 'plaza-template-edit-message' },
        ],
      },
    ])

    await act(async () => {
      root?.render(<AiQuantPageClient serverOwnedConversations />)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(localStorage.getItem('ai_quant_return_intent_v1')).toBeNull()
    expect(container.textContent).toContain('plaza-template-edit-message')
    expect(container.textContent).not.toContain('existing-message|plaza-template-edit-message')
  })

  it('selects existing conversation from strategy edit session intent', async () => {
    localStorage.clear()
    localStorage.setItem('ai_quant_return_intent_v1', JSON.stringify({
      type: 'strategy-edit-session',
      strategyInstanceId: 'strategy-2',
      publishedSnapshotId: 'snapshot-2',
      source: 'account-detail',
      ts: Date.now(),
    }))

    const { listAiQuantConversations, recoverAiQuantEditConversation } = jest.requireMock('@/lib/api') as {
      listAiQuantConversations: jest.Mock
      recoverAiQuantEditConversation: jest.Mock
    }
    listAiQuantConversations.mockResolvedValue([
      {
        id: 'conversation-1',
        activeCodegenSessionId: 'session-1',
        conversationTitle: 'first',
        conversationMessages: [{ role: 'assistant', content: 'first-message' }],
        strategyInstanceId: 'strategy-1',
      },
      {
        id: 'conversation-2',
        activeCodegenSessionId: 'session-2',
        conversationTitle: 'second',
        conversationMessages: [{ role: 'assistant', content: 'second-message' }],
        strategyInstanceId: 'strategy-2',
        publishedSnapshotId: 'snapshot-2',
      },
    ])

    await act(async () => {
      root?.render(<AiQuantPageClient serverOwnedConversations />)
    })

    await waitForCondition(() => expect(container.textContent).toContain('second-message'))
    expect(container.textContent).not.toContain('first-message')
    expect(recoverAiQuantEditConversation).not.toHaveBeenCalled()
    expect(localStorage.getItem('ai_quant_return_intent_v1')).toBeNull()
  })

  it('recovers edit conversation when no loaded conversation matches intent', async () => {
    localStorage.clear()
    localStorage.setItem('ai_quant_return_intent_v1', JSON.stringify({
      type: 'strategy-edit-session',
      strategyInstanceId: 'strategy-9',
      publishedSnapshotId: 'snapshot-9',
      source: 'account-detail',
      ts: Date.now(),
    }))

    const { listAiQuantConversations, recoverAiQuantEditConversation } = jest.requireMock('@/lib/api') as {
      listAiQuantConversations: jest.Mock
      recoverAiQuantEditConversation: jest.Mock
    }
    listAiQuantConversations.mockResolvedValue([])
    recoverAiQuantEditConversation.mockResolvedValue({
      id: 'conversation-9',
      activeCodegenSessionId: 'session-9',
      conversationTitle: 'recovered',
      conversationMessages: [{ role: 'assistant', content: '已基于上一版策略恢复修改上下文。' }],
      strategyInstanceId: 'strategy-9',
      publishedSnapshotId: 'snapshot-9',
      semanticGraph: { version: 1 },
      specDesc: { rules: [] },
    })

    await act(async () => {
      root?.render(<AiQuantPageClient serverOwnedConversations />)
    })

    await waitForCondition(() => expect(container.textContent).toContain('已基于上一版策略恢复修改上下文。'))
    expect(recoverAiQuantEditConversation).toHaveBeenCalledWith({
      strategyInstanceId: 'strategy-9',
      publishedSnapshotId: 'snapshot-9',
      conversationId: undefined,
      sessionId: undefined,
      source: 'account-detail',
    })
    expect(localStorage.getItem('ai_quant_return_intent_v1')).toBeNull()
  })

  it('preserves strategy edit intent when recovery fails', async () => {
    localStorage.clear()
    localStorage.setItem('ai_quant_return_intent_v1', JSON.stringify({
      type: 'strategy-edit-session',
      strategyInstanceId: 'strategy-9',
      ts: Date.now(),
    }))
    const { listAiQuantConversations, recoverAiQuantEditConversation } = jest.requireMock('@/lib/api') as {
      listAiQuantConversations: jest.Mock
      recoverAiQuantEditConversation: jest.Mock
    }
    listAiQuantConversations.mockResolvedValue([])
    recoverAiQuantEditConversation.mockRejectedValue(new Error('gateway'))

    await act(async () => {
      root?.render(<AiQuantPageClient serverOwnedConversations />)
    })

    await waitForCondition(() => expect(recoverAiQuantEditConversation).toHaveBeenCalled())
    expect(localStorage.getItem('ai_quant_return_intent_v1')).toContain('strategy-edit-session')
  })

  it('preserves newer strategy edit intent when recovery resolves late', async () => {
    localStorage.clear()
    localStorage.setItem('ai_quant_return_intent_v1', JSON.stringify({
      type: 'strategy-edit-session',
      strategyInstanceId: 'strategy-old',
      publishedSnapshotId: 'snapshot-old',
      ts: Date.now(),
    }))

    const { listAiQuantConversations, recoverAiQuantEditConversation } = jest.requireMock('@/lib/api') as {
      listAiQuantConversations: jest.Mock
      recoverAiQuantEditConversation: jest.Mock
    }
    const deferred = createDeferred<Record<string, unknown>>()
    listAiQuantConversations.mockResolvedValue([])
    recoverAiQuantEditConversation.mockReturnValue(deferred.promise)

    await act(async () => {
      root?.render(<AiQuantPageClient serverOwnedConversations />)
    })
    await waitForCondition(() => expect(recoverAiQuantEditConversation).toHaveBeenCalled())

    localStorage.setItem('ai_quant_return_intent_v1', JSON.stringify({
      type: 'strategy-edit-session',
      strategyInstanceId: 'strategy-new',
      publishedSnapshotId: 'snapshot-new',
      ts: Date.now() + 1,
    }))

    await act(async () => {
      deferred.resolve({
        id: 'conversation-old',
        activeCodegenSessionId: 'session-old',
        conversationTitle: 'recovered old',
        conversationMessages: [{ role: 'assistant', content: 'old recovered message' }],
        strategyInstanceId: 'strategy-old',
        publishedSnapshotId: 'snapshot-old',
      })
      await Promise.resolve()
    })

    await waitForCondition(() => expect(container.textContent).toContain('old recovered message'))
    expect(localStorage.getItem('ai_quant_return_intent_v1')).toContain('strategy-new')
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
        status: 'CONFIRM_GATE',
        updatedAt: '2026-04-10T12:00:00.000Z',
        conversationTitle: 'server-conv-1',
        conversationMessages: [{ role: 'assistant', content: 'server-message-1' }],
      },
      {
        id: 'conv-2',
        status: 'CONFIRM_GATE',
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

  it('blocks deleting a server-owned conversation while its linked strategy is running', async () => {
    localStorage.clear()

    const { listAiQuantConversations, deleteAiQuantConversation, fetchAccountAiQuantStrategyDetail } = jest.requireMock('@/lib/api') as {
      listAiQuantConversations: jest.Mock
      deleteAiQuantConversation: jest.Mock
      fetchAccountAiQuantStrategyDetail: jest.Mock
    }

    listAiQuantConversations.mockResolvedValue([{
      id: 'conv-running',
      status: 'PUBLISHED',
      updatedAt: '2026-04-10T12:00:00.000Z',
      conversationTitle: 'running-conv',
      conversationMessages: [{ role: 'assistant', content: 'running-message' }],
      strategyInstanceId: 'strategy-running',
    }])
    fetchAccountAiQuantStrategyDetail.mockResolvedValue({
      id: 'strategy-running',
      name: 'running-strategy',
      status: 'running',
      positionOverview: { openPositionsCount: 0, totalUnrealizedPnl: 0 },
      latestOrders: [],
    })

    await act(async () => {
      root?.render(<AiQuantPageClient deployVersion="deploy-current" serverOwnedConversations />)
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      (container.querySelector('[data-testid="delete-conv-running"]') as HTMLButtonElement).click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain('当前策略正在运行')
    expect(deleteAiQuantConversation).not.toHaveBeenCalled()
  })

  it('deletes a server-owned conversation when its linked strategy record no longer exists', async () => {
    localStorage.clear()

    const { listAiQuantConversations, deleteAiQuantConversation, fetchAccountAiQuantStrategyDetail } = jest.requireMock('@/lib/api') as {
      listAiQuantConversations: jest.Mock
      deleteAiQuantConversation: jest.Mock
      fetchAccountAiQuantStrategyDetail: jest.Mock
    }

    listAiQuantConversations.mockResolvedValue([{
      id: 'conv-missing-strategy',
      status: 'PUBLISHED',
      updatedAt: '2026-04-10T12:00:00.000Z',
      conversationTitle: 'missing-strategy-conv',
      conversationMessages: [{ role: 'assistant', content: 'missing-strategy-message' }],
      strategyInstanceId: 'strategy-missing',
    }])
    fetchAccountAiQuantStrategyDetail.mockRejectedValue(Object.assign(new Error('获取 AI 量化策略详情失败'), {
      code: 'ACCOUNT_STRATEGY_NOT_FOUND',
      statusCode: 404,
      details: {
        error: {
          code: 'ACCOUNT_STRATEGY_NOT_FOUND',
        },
      },
    }))

    await act(async () => {
      root?.render(<AiQuantPageClient deployVersion="deploy-current" serverOwnedConversations />)
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      (container.querySelector('[data-testid="delete-conv-missing-strategy"]') as HTMLButtonElement).click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(deleteAiQuantConversation).toHaveBeenCalledWith('conv-missing-strategy')
    expect(container.textContent).not.toContain('missing-strategy-message')
  })

  it('can delete the linked stopped strategy before removing a server-owned conversation', async () => {
    localStorage.clear()
    jest.spyOn(window, 'confirm').mockReturnValue(true)

    const {
      deleteAccountAiQuantStrategy,
      deleteAiQuantConversation,
      fetchAccountAiQuantStrategyDetail,
      listAiQuantConversations,
    } = jest.requireMock('@/lib/api') as {
      deleteAccountAiQuantStrategy: jest.Mock
      deleteAiQuantConversation: jest.Mock
      fetchAccountAiQuantStrategyDetail: jest.Mock
      listAiQuantConversations: jest.Mock
    }

    listAiQuantConversations.mockResolvedValue([{
      id: 'conv-stopped',
      status: 'PUBLISHED',
      updatedAt: '2026-04-10T12:00:00.000Z',
      conversationTitle: 'stopped-conv',
      conversationMessages: [{ role: 'assistant', content: 'stopped-message' }],
      strategyInstanceId: 'strategy-stopped',
    }])
    fetchAccountAiQuantStrategyDetail.mockResolvedValue({
      id: 'strategy-stopped',
      name: 'stopped-strategy',
      status: 'stopped',
      positionOverview: { openPositionsCount: 0, totalUnrealizedPnl: 0 },
      latestOrders: [],
    })

    await act(async () => {
      root?.render(<AiQuantPageClient deployVersion="deploy-current" serverOwnedConversations />)
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      (container.querySelector('[data-testid="delete-conv-stopped"]') as HTMLButtonElement).click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.textContent).toContain('同时删除已停止策略记录')

    await act(async () => {
      ;(container.querySelector('input[type="checkbox"]') as HTMLInputElement).click()
      await Promise.resolve()
    })
    await act(async () => {
      ;(container.querySelector('[data-testid="confirm-delete-conversation"]') as HTMLButtonElement).click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(deleteAccountAiQuantStrategy).not.toHaveBeenCalled()
    expect(deleteAiQuantConversation).toHaveBeenCalledWith('conv-stopped', { deleteStoppedStrategy: true })
    expect(container.textContent).not.toContain('stopped-message')
  })

})
