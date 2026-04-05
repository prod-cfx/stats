/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { AiQuantPageClient } from './AiQuantPageClient'

const mockContinueLlmCodegenSession = jest.fn()
const mockFetchBacktestCapabilities = jest.fn()
const translationMap: Record<string, string> = {
  'aiQuant.messages.graphConfirmed': '逻辑图已确认，正在生成策略代码...',
  'aiQuant.messages.graphGenerated': '我已把你的自然语言转换为逻辑图。请先确认逻辑图，再开始回测。',
  'aiQuant.messages.codeGeneratedBacktest': '策略代码已生成，现在可以开始回测。',
  'aiQuant.messages.generatedCodeTitle': '生成的策略代码：',
}

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => translationMap[key] ?? key }),
}))

jest.mock('next/navigation', () => ({
  useParams: () => ({ lng: 'zh' }),
  useRouter: () => ({ push: jest.fn() }),
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
  ConversationSidebar: () => <div data-testid="sidebar" />,
}))

jest.mock('@/components/ai-quant/DeployDialog', () => ({
  DeployDialog: () => null,
}))

jest.mock('@/components/ai-quant/GuestAiQuantLanding', () => ({
  GuestAiQuantLanding: () => <div data-testid="guest" />,
}))

jest.mock('@/components/ai-quant/BacktestSummaryCard', () => ({
  BacktestSummaryCard: ({ onOptimize }: { onOptimize: () => void }) => (
    <button data-testid="return-to-chat" onClick={onOptimize}>
      optimize
    </button>
  ),
}))

jest.mock('@/components/ai-quant/QuantChatPanel', () => ({
  QuantChatPanel: ({
    messages,
    onSend,
    onRunBacktest,
    canRunBacktest,
    onParamChange,
  }: {
    messages: Array<{ id: string; role: string; content: string }>
    onSend: (input: string) => void
    onRunBacktest: () => void
    canRunBacktest?: boolean
    onParamChange?: (key: string, value: unknown) => void
  }) => {
    const [input, setInput] = React.useState('')

    return (
      <div>
        <div data-testid="messages">{messages.map(message => message.content).join('\n')}</div>
        <input
          data-testid="chat-input"
          value={input}
          onChange={event => setInput(event.target.value)}
        />
        <button data-testid="send-chat" onClick={() => onSend(input)}>
          send
        </button>
        <button data-testid="run-backtest" disabled={!canRunBacktest} onClick={onRunBacktest}>
          run
        </button>
        <button data-testid="set-position-20" onClick={() => onParamChange?.('positionPct', 20)}>
          set position
        </button>
        <button data-testid="set-backtest-range-7d" onClick={() => onParamChange?.('backtestRangePreset', '7D')}>
          set range
        </button>
      </div>
    )
  },
}))

jest.mock('@/components/ai-quant/LogicGraphPreview', () => ({
  LogicGraphPreview: ({
    graph,
    onConfirm,
    onRevise,
    confirmDisabled,
  }: {
    graph: { status: string }
    onConfirm: () => void
    onRevise: () => void
    confirmDisabled?: boolean
  }) => (
    <div>
      <div data-testid="graph-status">{graph.status}</div>
      <button data-testid="confirm-graph" disabled={Boolean(confirmDisabled)} onClick={onConfirm}>
        confirm
      </button>
      <button data-testid="revise-graph" onClick={onRevise}>
        revise
      </button>
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
  localStorage.setItem(
    'ai_quant_conversations_v1',
    JSON.stringify([
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
    ]),
  )
}

function seedPublishedConversation(now = Date.now()) {
  localStorage.setItem(
    'ai_quant_conversations_v1',
    JSON.stringify([
      {
        id: 'conv-1',
        title: 'conv',
        messages: [
          { id: 'welcome', role: 'assistant', content: 'hello' },
          {
            id: 'published-code',
            role: 'assistant',
            content: 'generated\n```javascript\nreturn { ok: true }\n```',
          },
        ],
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
        backtestResult: {
          id: 'backtest-1',
          maxDrawdownPct: 25,
          totalReturnPct: -8,
          winRatePct: 32,
          tradeCount: 9,
          symbol: 'BTCUSDT',
          startAt: '2026-03-01T00:00:00.000Z',
          endAt: '2026-03-31T00:00:00.000Z',
        },
        logicGraph: {
          version: 2,
          status: 'confirmed',
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
        publishedStrategyInstanceId: 'strategy-1',
        publishedSnapshotId: 'snapshot-1',
        latestSignalMessage: null,
        backtestExecutionState: 'succeeded',
        updatedAt: now,
      },
    ]),
  )
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(innerResolve => {
    resolve = innerResolve
  })
  return { promise, resolve }
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
      publishedSnapshotId: 'snapshot-1',
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

  it('shows generating copy immediately after graph confirmation and enables backtest after codegen is published', async () => {
    const deferred = createDeferred({
      id: 'session-1',
      status: 'PUBLISHED' as const,
      strategyInstanceId: 'strategy-1',
      publishedSnapshotId: 'snapshot-1',
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
    mockContinueLlmCodegenSession.mockReturnValueOnce(deferred.promise)

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    const initialRunButton = container.querySelector(
      '[data-testid="run-backtest"]',
    ) as HTMLButtonElement | null
    expect(initialRunButton?.disabled).toBe(true)

    await act(async () => {
      container
        .querySelector('[data-testid="confirm-graph"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="messages"]')?.textContent).toContain(
      '逻辑图已确认，正在生成策略代码...',
    )
    expect(container.querySelector('[data-testid="messages"]')?.textContent).not.toContain(
      '策略代码已生成，现在可以开始回测。',
    )
    expect(container.querySelector('[data-testid="graph-status"]')?.textContent).toBe('confirmed')
    const confirmButton = container.querySelector(
      '[data-testid="confirm-graph"]',
    ) as HTMLButtonElement | null
    const runButton = container.querySelector(
      '[data-testid="run-backtest"]',
    ) as HTMLButtonElement | null
    expect(confirmButton?.disabled).toBe(true)
    expect(runButton?.disabled).toBe(true)

    await act(async () => {
      deferred.resolve({
        id: 'session-1',
        status: 'PUBLISHED',
        strategyInstanceId: 'strategy-1',
        publishedSnapshotId: 'snapshot-1',
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
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="messages"]')?.textContent).toContain(
      '策略代码已生成，现在可以开始回测。',
    )
    expect(runButton?.disabled).toBe(false)
  })

  it('enables backtest even when published response has null strategyInstanceId', async () => {
    mockContinueLlmCodegenSession.mockResolvedValueOnce({
      id: 'session-1',
      status: 'PUBLISHED',
      strategyInstanceId: null,
      publishedSnapshotId: 'snapshot-1',
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
      container
        .querySelector('[data-testid="confirm-graph"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    const runButton = container.querySelector(
      '[data-testid="run-backtest"]',
    ) as HTMLButtonElement | null
    expect(runButton?.disabled).toBe(false)
  })

  it('re-enables backtest after revise and reconfirm flow', async () => {
    localStorage.clear()
    seedPublishedConversation(Date.now())
    mockContinueLlmCodegenSession
      .mockResolvedValueOnce({
        id: 'session-1',
        status: 'CHECKLIST_GATE',
        specDesc: {
          entryRules: ['价格回踩 5 日均线买入'],
          exitRules: ['价格跌破 10 日均线卖出'],
          riskRules: { positionPct: 8, maxDrawdownPct: 15 },
          market: {
            symbols: ['BTCUSDT'],
            timeframes: ['15m'],
          },
        },
      })
      .mockResolvedValueOnce({
        id: 'session-1',
        status: 'PUBLISHED',
        strategyInstanceId: 'strategy-2',
        publishedSnapshotId: 'snapshot-2',
        scriptCode: 'return { ok: "revised" }',
        specDesc: {
          entryRules: ['价格回踩 5 日均线买入'],
          exitRules: ['价格跌破 10 日均线卖出'],
          riskRules: { positionPct: 8, maxDrawdownPct: 15 },
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

    const initialRunButton = container.querySelector(
      '[data-testid="run-backtest"]',
    ) as HTMLButtonElement | null
    expect(initialRunButton?.disabled).toBe(false)

    await act(async () => {
      container
        .querySelector('[data-testid="return-to-chat"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    await act(async () => {
      const input = container.querySelector('[data-testid="chat-input"]') as HTMLInputElement | null
      input!.value = '把止损改成 8%，并重新整理逻辑图'
      input?.dispatchEvent(new Event('input', { bubbles: true }))
      container
        .querySelector('[data-testid="send-chat"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="graph-status"]')?.textContent).toBe('draft')
    const confirmButtonAfterRevise = container.querySelector(
      '[data-testid="confirm-graph"]',
    ) as HTMLButtonElement | null
    const runButtonAfterRevise = container.querySelector(
      '[data-testid="run-backtest"]',
    ) as HTMLButtonElement | null
    expect(confirmButtonAfterRevise?.disabled).toBe(false)
    expect(runButtonAfterRevise?.disabled).toBe(true)

    await act(async () => {
      container
        .querySelector('[data-testid="confirm-graph"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="graph-status"]')?.textContent).toBe('confirmed')
    const confirmButtonAfterReconfirm = container.querySelector(
      '[data-testid="confirm-graph"]',
    ) as HTMLButtonElement | null
    const runButtonAfterReconfirm = container.querySelector(
      '[data-testid="run-backtest"]',
    ) as HTMLButtonElement | null
    expect(confirmButtonAfterReconfirm?.disabled).toBe(true)
    expect(runButtonAfterReconfirm?.disabled).toBe(false)
  })

  it('invalidates published snapshot when a strategy param changes but keeps publication for pure backtest-range changes', async () => {
    localStorage.clear()
    seedPublishedConversation(Date.now())

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    const initialRunButton = container.querySelector(
      '[data-testid="run-backtest"]',
    ) as HTMLButtonElement | null
    expect(initialRunButton?.disabled).toBe(false)

    await act(async () => {
      container
        .querySelector('[data-testid="set-backtest-range-7d"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    const runButtonAfterRangeChange = container.querySelector(
      '[data-testid="run-backtest"]',
    ) as HTMLButtonElement | null
    expect(runButtonAfterRangeChange?.disabled).toBe(false)

    await act(async () => {
      container
        .querySelector('[data-testid="set-position-20"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    const runButtonAfterStrategyChange = container.querySelector(
      '[data-testid="run-backtest"]',
    ) as HTMLButtonElement | null
    expect(container.querySelector('[data-testid="graph-status"]')?.textContent).toBe('draft')
    expect(runButtonAfterStrategyChange?.disabled).toBe(true)
  })
})
