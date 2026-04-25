/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { AiQuantPageClient } from './AiQuantPageClient'

const mockContinueLlmCodegenSession = jest.fn()
const mockFetchAccountAiQuantStrategyDetail = jest.fn()
const mockFetchBacktestCapabilities = jest.fn()
const mockGetLlmCodegenSession = jest.fn()
const mockPerformAccountAiQuantStrategyAction = jest.fn()
const mockReadPersistedConversations = jest.fn()
const mockStartLlmCodegenSession = jest.fn()
const validSemanticGraph = {
  version: 1,
  market: {
    symbol: 'BTCUSDT',
    primaryTimeframe: '15m',
  },
  nodes: [
    {
      id: 'entry-drop-1',
      phase: 'entry',
      kind: 'price_change_pct',
      params: {
        timeframe: '15m',
        left: { source: 'close', offsetBars: 0 },
        right: { source: 'close', offsetBars: 1 },
        op: 'lte',
        valuePct: -1,
      },
    },
  ],
  actions: [
    { id: 'open-long', kind: 'OPEN_LONG', sizePct: 10 },
    { id: 'close-long', kind: 'CLOSE_LONG', sizePct: 100 },
  ],
  risk: [],
} as const
const translationMap: Record<string, string> = {
  'aiQuant.messages.graphConfirmed': '逻辑图已确认，正在生成策略代码...',
  'aiQuant.messages.graphGenerated': '我已把你的自然语言转换为逻辑图。请先确认逻辑图，再开始回测。',
  'aiQuant.messages.codeGeneratedBacktest': '策略代码已生成，现在可以开始回测。',
  'aiQuant.messages.confirmGenerate': 'aiQuant.messages.confirmGenerate',
  'aiQuant.messages.generatedCodeTitle': '生成的策略代码：',
  'aiQuant.messages.staleConversationRecovered': '检测到本地会话已过期，已为你重建一个干净的对话，请重新确认并生成策略。',
}

function readStoredConversations<T>(): T[] {
  const raw = localStorage.getItem('ai_quant_conversations_v1')
  if (!raw) {
    return []
  }

  const parsed = JSON.parse(raw) as T[] | { conversations?: T[] }
  if (Array.isArray(parsed)) {
    return parsed
  }

  return Array.isArray(parsed?.conversations) ? parsed.conversations : []
}

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      translationMap[key] ?? options?.defaultValue ?? key,
  }),
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

jest.mock('./ai-quant-page-conversation', () => {
  const actual = jest.requireActual('./ai-quant-page-conversation') as typeof import('./ai-quant-page-conversation')
  return {
    ...actual,
    readPersistedConversations: (...args: Parameters<typeof actual.readPersistedConversations>) => {
      const override = mockReadPersistedConversations.getMockImplementation()
      if (override) {
        return override(...args, actual.readPersistedConversations)
      }
      return actual.readPersistedConversations(...args)
    },
  }
})

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
  BacktestSummaryCard: ({
    onOptimize,
    onDeploy,
    onViewRunningStrategy,
    deploymentState,
    deployLabel,
  }: {
    onOptimize: () => void
    onDeploy: () => void
    onViewRunningStrategy?: () => void
    deploymentState?: 'not_deployed' | 'running' | 'stopped' | 'unknown'
    deployLabel?: string
  }) => (
    <div>
      <button data-testid="return-to-chat" onClick={onOptimize}>
        optimize
      </button>
      <button
        data-testid="open-deploy"
        disabled={deploymentState === 'running' || deploymentState === 'unknown'}
        onClick={onDeploy}
      >
        {deployLabel ?? 'deploy'}
      </button>
      {onViewRunningStrategy
        ? (
            <button data-testid="view-running-strategy" onClick={onViewRunningStrategy}>
              view running
            </button>
          )
        : null}
      <div data-testid="deployment-state">{deploymentState ?? 'not_deployed'}</div>
    </div>
  ),
}))

jest.mock('@/components/ai-quant/QuantChatPanel', () => ({
  QuantChatPanel: ({
    messages,
    publicationGate,
    onSend,
    onRunBacktest,
    canRunBacktest,
    onParamChange,
  }: {
    messages: Array<{ id: string; role: string; content: string }>
    clarificationGate?: {
      blocked: boolean
      summary?: string | null
      items: Array<{ key: string; question: string; allowedAnswers?: string[]; status: string }>
    } | null
    publicationGate?: {
      passed: boolean
      blockingMismatches: Array<{ field: string; expected: string; actual: string; reason: string }>
    } | null
    onSend: (input: string) => void
    onRunBacktest: () => void
    canRunBacktest?: boolean
    onParamChange?: (key: string, value: unknown) => void
  }) => {
    const [input, setInput] = React.useState('')

    return (
      <div>
        <div data-testid="messages">{messages.map(message => message.content).join('\n')}</div>
        <div data-testid="publication-gate">
          {publicationGate?.blockingMismatches
            ?.map(item => `${item.field}:${item.expected}:${item.actual}:${item.reason}`)
            .join('\n') ?? ''}
        </div>
        <input
          data-testid="chat-input"
          value={input}
          onChange={event => setInput(event.target.value)}
        />
        <button data-testid="send-chat" onClick={() => onSend(input)}>
          send
        </button>
        <button data-testid="send-revise" onClick={() => onSend('把止损改成 8%，并重新整理逻辑图')}>
          revise
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
    publishedSnapshotId,
  }: {
    graph: { status: string }
    onConfirm: () => void
    onRevise: () => void
    confirmDisabled?: boolean
    publishedSnapshotId?: string | null
  }) => (
    <div data-testid="legacy-graph-preview">
      <div data-testid="graph-status">{graph.status}</div>
      <div data-testid="legacy-snapshot-id">{publishedSnapshotId ?? ''}</div>
      <button data-testid="confirm-graph" disabled={Boolean(confirmDisabled)} onClick={onConfirm}>
        confirm
      </button>
      <button data-testid="revise-graph" onClick={onRevise}>
        revise
      </button>
    </div>
  ),
}))

jest.mock('@/components/ai-quant/DisplayLogicGraphPreview', () => ({
  DisplayLogicGraphPreview: ({
    graph,
    onConfirm,
    onRevise,
    confirmDisabled,
    confirmed,
    publishedSnapshotId,
  }: {
    graph: { blocks: Array<{ type: string }> }
    onConfirm: () => void
    onRevise: () => void
    confirmDisabled?: boolean
    confirmed?: boolean
    publishedSnapshotId?: string | null
  }) => (
    <div data-testid="display-graph-preview">
      <div data-testid="display-graph-block-count">{graph.blocks.length}</div>
      <div data-testid="display-graph-status">{confirmed ? 'confirmed' : 'draft'}</div>
      <div data-testid="display-snapshot-id">{publishedSnapshotId ?? ''}</div>
      <button data-testid="display-confirm-graph" disabled={Boolean(confirmDisabled)} onClick={onConfirm}>
        confirm
      </button>
      <button data-testid="display-revise-graph" onClick={onRevise}>
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
  fetchAccountAiQuantStrategyDetail: (...args: unknown[]) => mockFetchAccountAiQuantStrategyDetail(...args),
  fetchUserExchangeAccountStatuses: jest.fn(async () => []),
  getLlmCodegenSession: (...args: unknown[]) => mockGetLlmCodegenSession(...args),
  performAccountAiQuantStrategyAction: (...args: unknown[]) => mockPerformAccountAiQuantStrategyAction(...args),
  startLlmCodegenSession: (...args: unknown[]) => mockStartLlmCodegenSession(...args),
  updateAiQuantConversationBacktestDraft: jest.fn(async () => undefined),
}))

function buildStrategyDetail(
  overrides: Partial<{
    id: string
    status: 'running' | 'stopped' | 'draft'
    positionCount: number
  }> = {},
) {
  return {
    id: overrides.id ?? 'strategy-1',
    name: 'AI Quant strategy',
    status: overrides.status ?? 'stopped',
    exchange: 'okx',
    symbol: 'BTCUSDT',
    timeframe: '15m',
    positionPct: 10,
    isSubscribed: true,
    paramSchema: null,
    paramValues: null,
    schemaVersion: null,
    metrics: {
      returnPct: 12,
      maxDrawdownPct: 6,
      winRatePct: 51,
      tradeCount: 22,
    },
    totalPnl: 120,
    todayPnl: 10,
    equitySeries: [],
    snapshot: {
      exchange: 'okx',
      symbol: 'BTCUSDT',
      timeframe: '15m',
      positionPct: 10,
      publishedSnapshotId: 'snapshot-1',
      snapshotHash: 'hash-1',
      paramSchema: null,
      paramValues: null,
      schemaVersion: null,
    },
    timeline: [],
    runtimeExecutionStates: [],
    accountOverview: {
      initialBalance: 10000,
      totalEquity: 10120,
      availableBalance: 10000,
      totalPnl: 120,
      todayPnl: 10,
      baseCurrency: 'USDT',
    },
    positionOverview: {
      openPositionsCount: overrides.positionCount ?? 0,
      closedPositionsCount: 0,
      totalRealizedPnl: 0,
      totalUnrealizedPnl: 0,
    },
    latestOrders: [],
    updatedAt: '2026-04-25T00:00:00.000Z',
  }
}

function seedDraftConversation(
  now = Date.now(),
  overrides?: {
    messages?: Array<{ id: string; role: 'assistant' | 'user'; content: string }>
    displayLogicGraph?: Record<string, unknown> | null
    semanticGraph?: typeof validSemanticGraph | null
    validationReport?: {
      ok: boolean
      errors: Array<{ code: string; message: string }>
    } | null
    pendingCanonicalDigest?: string | null
    clarificationGate?: Record<string, unknown> | null
    publicationGate?: Record<string, unknown> | null
  },
) {
  localStorage.setItem(
    'ai_quant_conversations_v1',
    JSON.stringify([
      {
        id: 'conv-1',
        title: 'conv',
        messages: overrides?.messages ?? [{ id: 'welcome', role: 'assistant', content: 'hello' }],
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
        displayLogicGraph: overrides?.displayLogicGraph === undefined
          ? null
          : overrides.displayLogicGraph,
        semanticGraph: overrides?.semanticGraph === undefined ? validSemanticGraph : overrides.semanticGraph,
        validationReport: overrides?.validationReport === undefined
          ? { ok: true, errors: [] }
          : overrides.validationReport,
        pendingCanonicalDigest: overrides?.pendingCanonicalDigest === undefined
          ? 'sha256:canonical-1'
          : overrides.pendingCanonicalDigest,
        clarificationGate: overrides?.clarificationGate === undefined ? null : overrides.clarificationGate,
        publicationGate: overrides?.publicationGate === undefined ? null : overrides.publicationGate,
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
        semanticGraph: validSemanticGraph,
        validationReport: { ok: true, errors: [] },
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

function seedStoredConversations(conversations: unknown[]) {
  localStorage.setItem('ai_quant_conversations_v1', JSON.stringify(conversations))
}

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(innerResolve => {
    resolve = innerResolve
  })
  return { promise, resolve }
}

function readStoredCodegenConversations() {
  const parsed = JSON.parse(localStorage.getItem('ai_quant_conversations_v1') ?? '[]') as Array<{
    id: string
    llmCodegenSessionId?: string | null
    messages: Array<{ id: string; role: string; content: string }>
    publishedSnapshotId?: string | null
  }> | { conversations?: Array<{
    id: string
    llmCodegenSessionId?: string | null
    messages: Array<{ id: string; role: string; content: string }>
    publishedSnapshotId?: string | null
  }> }
  if (Array.isArray(parsed)) {
    return parsed
  }
  return Array.isArray(parsed?.conversations) ? parsed.conversations : []
}

async function waitForAssertion(
  assertion: () => void,
  timeoutMs = 1000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs

  while (true) {
    try {
      assertion()
      return
    } catch (error) {
      if (Date.now() >= deadline) {
        throw error
      }
      await act(async () => {
        await new Promise(resolve => window.setTimeout(resolve, 10))
      })
    }
  }
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
    mockReadPersistedConversations.mockReset()

    mockFetchBacktestCapabilities.mockResolvedValue({
      allowedBaseTimeframes: ['15m'],
    })
    mockFetchAccountAiQuantStrategyDetail.mockReset()
    mockFetchAccountAiQuantStrategyDetail.mockResolvedValue(buildStrategyDetail())
    mockGetLlmCodegenSession.mockReset()
    mockPerformAccountAiQuantStrategyAction.mockReset()
    mockPerformAccountAiQuantStrategyAction.mockResolvedValue(buildStrategyDetail())
    mockStartLlmCodegenSession.mockReset()
    mockContinueLlmCodegenSession.mockResolvedValue({
      id: 'session-1',
      status: 'PUBLISHED',
      strategyInstanceId: 'strategy-1',
      publishedSnapshotId: 'snapshot-1',
      canonicalDigest: 'sha256:canonical-1',
      scriptCode: 'return { ok: true }',
      semanticGraph: validSemanticGraph,
      validationReport: { ok: true, errors: [] },
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

  it('renders the display graph preview when hydrated and still confirms the operational logicGraph', async () => {
    localStorage.clear()
    seedDraftConversation(Date.now(), {
      displayLogicGraph: {
        blocks: [
          {
            type: 'IF',
            items: [
              {
                kind: 'condition',
                id: 'condition-1',
                text: '3m 内相对前收盘下跌 1%',
              },
            ],
          },
        ],
      },
    })

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="display-graph-preview"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="legacy-graph-preview"]')).toBeNull()
    expect(container.querySelector('[data-testid="display-graph-block-count"]')?.textContent).toBe('1')
    expect(container.querySelector('[data-testid="display-graph-status"]')?.textContent).toBe('draft')

    await act(async () => {
      container
        .querySelector('[data-testid="display-confirm-graph"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="display-graph-status"]')?.textContent).toBe('confirmed')
  })

  it('does not show a stale published snapshot id for a newer confirmed graph version', async () => {
    localStorage.clear()
    seedStoredConversations([
      {
        id: 'conv-stale-snapshot',
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
        displayLogicGraph: {
          blocks: [
            {
              type: 'EXECUTE',
              items: [
                {
                  kind: 'execute',
                  id: 'execute-symbol',
                  key: 'symbol',
                  text: '标的: BTCUSDT',
                },
              ],
            },
          ],
        },
        semanticGraph: validSemanticGraph,
        validationReport: { ok: true, errors: [] },
        clarificationGate: null,
        publicationGate: null,
        pendingCanonicalDigest: 'sha256:canonical-1',
        llmCodegenSessionId: 'session-1',
        publishedStrategyInstanceId: 'strategy-stale',
        publishedSnapshotId: 'snapshot-stale',
        publishedScriptCode: 'return { stale: true }',
        publishedScriptGraphVersion: 1,
        latestSignalMessage: null,
        backtestExecutionState: 'idle',
        updatedAt: Date.now(),
      },
    ])

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    await waitForAssertion(() => {
      expect(container.querySelector('[data-testid="display-graph-status"]')?.textContent).toBe('confirmed')
      expect(container.querySelector('[data-testid="display-snapshot-id"]')?.textContent).toBe('')
    })
  })

  it('shows generating copy immediately after graph confirmation and enables backtest after codegen is published', async () => {
    mockGetLlmCodegenSession.mockRejectedValueOnce(new Error('skip preload reconcile'))

    const deferred = createDeferred({
      id: 'session-1',
      status: 'PUBLISHED' as const,
      strategyInstanceId: 'strategy-1',
      publishedSnapshotId: 'snapshot-1',
      canonicalDigest: 'sha256:canonical-1',
      scriptCode: 'return { ok: true }',
      semanticGraph: validSemanticGraph,
      validationReport: { ok: true, errors: [] },
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
        canonicalDigest: 'sha256:canonical-1',
        scriptCode: 'return { ok: true }',
        semanticGraph: validSemanticGraph,
        validationReport: { ok: true, errors: [] },
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

  it('reconciles only the active persisted conversation session on restore', async () => {
    const stored = readStoredConversations()
    localStorage.setItem(
      'ai_quant_conversations_v1',
      JSON.stringify([
        stored[0],
        {
          ...stored[0],
          id: 'conv-2',
          title: 'conv-2',
          llmCodegenSessionId: 'session-2',
          pendingCanonicalDigest: 'sha256:canonical-2',
          updatedAt: stored[0].updatedAt - 1,
        },
      ]),
    )

    mockGetLlmCodegenSession.mockResolvedValueOnce({
      id: 'session-1',
      status: 'PUBLISHED',
      strategyInstanceId: 'strategy-1',
      publishedSnapshotId: 'snapshot-1',
      canonicalDigest: 'sha256:canonical-1',
      scriptCode: 'return { ok: true }',
      semanticGraph: validSemanticGraph,
      validationReport: { ok: true, errors: [] },
      specDesc: {
        canonicalDigest: 'sha256:canonical-1',
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

    await waitForAssertion(() => {
      expect(mockGetLlmCodegenSession.mock.calls).toEqual([['session-1']])
    })
  })

  it('enables backtest even when published response has null strategyInstanceId', async () => {
    mockGetLlmCodegenSession.mockRejectedValueOnce(new Error('skip preload reconcile'))
    mockContinueLlmCodegenSession.mockResolvedValueOnce({
      id: 'session-1',
      status: 'PUBLISHED',
      strategyInstanceId: null,
      publishedSnapshotId: 'snapshot-1',
      canonicalDigest: 'sha256:canonical-1',
      scriptCode: 'return { ok: true }',
      semanticGraph: validSemanticGraph,
      validationReport: { ok: true, errors: [] },
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

  it('keeps clarification inside normal chat messages and disables confirm while marketType is unresolved', async () => {
    seedDraftConversation(Date.now(), {
      messages: [
        {
          id: 'assistant-clarification',
          role: 'assistant',
          content: '我当前理解的策略是：OKX BTCUSDT 3m。现在还缺一个会影响脚本生成一致性的条件：关键市场约束信息。请确认：该策略运行在现货还是合约市场？',
        },
      ],
      clarificationGate: {
        blocked: true,
        summary: 'OKX BTCUSDT 3m',
        items: [
          {
            key: 'market.marketType',
            field: 'marketType',
            reason: 'missing_market_type',
            question: '这条策略包含做空，请确认使用现货还是合约/永续？',
            allowedAnswers: ['spot', 'perp'],
            blocking: true,
            status: 'pending',
          },
        ],
      },
    })

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="messages"]')?.textContent).toContain(
      '该策略运行在现货还是合约市场？',
    )
    expect(
      (container.querySelector('[data-testid="confirm-graph"]') as HTMLButtonElement | null)?.disabled,
    ).toBe(true)
  })

  it('silently repairs the active stored conversation from a terminal remote session on restore', async () => {
    seedDraftConversation(Date.now(), {
      pendingCanonicalDigest: 'sha256:canonical-stale',
    })
    mockGetLlmCodegenSession.mockResolvedValueOnce({
      id: 'session-1',
      status: 'PUBLISHED',
      strategyInstanceId: 'strategy-1',
      publishedSnapshotId: 'snapshot-remote',
      canonicalDigest: 'sha256:canonical-remote',
      scriptCode: 'return { repaired: true }',
      semanticGraph: validSemanticGraph,
      validationReport: { ok: true, errors: [] },
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

    await waitForAssertion(() => {
      expect(mockGetLlmCodegenSession).toHaveBeenCalledWith('session-1')
      expect(container.querySelector('[data-testid="graph-status"]')?.textContent).toBe('confirmed')
      expect(
        (container.querySelector('[data-testid="run-backtest"]') as HTMLButtonElement | null)?.disabled,
      ).toBe(false)
    })

    expect(container.textContent).not.toContain(translationMap['aiQuant.messages.staleConversationRecovered'])
    const stored = readStoredConversations<{
      llmCodegenSessionId?: string | null
      pendingCanonicalDigest?: string | null
      publishedSnapshotId?: string | null
    }>()
    expect(stored[0]?.llmCodegenSessionId ?? null).toBeNull()
    expect(stored[0]?.pendingCanonicalDigest ?? null).toBe('sha256:canonical-remote')
    expect(stored[0]?.publishedSnapshotId ?? null).toBe('snapshot-remote')
  })

  it('preserves a locally coherent draft when reconciliation fails transiently', async () => {
    mockGetLlmCodegenSession.mockRejectedValueOnce(new Error('network down'))

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    await waitForAssertion(() => {
      expect(mockGetLlmCodegenSession).toHaveBeenCalledWith('session-1')
      expect(container.querySelector('[data-testid="graph-status"]')?.textContent).toBe('draft')
    })

    expect(container.textContent).not.toContain(translationMap['aiQuant.messages.staleConversationRecovered'])
    const stored = readStoredConversations<{ llmCodegenSessionId?: string | null }>()
    expect(stored[0]?.llmCodegenSessionId ?? null).toBe('session-1')
  })

  it('replaces an irreparable stored conversation with a clean recovery notice', async () => {
    mockGetLlmCodegenSession.mockResolvedValueOnce({
      id: 'session-1',
      status: 'PUBLISHED',
      canonicalDigest: null,
      scriptCode: null,
      publishedSnapshotId: null,
      semanticGraph: null,
      validationReport: null,
      specDesc: null,
    })

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    await waitForAssertion(() => {
      expect(container.textContent).toContain(
        translationMap['aiQuant.messages.staleConversationRecovered'],
      )
    })

    const stored = readStoredConversations<{
      llmCodegenSessionId?: string | null
      publishedSnapshotId?: string | null
      messages?: Array<{ content: string }>
    }>()
    expect(stored[0]?.llmCodegenSessionId ?? null).toBeNull()
    expect(stored[0]?.publishedSnapshotId ?? null).toBeNull()
    expect(stored[0]?.messages?.some(message =>
      message.content === translationMap['aiQuant.messages.staleConversationRecovered'])).toBe(true)
  })

  it('reconciles only the active stored conversation on restore', async () => {
    seedStoredConversations([
      {
        id: 'conv-1',
        title: 'conv-1',
        messages: [{ id: 'm-1', role: 'assistant', content: 'hello' }],
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
        semanticGraph: validSemanticGraph,
        validationReport: { ok: true, errors: [] },
        pendingCanonicalDigest: 'sha256:canonical-1',
        clarificationGate: null,
        publicationGate: null,
        llmCodegenSessionId: 'session-1',
        publishedStrategyInstanceId: null,
        latestSignalMessage: null,
        backtestExecutionState: 'idle',
        updatedAt: Date.now(),
      },
      {
        id: 'conv-2',
        title: 'conv-2',
        messages: [{ id: 'm-2', role: 'assistant', content: 'hello again' }],
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
        semanticGraph: validSemanticGraph,
        validationReport: { ok: true, errors: [] },
        pendingCanonicalDigest: 'sha256:canonical-2',
        clarificationGate: null,
        publicationGate: null,
        llmCodegenSessionId: 'session-2',
        publishedStrategyInstanceId: null,
        latestSignalMessage: null,
        backtestExecutionState: 'idle',
        updatedAt: Date.now() - 1,
      },
    ])

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    await waitForAssertion(() => {
      expect(mockGetLlmCodegenSession).toHaveBeenCalledTimes(1)
    })
    expect(mockGetLlmCodegenSession).toHaveBeenCalledWith('session-1')
    expect(mockGetLlmCodegenSession).not.toHaveBeenCalledWith('session-2')
  })

  it('clears pending canonical digest when backend returns a blocking clarification gate', async () => {
    localStorage.clear()
    seedDraftConversation(Date.now(), {
      pendingCanonicalDigest: 'sha256:canonical-1',
    })
    mockContinueLlmCodegenSession.mockResolvedValueOnce({
      id: 'session-1',
      status: 'DRAFTING',
      clarificationGate: {
        blocked: true,
        summary: 'OKX BTCUSDT 15m',
        items: [
          {
            key: 'market.marketType',
            field: 'marketType',
            reason: 'missing_market_type',
            question: '该策略运行在现货还是合约市场？',
            allowedAnswers: ['spot', 'perp'],
            blocking: true,
            status: 'pending',
          },
        ],
        pendingItems: [
          {
            key: 'market.marketType',
            field: 'marketType',
            reason: 'missing_market_type',
            question: '该策略运行在现货还是合约市场？',
            allowedAnswers: ['spot', 'perp'],
            blocking: true,
            status: 'pending',
          },
        ],
      },
      canonicalDigest: null,
      specDesc: null,
      semanticGraph: null,
      validationReport: null,
    })

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    await act(async () => {
      const input = container.querySelector('[data-testid="chat-input"]') as HTMLInputElement | null
      if (input) {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
          ?.set
          ?.call(input, 'perp')
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }
      container
        .querySelector('[data-testid="send-chat"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    await waitForAssertion(() => {
    const stored = readStoredConversations<{ pendingCanonicalDigest?: string | null }>()
      expect(stored[0]?.pendingCanonicalDigest ?? null).toBeNull()
      expect(
        (container.querySelector('[data-testid="confirm-graph"]') as HTMLButtonElement | null)?.disabled,
      ).toBe(true)
    })
  })

  it('submits clarification answers through the normal chat input when blocked', async () => {
    seedDraftConversation(Date.now(), {
      messages: [
        {
          id: 'assistant-clarification',
          role: 'assistant',
          content: '请补充连续 3 根 K 线跌破布林带下轨时的处理动作',
        },
      ],
      clarificationGate: {
        blocked: true,
        summary: 'OKX BTCUSDT 15m',
        items: [
          {
            key: 'riskRules.earlyStop.action',
            field: 'riskRules.earlyStop.action',
            reason: 'missing_early_stop_action',
            question: '请补充连续 3 根 K 线跌破布林带下轨时的处理动作',
            blocking: true,
            status: 'pending',
          },
        ],
      },
    })

    mockContinueLlmCodegenSession.mockResolvedValueOnce({
      id: 'session-1',
      status: 'CONFIRM_GATE',
      clarificationGate: null,
      canonicalDigest: 'sha256:canonical-2',
      semanticGraph: validSemanticGraph,
      validationReport: { ok: true, errors: [] },
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

    await act(async () => {
      const input = container.querySelector(
        '[data-testid="chat-input"]',
      ) as HTMLInputElement | null
      if (input) {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
          ?.set
          ?.call(input, '减半仓位')
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="send-chat"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockContinueLlmCodegenSession).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({
        message: '减半仓位',
        clarificationAnswers: {
          'riskRules.earlyStop.action': '减半仓位',
        },
      }),
    )
  })

  it('does not let short confirmation replies bypass a pending clarification gate', async () => {
    seedDraftConversation(Date.now(), {
      logicGraph: { ...validSemanticGraph, status: 'draft' },
      validationReport: { ok: false, errors: ['missing clarification'] },
      messages: [
        {
          id: 'assistant-inferred-confirmation',
          role: 'assistant',
          content: '请确认这些推断是否成立；确认后我再生成策略代码。',
        },
      ],
      clarificationGate: {
        blocked: true,
        summary: 'OKX BTCUSDT 15m',
        items: [
          {
            key: 'risk.stopLossBasis',
            field: 'risk.stopLossBasis',
            reason: 'ambiguous_condition_basis',
            question: '请确认这些推断是否成立；确认后我再生成策略代码。',
            blocking: true,
            status: 'pending',
          },
        ],
      },
    })

    mockContinueLlmCodegenSession.mockResolvedValueOnce({
      id: 'session-1',
      status: 'CONFIRM_GATE',
      clarificationGate: null,
      canonicalDigest: 'sha256:canonical-2',
      semanticGraph: validSemanticGraph,
      validationReport: { ok: true, errors: [] },
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

    await act(async () => {
      const input = container.querySelector('[data-testid="chat-input"]') as HTMLInputElement | null
      if (input) {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
          ?.set
          ?.call(input, '可以')
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }
      container
        .querySelector('[data-testid="send-chat"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockContinueLlmCodegenSession).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({
        message: '可以',
        clarificationAnswers: {
          'risk.stopLossBasis': '可以',
        },
      }),
    )
    expect(container.querySelector('[data-testid="messages"]')?.textContent).not.toContain(
      'The current strategy graph is not yet executable.',
    )
  })

  it('binds the MA50 blocked-chat answer to the backend-selected semantic clarification item', async () => {
    seedDraftConversation(Date.now(), {
      messages: [
        {
          id: 'assistant-semantic-clarification',
          role: 'assistant',
          content: '长期均线是多少？',
        },
      ],
      clarificationGate: {
        blocked: true,
        summary: 'BTCUSDT 15m',
        items: [
          {
            key: 'semantic.reference.period.entry',
            field: 'entryRules',
            reason: 'missing_entry_rules',
            question: '长期均线是多少？',
            blocking: true,
            status: 'pending',
          },
          {
            key: 'executionContext.exchange',
            field: 'exchange',
            reason: 'missing_exchange',
            question: '请确认交易所（binance / okx / hyperliquid）。',
            blocking: true,
            status: 'pending',
          },
        ],
        pendingItems: [
          {
            key: 'semantic.reference.period.entry',
            field: 'entryRules',
            reason: 'missing_entry_rules',
            question: '长期均线是多少？',
            blocking: true,
            status: 'pending',
          },
        ],
      },
    })
    mockReadPersistedConversations.mockImplementation((input, actualReadPersistedConversations) => {
      const result = actualReadPersistedConversations(input)
      return {
        ...result,
        conversations: result.conversations.map((conversation, index) => {
          if (index !== 0 || !conversation.clarificationGate) {
            return conversation
          }
          return {
            ...conversation,
            clarificationGate: {
              ...conversation.clarificationGate,
              items: [
                {
                  key: 'semantic.reference.period.entry',
                  field: 'entryRules',
                  reason: 'missing_entry_rules',
                  question: '长期均线是多少？',
                  blocking: true,
                  status: 'pending',
                },
                {
                  key: 'executionContext.exchange',
                  field: 'exchange',
                  reason: 'missing_exchange',
                  question: '请确认交易所（binance / okx / hyperliquid）。',
                  blocking: true,
                  status: 'pending',
                },
              ],
              pendingItems: [
                {
                  key: 'semantic.reference.period.entry',
                  field: 'entryRules',
                  reason: 'missing_entry_rules',
                  question: '长期均线是多少？',
                  blocking: true,
                  status: 'pending',
                },
              ],
            },
          }
        }),
      }
    })

    mockContinueLlmCodegenSession.mockResolvedValueOnce({
      id: 'session-1',
      status: 'CONFIRM_GATE',
      clarificationGate: null,
      canonicalDigest: 'sha256:canonical-ma50',
      semanticGraph: validSemanticGraph,
      validationReport: { ok: true, errors: [] },
      specDesc: {
        entryRules: ['价格突破 MA50 时买入'],
        exitRules: ['价格跌破短期均线时卖出'],
        riskRules: { positionPct: 10, maxDrawdownPct: 15 },
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

    expect(container.querySelector('[data-testid="messages"]')?.textContent).toContain('长期均线是多少？')
    expect(
      (container.querySelector('[data-testid="confirm-graph"]') as HTMLButtonElement | null)?.disabled,
    ).toBe(true)

    await act(async () => {
      const input = container.querySelector('[data-testid="chat-input"]') as HTMLInputElement | null
      if (input) {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
          ?.set
          ?.call(input, 'MA50')
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="send-chat"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockContinueLlmCodegenSession).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({
        message: 'MA50',
        clarificationAnswers: {
          'semantic.reference.period.entry': 'MA50',
        },
      }),
    )
  })

  it('clears a stale publication gate when backend explicitly returns publicationGate null', async () => {
    seedDraftConversation(Date.now(), {
      clarificationGate: {
        blocked: true,
        items: [
          {
            key: 'market.marketType',
            field: 'marketType',
            reason: 'missing_market_type',
            question: '该策略运行在现货还是合约市场？',
            allowedAnswers: ['spot', 'perp'],
            blocking: true,
            status: 'pending',
          },
        ],
      },
      publicationGate: {
        passed: false,
        blockingMismatches: [
          {
            field: 'exchange',
            expected: 'okx',
            actual: 'binance',
            reason: 'confirmed snapshot and compiled artifact exchange mismatch',
          },
        ],
      },
    })

    mockContinueLlmCodegenSession.mockResolvedValueOnce({
      id: 'session-1',
      status: 'CONFIRM_GATE',
      publicationGate: null,
      canonicalDigest: 'sha256:canonical-2',
      semanticGraph: validSemanticGraph,
      validationReport: { ok: true, errors: [] },
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

    expect(container.querySelector('[data-testid="publication-gate"]')?.textContent).toContain('binance')

    await act(async () => {
      const input = container.querySelector('[data-testid="chat-input"]') as HTMLInputElement | null
      if (input) {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
          ?.set
          ?.call(input, 'perp')
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }
      container
        .querySelector('[data-testid="send-chat"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    await waitForAssertion(() => {
      expect(container.querySelector('[data-testid="publication-gate"]')?.textContent).toBe('')
    })

    const stored = readStoredCodegenConversations()
    expect(stored[0]).toHaveProperty('publicationGate', null)
  })

  it('replaces an irreparable stale persisted conversation with a fresh conversation notice', async () => {
    localStorage.setItem(
      'ai_quant_conversations_v1',
      JSON.stringify([
        {
          id: 'conv-stale',
          title: 'stale',
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
          logicGraph: null,
          codegenSpecDesc: {
            canonicalDigest: 'sha256:canonical-2',
          },
          semanticGraph: validSemanticGraph,
          validationReport: { ok: true, errors: [] },
          clarificationGate: null,
          publicationGate: null,
          pendingCanonicalDigest: 'sha256:canonical-1',
          llmCodegenSessionId: 'session-stale',
          publishedStrategyInstanceId: 'strategy-stale',
          publishedSnapshotId: 'snapshot-stale',
          publishedScriptCode: 'return { stale: true }',
          publishedScriptGraphVersion: 99,
          latestSignalMessage: null,
          backtestExecutionState: 'idle',
          updatedAt: Date.now(),
        },
      ]),
    )

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    await waitForAssertion(() => {
      const stored = readStoredConversations()
      expect(stored).toHaveLength(1)
      expect(stored[0]?.id).not.toBe('conv-stale')
      expect(stored[0]?.llmCodegenSessionId ?? null).toBeNull()
      expect(stored[0]?.messages[0]?.content).toBe('aiQuant.messages.welcome')
      expect(stored[0]?.messages.length).toBeGreaterThan(1)
    })
  })

  it('renders publication gate mismatch details when publish gate is blocked', async () => {
    seedDraftConversation(Date.now(), {
      publicationGate: {
        passed: false,
        blockingMismatches: [
          {
            field: 'exchange',
            expected: 'okx',
            actual: 'binance',
            reason: 'confirmed snapshot and compiled artifact exchange mismatch',
          },
        ],
      },
    })

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="publication-gate"]')?.textContent).toContain('okx')
    expect(container.querySelector('[data-testid="publication-gate"]')?.textContent).toContain('binance')
  })

  it('re-enables backtest after revise and reconfirm flow', async () => {
    localStorage.clear()
    seedPublishedConversation(Date.now())
    mockContinueLlmCodegenSession
      .mockResolvedValueOnce({
        id: 'session-1',
        status: 'CONFIRM_GATE',
        canonicalDigest: 'sha256:canonical-2',
        semanticGraph: validSemanticGraph,
        validationReport: { ok: true, errors: [] },
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
        canonicalDigest: 'sha256:canonical-2',
        scriptCode: 'return { ok: "revised" }',
        semanticGraph: validSemanticGraph,
        validationReport: { ok: true, errors: [] },
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
      container
        .querySelector('[data-testid="send-revise"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    await waitForAssertion(() => {
      expect(mockContinueLlmCodegenSession).toHaveBeenCalledTimes(1)
    })

    await waitForAssertion(() => {
      expect(container.querySelector('[data-testid="graph-status"]')?.textContent).toBe('draft')
      expect(
        (container.querySelector('[data-testid="confirm-graph"]') as HTMLButtonElement | null)?.disabled,
      ).toBe(false)
    })
    const runButtonAfterRevise = container.querySelector(
      '[data-testid="run-backtest"]',
    ) as HTMLButtonElement | null
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

  it('blocks return-to-chat edits behind the running strategy guard and preserves the published snapshot', async () => {
    localStorage.clear()
    seedPublishedConversation(Date.now())
    mockFetchAccountAiQuantStrategyDetail.mockResolvedValueOnce(
      buildStrategyDetail({ status: 'running', positionCount: 1 }),
    )
    mockFetchAccountAiQuantStrategyDetail.mockResolvedValueOnce(
      buildStrategyDetail({ status: 'running', positionCount: 1 }),
    )
    mockPerformAccountAiQuantStrategyAction.mockResolvedValueOnce(
      buildStrategyDetail({ status: 'stopped' }),
    )

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="deployment-state"]')?.textContent).toBe('running')

    await act(async () => {
      container
        .querySelector('[data-testid="return-to-chat"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(container.textContent).toContain('策略正在运行，不能直接修改')
    const storedBeforeStop = readStoredCodegenConversations()
    expect(storedBeforeStop[0]?.publishedSnapshotId ?? null).toBe('snapshot-1')

    await act(async () => {
      container
        .querySelector('[data-testid="stop-running-strategy"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(container.textContent).toContain('当前策略仍有持仓或挂单')

    await act(async () => {
      container
        .querySelector('[data-testid="stop-only-strategy"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockPerformAccountAiQuantStrategyAction).toHaveBeenCalledWith('strategy-1', {
      userId: 'u-1',
      action: 'stop',
    })
    expect(container.querySelector('[data-testid="deployment-state"]')?.textContent).toBe('stopped')
    expect(container.textContent).not.toContain('策略正在运行，不能直接修改')

    await act(async () => {
      container
        .querySelector('[data-testid="return-to-chat"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    await waitForAssertion(() => {
      expect(container.querySelector('[data-testid="graph-status"]')?.textContent).toBe('draft')
    })
    const storedAfterStop = readStoredCodegenConversations()
    expect(storedAfterStop[0]?.publishedSnapshotId ?? null).toBeNull()
  })

  it('fails closed for return-to-chat edits while deployment state is still loading', async () => {
    localStorage.clear()
    seedPublishedConversation(Date.now())
    const detailDeferred = createDeferred<ReturnType<typeof buildStrategyDetail>>()
    mockFetchAccountAiQuantStrategyDetail.mockReturnValueOnce(detailDeferred.promise)

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    await act(async () => {
      container
        .querySelector('[data-testid="return-to-chat"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(container.querySelector('[data-testid="deployment-state"]')?.textContent).toBe('unknown')
    expect(container.textContent).toContain('部署状态待确认')
    expect(container.querySelector('[data-testid="graph-status"]')?.textContent).toBe('confirmed')

    const stored = readStoredCodegenConversations()
    expect(stored[0]?.publishedSnapshotId ?? null).toBe('snapshot-1')
    detailDeferred.resolve(buildStrategyDetail({ status: 'stopped' }))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })
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

  it('disables graph confirmation and shows validation errors when semantic graph is not executable', async () => {
    localStorage.clear()
    seedDraftConversation(Date.now(), {
      semanticGraph: validSemanticGraph,
      validationReport: {
        ok: false,
        errors: [
          {
            code: 'codegen.semantic_graph_unsupported_feature',
            message: 'grid range missing',
          },
        ],
      },
      pendingCanonicalDigest: null,
    })

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    const confirmButton = container.querySelector(
      '[data-testid="confirm-graph"]',
    ) as HTMLButtonElement | null
    expect(confirmButton?.disabled).toBe(true)
    expect(container.textContent).toContain('grid range missing')
  })

  it('enables graph confirmation when a canonical digest is pending even without semanticGraph payload', async () => {
    localStorage.clear()
    seedDraftConversation(Date.now(), {
      semanticGraph: null,
      validationReport: null,
      pendingCanonicalDigest: 'sha256:canonical-1',
    })

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    const confirmButton = container.querySelector(
      '[data-testid="confirm-graph"]',
    ) as HTMLButtonElement | null
    expect(confirmButton?.disabled).toBe(false)
  })

  it('posts confirmedCanonicalDigest when the user confirms the logic graph', async () => {
    localStorage.clear()
    seedDraftConversation(Date.now(), {
      semanticGraph: null,
      validationReport: null,
      pendingCanonicalDigest: 'sha256:canonical-1',
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

    expect(mockContinueLlmCodegenSession).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({
        confirmGenerate: true,
        confirmedCanonicalDigest: 'sha256:canonical-1',
      }),
    )
  })

  it('does not resend one-sided bollinger checklist fields when confirmGenerate is driven by a full dual-side specDesc', async () => {
    localStorage.clear()
    seedDraftConversation(Date.now(), {
      pendingCanonicalDigest: 'sha256:canonical-bollinger-1',
      semanticGraph: null,
      validationReport: null,
    })
    const stored = readStoredConversations<Record<string, unknown>>()
    localStorage.setItem(
      'ai_quant_conversations_v1',
      JSON.stringify([
        {
          ...stored[0],
          logicGraph: {
            version: 1,
            status: 'draft',
            trigger: [
              {
                id: 'entry-upper-only',
                operator: '价格向上突破布林带上轨',
              },
            ],
            actions: [],
            risk: [],
            meta: {
              exchange: 'okx',
              symbol: 'BTCUSDT',
              timeframe: '15m',
              positionPct: 10,
            },
          },
          codegenSpecDesc: {
            canonicalDigest: 'sha256:canonical-bollinger-1',
            rules: [
              {
                phase: 'entry',
                condition: { key: 'bollinger.upper_break' },
                actions: [{ type: 'OPEN_SHORT' }],
              },
              {
                phase: 'entry',
                condition: { key: 'bollinger.lower_break' },
                actions: [{ type: 'OPEN_LONG' }],
              },
              {
                phase: 'exit',
                condition: { key: 'bollinger.middle_revert' },
                actions: [{ type: 'CLOSE_LONG' }, { type: 'CLOSE_SHORT' }],
              },
            ],
            market: {
              symbols: ['BTCUSDT'],
              timeframes: ['15m'],
            },
            lockedParams: {
              exchange: 'okx',
              marketType: 'perp',
              positionPct: 10,
            },
          },
        },
      ]),
    )

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

    expect(mockContinueLlmCodegenSession).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({
        message: 'aiQuant.messages.confirmGenerate',
        confirmGenerate: true,
        confirmedCanonicalDigest: 'sha256:canonical-bollinger-1',
        clarificationAnswers: undefined,
      }),
    )
    const continuePayload = mockContinueLlmCodegenSession.mock.calls.at(-1)?.[1] as Record<string, unknown>
    expect(continuePayload).not.toHaveProperty('entryRules')
    expect(continuePayload).not.toHaveProperty('exitRules')
    expect(continuePayload).not.toHaveProperty('riskRules')
    expect(continuePayload).not.toHaveProperty('symbols')
    expect(continuePayload).not.toHaveProperty('timeframes')
  })

  it('does not resend default maxDrawdownPct when confirmGenerate is driven by a grid specDesc', async () => {
    localStorage.clear()
    seedDraftConversation(Date.now(), {
      pendingCanonicalDigest: 'sha256:canonical-grid-1',
      semanticGraph: null,
      validationReport: null,
    })
    const stored = readStoredConversations<Record<string, unknown>>()
    localStorage.setItem(
      'ai_quant_conversations_v1',
      JSON.stringify([
        {
          ...stored[0],
          logicGraph: {
            version: 1,
            status: 'draft',
            trigger: [
              {
                id: 'grid-entry-vague',
                operator: '网格区间交易',
              },
            ],
            actions: [],
            risk: [],
            meta: {
              exchange: 'okx',
              symbol: 'BTCUSDT',
              timeframe: '15m',
              positionPct: 10,
            },
          },
          codegenSpecDesc: {
            canonicalDigest: 'sha256:canonical-grid-1',
            rules: [
              {
                phase: 'entry',
                sideScope: 'long',
                condition: { key: 'grid.range_rebalance' },
                actions: [{ type: 'OPEN_LONG' }],
              },
              {
                phase: 'entry',
                sideScope: 'short',
                condition: { key: 'grid.range_rebalance' },
                actions: [{ type: 'OPEN_SHORT' }],
              },
              {
                phase: 'exit',
                sideScope: 'long',
                condition: { key: 'grid.range_rebalance' },
                actions: [{ type: 'CLOSE_LONG' }],
              },
              {
                phase: 'exit',
                sideScope: 'short',
                condition: { key: 'grid.range_rebalance' },
                actions: [{ type: 'CLOSE_SHORT' }],
              },
            ],
            market: {
              symbols: ['BTCUSDT'],
              timeframes: ['15m'],
            },
            lockedParams: {
              exchange: 'okx',
              marketType: 'perp',
              positionPct: 10,
              gridLower: 60000,
              gridUpper: 80000,
              gridStepPct: 0.5,
            },
          },
        },
      ]),
    )

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

    expect(mockContinueLlmCodegenSession).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({
        message: 'aiQuant.messages.confirmGenerate',
        confirmGenerate: true,
        confirmedCanonicalDigest: 'sha256:canonical-grid-1',
        clarificationAnswers: undefined,
      }),
    )
    const continuePayload = mockContinueLlmCodegenSession.mock.calls.at(-1)?.[1] as Record<string, unknown>
    expect(continuePayload).not.toHaveProperty('riskRules')
    expect(JSON.stringify(continuePayload)).not.toContain('maxDrawdownPct')
    expect(continuePayload).not.toHaveProperty('entryRules')
    expect(continuePayload).not.toHaveProperty('exitRules')
  })

  it('blocks chat-based confirmation when semantic graph validation is not ok', async () => {
    localStorage.clear()
    seedDraftConversation(Date.now(), {
      semanticGraph: validSemanticGraph,
      validationReport: {
        ok: false,
        errors: [
          {
            code: 'codegen.semantic_graph_unsupported_feature',
            message: 'grid range missing',
          },
        ],
      },
      pendingCanonicalDigest: null,
    })

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    await act(async () => {
      const input = container.querySelector('[data-testid="chat-input"]') as HTMLInputElement | null
      input!.value = '确认'
      input?.dispatchEvent(new Event('input', { bubbles: true }))
      container
        .querySelector('[data-testid="send-chat"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockContinueLlmCodegenSession).not.toHaveBeenCalled()
    expect(container.querySelector('[data-testid="graph-status"]')?.textContent).toBe('draft')
    expect(container.textContent).toContain('grid range missing')
  })
})
