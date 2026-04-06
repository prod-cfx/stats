/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { AiQuantPageClient } from './AiQuantPageClient'

const mockFetchBacktestCapabilities = jest.fn()
const mockCheckBacktestSymbolSupport = jest.fn()
const mockCreateBacktestJob = jest.fn()

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

jest.mock('@/components/ai-quant/LogicGraphPreview', () => ({
  LogicGraphPreview: () => null,
}))

jest.mock('@/components/ai-quant/BacktestSummaryCard', () => ({
  BacktestSummaryCard: () => null,
}))

jest.mock('@/components/ai-quant/QuantChatPanel', () => ({
  QuantChatPanel: ({
    messages,
    paramSchema,
    paramValues,
    onParamChange,
    onRunBacktest,
    canRunBacktest,
  }: {
    messages: Array<{ id: string, role: string, content: string }>
    paramSchema: Record<string, unknown> | null
    paramValues: Record<string, unknown>
    onParamChange: (key: string, value: unknown) => void
    onRunBacktest: () => void
    canRunBacktest?: boolean
  }) => {
    const properties = (paramSchema?.properties as Record<string, any> | undefined) ?? {}
    const symbolOptions = Array.isArray(properties.symbol?.enum) ? properties.symbol.enum : []
    const timeframeOptions = Array.isArray(properties.baseTimeframe?.enum) ? properties.baseTimeframe.enum : []
    return (
      <div>
        <button data-testid="run-backtest" disabled={!canRunBacktest} onClick={onRunBacktest}>run</button>
        <select
          data-testid="symbol-select"
          value={String(paramValues.symbol ?? '')}
          onChange={event => onParamChange('symbol', event.target.value)}
        >
          {symbolOptions.map((item: string) => <option key={item} value={item}>{item}</option>)}
        </select>
        <select
          data-testid="timeframe-select"
          value={String(paramValues.baseTimeframe ?? '')}
          onChange={event => onParamChange('baseTimeframe', event.target.value)}
        >
          {timeframeOptions.map((item: string) => <option key={item} value={item}>{item}</option>)}
        </select>
        <div data-testid="param-values">{JSON.stringify(paramValues)}</div>
        <div data-testid="messages">{messages.map(msg => msg.content).join('|')}</div>
      </div>
    )
  },
}))

jest.mock('@/components/ai-quant/backtest-capability-client', () => ({
  fetchBacktestCapabilities: (...args: unknown[]) => mockFetchBacktestCapabilities(...args),
}))

jest.mock('@/components/ai-quant/backtest-symbol-support-client', () => ({
  checkBacktestSymbolSupport: (...args: unknown[]) => mockCheckBacktestSymbolSupport(...args),
}))

jest.mock('@/components/ai-quant/backtest-job-client', () => ({
  createBacktestJob: (...args: unknown[]) => mockCreateBacktestJob(...args),
  getBacktestJob: jest.fn(),
  getBacktestJobResult: jest.fn(),
}))

jest.mock('@/lib/api', () => ({
  deployAccountAiQuantStrategy: jest.fn(),
  continueLlmCodegenSession: jest.fn(),
  fetchUserExchangeAccountStatuses: jest.fn(async () => []),
  getLlmCodegenSession: jest.fn(),
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
      publishedScriptGraphVersion: 1,
      backtestExecutionConfigExplicit: true,
      latestSignalMessage: null,
      backtestExecutionState: 'idle',
      updatedAt: now,
    },
  ]))
}

describe('AiQuantPageClient capability gating', () => {
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
    mockCheckBacktestSymbolSupport.mockResolvedValue({ status: 'supported' })
    mockCreateBacktestJob.mockResolvedValue({
      id: 'btjob-1',
      status: 'failed',
      createdAt: '2026-04-02T00:00:00.000Z',
      error: 'mock_failure',
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

  it('loading disables run', async () => {
    mockFetchBacktestCapabilities.mockReturnValue(new Promise(() => {}))

    await act(async () => {
      root?.render(<AiQuantPageClient />)
    })

    const runButton = container.querySelector('[data-testid="run-backtest"]') as HTMLButtonElement | null
    expect(runButton?.disabled).toBe(true)
  })

  it('failed disables run and shows capability-load-failed message', async () => {
    mockFetchBacktestCapabilities.mockRejectedValue(new Error('failed'))

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    const runButton = container.querySelector('[data-testid="run-backtest"]') as HTMLButtonElement | null
    expect(runButton?.disabled).toBe(true)
    expect(container.querySelector('[data-testid="messages"]')?.textContent).toContain('aiQuant.messages.backtestCapabilityLoadFailed')
  })

  it('ready keeps strategy symbol and allows timeframe updates even when capabilities are narrower', async () => {
    const now = Date.now()
    localStorage.setItem('ai_quant_conversations_v1', JSON.stringify([
      {
        id: 'conv-1',
        title: 'conv',
        messages: [{ id: 'welcome', role: 'assistant', content: '```typescript\nreturn { ok: true }\n```' }],
        params: {
          exchange: 'okx',
          symbol: 'ETHUSDC',
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
          symbol: 'ETHUSDC',
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
            exchange: 'okx',
            symbol: 'ETHUSDC',
            timeframe: '15m',
            positionPct: 10,
          },
        },
        llmCodegenSessionId: null,
        publishedStrategyInstanceId: 'strategy-1',
        publishedSnapshotId: 'snapshot-1',
        publishedScriptGraphVersion: 1,
        backtestExecutionConfigExplicit: true,
        latestSignalMessage: null,
        backtestExecutionState: 'idle',
        updatedAt: now,
      },
    ]))

    mockFetchBacktestCapabilities.mockResolvedValue({
      allowedSymbols: ['BTCUSDT'],
      allowedBaseTimeframes: ['15m', '1h'],
    })

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
      await Promise.resolve()
    })

    const runButton = container.querySelector('[data-testid="run-backtest"]') as HTMLButtonElement | null
    expect(runButton?.disabled).toBe(false)
    const symbolOptions = Array.from(container.querySelectorAll('[data-testid="symbol-select"] option')).map(option => option.textContent)
    expect(symbolOptions).toEqual(expect.arrayContaining(['ETHUSDC', 'BTCUSDT']))

    await act(async () => {
      const timeframeSelect = container.querySelector('[data-testid="timeframe-select"]') as HTMLSelectElement
      timeframeSelect.value = '1h'
      timeframeSelect.dispatchEvent(new Event('change', { bubbles: true }))
    })

    const paramValues = container.querySelector('[data-testid="param-values"]')?.textContent ?? ''
    expect(paramValues).toContain('"symbol":"ETHUSDC"')
    expect(paramValues).toContain('"baseTimeframe":"1h"')
  })

  it('keeps run disabled before latest code is published', async () => {
    const now = Date.now()
    localStorage.setItem('ai_quant_conversations_v1', JSON.stringify([
      {
        id: 'conv-1',
        title: 'conv',
        messages: [{ id: 'welcome', role: 'assistant', content: 'draft only' }],
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
        latestSignalMessage: null,
        backtestExecutionState: 'idle',
        updatedAt: now,
      },
    ]))

    mockFetchBacktestCapabilities.mockResolvedValue({
      allowedSymbols: ['BTCUSDT', 'ETHUSDT'],
      allowedBaseTimeframes: ['15m', '1h'],
    })

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    const runButton = container.querySelector('[data-testid="run-backtest"]') as HTMLButtonElement | null
    expect(runButton?.disabled).toBe(true)
  })

  it('invalid current timeframe auto-corrects without overwriting strategy symbol', async () => {
    const now = Date.now()
    localStorage.setItem('ai_quant_conversations_v1', JSON.stringify([
      {
        id: 'conv-1',
        title: 'conv',
        messages: [{ id: 'welcome', role: 'assistant', content: 'hello' }],
        params: {
          exchange: 'binance',
          symbol: 'ETHUSDC',
          baseTimeframe: '5m',
          buyWindowMin: 3,
          buyDropPct: 1,
          sellWindowMin: 15,
          sellRisePct: 2,
          positionPct: 10,
        },
        paramSchema: null,
        paramValues: {
          exchange: 'binance',
          symbol: 'ETHUSDC',
          baseTimeframe: '5m',
          buyWindowMin: 3,
          buyDropPct: 1,
          sellWindowMin: 15,
          sellRisePct: 2,
          positionPct: 10,
        },
        backtestResult: null,
        logicGraph: null,
        llmCodegenSessionId: null,
        latestSignalMessage: null,
        backtestExecutionState: 'idle',
        updatedAt: now,
      },
    ]))

    mockFetchBacktestCapabilities.mockResolvedValue({
      allowedSymbols: ['BTCUSDT', 'ETHUSDT'],
      allowedBaseTimeframes: ['15m', '1h'],
    })

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    const paramValues = container.querySelector('[data-testid="param-values"]')?.textContent ?? ''
    expect(paramValues).toContain('"symbol":"ETHUSDC"')
    expect(paramValues).toContain('"baseTimeframe":"15m"')
    expect(container.querySelector('[data-testid="messages"]')?.textContent).toContain('aiQuant.messages.backtestCapabilityAutoCorrected')
  })

  it('checks symbol support before creating backtest job', async () => {
    mockFetchBacktestCapabilities.mockResolvedValue({
      allowedSymbols: ['BTCUSDT'],
      allowedBaseTimeframes: ['15m', '1h'],
    })

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
    })

    await act(async () => {
      const runButton = container.querySelector('[data-testid="run-backtest"]') as HTMLButtonElement
      runButton.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockCheckBacktestSymbolSupport).toHaveBeenCalledWith({
      exchange: 'binance',
      symbol: 'BTCUSDT',
    })
    expect(mockCreateBacktestJob).toHaveBeenCalledTimes(1)
  })

  it('does not create backtest job when symbol support check returns not_supported', async () => {
    const now = Date.now()
    localStorage.setItem('ai_quant_conversations_v1', JSON.stringify([
      {
        id: 'conv-1',
        title: 'conv',
        messages: [{ id: 'welcome', role: 'assistant', content: '```typescript\nreturn { ok: true }\n```' }],
        params: {
          exchange: 'okx',
          symbol: 'ETHUSDC',
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
          symbol: 'ETHUSDC',
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
            exchange: 'okx',
            symbol: 'ETHUSDC',
            timeframe: '15m',
            positionPct: 10,
          },
        },
        llmCodegenSessionId: null,
        publishedStrategyInstanceId: 'strategy-1',
        publishedSnapshotId: 'snapshot-1',
        publishedScriptGraphVersion: 1,
        backtestExecutionConfigExplicit: true,
        latestSignalMessage: null,
        backtestExecutionState: 'idle',
        updatedAt: now,
      },
    ]))
    mockFetchBacktestCapabilities.mockResolvedValue({
      allowedSymbols: ['BTCUSDT'],
      allowedBaseTimeframes: ['15m', '1h'],
    })
    mockCheckBacktestSymbolSupport.mockResolvedValueOnce({ status: 'not_supported' })

    await act(async () => {
      root?.render(<AiQuantPageClient />)
      await Promise.resolve()
      await Promise.resolve()
    })

    await act(async () => {
      const runButton = container.querySelector('[data-testid="run-backtest"]') as HTMLButtonElement
      runButton.click()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(mockCheckBacktestSymbolSupport).toHaveBeenCalledWith({
      exchange: 'okx',
      symbol: 'ETHUSDC',
    })
    expect(mockCreateBacktestJob).not.toHaveBeenCalled()
    expect(container.querySelector('[data-testid="messages"]')?.textContent).toContain('aiQuant.messages.backtestPayloadInvalid')
  })
})
