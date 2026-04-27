/** @jest-environment jsdom */

import type { AccountAiQuantStrategyDetail } from '@/lib/api'
import type { AiQuantStrategyRecord } from './ai-quant-strategy-store'
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server.node'
import {
  AiQuantStrategyList,
  AiQuantStrategyPrimarySummary,
  buildParamSummary,
  buildPrimarySummary,
  getStrategyRuntimeActionLabel,
} from './AiQuantStrategyList'

jest.mock('lucide-react', () => ({
  Activity: () => null,
  Clock: () => null,
  MoreHorizontal: () => null,
  Play: () => null,
  PlayCircle: () => null,
  Square: () => null,
  StopCircle: () => null,
  Trash2: () => null,
}))

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children }: { children: unknown }) => children,
}))

const mockFetchAccountAiQuantStrategies = jest.fn()
const mockFetchAccountAiQuantStrategyDetail = jest.fn()
const mockPerformAccountAiQuantStrategyAction = jest.fn()
const mockDeleteAccountAiQuantStrategy = jest.fn()
let mockSession: { userId: string } | null = null
const mockT = (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key

globalThis.IS_REACT_ACT_ENVIRONMENT = true

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: mockT }),
}))

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ session: mockSession }),
}))

jest.mock('@/lib/api', () => ({
  deleteAccountAiQuantStrategy: (...args: unknown[]) => mockDeleteAccountAiQuantStrategy(...args),
  fetchAccountAiQuantStrategies: (...args: unknown[]) => mockFetchAccountAiQuantStrategies(...args),
  fetchAccountAiQuantStrategyDetail: (...args: unknown[]) => mockFetchAccountAiQuantStrategyDetail(...args),
  performAccountAiQuantStrategyAction: (...args: unknown[]) => mockPerformAccountAiQuantStrategyAction(...args),
}))

function makeListRecord(overrides: Partial<AiQuantStrategyRecord> = {}): AiQuantStrategyRecord {
  return {
    id: 'stg-list-1',
    name: 'List Strategy',
    status: 'running',
    exchange: 'binance',
    symbol: 'BTCUSDT',
    timeframe: '15m',
    positionPct: 10,
    initialCapital: 10000,
    metrics: {
      returnPct: 0,
      maxDrawdownPct: 0,
      winRatePct: 0,
      tradeCount: 0,
    },
    equitySeries: [],
    timeline: [],
    paramSchema: {
      type: 'object',
      properties: {
        leverage: { type: 'number', title: '杠杆' },
        atrPeriod: { type: 'number', title: 'ATR周期' },
      },
    },
    paramValues: {
      leverage: 3,
      atrPeriod: 14,
    },
    schemaVersion: 'v1',
    supportsDynamicParams: false,
    updatedAt: '2026-03-20T00:00:00.000Z',
    ...overrides,
  }
}

function buildStrategyDetail(overrides: Partial<AccountAiQuantStrategyDetail> = {}): AccountAiQuantStrategyDetail {
  return {
    id: 'stg-list-1',
    name: 'List Strategy',
    status: 'running',
    exchange: 'okx',
    symbol: 'DOGEUSDT',
    timeframe: '1h',
    positionPct: 10,
    isSubscribed: true,
    paramSchema: null,
    paramValues: null,
    schemaVersion: null,
    metrics: {
      returnPct: 0,
      maxDrawdownPct: 0,
      winRatePct: 0,
      tradeCount: 0,
    },
    updatedAt: '2026-03-20T00:00:00.000Z',
    totalPnl: 0,
    todayPnl: 0,
    equitySeries: [],
    snapshot: {
      exchange: 'okx',
      symbol: 'DOGEUSDT',
      timeframe: '1h',
      positionPct: 10,
      publishedSnapshotId: 'snapshot-1',
      snapshotHash: 'hash-1',
      paramSchema: null,
      paramValues: null,
      schemaVersion: null,
      strategyConfig: {
        exchange: 'okx',
        symbol: 'DOGEUSDT',
        marketType: 'spot',
        baseTimeframe: '1h',
        positionPct: 10,
      },
    },
    timeline: [],
    runtimeExecutionStates: [],
    accountOverview: {
      initialBalance: 10000,
      totalEquity: 10000,
      availableBalance: 10000,
      totalPnl: 0,
      todayPnl: 0,
      baseCurrency: 'USDT',
    },
    positionOverview: {
      openPositionsCount: 0,
      closedPositionsCount: 0,
      totalRealizedPnl: 0,
      totalUnrealizedPnl: 0,
    },
    latestOrders: [],
    openOrdersCount: 0,
    ...overrides,
  }
}

let container: HTMLDivElement
let root: Root

beforeEach(() => {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  mockSession = null
  mockFetchAccountAiQuantStrategies.mockReset()
  mockFetchAccountAiQuantStrategyDetail.mockReset()
  mockPerformAccountAiQuantStrategyAction.mockReset()
  mockDeleteAccountAiQuantStrategy.mockReset()
})

afterEach(() => {
  act(() => {
    root.unmount()
  })
  container.remove()
})

describe('AiQuantStrategyList primary summary', () => {
  it('uses dynamic summary path when schema exists and does not use fixed primary summary', () => {
    const record = makeListRecord()
    const out = buildPrimarySummary(record, key => key)

    expect(out).toEqual(['杠杆: 3', 'ATR周期: 14'])
    expect(out).not.toContain(record.exchange.toUpperCase())
    expect(out).not.toContain(record.symbol)
    expect(out).not.toContain(record.timeframe)
    expect(out).not.toContain(`aiQuant.position ${record.positionPct}%`)
  })

  it('uses fixed summary path when schema is missing', () => {
    const record = makeListRecord({
      paramSchema: null,
      paramValues: null,
    })
    const out = buildPrimarySummary(record, key => key)

    expect(out).toEqual([
      'BINANCE',
      'BTCUSDT',
      '15m',
      'aiQuant.position 10%',
    ])
  })

  it('caps dynamic summary at 3 items and filters invalid values', () => {
    const summary = buildParamSummary(
      {
        type: 'object',
        properties: {
          emptyString: { type: 'string', title: '空字符串' },
          zero: { type: 'number', title: '零值' },
          falseFlag: { type: 'boolean', title: '开关' },
          nullField: { type: 'string', title: '空值' },
          arrayField: { type: 'array', title: '数组' },
          objField: { type: 'object', title: '对象' },
          extra: { type: 'string', title: '额外' },
        },
      },
      {
        emptyString: '',
        zero: 0,
        falseFlag: false,
        nullField: null,
        arrayField: ['a', 1, true, { bad: 'x' }],
        objField: { bad: 'x' },
        extra: 'ignored-by-limit',
      },
    )

    expect(summary).toEqual([
      '零值: 0',
      '开关: false',
      '数组: a, 1, true',
    ])
  })

  it('uses localized fallback when schema exists but dynamic summary is empty', () => {
    const record = makeListRecord({
      paramValues: {},
    })
    const out = buildPrimarySummary(record, key => (key === 'aiQuant.paramSummaryEmpty' ? '暂无参数' : key))

    expect(out).toEqual(['暂无参数'])
  })

  it('uses a stop-specific label for running strategies to avoid duplicate detail actions', () => {
    const t = (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key

    expect(getStrategyRuntimeActionLabel('running', t)).toBe('停止策略')
    expect(getStrategyRuntimeActionLabel('stopped', t)).toBe('aiQuant.actions.run')
  })

  it('keeps the running strategy action as a functional stop button with confirmation', async () => {
    mockSession = { userId: 'user-1' }
    mockFetchAccountAiQuantStrategies.mockResolvedValue({
      items: [{
        id: 'stg-list-1',
        name: 'List Strategy',
        status: 'running',
        exchange: 'okx',
        symbol: 'DOGEUSDT',
        timeframe: '1h',
        positionPct: 10,
        isSubscribed: true,
        paramSchema: null,
        paramValues: null,
        schemaVersion: null,
        metrics: { returnPct: 0, maxDrawdownPct: 0, winRatePct: 0, tradeCount: 0 },
        updatedAt: '2026-03-20T00:00:00.000Z',
      }],
    })
    mockFetchAccountAiQuantStrategyDetail.mockResolvedValue(buildStrategyDetail())
    mockPerformAccountAiQuantStrategyAction.mockResolvedValue(buildStrategyDetail({ status: 'stopped' }))

    await act(async () => {
      root.render(React.createElement(AiQuantStrategyList, { lng: 'zh' }))
    })
    await act(async () => {})

    const stopButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent?.includes('停止策略'))
    expect(stopButton).toBeTruthy()

    await act(async () => {
      stopButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    expect(mockFetchAccountAiQuantStrategyDetail).toHaveBeenCalledWith('stg-list-1', 'user-1')
    expect(container.textContent).toContain('确认停止策略？')

    await act(async () => {
      container.querySelector('[data-testid="confirm-stop-strategy"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      )
    })

    expect(mockPerformAccountAiQuantStrategyAction).toHaveBeenCalledWith('stg-list-1', {
      userId: 'user-1',
      action: 'stop',
    })
  })

  it('renders static fallback summary in DOM with separators and expected order', () => {
    const record = makeListRecord({
      paramSchema: null,
      paramValues: null,
    })
    const html = renderToStaticMarkup(
      React.createElement(
        'div',
        { className: 'mt-1 flex items-center gap-2 text-xs text-[color:var(--cf-muted)]' },
        React.createElement(AiQuantStrategyPrimarySummary, { item: record, t: (key: string) => key, keyPrefix: record.id }),
      ),
    )

    expect(html).toContain('BINANCE')
    expect(html).toContain('BTCUSDT')
    expect(html).toContain('15m')
    expect(html).toContain('aiQuant.position 10%')
    expect((html.match(/<span>\/<\/span>/g) || []).length).toBe(3)

    const exchangePos = html.indexOf('BINANCE')
    const symbolPos = html.indexOf('BTCUSDT')
    const timeframePos = html.indexOf('15m')
    const positionPos = html.indexOf('aiQuant.position 10%')
    expect(exchangePos).toBeGreaterThan(-1)
    expect(symbolPos).toBeGreaterThan(exchangePos)
    expect(timeframePos).toBeGreaterThan(symbolPos)
    expect(positionPos).toBeGreaterThan(timeframePos)
  })
})
