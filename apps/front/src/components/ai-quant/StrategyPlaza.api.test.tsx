/** @jest-environment jsdom */

import type { StrategyPlazaTemplate } from '@/lib/api'
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { StrategyPlaza } from './StrategyPlaza'

let mockTranslations: Record<string, string> = {}

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      mockTranslations[key] ?? options?.defaultValue ?? key,
  }),
}))

jest.mock('lucide-react', () => ({
  Activity: () => <span data-testid="activity-icon" />,
  BarChart3: () => <span data-testid="bar-chart-icon" />,
  Edit3: () => <span data-testid="edit-icon" />,
  Info: () => <span data-testid="info-icon" />,
  Loader2: () => <span data-testid="loader-icon" />,
  Play: () => <span data-testid="play-icon" />,
  Shield: () => <span data-testid="shield-icon" />,
  TrendingUp: () => <span data-testid="trending-up-icon" />,
  Zap: () => <span data-testid="zap-icon" />,
}))

const template: StrategyPlazaTemplate = {
  id: 'ma-cross',
  name: 'MA Cross Demo',
  description: 'Use moving averages to follow confirmed trends.',
  logicDescription: 'Fast MA crosses slow MA.',
  tags: ['trend', 'demo'],
  riskLevel: 'medium',
  scenario: 'trend_following',
  exchange: 'okx',
  environment: 'demo',
  marketType: 'perp',
  symbol: 'BTC-USDT-SWAP',
  timeframe: '15m',
  positionPct: 0.25,
  leverage: 3,
  status: 'live',
  displayOrder: 1,
  displayMetrics: {
    label: 'official_sample_backtest',
    returnPct: 1.78,
    winRatePct: 58.14,
    maxDrawdownPct: 0.78,
    tradeCount: 43,
  },
  officialBacktest: {
    generatedAt: '2026-06-10T04:45:41.674Z',
    backtestFrom: 1775008800000,
    backtestTo: 1777167900000,
    source: 'https://www.okx.com/api/v5/market/history-candles',
    dataSource: {
      exchange: 'okx',
      marketType: 'swap',
      endpoint: 'https://www.okx.com/api/v5/market/history-candles',
      fixedEndTs: 1777168800000,
      pagination: { parameter: 'after', pageLimit: 300, pageCount: 8 },
    },
    candleCount: 2400,
    metrics: { returnPct: 1.78, winRatePct: 58.14, maxDrawdownPct: 0.78, tradeCount: 43 },
    equityCurve: [{ ts: 1775008800000, equity: 10000 }, { ts: 1777167900000, equity: 10177.53 }],
    trades: [{
      id: 'ma-cross-1',
      side: 'LONG',
      entryTs: 1775008800000,
      entryPrice: 100,
      exitTs: 1775095200000,
      exitPrice: 101.78,
      returnPct: 1.78,
    }],
    confidence: { level: 'high', reasons: ['样本回测满足官方基础准入条件。'] },
    disclaimer: '历史回测不代表未来收益。该结果基于固定历史窗口和官方参数，不等同于实盘表现。',
  },
}

const gridTemplate: StrategyPlazaTemplate = {
  ...template,
  id: 'grid-range',
  name: '网格区间',
  description: '在震荡区间内低买高卖，适合方向不明显的行情。',
  tags: ['网格', '现货', 'OKX 模拟盘'],
  marketType: 'spot',
  symbol: 'BTC-USDT',
  leverage: null,
}

describe('StrategyPlaza API rendering', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    ;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true
    mockTranslations = {}
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    container.remove()
  })

  it('renders backend templates with official sample backtest metrics', async () => {
    mockTranslations = {
      'aiQuant.strategies.ma-cross.tags.trend': 'Trend Follow',
      'aiQuant.strategies.ma-cross.tags.ma': 'Moving Average',
      'aiQuant.strategies.ma-cross.tags.okxDemo': 'OKX Demo',
      'aiQuant.strategyPlazaCard.okxDemo': 'OKX Demo',
      'aiQuant.strategyPlazaCard.marketType.perp': 'Perp',
    }

    await act(async () => {
      root.render(
        <StrategyPlaza
          templates={[template]}
          loading={false}
          onRunStrategy={() => undefined}
          onEditStrategy={() => undefined}
        />,
      )
    })

    expect(container.textContent).toContain('MA Cross Demo')
    expect(container.textContent).toContain('Use moving averages to follow confirmed trends.')
    expect(container.textContent).toContain('Trend Follow')
    expect(container.textContent).toContain('Moving Average')
    expect(container.textContent).toContain('BTC-USDT-SWAP')
    expect(container.textContent).toContain('近 15m')
    expect(container.textContent).toContain('OKX Demo')
    expect(container.textContent).toContain('Perp')
    expect(container.textContent).toContain('25%')
    expect(container.textContent).toContain('3x')
    expect(container.textContent).toContain('58.14%')
    expect(container.textContent).toContain('0.78%')
    expect(container.textContent).toContain('+1.78%')
    expect(container.textContent).toContain('43')
    expect(container.textContent).toContain('高置信')
    expect(container.querySelector('[data-testid="strategy-plaza-official-evidence"]')).toBeNull()
    expect(container.textContent).not.toContain('历史回测不代表未来收益')
    expect(container.textContent).not.toContain('K 线 2400')
    expect(container.textContent).not.toContain('+12.5%')
    expect(container.textContent).not.toContain('68%')
    expect(container.textContent).not.toContain('Sharpe')
    expect(container.textContent).not.toContain('跟单')
  })

  it('uses official equity points for card sparklines', async () => {
    await act(async () => {
      root.render(
        <StrategyPlaza
          templates={[template]}
          loading={false}
          onRunStrategy={() => undefined}
          onEditStrategy={() => undefined}
        />,
      )
    })

    const sparkline = container.querySelector('[data-testid="strategy-plaza-card"] polyline')

    expect(sparkline?.getAttribute('points')).toBe('0.0,37.0 120.0,3.0')
  })

  it('opens official reports from card clicks while keeping run and edit separate', async () => {
    const onOpenStrategyReport = jest.fn()
    const onRunStrategy = jest.fn()
    const onEditStrategy = jest.fn()

    await act(async () => {
      root.render(
        <StrategyPlaza
          templates={[template]}
          loading={false}
          onRunStrategy={onRunStrategy}
          onEditStrategy={onEditStrategy}
          onOpenStrategyReport={onOpenStrategyReport}
        />,
      )
    })

    const card = container.querySelector('[data-testid="strategy-plaza-card"]')
    const actionHost = container.querySelector(
      '[data-testid="strategy-plaza-grid"] [data-testid="strategy-plaza-actions"]',
    )
    const buttons = Array.from(actionHost?.querySelectorAll('button') ?? [])

    await act(async () => {
      card?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      buttons[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      buttons[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onOpenStrategyReport).toHaveBeenCalledTimes(1)
    expect(onOpenStrategyReport).toHaveBeenCalledWith('ma-cross')
    expect(onRunStrategy).toHaveBeenCalledWith('ma-cross')
    expect(onEditStrategy).toHaveBeenCalledWith('ma-cross')
  })

  it('does not render official evidence disclosure on cards', async () => {
    const onOpenStrategyReport = jest.fn()

    await act(async () => {
      root.render(
        <StrategyPlaza
          templates={[template]}
          loading={false}
          onRunStrategy={() => undefined}
          onEditStrategy={() => undefined}
          onOpenStrategyReport={onOpenStrategyReport}
        />,
      )
    })

    expect(container.querySelector('[data-testid="strategy-plaza-official-evidence"]')).toBeNull()
    expect(container.textContent).not.toContain('官方样本回测')
    expect(onOpenStrategyReport).not.toHaveBeenCalled()
  })

  it('renders all 32 paginated official templates without placeholder metrics', async () => {
    const templates = Array.from({ length: 32 }, (_, index): StrategyPlazaTemplate => {
      const id = `sample-${index + 1}`
      return {
        ...template,
        id,
        name: `Sample ${index + 1}`,
        displayOrder: index + 1,
        displayMetrics: {
          ...template.displayMetrics,
          returnPct: index + 1,
          winRatePct: 50 + index / 10,
          maxDrawdownPct: 1 + index / 100,
          tradeCount: 20 + index,
        },
        officialBacktest: {
          ...template.officialBacktest,
          metrics: {
            returnPct: index + 1,
            winRatePct: 50 + index / 10,
            maxDrawdownPct: 1 + index / 100,
            tradeCount: 20 + index,
          },
          trades: Array.from({ length: 20 + index }, (_, tradeIndex) => ({
            id: `${id}-${tradeIndex + 1}`,
            side: 'LONG' as const,
            entryTs: 1775008800000 + tradeIndex * 60000,
            entryPrice: 100,
            exitTs: 1775008860000 + tradeIndex * 60000,
            exitPrice: 101,
            returnPct: 1,
          })),
        },
      }
    })

    await act(async () => {
      root.render(
        <StrategyPlaza
          templates={templates}
          loading={false}
          onRunStrategy={() => undefined}
          onEditStrategy={() => undefined}
        />,
      )
    })

    for (const page of [1, 2, 3, 4]) {
      const pageButton = Array.from(container.querySelectorAll('button')).find(button =>
        button.textContent === String(page),
      )

      await act(async () => {
        pageButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      })

      const cards = Array.from(container.querySelectorAll('[data-testid="strategy-plaza-card"]'))
      expect(cards.length).toBe(page === 4 ? 5 : 9)
      for (const card of cards) {
        expect(card.textContent).not.toContain('--')
        expect(card.textContent).not.toContain('交易0')
      }
    }
  })

  it('uses localized range buy/sell copy for the former grid-range card', async () => {
    mockTranslations = {
      'aiQuant.strategies.grid-range.name': 'Range Buy/Sell',
      'aiQuant.strategies.grid-range.desc':
        'Buy near the lower range and sell near the upper range.',
      'aiQuant.strategies.grid-range.tags.range': 'Range',
      'aiQuant.strategies.grid-range.tags.buyLowSellHigh': 'Buy Low/Sell High',
      'aiQuant.strategies.grid-range.tags.okxDemo': 'OKX Demo',
      'aiQuant.strategyPlazaCard.okxDemo': 'OKX Demo',
      'aiQuant.strategyPlazaCard.marketType.spot': 'Spot',
    }

    await act(async () => {
      root.render(
        <StrategyPlaza
          templates={[gridTemplate]}
          loading={false}
          onRunStrategy={() => undefined}
          onEditStrategy={() => undefined}
        />,
      )
    })

    expect(container.textContent).toContain('Range Buy/Sell')
    expect(container.textContent).toContain(
      'Buy near the lower range and sell near the upper range.',
    )
    expect(container.textContent).toContain('Range')
    expect(container.textContent).toContain('Buy Low/Sell High')
    expect(container.textContent).toContain('OKX Demo')
    expect(container.textContent).toContain('Spot')
    expect(container.textContent).not.toContain('网格区间')
  })

  it('uses localized copy for backend Chinese MA crossover templates', async () => {
    mockTranslations = {
      'aiQuant.strategies.ma-cross.name': 'MA Crossover',
      'aiQuant.strategies.ma-cross.desc':
        'Go long when the short moving average crosses above the long moving average.',
      'aiQuant.strategies.ma-cross.tags.trend': 'Trend Follow',
      'aiQuant.strategies.ma-cross.tags.ma': 'Moving Average',
      'aiQuant.strategies.ma-cross.tags.okxDemo': 'OKX Demo',
      'aiQuant.strategyPlazaCard.okxDemo': 'OKX Demo',
      'aiQuant.strategyPlazaCard.marketType.perp': 'Perp',
    }
    const chineseMaTemplate: StrategyPlazaTemplate = {
      ...template,
      id: 'ma-cross',
      name: 'MA 均线交叉',
      description: '短均线上穿长均线做多，跌回长均线下方退出。',
      tags: ['趋势跟随', '均线', 'OKX 模拟盘'],
    }

    await act(async () => {
      root.render(
        <StrategyPlaza
          templates={[chineseMaTemplate]}
          loading={false}
          onRunStrategy={() => undefined}
          onEditStrategy={() => undefined}
        />,
      )
    })

    expect(container.textContent).toContain('MA Crossover')
    expect(container.textContent).toContain(
      'Go long when the short moving average crosses above the long moving average.',
    )
    expect(container.textContent).toContain('Trend Follow')
    expect(container.textContent).toContain('Moving Average')
    expect(container.textContent).toContain('OKX Demo')
    expect(container.textContent).not.toContain('MA 均线交叉')
    expect(container.textContent).not.toContain('短均线上穿长均线做多')
    expect(container.textContent).not.toContain('趋势跟随')
  })

  it('passes the template id to run and edit actions', async () => {
    const onRunStrategy = jest.fn()
    const onEditStrategy = jest.fn()

    await act(async () => {
      root.render(
        <StrategyPlaza
          templates={[template]}
          loading={false}
          onRunStrategy={onRunStrategy}
          onEditStrategy={onEditStrategy}
        />,
      )
    })

    const actionHost = container.querySelector(
      '[data-testid="strategy-plaza-grid"] [data-testid="strategy-plaza-actions"]',
    )
    const buttons = Array.from(actionHost?.querySelectorAll('button') ?? [])
    await act(async () => {
      buttons[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      buttons[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onRunStrategy).toHaveBeenCalledWith('ma-cross')
    expect(onEditStrategy).toHaveBeenCalledWith('ma-cross')
  })

  it('uses the logic confirmation blue-purple gradient on run actions', async () => {
    await act(async () => {
      root.render(
        <StrategyPlaza
          templates={[template]}
          loading={false}
          onRunStrategy={() => undefined}
          onEditStrategy={() => undefined}
        />,
      )
    })

    const actionHost = container.querySelector(
      '[data-testid="strategy-plaza-grid"] [data-testid="strategy-plaza-actions"]',
    )
    const runButton = actionHost?.querySelector('button')

    expect(runButton?.className).toContain('from-primary')
    expect(runButton?.className).toContain('to-secondary')
    expect(runButton?.getAttribute('style')).toContain('#3474ff')
    expect(runButton?.getAttribute('style')).toContain('#8a55ff')
  })

  it('renders aligned run and edit buttons', async () => {
    await act(async () => {
      root.render(
        <StrategyPlaza
          templates={[template]}
          loading={false}
          onRunStrategy={() => undefined}
          onEditStrategy={() => undefined}
        />,
      )
    })

    const actionHost = container.querySelector(
      '[data-testid="strategy-plaza-grid"] [data-testid="strategy-plaza-actions"]',
    )
    const buttons = Array.from(actionHost?.querySelectorAll('button') ?? [])

    expect(actionHost?.className).toContain('flex')
    expect(actionHost?.className).not.toContain('grid-cols-2')
    expect(buttons[0]?.className).toContain('h-9')
    expect(buttons[1]?.className).toContain('h-9')
    expect(buttons[0]?.className).toContain('flex-1')
    expect(buttons[1]?.className).toContain('flex-1')
    expect(buttons[0]?.className.split(/\s+/)).not.toContain('primary')
    expect(buttons[1]?.className.split(/\s+/)).not.toContain('primary')
  })

  it('keeps the hot rail title concise and theme-aware', async () => {
    await act(async () => {
      root.render(
        <StrategyPlaza
          templates={[template, gridTemplate]}
          loading={false}
          onRunStrategy={() => undefined}
          onEditStrategy={() => undefined}
        />,
      )
    })

    const rail = container.querySelector('[data-testid="strategy-plaza-hot-rail"]')
    const railCard = rail?.querySelector('article')

    expect(container.textContent).toContain('热门策略')
    expect(container.textContent).not.toContain('社区本周关注度最高')
    expect(railCard?.className).toContain('bg-[color:var(--cf-surface)]')
    expect(railCard?.className).toContain('text-[color:var(--cf-text-strong)]')
    expect(railCard?.className).not.toContain('text-white')
    expect(railCard?.className).not.toContain('#16122F')
  })

  it('places hot rail status badges in the top-right corner', async () => {
    await act(async () => {
      root.render(
        <StrategyPlaza
          templates={[template, gridTemplate]}
          loading={false}
          onRunStrategy={() => undefined}
          onEditStrategy={() => undefined}
        />,
      )
    })

    const rail = container.querySelector('[data-testid="strategy-plaza-hot-rail"]')
    const badge = rail?.querySelector('[data-testid="strategy-plaza-status-badge"]')

    expect(badge?.className).toContain('absolute')
    expect(badge?.className).toContain('right-3')
    expect(badge?.className).toContain('top-3')
  })

  it('uses the logic confirmation blue-purple gradient for hot rail run buttons', async () => {
    await act(async () => {
      root.render(
        <StrategyPlaza
          templates={[template, gridTemplate]}
          loading={false}
          onRunStrategy={() => undefined}
          onEditStrategy={() => undefined}
        />,
      )
    })

    const rail = container.querySelector('[data-testid="strategy-plaza-hot-rail"]')
    const runButton = rail?.querySelector('[data-testid="strategy-plaza-run-button"]')

    expect(runButton?.className).toContain('from-primary')
    expect(runButton?.className).toContain('to-secondary')
    expect(runButton?.getAttribute('style')).toContain('#3474ff')
    expect(runButton?.getAttribute('style')).toContain('#8a55ff')
  })

  it('renders card footer actions on one aligned row like the PC design', async () => {
    await act(async () => {
      root.render(
        <StrategyPlaza
          templates={[template]}
          loading={false}
          onRunStrategy={() => undefined}
          onEditStrategy={() => undefined}
        />,
      )
    })

    const card = container.querySelector('[data-testid="strategy-plaza-card"]')
    const footer = card?.querySelector('[data-testid="strategy-plaza-card-footer"]')
    const positionLeverage = card?.querySelector('[data-testid="strategy-plaza-position-leverage"]')
    const actions = card?.querySelector('[data-testid="strategy-plaza-actions"]')
    const buttons = Array.from(actions?.querySelectorAll('button') ?? [])

    expect(positionLeverage).toBeNull()
    expect(footer?.className).toContain('flex')
    expect(footer?.className).toContain('items-center')
    expect(actions?.className).toContain('flex')
    expect(actions?.className).not.toContain('grid-cols-2')
    expect(buttons[0]?.className).toContain('h-9')
    expect(buttons[1]?.className).toContain('h-9')
  })

  it('uses dark square pagination with the logic confirmation gradient on the active page', async () => {
    const manyTemplates = Array.from({ length: 10 }, (_, index) => ({
      ...template,
      id: `ma-cross-${index}`,
      name: `MA Cross Demo ${index}`,
      displayOrder: index + 1,
    }))

    await act(async () => {
      root.render(
        <StrategyPlaza
          templates={manyTemplates}
          loading={false}
          onRunStrategy={() => undefined}
          onEditStrategy={() => undefined}
        />,
      )
    })

    const pager = container.querySelector('[data-testid="strategy-plaza-pager"]')
    const buttons = Array.from(pager?.querySelectorAll('button') ?? [])
    const activePage = container.querySelector('[data-testid="strategy-plaza-page-button-active"]')

    expect(pager?.className).toContain('gap-1.5')
    expect(buttons[0]?.className).toContain('h-9')
    expect(buttons[0]?.className).toContain('min-w-9')
    expect(buttons[0]?.className).toContain('rounded-[9px]')
    expect(activePage?.className).toContain('from-primary')
    expect(activePage?.className).toContain('to-secondary')
    expect(activePage?.getAttribute('style')).toContain('#3474ff')
    expect(activePage?.getAttribute('style')).toContain('#8a55ff')
  })

  it('limits strategy category pages to nine cards and renders pagination controls', async () => {
    const manyTemplates = Array.from({ length: 10 }, (_, index) => ({
      ...template,
      id: `ma-cross-page-${index}`,
      name: `MA Cross Page ${index}`,
      displayOrder: index + 1,
    }))

    await act(async () => {
      root.render(
        <StrategyPlaza
          templates={manyTemplates}
          loading={false}
          onRunStrategy={() => undefined}
          onEditStrategy={() => undefined}
        />,
      )
    })

    expect(container.querySelectorAll('[data-testid="strategy-plaza-card"]')).toHaveLength(9)
    expect(container.querySelector('[data-testid="strategy-plaza-pager"]')).not.toBeNull()
  })

  it('renders the PC strategy plaza rail, toolbar, rich cards and local search', async () => {
    await act(async () => {
      root.render(
        <StrategyPlaza
          templates={[template, gridTemplate]}
          loading={false}
          onRunStrategy={() => undefined}
          onEditStrategy={() => undefined}
        />,
      )
    })

    expect(container.querySelector('[data-testid="strategy-plaza-hot-rail"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="strategy-plaza-toolbar"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="strategy-plaza-grid"]')).not.toBeNull()
    expect(container.textContent).toContain('热门策略')
    expect(container.textContent).not.toContain('社区本周关注度最高')
    expect(container.textContent).toContain('共 2 个')

    const search = container.querySelector<HTMLInputElement>(
      '[data-testid="strategy-plaza-search"]',
    )
    expect(search).not.toBeNull()
    expect(search?.getAttribute('placeholder')).toBe('搜索策略 · 币对 · 作者')

    await act(async () => {
      search!.value = '网格'
      search!.dispatchEvent(new Event('input', { bubbles: true }))
    })

    const grid = container.querySelector('[data-testid="strategy-plaza-grid"]')
    expect(grid?.textContent).toContain('网格区间')
    expect(grid?.textContent).not.toContain('MA Cross Demo')
    expect(container.textContent).toContain('共 1 个')
  })

  it('filters by category and shows an empty favorite state from PC plaza design', async () => {
    await act(async () => {
      root.render(
        <StrategyPlaza
          templates={[template, gridTemplate]}
          loading={false}
          onRunStrategy={() => undefined}
          onEditStrategy={() => undefined}
        />,
      )
    })

    const gridChip = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent === '网格',
    )
    expect(gridChip).not.toBeUndefined()

    await act(async () => {
      gridChip!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const grid = container.querySelector('[data-testid="strategy-plaza-grid"]')
    expect(grid?.textContent).toContain('网格区间')
    expect(grid?.textContent).not.toContain('MA Cross Demo')

    const favoriteChip = Array.from(container.querySelectorAll('button')).find(
      button => button.textContent === '收藏',
    )
    expect(favoriteChip).not.toBeUndefined()

    await act(async () => {
      favoriteChip!.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.textContent).toContain('还没有收藏的策略')
    expect(container.textContent).toContain('点击策略卡右上角的 ☆ 星标，把感兴趣的策略收藏到这里。')
  })

  it('keeps card metadata and actions from overflowing on mobile', async () => {
    await act(async () => {
      root.render(
        <StrategyPlaza
          templates={[template]}
          loading={false}
          pendingTemplateId="ma-cross"
          pendingAction="edit"
          onRunStrategy={() => undefined}
          onEditStrategy={() => undefined}
        />,
      )
    })

    const article = container.querySelector('[data-testid="strategy-plaza-card"]')
    const metadataRows = article?.querySelectorAll('[data-testid="strategy-plaza-meta-row"]') ?? []
    const actions = article?.querySelector('[data-testid="strategy-plaza-actions"]')

    expect(article?.className).toContain('min-w-0')
    expect(metadataRows[0]?.className).toContain('grid')
    expect(metadataRows[0]?.className).toContain('sm:flex')
    expect(actions?.className).toContain('flex')
    expect(actions?.className).not.toContain('grid-cols-2')
  })

  it('keeps loaded templates visible when showing an action error', async () => {
    await act(async () => {
      root.render(
        <StrategyPlaza
          templates={[template]}
          loading={false}
          actionError="运行策略失败"
          onRunStrategy={() => undefined}
          onEditStrategy={() => undefined}
        />,
      )
    })

    expect(container.textContent).toContain('MA Cross Demo')
    expect(container.textContent).toContain('运行策略失败')
  })

  it('disables actions and marks the pending button while a template action is running', async () => {
    const onRunStrategy = jest.fn()
    const onEditStrategy = jest.fn()

    await act(async () => {
      root.render(
        <StrategyPlaza
          templates={[template]}
          loading={false}
          pendingTemplateId="ma-cross"
          pendingAction="run"
          onRunStrategy={onRunStrategy}
          onEditStrategy={onEditStrategy}
        />,
      )
    })

    const actionHost = container.querySelector(
      '[data-testid="strategy-plaza-grid"] [data-testid="strategy-plaza-actions"]',
    )
    const buttons = Array.from(actionHost?.querySelectorAll('button') ?? [])
    expect(buttons).toHaveLength(2)
    expect(buttons[0]?.disabled).toBe(true)
    expect(buttons[0]?.getAttribute('aria-busy')).toBe('true')
    expect(buttons[0]?.textContent).toContain('运行中')
    expect(buttons[1]?.disabled).toBe(true)

    await act(async () => {
      buttons[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      buttons[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onRunStrategy).not.toHaveBeenCalled()
    expect(onEditStrategy).not.toHaveBeenCalled()
  })

  it('shows a spinner instead of the edit icon while a template edit action is pending', async () => {
    await act(async () => {
      root.render(
        <StrategyPlaza
          templates={[template]}
          loading={false}
          pendingTemplateId="ma-cross"
          pendingAction="edit"
          onRunStrategy={() => undefined}
          onEditStrategy={() => undefined}
        />,
      )
    })

    const actionHost = container.querySelector(
      '[data-testid="strategy-plaza-grid"] [data-testid="strategy-plaza-actions"]',
    )
    const buttons = Array.from(actionHost?.querySelectorAll('button') ?? [])
    expect(buttons).toHaveLength(2)
    expect(buttons[0]?.disabled).toBe(true)
    expect(buttons[1]?.disabled).toBe(true)
    expect(buttons[1]?.getAttribute('aria-busy')).toBe('true')
    expect(buttons[1]?.textContent).toContain('处理中')
    expect(buttons[1]?.querySelector('[data-testid="loader-icon"]')).not.toBeNull()
    expect(buttons[1]?.querySelector('[data-testid="edit-icon"]')).toBeNull()
  })
})
