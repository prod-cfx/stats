/** @jest-environment jsdom */

import type { Root } from 'react-dom/client'
import type { AiQuantStrategyRecord } from './ai-quant-strategy-store'
import type { AccountAiQuantStrategyDetail } from '@/lib/api'
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { renderToStaticMarkup } from 'react-dom/server.node'
import mockZhCommon from '../../../public/locales/zh/common.json'
import {
  AiQuantStrategyList,
  AiQuantStrategyPrimarySummary,
  buildParamSummary,
  buildPrimarySummary,
  computeTabCounts,
  filterStrategiesByTab,
  getStrategyRuntimeActionLabel,
} from './AiQuantStrategyList'

jest.mock('lucide-react', () => ({
  Activity: () => null,
  ChevronRight: () => null,
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
  default: ({ children, href, className, ...props }: { children: React.ReactNode; href: string; className?: string } & Record<string, unknown>) => (
    React.createElement('a', { href, className, ...props }, children)
  ),
}))

const mockFetchAccountAiQuantStrategies = jest.fn()
const mockFetchAccountAiQuantStrategyDetail = jest.fn()
const mockPerformAccountAiQuantStrategyAction = jest.fn()
const mockDeleteAccountAiQuantStrategy = jest.fn()
const mockListAiQuantConversations = jest.fn()
const mockRouterPush = jest.fn()
let mockSession: { userId: string } | null = null
const mockT = (key: string, options?: { defaultValue?: string } & Record<string, unknown>) => {
  const value = key.split('.').reduce<unknown>((curr, segment) => (
    curr && typeof curr === 'object' ? (curr as Record<string, unknown>)[segment] : undefined
  ), mockZhCommon)
  const template = typeof value === 'string' ? value : (options?.defaultValue ?? key)
  return Object.entries(options ?? {}).reduce(
    (text, [name, replacement]) => name === 'defaultValue'
      ? text
      : text.replaceAll(`{{${name}}}`, String(replacement)),
    template,
  )
}

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
  it('uses a compact metadata row even when dynamic params exist', () => {
    const record = makeListRecord({
      marketType: 'perp',
      deploymentExecutionCurrent: { leverage: 3 },
    })
    const out = buildPrimarySummary(record, key => key)

    expect(out).toEqual(['BINANCE', 'BTCUSDT', 'PERP', '15m', '3x'])
    expect(out.join(' / ')).not.toContain('杠杆:')
    expect(out.join(' / ')).not.toContain('ATR周期')
  })

  it('uses exchange, symbol, timeframe and omits empty optional metadata', () => {
    const record = makeListRecord({
      marketType: 'unknown',
      paramSchema: null,
      paramValues: null,
    })
    const out = buildPrimarySummary(record, key => key)

    expect(out).toEqual([
      'BINANCE',
      'BTCUSDT',
      '15m',
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

  it('omits dynamic-param empty fallback from card metadata', () => {
    const record = makeListRecord({
      marketType: 'spot',
      paramValues: {},
    })
    const out = buildPrimarySummary(record, key => (key === 'aiQuant.paramSummaryEmpty' ? '暂无参数' : key))

    expect(out).toEqual(['BINANCE', 'BTCUSDT', 'SPOT', '15m'])
    expect(out).not.toContain('暂无参数')
  })

  it('localizes compact market type and appends leverage for derivatives', () => {
    const record = makeListRecord({
      exchange: 'okx',
      symbol: 'ETH-USDT-SWAP',
      marketType: 'perp',
      deploymentExecutionCurrent: { leverage: 2 },
    })
    const out = buildPrimarySummary(record, mockT)

    expect(out).toEqual([
      'OKX',
      'ETH-USDT-SWAP',
      '永续',
      '15m',
      '2x',
    ])
    expect(out.join(' / ')).not.toContain('市场类型')
  })

  it('uses a stop-specific label for running strategies to avoid duplicate detail actions', () => {
    const t = mockT

    expect(getStrategyRuntimeActionLabel('running', t)).toBe('停止策略')
    expect(getStrategyRuntimeActionLabel('stopped', t)).toBe('运行')
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

  function detailItem(overrides: Partial<AccountAiQuantStrategyDetail> = {}): AccountAiQuantStrategyDetail {
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
      runtimeSemanticSummary: null,
      ...overrides,
    }
  }

  it('loads latest detail and shows a simple stop confirmation when no holdings or orders exist', async () => {
    mockPerformAccountAiQuantStrategyAction.mockResolvedValue({})
    mockFetchAccountAiQuantStrategyDetail.mockResolvedValue(detailItem())

    await renderStrategyListWithItems([listItem()])

    const stopButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent?.includes('停止策略'))
    expect(stopButton).toBeTruthy()
    expect(stopButton?.closest('a')).toBeNull()

    await act(async () => {
      stopButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })

    expect(mockFetchAccountAiQuantStrategyDetail).toHaveBeenCalledWith('stg-list-1', 'user-1')
    expect(container.textContent).toContain('确认停止策略？')
    expect(container.textContent).toContain('确认停止')
    expect(container.textContent).not.toContain('当前策略仍有持仓或挂单')
    expect(container.textContent).not.toContain('平仓并停止')

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

  it('renders strategy cards with performance metrics for the console overview', async () => {
    await renderStrategyListWithItems([
      listItem({
        name: 'BTC Momentum',
        metrics: { returnPct: 21.8, maxDrawdownPct: 12.3, winRatePct: 58.4, tradeCount: 74 },
      }),
    ])

    expect(container.textContent).toContain('BTC Momentum')
    expect(container.textContent).toContain('收益')
    expect(container.textContent).toContain('+21.8%')
    expect(container.textContent).toContain('回撤')
    expect(container.textContent).toContain('12.3%')
    expect(container.textContent).toContain('胜率')
    expect(container.textContent).toContain('58.4%')
    expect(container.textContent).toContain('交易')
    expect(container.textContent).toContain('74')
  })

  it('shows average return in the console overview instead of summing return percentages', async () => {
    await renderStrategyListWithItems([
      listItem({
        id: 'stg-return-1',
        metrics: { returnPct: 10, maxDrawdownPct: 0, winRatePct: 40, tradeCount: 1 },
      }),
      listItem({
        id: 'stg-return-2',
        metrics: { returnPct: 30, maxDrawdownPct: 0, winRatePct: 60, tradeCount: 1 },
      }),
    ])

    expect(container.textContent).toContain('平均收益')
    expect(container.textContent).toContain('+20%')
    expect(container.textContent).not.toContain('+40%')
  })

  it('calls liquidate_and_stop from the list stop dialog when user chooses liquidation', async () => {
    mockPerformAccountAiQuantStrategyAction.mockResolvedValue({})
    mockFetchAccountAiQuantStrategyDetail.mockResolvedValue(detailItem({
      positionOverview: {
        openPositionsCount: 1,
        closedPositionsCount: 0,
        totalRealizedPnl: 0,
        totalUnrealizedPnl: 12,
      },
      openOrdersCount: 1,
    }))

    await renderStrategyListWithItems([listItem()])

    const stopButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent?.includes('停止策略'))
    await act(async () => {
      stopButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    })
    expect(container.textContent).toContain('当前策略仍有持仓或挂单')
    expect(container.textContent).toContain('平仓并停止')

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
      .find(button => button.textContent?.includes('删除'))
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
      .find(button => button.textContent?.includes('删除'))
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
      .find(button => button.textContent?.includes('删除'))
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
      .find(button => button.textContent?.includes('删除'))
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
      .find(button => button.textContent?.includes('删除'))
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
      .find(button => button.textContent?.includes('删除'))
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

    // 默认 tab=「全部」会排除 view-only；切到「历史记录」tab 才能看到只读项
    await act(async () => {
      ;(container.querySelector('[data-testid="strategy-filter-tab-history"]') as HTMLButtonElement).click()
    })

    const rowButtons = Array.from(container.querySelectorAll('button'))
      .filter(b => !b.getAttribute('data-testid')?.startsWith('strategy-filter-tab-'))
    expect(rowButtons.find(b => b.textContent?.includes('删除'))).toBeUndefined()
    expect(rowButtons.find(b => b.textContent?.includes('Run'))).toBeUndefined()
    expect(rowButtons.find(b => b.textContent?.includes('停止策略'))).toBeUndefined()

    const link = Array.from(container.querySelectorAll('a'))
      .find(a => a.getAttribute('aria-label') === '查看详情')
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
    expect(html).not.toContain('aiQuant.position 10%')
    expect((html.match(/<span>\/<\/span>/g) || []).length).toBe(2)

    const exchangePos = html.indexOf('BINANCE')
    const symbolPos = html.indexOf('BTCUSDT')
    const timeframePos = html.indexOf('15m')
    expect(exchangePos).toBeGreaterThan(-1)
    expect(symbolPos).toBeGreaterThan(exchangePos)
    expect(timeframePos).toBeGreaterThan(symbolPos)
  })
})

describe('filterStrategiesByTab / computeTabCounts', () => {
  const running = makeListRecord({ id: 'r', status: 'running', viewOnlyAt: null })
  const stopped = makeListRecord({ id: 's', status: 'stopped', viewOnlyAt: null })
  const draft = makeListRecord({ id: 'd', status: 'draft', viewOnlyAt: null })
  const historyStopped = makeListRecord({ id: 'h1', status: 'stopped', viewOnlyAt: '2026-04-01T00:00:00.000Z' })
  const historyRunning = makeListRecord({ id: 'h2', status: 'running', viewOnlyAt: '2026-04-02T00:00:00.000Z' })
  const all = [running, stopped, draft, historyStopped, historyRunning]

  it('all tab excludes view-only', () => {
    expect(filterStrategiesByTab(all, 'all').map(x => x.id)).toEqual(['r', 's', 'd'])
  })

  it('running tab excludes view-only running', () => {
    expect(filterStrategiesByTab(all, 'running').map(x => x.id)).toEqual(['r'])
  })

  it('stopped tab excludes view-only stopped', () => {
    expect(filterStrategiesByTab(all, 'stopped').map(x => x.id)).toEqual(['s'])
  })

  it('history tab includes any viewOnlyAt non-null', () => {
    expect(filterStrategiesByTab(all, 'history').map(x => x.id).sort()).toEqual(['h1', 'h2'])
  })

  it('computeTabCounts keeps all aligned with every non-history strategy', () => {
    expect(computeTabCounts(all)).toEqual({ all: 3, running: 1, stopped: 1, history: 2 })
  })
})

describe('AiQuantStrategyList tabs UI', () => {
  let tabsItemSeq = 0
  function tabsListItem(overrides: Partial<AiQuantStrategyRecord> = {}) {
    tabsItemSeq += 1
    return makeListRecord({
      id: `stg-tab-${tabsItemSeq}`,
      paramSchema: null,
      paramValues: null,
      viewOnlyAt: null,
      ...overrides,
    })
  }

  beforeEach(() => {
    mockSession = { userId: 'user-1' }
    tabsItemSeq = 0
  })

  it('requests strategies with limit=100 on mount', async () => {
    mockFetchAccountAiQuantStrategies.mockResolvedValue({ items: [] })
    await act(async () => {
      root.render(React.createElement(AiQuantStrategyList, { lng: 'zh' }))
    })
    await act(async () => {})
    expect(mockFetchAccountAiQuantStrategies).toHaveBeenCalledWith({ userId: 'user-1', page: 1, limit: 100 })
  })

  it('renders four tabs with counts and defaults to all', async () => {
    mockFetchAccountAiQuantStrategies.mockResolvedValue({
      items: [
        tabsListItem({ id: 'r1', status: 'running', viewOnlyAt: null }),
        tabsListItem({ id: 's1', status: 'stopped', viewOnlyAt: null }),
        tabsListItem({ id: 's2', status: 'stopped', viewOnlyAt: null }),
        tabsListItem({ id: 'h1', status: 'stopped', viewOnlyAt: '2026-04-01T00:00:00.000Z' }),
      ],
    })
    await act(async () => {
      root.render(React.createElement(AiQuantStrategyList, { lng: 'zh' }))
    })
    await act(async () => {})

    const tabs = container.querySelectorAll('[data-testid^="strategy-filter-tab-"]')
    expect(tabs.length).toBe(4)
    const counts = Array.from(tabs).map(el => el.getAttribute('data-count'))
    expect(counts).toEqual(['3', '1', '2', '1'])

    const active = container.querySelector('[data-testid^="strategy-filter-tab-"][data-active="true"]')
    expect(active?.getAttribute('data-testid')).toBe('strategy-filter-tab-all')
  })

  it('clicking history tab filters list to view-only items only', async () => {
    mockFetchAccountAiQuantStrategies.mockResolvedValue({
      items: [
        tabsListItem({ id: 'r1', status: 'running', viewOnlyAt: null, name: 'R1' }),
        tabsListItem({ id: 's1', status: 'stopped', viewOnlyAt: null, name: 'S1' }),
        tabsListItem({ id: 'h1', status: 'stopped', viewOnlyAt: '2026-04-01T00:00:00.000Z', name: 'H1' }),
      ],
    })
    await act(async () => {
      root.render(React.createElement(AiQuantStrategyList, { lng: 'zh' }))
    })
    await act(async () => {})

    await act(async () => {
      ;(container.querySelector('[data-testid="strategy-filter-tab-history"]') as HTMLButtonElement).click()
    })

    const titles = Array.from(container.querySelectorAll('.cf-ai-strategy-card p'))
      .map(n => n.textContent)
      .filter(text => text === 'H1')
    expect(titles).toEqual(['H1'])
  })

  it('shows emptyForTab hint when filtered list is empty but strategies are not', async () => {
    mockFetchAccountAiQuantStrategies.mockResolvedValue({
      items: [tabsListItem({ id: 'r1', status: 'running', viewOnlyAt: null })],
    })
    await act(async () => {
      root.render(React.createElement(AiQuantStrategyList, { lng: 'zh' }))
    })
    await act(async () => {})

    await act(async () => {
      ;(container.querySelector('[data-testid="strategy-filter-tab-history"]') as HTMLButtonElement).click()
    })

    expect(container.querySelector('[data-testid="strategy-filter-empty"]')).not.toBeNull()
    expect(container.textContent).not.toContain('aiQuant.createStrategy')
  })

  it('still shows large empty state when there are zero strategies', async () => {
    mockFetchAccountAiQuantStrategies.mockResolvedValue({ items: [] })
    await act(async () => {
      root.render(React.createElement(AiQuantStrategyList, { lng: 'zh' }))
    })
    await act(async () => {})

    expect(container.querySelector('[data-testid="strategy-filter-empty"]')).toBeNull()
    expect(container.querySelector('[data-testid^="strategy-filter-tab-"]')).toBeNull()
  })

  it('history tab hides Run/Stop/Delete even for running+viewOnly anomaly', async () => {
    mockFetchAccountAiQuantStrategies.mockResolvedValue({
      items: [
        tabsListItem({
          id: 'h-running',
          status: 'running',
          viewOnlyAt: '2026-04-02T00:00:00.000Z',
          name: 'HistoryRunning',
        }),
      ],
    })
    await act(async () => {
      root.render(React.createElement(AiQuantStrategyList, { lng: 'zh' }))
    })
    await act(async () => {})

    await act(async () => {
      ;(container.querySelector('[data-testid="strategy-filter-tab-history"]') as HTMLButtonElement).click()
    })

    const titles = Array.from(container.querySelectorAll('.cf-ai-strategy-card p'))
      .map(n => n.textContent)
      .filter(text => text === 'HistoryRunning')
    expect(titles).toEqual(['HistoryRunning'])

    const rowButtons = Array.from(container.querySelectorAll('button'))
      .filter(b => !b.getAttribute('data-testid')?.startsWith('strategy-filter-tab-'))
    expect(rowButtons.find(b => b.textContent?.includes('Run'))).toBeUndefined()
    expect(rowButtons.find(b => b.textContent?.includes('停止策略'))).toBeUndefined()
    expect(rowButtons.find(b => b.textContent?.includes('删除'))).toBeUndefined()
  })

  it('keeps strategy card actions and metric cells stable on mobile', async () => {
    mockFetchAccountAiQuantStrategies.mockResolvedValue({
      items: [
        tabsListItem({
          id: 'mobile-layout',
          name: 'Very long mobile layout strategy name',
          symbol: 'BTC-USDT-SWAP-LONG-SYMBOL',
          status: 'running',
          viewOnlyAt: null,
        }),
      ],
    })
    await act(async () => {
      root.render(React.createElement(AiQuantStrategyList, { lng: 'zh' }))
    })
    await act(async () => {})

    const actions = container.querySelector('[data-testid="ai-quant-strategy-card-actions"]')
    const metricGrid = container.querySelector('[data-testid="ai-quant-strategy-card-metrics"]')
    const title = Array.from(container.querySelectorAll('.cf-ai-strategy-card p')).find(
      node => node.textContent === 'Very long mobile layout strategy name',
    )
    const detailLinks = Array.from(container.querySelectorAll('a[aria-label="查看详情"]'))
    const mobileDetailLink = detailLinks.find(link => link.className.includes('absolute'))
    const desktopDetailLink = detailLinks.find(link => link.className.includes('sm:inline-flex'))

    expect(actions?.className).toContain('grid')
    expect(actions?.className).toContain('grid-cols-2')
    expect(actions?.className).toContain('sm:flex')
    expect(mobileDetailLink?.className).toContain('right-5')
    expect(mobileDetailLink?.className).toContain('top-4')
    expect(mobileDetailLink?.className).toContain('sm:hidden')
    expect(desktopDetailLink?.className).toContain('hidden')
    expect(desktopDetailLink?.className).toContain('sm:inline-flex')
    expect(title?.className).toContain('break-words')
    expect(metricGrid?.className).toContain('grid-cols-2')
    expect(metricGrid?.className).toContain('md:grid-cols-4')
  })
})
