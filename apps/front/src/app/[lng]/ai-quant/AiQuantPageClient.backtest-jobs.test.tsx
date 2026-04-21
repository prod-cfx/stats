/** @jest-environment jsdom */

import type { ConversationState } from './ai-quant-page-conversation'
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { runAiQuantBacktest } from './ai-quant-page-backtest'
import { AiQuantPageClient } from './AiQuantPageClient'
import { ApiError } from '@/lib/errors'

const mockPush = jest.fn()
const mockCreateBacktestJob = jest.fn()
const mockGetBacktestJob = jest.fn()
const mockGetBacktestJobResult = jest.fn()
const mockBuildBacktestPayload = jest.fn()
const mockFetchBacktestCapabilities = jest.fn()
const mockCheckBacktestSymbolSupport = jest.fn()

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (
        key === 'aiQuant.messages.backtestPayloadInvalid' &&
        typeof options?.reason === 'string'
      ) {
        return `${key}:${options.reason}`
      }
      return key
    },
  }),
}))

jest.mock('next/navigation', () => ({
  useParams: () => ({ lng: 'zh' }),
  useRouter: () => ({ push: mockPush }),
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
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
    onCreate,
    onSwitch,
    items,
  }: {
    onCreate: () => void
    onSwitch: (id: string) => void
    items: Array<{ id: string }>
  }) => (
    <div data-testid="sidebar">
      <button data-testid="sidebar-create" onClick={onCreate}>
        create
      </button>
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
    messages: Array<{ id: string; role: string; content: string }>
    onRunBacktest: () => void
    canRunBacktest?: boolean
  }) => (
    <div>
      <button data-testid="run-backtest" disabled={!canRunBacktest} onClick={onRunBacktest}>
        run
      </button>
      <div data-testid="messages">{messages.map(msg => msg.content).join('|')}</div>
    </div>
  ),
}))

jest.mock('@/components/ai-quant/BacktestSummaryCard', () => ({
  BacktestSummaryCard: ({
    result,
    canDeploy,
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
    canDeploy: boolean
  }) => (
    <div data-testid="backtest-summary">
      {`${result.id}|${result.symbol}|${result.startAt}|${result.endAt}|${result.maxDrawdownPct}|${result.totalReturnPct}|${result.winRatePct}|${result.tradeCount}|${canDeploy ? 'deployable' : 'blocked'}`}
    </div>
  ),
}))

jest.mock('@/components/ai-quant/backtest-payload-builder', () => ({
  BacktestPayloadBuilderError: class BacktestPayloadBuilderError extends Error {
    __builderError = true
    code: string

    constructor(code: string) {
      super(code)
      this.code = code
      this.name = 'BacktestPayloadBuilderError'
    }
  },
  buildBacktestPayload: (...args: unknown[]) => mockBuildBacktestPayload(...args),
  isBacktestPayloadBuilderError: (error: unknown) =>
    Boolean((error as { __builderError?: boolean })?.__builderError),
}))
jest.mock('@/components/ai-quant/backtest-capability-client', () => ({
  fetchBacktestCapabilities: (...args: unknown[]) => mockFetchBacktestCapabilities(...args),
}))
jest.mock('@/components/ai-quant/backtest-symbol-support-client', () => ({
  checkBacktestSymbolSupport: (...args: unknown[]) => mockCheckBacktestSymbolSupport(...args),
}))

jest.mock('@/components/ai-quant/backtest-job-client', () => ({
  createBacktestJob: (...args: unknown[]) => mockCreateBacktestJob(...args),
  getBacktestJob: (...args: unknown[]) => mockGetBacktestJob(...args),
  getBacktestJobResult: (...args: unknown[]) => mockGetBacktestJobResult(...args),
}))

jest.mock('@/lib/api', () => ({
  deployAccountAiQuantStrategy: jest.fn(),
  continueLlmCodegenSession: jest.fn(),
  fetchUserExchangeAccountStatuses: jest.fn(async () => []),
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
      publishedSnapshotId: 'snapshot-1',
    },
    dataRange: {
      fromTs: Date.parse('2026-03-01T00:00:00.000Z'),
      toTs: Date.parse('2026-03-24T00:00:00.000Z'),
    },
    bars: [],
  }
}

function createLocalizedBacktestTranslator(lng: 'zh' | 'en') {
  return (key: string, options?: Record<string, unknown>) => {
    if (key === 'aiQuant.messages.backtestPayloadInvalid' && typeof options?.reason === 'string') {
      return `${key}:${options.reason}`
    }

    const translations = {
      zh: {
        'aiQuant.messages.backtestSymbolUnavailable':
          '当前策略标的 {{symbol}} 暂不支持回测，请先确认该标的的历史行情能力是否已接入。',
        'aiQuant.messages.backtestMarketDataUnavailable':
          '{{symbol}} 当前缺少 {{baseTimeframe}} 历史行情数据，暂时无法回测。',
        'aiQuant.messages.backtestServiceTemporarilyUnavailable':
          '回测服务暂时不可用，请稍后重试。',
      },
      en: {
        'aiQuant.messages.backtestSymbolUnavailable':
          'Backtesting is not available for {{symbol}} yet. Please confirm that historical market data for this symbol has been enabled.',
        'aiQuant.messages.backtestMarketDataUnavailable':
          'Historical {{baseTimeframe}} market data for {{symbol}} is not available yet, so the backtest cannot run.',
        'aiQuant.messages.backtestServiceTemporarilyUnavailable':
          'The backtest service is temporarily unavailable. Please try again later.',
      },
    } as const

    const template = translations[lng][key as keyof (typeof translations)[typeof lng]]
    if (!template) {
      return key
    }

    return template.replace(/\{\{(\w+)\}\}/g, (_match, name: string) => String(options?.[name] ?? ''))
  }
}

function seedConfirmedConversation(now = Date.now()) {
  localStorage.setItem(
    'ai_quant_conversations_v1',
    JSON.stringify([
      {
        id: 'conv-1',
        title: 'conv',
        messages: [
          { id: 'welcome', role: 'assistant', content: '```typescript\nreturn { ok: true }\n```' },
        ],
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
        publishedStrategyInstanceId: null,
        publishedSnapshotId: 'snapshot-1',
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
        },
        publishedSnapshotStrategyConfig: {
          exchange: 'binance',
          symbol: 'BTCUSDT',
          marketType: 'perp',
          baseTimeframe: '15m',
          positionPct: 10,
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
        latestSignalMessage: null,
        backtestExecutionConfigExplicit: true,
        backtestExecutionState: 'idle',
        updatedAt: now,
      },
    ]),
  )
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
    seedConfirmedConversation(Date.now())
    jest.clearAllMocks()

    mockBuildBacktestPayload.mockReturnValue(defaultPayload())
    mockFetchBacktestCapabilities.mockResolvedValue({
      allowedSymbols: ['BTCUSDT'],
      allowedBaseTimeframes: ['15m'],
    })
    mockCheckBacktestSymbolSupport.mockResolvedValue({
      status: 'supported',
    })
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
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="run-backtest"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
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

  it('treats zero-trade backtests as non-deployable and avoids the success message', async () => {
    mockGetBacktestJobResult.mockResolvedValue({
      summary: {
        netProfit: 0,
        netProfitPct: 0,
        maxDrawdownPct: 0,
        winRate: 0,
        profitFactor: 0,
        totalTrades: 0,
      },
    })

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="run-backtest"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    await act(async () => {
      jest.advanceTimersByTime(1500)
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="messages"]')?.textContent).toContain(
      'aiQuant.messages.backtestNoTrades',
    )
    expect(container.querySelector('[data-testid="messages"]')?.textContent).not.toContain(
      'aiQuant.messages.backtestSuccess',
    )
  })

  it('allows deploy messaging when the backtest ends with an unclosed position but drawdown still passes', async () => {
    mockGetBacktestJobResult.mockResolvedValueOnce({
      summary: {
        netProfit: 0,
        netProfitPct: 0,
        maxDrawdownPct: 0.3199417903674797,
        winRate: 0,
        profitFactor: 0,
        totalTrades: 0,
        totalOpenTrades: 1,
        openPnl: 0.282686611713497,
      },
      openPositions: [
        {
          symbol: 'BTCUSDT:PERP',
          qty: 0.00017167096767048035,
          avgEntryPrice: 72238.52313,
          unrealizedPnl: 0.282686611713497,
        },
      ],
    })

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="run-backtest"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    await act(async () => {
      jest.advanceTimersByTime(1500)
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="messages"]')?.textContent).toContain(
      'aiQuant.messages.backtestSuccess',
    )
    expect(container.querySelector('[data-testid="messages"]')?.textContent).not.toContain(
      'aiQuant.messages.backtestOpenTrades',
    )
    expect(container.querySelector('[data-testid="backtest-summary"]')?.textContent).toContain(
      'deployable',
    )
  })

  it('surfaces drawdown failure messaging when open-only results still exceed the drawdown limit', async () => {
    mockGetBacktestJobResult.mockResolvedValueOnce({
      summary: {
        netProfit: 0,
        netProfitPct: 0,
        maxDrawdownPct: 20.5,
        winRate: 0,
        profitFactor: 0,
        totalTrades: 0,
        totalOpenTrades: 1,
        openPnl: -1.25,
      },
      openPositions: [
        {
          symbol: 'BTCUSDT:PERP',
          qty: 0.00017167096767048035,
          avgEntryPrice: 72238.52313,
          unrealizedPnl: -1.25,
        },
      ],
    })

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="run-backtest"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    await act(async () => {
      jest.advanceTimersByTime(1500)
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="messages"]')?.textContent).toContain(
      'aiQuant.messages.backtestFail',
    )
    expect(container.querySelector('[data-testid="messages"]')?.textContent).not.toContain(
      'aiQuant.messages.backtestOpenTrades',
    )
  })

  it('passes allowPartial to the backtest payload builder when submitting a job', async () => {
    const seeded = JSON.parse(localStorage.getItem('ai_quant_conversations_v1') ?? '[]')
    seeded[0].paramValues = {
      ...seeded[0].paramValues,
      backtestInitialCash: 10000,
      backtestLeverage: 1,
      backtestSlippageBps: 10,
      backtestFeeBps: 5,
      backtestPriceSource: 'close',
      backtestAllowPartial: true,
    }
    localStorage.setItem('ai_quant_conversations_v1', JSON.stringify(seeded))

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="run-backtest"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(mockBuildBacktestPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        allowPartial: true,
      }),
    )
  })

  it('passes published snapshot state timeframes to the backtest payload builder', async () => {
    const seeded = JSON.parse(localStorage.getItem('ai_quant_conversations_v1') ?? '[]')
    seeded[0].publishedSnapshotBacktestConfigDefaults = {
      ...seeded[0].publishedSnapshotBacktestConfigDefaults,
      stateTimeframes: ['15m', '1h'],
    }
    localStorage.setItem('ai_quant_conversations_v1', JSON.stringify(seeded))

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="run-backtest"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(mockBuildBacktestPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        stateTimeframes: ['15m', '1h'],
      }),
    )
  })

  it('blocks backtest when strategy params drift from published snapshot truth', async () => {
    const seeded = JSON.parse(localStorage.getItem('ai_quant_conversations_v1') ?? '[]')
    seeded[0].paramValues = {
      ...seeded[0].paramValues,
      positionPct: 22,
    }
    localStorage.setItem('ai_quant_conversations_v1', JSON.stringify(seeded))

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="run-backtest"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(mockCreateBacktestJob).not.toHaveBeenCalled()
    expect(container.querySelector('[data-testid="messages"]')?.textContent).toContain(
      '请重新发布后再回测',
    )
  })

  it('allows backtest when only the range changes on a published snapshot', async () => {
    const seeded = JSON.parse(localStorage.getItem('ai_quant_conversations_v1') ?? '[]')
    seeded[0].paramValues = {
      ...seeded[0].paramValues,
      backtestRangePreset: '7D',
    }
    localStorage.setItem('ai_quant_conversations_v1', JSON.stringify(seeded))

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="run-backtest"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(mockCreateBacktestJob).toHaveBeenCalledTimes(1)
    expect(mockBuildBacktestPayload).toHaveBeenCalled()
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
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="run-backtest"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    await act(async () => {
      jest.advanceTimersByTime(1500)
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="backtest-summary"]')).toBeNull()
    expect(container.querySelector('[data-testid="messages"]')?.textContent).toContain(
      'aiQuant.messages.backtestPayloadInvalid',
    )
    expect(mockGetBacktestJobResult).not.toHaveBeenCalled()
  })

  it('retries transient backtest job polling failure and still completes successfully', async () => {
    mockGetBacktestJob
      .mockRejectedValueOnce(
        new ApiError(
          '量化服务暂时不可用，请稍后重试 (SERVICE_TEMPORARILY_UNAVAILABLE, HTTP 503, requestId req-503)',
          'SERVICE_TEMPORARILY_UNAVAILABLE',
          503,
          { error: { code: 'SERVICE_TEMPORARILY_UNAVAILABLE', requestId: 'req-503' } },
        ),
      )
      .mockResolvedValueOnce({
        id: 'job-1',
        status: 'succeeded',
        createdAt: '2026-03-24T12:00:01.000Z',
      })
    mockGetBacktestJobResult.mockResolvedValue({
      summary: {
        netProfit: 120,
        netProfitPct: 12,
        maxDrawdownPct: 9.5,
        winRate: 0.55,
        profitFactor: 1.8,
        totalTrades: 42,
      },
    })

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="run-backtest"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    await act(async () => {
      jest.advanceTimersByTime(1500)
      await Promise.resolve()
    })

    await act(async () => {
      jest.advanceTimersByTime(1500)
      await Promise.resolve()
    })

    expect(mockGetBacktestJob).toHaveBeenCalledTimes(2)
    expect(mockGetBacktestJobResult).toHaveBeenCalled()
    expect(container.querySelector('[data-testid="backtest-summary"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="messages"]')?.textContent).not.toContain(
      'aiQuant.messages.backtestPayloadInvalid',
    )
  })

  it('refreshes cached backtest summary from the persisted job result on hydration', async () => {
    const now = Date.now()
    localStorage.clear()
    localStorage.setItem(
      'ai_quant_conversations_v1',
      JSON.stringify([
        {
          id: 'conv-1',
          title: 'conv',
          messages: [
            {
              id: 'welcome',
              role: 'assistant',
              content: '```typescript\nreturn { ok: true }\n```',
            },
          ],
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
            id: 'job-1',
            symbol: 'BTCUSDT',
            startAt: '2026-03-01T00:00:00.000Z',
            endAt: '2026-03-24T00:00:00.000Z',
            maxDrawdownPct: 20,
            totalReturnPct: 10,
            winRatePct: 50,
            tradeCount: 10,
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
          publishedStrategyInstanceId: null,
          publishedSnapshotId: 'snapshot-1',
          publishedScriptCode: 'return { ok: true }',
          publishedScriptGraphVersion: 1,
          latestSignalMessage: null,
          backtestExecutionState: 'idle',
          updatedAt: now,
        },
      ]),
    )

    mockGetBacktestJobResult.mockResolvedValueOnce({
      summary: {
        netProfit: 200,
        netProfitPct: 12.5,
        maxDrawdownPct: 9.6,
        winRate: 0.61,
        profitFactor: 1.8,
        totalTrades: 18,
      },
    })

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })
    let summary: Element | null = null
    for (let attempt = 0; attempt < 3 && !summary; attempt += 1) {
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
      summary = container.querySelector('[data-testid="backtest-summary"]')
    }

    expect(summary?.textContent).toContain('job-1')
    expect(summary?.textContent).toContain('|9.6|12.5|61|18')
    expect(mockGetBacktestJobResult).toHaveBeenCalledWith('job-1')
  })

  it('running state disables backtest button', async () => {
    let resolvePoll: ((value: unknown) => void) | null = null
    const pollPromise = new Promise(resolve => {
      resolvePoll = resolve
    })
    mockGetBacktestJob.mockReturnValue(pollPromise)

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="run-backtest"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    const runButton = container.querySelector(
      '[data-testid="run-backtest"]',
    ) as HTMLButtonElement | null
    expect(runButton?.disabled).toBe(true)

    resolvePoll?.({ id: 'job-1', status: 'succeeded', createdAt: '2026-03-24T12:00:01.000Z' })
    await act(async () => {
      await Promise.resolve()
    })
  })

  it('shows in-progress assistant feedback immediately after starting backtest', async () => {
    let resolvePoll: ((value: unknown) => void) | null = null
    const pollPromise = new Promise(resolve => {
      resolvePoll = resolve
    })
    mockGetBacktestJob.mockReturnValue(pollPromise)

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="run-backtest"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="messages"]')?.textContent).toContain(
      'aiQuant.messages.backtestRunning',
    )
    expect(container.querySelector('[data-testid="backtest-summary"]')).toBeNull()

    resolvePoll?.({ id: 'job-1', status: 'succeeded', createdAt: '2026-03-24T12:00:01.000Z' })
    await act(async () => {
      await Promise.resolve()
    })
  })

  it.each(['submitting', 'running', 'timeout'] as const)(
    'hydrates transient execution state %s to idle to avoid refresh lock',
    async state => {
      const now = Date.now()
      localStorage.setItem(
        'ai_quant_conversations_v1',
        JSON.stringify([
          {
            id: 'conv-1',
            title: 'conv',
            messages: [
              {
                id: 'welcome',
                role: 'assistant',
                content: '```typescript\nreturn { ok: true }\n```',
              },
            ],
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
            publishedStrategyInstanceId: null,
            publishedSnapshotId: 'snapshot-1',
            latestSignalMessage: null,
            backtestExecutionState: state,
            updatedAt: now,
          },
        ]),
      )

      await act(async () => {
        root?.render(<AiQuantPageClient />)
      })

      const runButton = container.querySelector(
        '[data-testid="run-backtest"]',
      ) as HTMLButtonElement | null
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
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="run-backtest"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    await act(async () => {
      jest.advanceTimersByTime(179000)
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="messages"]')?.textContent).toContain(
      'aiQuant.messages.backtestRunning',
    )

    await act(async () => {
      jest.advanceTimersByTime(1500)
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="backtest-summary"]')).toBeNull()
    expect(container.querySelector('[data-testid="messages"]')?.textContent).toContain(
      'aiQuant.messages.backtestTimeout',
    )
    expect(mockGetBacktestJobResult).not.toHaveBeenCalled()
    expect(mockGetBacktestJob.mock.calls.length).toBeLessThanOrEqual(50)
  })

  it('builder payload failure blocks execution and shows message', async () => {
    mockBuildBacktestPayload.mockImplementation(() => {
      const error = new Error('missing_published_snapshot')
      ;(error as Error & { __builderError: boolean; code: string }).__builderError = true
      ;(error as Error & { __builderError: boolean; code: string }).code =
        'missing_published_snapshot'
      throw error
    })

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="run-backtest"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(mockCreateBacktestJob).not.toHaveBeenCalled()
    expect(container.querySelector('[data-testid="backtest-summary"]')).toBeNull()
    expect(container.querySelector('[data-testid="messages"]')?.textContent).toContain(
      'aiQuant.messages.backtestMissingScriptCode',
    )
  })

  it('allows published snapshot backtest without explicit flag when snapshot-bound params are present', async () => {
    const seeded = JSON.parse(localStorage.getItem('ai_quant_conversations_v1') ?? '[]')
    seeded[0].backtestExecutionConfigExplicit = false
    seeded[0].paramValues = {
      ...seeded[0].paramValues,
      backtestInitialCash: 25000,
      backtestLeverage: 3,
      backtestSlippageBps: 12,
      backtestFeeBps: 4,
      backtestPriceSource: 'mid',
      backtestAllowPartial: false,
    }
    seeded[0].publishedSnapshotBacktestConfigDefaults = {
      initialCash: 25000,
      leverage: 3,
      slippageBps: 12,
      feeBps: 4,
      priceSource: 'mid',
      allowPartial: false,
    }
    localStorage.setItem('ai_quant_conversations_v1', JSON.stringify(seeded))

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="run-backtest"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(mockCreateBacktestJob).toHaveBeenCalledTimes(1)
    expect(mockBuildBacktestPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        initialCash: 25000,
        leverage: 3,
        execution: expect.objectContaining({
          slippageBps: 12,
          feeBps: 4,
          priceSource: 'mid',
        }),
        allowPartial: true,
      }),
    )
    expect(container.querySelector('[data-testid="messages"]')?.textContent ?? '').not.toContain(
      'missing_explicit_execution_config',
    )
  })

  it('allows spot snapshot backtests without a leverage value', async () => {
    const seeded = JSON.parse(localStorage.getItem('ai_quant_conversations_v1') ?? '[]')
    seeded[0].backtestExecutionConfigExplicit = false
    seeded[0].paramValues = {
      ...seeded[0].paramValues,
      marketType: 'spot',
      backtestInitialCash: 21000,
      backtestLeverage: undefined,
      backtestSlippageBps: 11,
      backtestFeeBps: 3,
      backtestPriceSource: 'mid',
      backtestAllowPartial: true,
    }
    seeded[0].publishedSnapshotParamValues = {
      ...seeded[0].publishedSnapshotParamValues,
      marketType: 'spot',
    }
    seeded[0].publishedSnapshotStrategyConfig = {
      ...seeded[0].publishedSnapshotStrategyConfig,
      marketType: 'spot',
    }
    seeded[0].publishedSnapshotBacktestConfigDefaults = {
      initialCash: 21000,
      leverage: null,
      slippageBps: 11,
      feeBps: 3,
      priceSource: 'mid',
      allowPartial: true,
    }
    localStorage.setItem('ai_quant_conversations_v1', JSON.stringify(seeded))

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="run-backtest"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(mockCreateBacktestJob).toHaveBeenCalledTimes(1)
    expect(mockBuildBacktestPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        marketType: 'spot',
        initialCash: 21000,
        leverage: null,
        execution: expect.objectContaining({
          slippageBps: 11,
          feeBps: 3,
          priceSource: 'mid',
        }),
      }),
    )
  })

  it('uses AI-Quant page execution params instead of snapshot defaults for published snapshot backtests', async () => {
    const seeded = JSON.parse(localStorage.getItem('ai_quant_conversations_v1') ?? '[]')
    seeded[0].backtestExecutionConfigExplicit = false
    seeded[0].paramValues = {
      ...seeded[0].paramValues,
      backtestInitialCash: 32000,
      backtestLeverage: 4,
      backtestSlippageBps: 9,
      backtestFeeBps: 6,
      backtestPriceSource: 'mid',
      backtestAllowPartial: false,
    }
    seeded[0].publishedSnapshotBacktestConfigDefaults = {
      initialCash: 10000,
      leverage: 1,
      slippageBps: 10,
      feeBps: 5,
      priceSource: 'close',
      allowPartial: true,
    }
    localStorage.setItem('ai_quant_conversations_v1', JSON.stringify(seeded))

    mockBuildBacktestPayload.mockImplementation((input: any) => {
      if (
        !Number.isFinite(input.initialCash) ||
        !Number.isFinite(input.leverage) ||
        !Number.isFinite(input.execution?.slippageBps) ||
        !Number.isFinite(input.execution?.feeBps) ||
        (input.execution?.priceSource !== 'open' &&
          input.execution?.priceSource !== 'close' &&
          input.execution?.priceSource !== 'mid')
      ) {
        const error = new Error('invalid_execution_config')
        ;(error as Error & { __builderError: boolean; code: string }).__builderError = true
        ;(error as Error & { __builderError: boolean; code: string }).code =
          'invalid_execution_config'
        throw error
      }
      return {
        ...defaultPayload(),
        initialCash: input.initialCash,
        leverage: input.leverage,
        execution: { ...input.execution },
        allowPartial: input.allowPartial,
      }
    })

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="run-backtest"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(mockCreateBacktestJob).toHaveBeenCalledTimes(1)
    expect(mockBuildBacktestPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        initialCash: 32000,
        leverage: 4,
        execution: expect.objectContaining({
          slippageBps: 9,
          feeBps: 6,
          priceSource: 'mid',
        }),
        allowPartial: true,
      }),
    )
    expect(container.querySelector('[data-testid="messages"]')?.textContent ?? '').not.toContain(
      'missing_explicit_execution_config',
    )
  })

  it('allows published snapshot backtest without snapshot defaults when AI-Quant page execution params are valid', async () => {
    const seeded = JSON.parse(localStorage.getItem('ai_quant_conversations_v1') ?? '[]')
    seeded[0].backtestExecutionConfigExplicit = false
    seeded[0].paramValues = {
      ...seeded[0].paramValues,
      backtestInitialCash: 18000,
      backtestLeverage: 2,
      backtestSlippageBps: 3,
      backtestFeeBps: 1,
      backtestPriceSource: 'open',
      backtestAllowPartial: false,
    }
    seeded[0].publishedSnapshotBacktestConfigDefaults = null
    seeded[0].publishedSnapshotCompatibilityMetadata = {
      isLegacySnapshot: false,
      missingBacktestConfigDefaults: true,
      missingDeploymentExecutionDefaults: false,
      missingDeploymentExecutionConstraints: false,
      requiresRepublishForBacktest: false,
      requiresRepublishForDeploy: false,
    }
    localStorage.setItem('ai_quant_conversations_v1', JSON.stringify(seeded))

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="run-backtest"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(mockCreateBacktestJob).toHaveBeenCalledTimes(1)
    expect(mockBuildBacktestPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        stateTimeframes: ['15m'],
        initialCash: 18000,
        leverage: 2,
        execution: expect.objectContaining({
          slippageBps: 3,
          feeBps: 1,
          priceSource: 'open',
        }),
      }),
    )
    expect(container.querySelector('[data-testid="messages"]')?.textContent ?? '').not.toContain(
      '重新发布',
    )
  })

  it('reports exact invalid execution fields even when explicit flag is false', async () => {
    const seeded = JSON.parse(localStorage.getItem('ai_quant_conversations_v1') ?? '[]')
    const activeConversation = {
      ...seeded[0],
      backtestExecutionConfigExplicit: false,
      publishedScriptGraphVersion: 1,
      publishedScriptCode: 'return { ok: true }',
      paramValues: {
        ...seeded[0].paramValues,
        backtestInitialCash: 20000,
        backtestLeverage: 2,
        backtestSlippageBps: 3,
        backtestFeeBps: '',
        backtestPriceSource: 'open',
        backtestAllowPartial: false,
      },
    } as ConversationState

    mockBuildBacktestPayload.mockImplementation((input: any) => {
      if (
        !Number.isFinite(input.initialCash) ||
        !Number.isFinite(input.leverage) ||
        !Number.isFinite(input.execution?.slippageBps) ||
        !Number.isFinite(input.execution?.feeBps) ||
        (input.execution?.priceSource !== 'open' &&
          input.execution?.priceSource !== 'close' &&
          input.execution?.priceSource !== 'mid')
      ) {
        const error = new Error('invalid_execution_config')
        ;(error as Error & { __builderError: boolean; code: string }).__builderError = true
        ;(error as Error & { __builderError: boolean; code: string }).code =
          'invalid_execution_config'
        throw error
      }
      return {
        ...defaultPayload(),
        initialCash: input.initialCash,
        leverage: input.leverage,
        execution: { ...input.execution },
        allowPartial: input.allowPartial,
      }
    })

    let currentConversation = activeConversation

    await runAiQuantBacktest({
      activeConversation,
      activeConversationIdRef: { current: activeConversation.id },
      backtestCapabilities: {
        allowedSymbols: ['BTCUSDT'],
        allowedBaseTimeframes: ['15m'],
      },
      backtestCapabilityState: 'ready',
      backtestRunMutexRef: { current: new Set<string>() },
      backtestRunTokenRef: { current: new Map<string, number>() },
      graphConfirmed: true,
      isMountedRef: { current: true },
      setConversationBacktestExecutionState: jest.fn(),
      t: (key: string, options?: Record<string, unknown>) =>
        key === 'aiQuant.messages.backtestPayloadInvalid' && typeof options?.reason === 'string'
          ? `${key}:${options.reason}`
          : key,
      updateConversationById: (_conversationId, updater) => {
        currentConversation = updater(currentConversation)
      },
    })

    expect(mockCreateBacktestJob).not.toHaveBeenCalled()
    expect(currentConversation.messages.at(-1)?.content ?? '').toContain('invalid_execution_config')
    expect(currentConversation.messages.at(-1)?.content ?? '').toContain('手续费')
    expect(currentConversation.messages.at(-1)?.content ?? '').not.toContain(
      'missing_explicit_execution_config',
    )
  })

  it('fails fast when allowPartial is present but invalid', async () => {
    const seeded = JSON.parse(localStorage.getItem('ai_quant_conversations_v1') ?? '[]')
    seeded[0].paramValues = {
      ...seeded[0].paramValues,
      backtestAllowPartial: 'maybe',
    }
    seeded[0].publishedSnapshotBacktestConfigDefaults = {
      ...seeded[0].publishedSnapshotBacktestConfigDefaults,
      allowPartial: 'maybe',
    }
    localStorage.setItem('ai_quant_conversations_v1', JSON.stringify(seeded))

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="run-backtest"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(mockCreateBacktestJob).not.toHaveBeenCalled()
    expect(container.querySelector('[data-testid="messages"]')?.textContent).toContain(
      'aiQuant.messages.backtestPayloadInvalid',
    )
    expect(container.querySelector('[data-testid="messages"]')?.textContent).toContain(
      'invalid_allow_partial',
    )
  })

  it('keeps exact default execution values when the conversation marked them as explicit', async () => {
    const seeded = JSON.parse(localStorage.getItem('ai_quant_conversations_v1') ?? '[]')
    seeded[0].backtestExecutionConfigExplicit = true
    seeded[0].paramValues = {
      ...seeded[0].paramValues,
      backtestInitialCash: 10000,
      backtestLeverage: 1,
      backtestSlippageBps: 10,
      backtestFeeBps: 5,
      backtestPriceSource: 'close',
      backtestAllowPartial: true,
    }
    seeded[0].publishedSnapshotBacktestConfigDefaults = {
      initialCash: 10000,
      leverage: 1,
      slippageBps: 10,
      feeBps: 5,
      priceSource: 'close',
      allowPartial: true,
    }
    localStorage.setItem('ai_quant_conversations_v1', JSON.stringify(seeded))

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="run-backtest"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(mockCreateBacktestJob).toHaveBeenCalledTimes(1)
    expect(mockBuildBacktestPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        initialCash: 10000,
        leverage: 1,
        execution: expect.objectContaining({
          slippageBps: 10,
          feeBps: 5,
          priceSource: 'close',
        }),
        allowPartial: true,
      }),
    )
  })

  it('fails closed for published snapshot backtest when truthful backtest baseline is missing even if old param snapshot exists', async () => {
    const seeded = JSON.parse(localStorage.getItem('ai_quant_conversations_v1') ?? '[]')
    seeded[0].publishedSnapshotBacktestConfigDefaults = null
    seeded[0].publishedSnapshotCompatibilityMetadata = {
      isLegacySnapshot: true,
      missingBacktestConfigDefaults: true,
      missingDeploymentExecutionDefaults: true,
      missingDeploymentExecutionConstraints: true,
      requiresRepublishForBacktest: true,
      requiresRepublishForDeploy: true,
    }
    seeded[0].publishedSnapshotBacktestConfigDefaults = {
      initialCash: 10000,
      leverage: 1,
      slippageBps: 10,
      feeBps: 5,
      priceSource: 'close',
      allowPartial: true,
    }
    localStorage.setItem('ai_quant_conversations_v1', JSON.stringify(seeded))

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="run-backtest"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(mockCreateBacktestJob).not.toHaveBeenCalled()
    expect(container.querySelector('[data-testid="messages"]')?.textContent).toContain('重新发布')
  })

  it('double click triggers only one create job call', async () => {
    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
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

  it('uses publishedSnapshotId as strategy id fallback instead of generating a mock id', async () => {
    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="run-backtest"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(mockBuildBacktestPayload).toHaveBeenCalledWith(
      expect.objectContaining({
        strategy: expect.objectContaining({
          id: 'snapshot-1',
          publishedSnapshotId: 'snapshot-1',
        }),
      }),
    )
  })

  it('uses the published snapshot exchange for symbol support checks', async () => {
    const seeded = JSON.parse(localStorage.getItem('ai_quant_conversations_v1') ?? '[]')
    const activeConversation = {
      ...seeded[0],
      params: {
        ...seeded[0].params,
        exchange: 'binance',
      },
      paramValues: {
        ...seeded[0].paramValues,
        exchange: 'binance',
      },
      publishedSnapshotParamValues: {
        ...seeded[0].publishedSnapshotParamValues,
        exchange: 'binance',
      },
      publishedSnapshotStrategyConfig: {
        ...seeded[0].publishedSnapshotStrategyConfig,
        exchange: 'okx',
      },
      publishedScriptGraphVersion: 1,
      publishedScriptCode: 'return { ok: true }',
    } as ConversationState

    mockCheckBacktestSymbolSupport.mockResolvedValueOnce({
      status: 'not_supported',
    })

    let currentConversation = activeConversation

    await runAiQuantBacktest({
      activeConversation,
      activeConversationIdRef: { current: activeConversation.id },
      backtestCapabilities: {
        allowedSymbols: ['BTCUSDT'],
        allowedBaseTimeframes: ['15m'],
      },
      backtestCapabilityState: 'ready',
      backtestRunMutexRef: { current: new Set<string>() },
      backtestRunTokenRef: { current: new Map<string, number>() },
      graphConfirmed: true,
      isMountedRef: { current: true },
      setConversationBacktestExecutionState: jest.fn(),
      t: (key: string) => key,
      updateConversationById: (_conversationId, updater) => {
        currentConversation = updater(currentConversation)
      },
    })

    expect(mockCheckBacktestSymbolSupport).toHaveBeenCalledWith({
      exchange: 'okx',
      marketType: 'perp',
      symbol: 'BTCUSDT',
      baseTimeframe: '15m',
    })
  })

  it('renders a user-readable zh message for BACKTEST_SYMBOL_UNAVAILABLE from symbol checks', async () => {
    const seeded = JSON.parse(localStorage.getItem('ai_quant_conversations_v1') ?? '[]')
    const activeConversation = {
      ...seeded[0],
      publishedScriptGraphVersion: 1,
      publishedScriptCode: 'return { ok: true }',
    } as ConversationState

    mockCheckBacktestSymbolSupport.mockResolvedValueOnce({
      status: 'not_supported',
      reasonCode: 'BACKTEST_SYMBOL_UNAVAILABLE',
      args: {
        symbol: 'ORDIUSDT',
      },
    })

    let currentConversation = activeConversation

    await runAiQuantBacktest({
      activeConversation,
      activeConversationIdRef: { current: activeConversation.id },
      backtestCapabilities: {
        allowedSymbols: ['BTCUSDT'],
        allowedBaseTimeframes: ['15m'],
      },
      backtestCapabilityState: 'ready',
      backtestRunMutexRef: { current: new Set<string>() },
      backtestRunTokenRef: { current: new Map<string, number>() },
      graphConfirmed: true,
      isMountedRef: { current: true },
      setConversationBacktestExecutionState: jest.fn(),
      t: createLocalizedBacktestTranslator('zh'),
      updateConversationById: (_conversationId, updater) => {
        currentConversation = updater(currentConversation)
      },
    })

    expect(currentConversation.messages.at(-1)?.content).toContain('当前策略标的 ORDIUSDT 暂不支持回测')
  })

  it('renders a user-readable en message for BACKTEST_SYMBOL_UNAVAILABLE from create-job failures', async () => {
    const seeded = JSON.parse(localStorage.getItem('ai_quant_conversations_v1') ?? '[]')
    const activeConversation = {
      ...seeded[0],
      publishedScriptGraphVersion: 1,
      publishedScriptCode: 'return { ok: true }',
    } as ConversationState

    mockCheckBacktestSymbolSupport.mockResolvedValueOnce({
      status: 'supported',
    })
    mockCreateBacktestJob.mockRejectedValueOnce(
      new ApiError('Bad Request', 'BACKTEST_SYMBOL_UNAVAILABLE', 400, {
        error: {
          code: 'BAD_REQUEST',
          stage: 'backtest',
          args: {
            reasonCode: 'BACKTEST_SYMBOL_UNAVAILABLE',
            symbol: 'ORDIUSDT',
          },
        },
      }),
    )

    let currentConversation = activeConversation

    await runAiQuantBacktest({
      activeConversation,
      activeConversationIdRef: { current: activeConversation.id },
      backtestCapabilities: {
        allowedSymbols: ['BTCUSDT'],
        allowedBaseTimeframes: ['15m'],
      },
      backtestCapabilityState: 'ready',
      backtestRunMutexRef: { current: new Set<string>() },
      backtestRunTokenRef: { current: new Map<string, number>() },
      graphConfirmed: true,
      isMountedRef: { current: true },
      setConversationBacktestExecutionState: jest.fn(),
      t: createLocalizedBacktestTranslator('en'),
      updateConversationById: (_conversationId, updater) => {
        currentConversation = updater(currentConversation)
      },
    })

    expect(currentConversation.messages.at(-1)?.content).toContain(
      'Backtesting is not available for ORDIUSDT yet',
    )
  })

  it('renders a user-readable zh message for BACKTEST_MARKET_DATA_UNAVAILABLE from symbol checks', async () => {
    const seeded = JSON.parse(localStorage.getItem('ai_quant_conversations_v1') ?? '[]')
    const activeConversation = {
      ...seeded[0],
      publishedScriptGraphVersion: 1,
      publishedScriptCode: 'return { ok: true }',
    } as ConversationState

    mockCheckBacktestSymbolSupport.mockResolvedValueOnce({
      status: 'not_supported',
      reasonCode: 'BACKTEST_MARKET_DATA_UNAVAILABLE',
      args: {
        symbol: 'ORDIUSDT',
        baseTimeframe: '1h',
      },
    })

    let currentConversation = activeConversation
    await runAiQuantBacktest({
      activeConversation,
      activeConversationIdRef: { current: activeConversation.id },
      backtestCapabilities: {
        allowedBaseTimeframes: ['15m'],
      },
      backtestCapabilityState: 'ready',
      backtestRunMutexRef: { current: new Set<string>() },
      backtestRunTokenRef: { current: new Map<string, number>() },
      graphConfirmed: true,
      isMountedRef: { current: true },
      setConversationBacktestExecutionState: jest.fn(),
      t: createLocalizedBacktestTranslator('zh'),
      updateConversationById: (_conversationId, updater) => {
        currentConversation = updater(currentConversation)
      },
    })

    expect(currentConversation.messages.at(-1)?.content).toContain('ORDIUSDT 当前缺少 1h 历史行情数据')
  })

  it('renders a user-readable en message for BACKTEST_SERVICE_TEMPORARILY_UNAVAILABLE from create-job failures', async () => {
    const seeded = JSON.parse(localStorage.getItem('ai_quant_conversations_v1') ?? '[]')
    const activeConversation = {
      ...seeded[0],
      publishedScriptGraphVersion: 1,
      publishedScriptCode: 'return { ok: true }',
    } as ConversationState

    mockCheckBacktestSymbolSupport.mockResolvedValueOnce({
      status: 'supported',
    })
    mockCreateBacktestJob.mockRejectedValueOnce(
      new ApiError('Temporary unavailable', 'BACKTEST_SERVICE_TEMPORARILY_UNAVAILABLE', 503, {
        error: {
          code: 'SERVICE_TEMPORARILY_UNAVAILABLE',
          stage: 'backtest',
          args: {
            reasonCode: 'BACKTEST_SERVICE_TEMPORARILY_UNAVAILABLE',
          },
        },
      }),
    )

    let currentConversation = activeConversation
    await runAiQuantBacktest({
      activeConversation,
      activeConversationIdRef: { current: activeConversation.id },
      backtestCapabilities: {
        allowedBaseTimeframes: ['15m'],
      },
      backtestCapabilityState: 'ready',
      backtestRunMutexRef: { current: new Set<string>() },
      backtestRunTokenRef: { current: new Map<string, number>() },
      graphConfirmed: true,
      isMountedRef: { current: true },
      setConversationBacktestExecutionState: jest.fn(),
      t: createLocalizedBacktestTranslator('en'),
      updateConversationById: (_conversationId, updater) => {
        currentConversation = updater(currentConversation)
      },
    })

    expect(currentConversation.messages.at(-1)?.content).toContain(
      'The backtest service is temporarily unavailable. Please try again later.',
    )
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
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="run-backtest"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
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
