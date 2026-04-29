/** @jest-environment jsdom */

import type { StrategyPlazaTemplate } from '@/lib/api'
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { StrategyPlaza } from './StrategyPlaza'

let mockTranslations: Record<string, string> = {}

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => mockTranslations[key] ?? options?.defaultValue ?? key,
  }),
}))

jest.mock('lucide-react', () => ({
  Activity: () => <span data-testid="activity-icon" />,
  BarChart3: () => <span data-testid="bar-chart-icon" />,
  Edit3: () => <span data-testid="edit-icon" />,
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
    ;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
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
    expect(container.textContent).toContain('trend')
    expect(container.textContent).toContain('demo')
    expect(container.textContent).toContain('BTC-USDT-SWAP / 15m')
    expect(container.textContent).toContain('OKX 模拟盘')
    expect(container.textContent).toContain('永续')
    expect(container.textContent).toContain('25%')
    expect(container.textContent).toContain('3x')
    expect(container.textContent).toContain('58.14%')
    expect(container.textContent).toContain('0.78%')
    expect(container.textContent).toContain('+1.78%')
    expect(container.textContent).not.toContain('+12.5%')
    expect(container.textContent).not.toContain('68%')
  })

  it('uses localized range buy/sell copy for the former grid-range card', async () => {
    mockTranslations = {
      'aiQuant.strategies.grid-range.name': 'Range Buy/Sell',
      'aiQuant.strategies.grid-range.desc': 'Buy near the lower range and sell near the upper range.',
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
    expect(container.textContent).toContain('Buy near the lower range and sell near the upper range.')
    expect(container.textContent).toContain('Range')
    expect(container.textContent).toContain('Buy Low/Sell High')
    expect(container.textContent).toContain('OKX Demo')
    expect(container.textContent).toContain('Spot')
    expect(container.textContent).not.toContain('网格区间')
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

    const buttons = Array.from(container.querySelectorAll('button'))
    await act(async () => {
      buttons[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      buttons[1]?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onRunStrategy).toHaveBeenCalledWith('ma-cross')
    expect(onEditStrategy).toHaveBeenCalledWith('ma-cross')
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

    const buttons = Array.from(container.querySelectorAll('button'))
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
})
