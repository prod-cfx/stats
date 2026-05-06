/** @jest-environment jsdom */

import type { Root } from 'react-dom/client'
import type { AiQuantStrategyRecord } from './ai-quant-strategy-store'
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
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
  default: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    React.createElement('a', { href, className }, children)
  ),
}))

const mockFetchAccountAiQuantStrategies = jest.fn()
const mockFetchAccountAiQuantStrategyDetail = jest.fn()
const mockPerformAccountAiQuantStrategyAction = jest.fn()
const mockDeleteAccountAiQuantStrategy = jest.fn()
const mockListAiQuantConversations = jest.fn()
const mockRouterPush = jest.fn()
let mockSession: { userId: string } | null = null
const mockT = (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key

globalThis.IS_REACT_ACT_ENVIRONMENT = true

jest.mock('react-i18next', () => ({
  // eslint-disable-next-line react-hooks-extra/no-unnecessary-use-prefix
  useTranslation: () => ({ t: mockT }),
}))

jest.mock('next/navigation', () => ({
  // eslint-disable-next-line react-hooks-extra/no-unnecessary-use-prefix
  useRouter: () => ({ push: mockRouterPush }),
}))

jest.mock('@/hooks/use-auth', () => ({
  // eslint-disable-next-line react-hooks-extra/no-unnecessary-use-prefix
  useAuth: () => ({ session: mockSession }),
}))

jest.mock('@/lib/api', () => ({
  deleteAccountAiQuantStrategy: (...args: unknown[]) => mockDeleteAccountAiQuantStrategy(...args),
  fetchAccountAiQuantStrategies: (...args: unknown[]) => mockFetchAccountAiQuantStrategies(...args),
  fetchAccountAiQuantStrategyDetail: (...args: unknown[]) => mockFetchAccountAiQuantStrategyDetail(...args),
  performAccountAiQuantStrategyAction: (...args: unknown[]) => mockPerformAccountAiQuantStrategyAction(...args),
  listAiQuantConversations: (...args: unknown[]) => mockListAiQuantConversations(...args),
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
  mockListAiQuantConversations.mockReset()
  mockRouterPush.mockReset()
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

  async function renderStrategyListWithItems(items: unknown[]) {
    mockSession = { userId: 'user-1' }
    mockFetchAccountAiQuantStrategies.mockResolvedValue({
      items,
    })

    await act(async () => {
      root.render(React.createElement(AiQuantStrategyList, { lng: 'zh' }))
    })
    await act(async () => {})
  }

  function listItem(overrides: Record<string, unknown> = {}) {
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
      metrics: { returnPct: 0, maxDrawdownPct: 0, winRatePct: 0, tradeCount: 0 },
      updatedAt: '2026-03-20T00:00:00.000Z',
      ...overrides,
    }
  }

  it('keeps the running strategy action as a functional stop button with confirmation', async () => {
    mockPerformAccountAiQuantStrategyAction.mockResolvedValue({})

    await renderStrategyListWithItems([listItem()])

    const stopButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent?.includes('停止策略'))
    expect(stopButton).toBeTruthy()
    expect(stopButton?.closest('a')).toBeNull()

    await act(async () => {
      stopButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    expect(mockFetchAccountAiQuantStrategyDetail).not.toHaveBeenCalled()
    expect(container.textContent).toContain('当前策略仍有持仓或挂单')

    await act(async () => {
      container.querySelector('[data-testid="stop-only-strategy"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      )
    })

    expect(mockPerformAccountAiQuantStrategyAction).toHaveBeenCalledWith('stg-list-1', {
      userId: 'user-1',
      action: 'stop',
    })
  })

  it('calls liquidate_and_stop from the list stop dialog when user chooses liquidation', async () => {
    mockPerformAccountAiQuantStrategyAction.mockResolvedValue({})

    await renderStrategyListWithItems([listItem()])

    const stopButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent?.includes('停止策略'))
    await act(async () => {
      stopButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    await act(async () => {
      container.querySelector('[data-testid="liquidate-and-stop-strategy"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true, cancelable: true }),
      )
    })

    expect(mockPerformAccountAiQuantStrategyAction).toHaveBeenCalledWith('stg-list-1', {
      userId: 'user-1',
      action: 'liquidate_and_stop',
    })
  })

  it('with-conversation: confirm without checkbox deletes only the conversation', async () => {
    mockDeleteAccountAiQuantStrategy.mockResolvedValue(undefined)
    mockListAiQuantConversations.mockResolvedValue([
      { id: 'conv-1', conversationTitle: '测试会话', strategyInstanceId: 'stg-list-1' },
    ])

    await renderStrategyListWithItems([listItem({ status: 'stopped', hasActiveConversation: true })])

    const deleteButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Delete'))
    expect(deleteButton?.closest('a')).toBeNull()

    await act(async () => {
      deleteButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    await act(async () => {})

    const dialog = container.querySelector('[role="dialog"]')
    expect(dialog).toBeTruthy()
    expect(dialog?.getAttribute('aria-modal')).toBe('true')

    const primary = container.querySelector('[data-testid="ai-quant-deletion-primary"]')
    expect(primary?.textContent).toContain('仅删除会话')

    await act(async () => {
      primary?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    expect(mockDeleteAccountAiQuantStrategy).toHaveBeenCalledWith('stg-list-1', 'user-1', { deleteStoppedStrategy: false })
  })

  it('with-conversation: confirm with checkbox deletes both', async () => {
    mockDeleteAccountAiQuantStrategy.mockResolvedValue(undefined)
    mockListAiQuantConversations.mockResolvedValue([
      { id: 'conv-1', conversationTitle: '测试会话', strategyInstanceId: 'stg-list-1' },
    ])

    await renderStrategyListWithItems([listItem({ status: 'stopped', hasActiveConversation: true })])

    const deleteButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Delete'))
    await act(async () => {
      deleteButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    await act(async () => {})

    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]')
    expect(checkbox).toBeTruthy()
    // 勾选前不显示破坏性内联警告。
    expect(container.querySelector('[data-testid="ai-quant-deletion-destructive-warning"]')).toBeNull()
    await act(async () => {
      checkbox!.click()
    })
    await act(async () => {})

    // 勾选后显示内联警告，提示「此操作不可恢复」，替代旧的 window.confirm。
    const warning = container.querySelector('[data-testid="ai-quant-deletion-destructive-warning"]')
    expect(warning).toBeTruthy()
    expect(warning?.textContent).toContain('此操作不可恢复')

    const primary = container.querySelector('[data-testid="ai-quant-deletion-primary"]')
    expect(primary?.textContent).toContain('删除会话和策略')

    await act(async () => {
      primary?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    expect(mockDeleteAccountAiQuantStrategy).toHaveBeenCalledWith('stg-list-1', 'user-1', { deleteStoppedStrategy: true })
  })

  it('no-conversation default (unchecked): primary "保留为只读" sets viewOnlyAt without deleting', async () => {
    mockDeleteAccountAiQuantStrategy.mockResolvedValue(undefined)

    await renderStrategyListWithItems([listItem({ status: 'stopped', hasActiveConversation: false })])

    const deleteButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Delete'))
    await act(async () => {
      deleteButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    await act(async () => {})

    const dialog = container.querySelector('[role="dialog"]')
    expect(dialog).toBeTruthy()
    // 文案带「策略广场」来源说明。
    expect(dialog?.textContent).toContain('策略广场')

    // 默认未勾：主按钮 = 保留为只读，副按钮 = 取消，未显示破坏性警告。
    const primary = container.querySelector('[data-testid="ai-quant-deletion-primary"]')
    expect(primary?.textContent).toContain('保留为只读')
    const secondary = container.querySelector('[data-testid="ai-quant-deletion-secondary"]')
    expect(secondary?.textContent).toContain('取消')
    expect(container.querySelector('[data-testid="ai-quant-deletion-destructive-warning"]')).toBeNull()

    await act(async () => {
      primary?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    expect(mockDeleteAccountAiQuantStrategy).toHaveBeenCalledWith('stg-list-1', 'user-1', { deleteStoppedStrategy: false })
  })

  it('no-conversation checked: primary swaps to "彻底删除策略" and archives the strategy', async () => {
    mockDeleteAccountAiQuantStrategy.mockResolvedValue(undefined)

    await renderStrategyListWithItems([listItem({ status: 'stopped', hasActiveConversation: false })])

    const deleteButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Delete'))
    await act(async () => {
      deleteButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    await act(async () => {})

    // 勾选「彻底删除策略记录（不可恢复）」复选框。
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]')
    expect(checkbox).toBeTruthy()
    await act(async () => {
      checkbox!.click()
    })
    await act(async () => {})

    // 主按钮文案与样式切换；展示破坏性警告条。
    const primary = container.querySelector('[data-testid="ai-quant-deletion-primary"]')
    expect(primary?.textContent).toContain('彻底删除策略')
    const warning = container.querySelector('[data-testid="ai-quant-deletion-destructive-warning"]')
    expect(warning?.textContent).toContain('此操作不可恢复')

    await act(async () => {
      primary?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    expect(mockDeleteAccountAiQuantStrategy).toHaveBeenCalledWith('stg-list-1', 'user-1', { deleteStoppedStrategy: true })
  })

  it('running-strategy: opens running dialog and routes to strategy detail', async () => {
    await renderStrategyListWithItems([listItem({ status: 'running', hasActiveConversation: true })])

    // running 状态下列表行同时渲染「停止策略」与「Delete」按钮（viewOnly 才隐藏）；
    // 点击 Delete 应把弹框切换到 running 分支，而非进入 with-conversation 分支。
    const deleteButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Delete'))
    expect(deleteButton).toBeTruthy()

    await act(async () => {
      deleteButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    const dialog = container.querySelector('[role="dialog"]')
    expect(dialog?.textContent).toContain('当前策略正在运行')
    const primary = container.querySelector('[data-testid="ai-quant-deletion-primary"]')
    expect(primary?.textContent).toContain('前往运行策略')

    await act(async () => {
      primary?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    expect(mockRouterPush).toHaveBeenCalledWith('/zh/account/ai-quant/strategy/stg-list-1')
    expect(mockDeleteAccountAiQuantStrategy).not.toHaveBeenCalled()
  })

  it('shows real backend errors in the dialog without falling back to local delete', async () => {
    mockDeleteAccountAiQuantStrategy.mockRejectedValue(new Error('delete failed from api'))

    await renderStrategyListWithItems([listItem({ status: 'stopped', hasActiveConversation: false })])

    const deleteButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Delete'))
    await act(async () => {
      deleteButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    await act(async () => {})

    const primary = container.querySelector('[data-testid="ai-quant-deletion-primary"]')
    await act(async () => {
      primary?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('delete failed from api')
  })

  it('view-only items only render the view-detail link', async () => {
    await renderStrategyListWithItems([
      listItem({ status: 'stopped', viewOnlyAt: '2026-04-01T00:00:00.000Z' }),
    ])

    const buttons = Array.from(container.querySelectorAll('button'))
    expect(buttons.find(b => b.textContent?.includes('Delete'))).toBeUndefined()
    expect(buttons.find(b => b.textContent?.includes('Run'))).toBeUndefined()
    expect(buttons.find(b => b.textContent?.includes('停止策略'))).toBeUndefined()

    const link = Array.from(container.querySelectorAll('a'))
      .find(a => a.textContent?.includes('aiQuant.viewDetail'))
    expect(link).toBeTruthy()
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
