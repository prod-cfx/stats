/** @jest-environment jsdom */

import type { StrategyPlazaTemplate } from '@/lib/api'
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { StrategyPlaza } from './StrategyPlaza'

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
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
    returnPct: null,
    winRatePct: null,
    maxDrawdownPct: null,
  },
}

describe('StrategyPlaza API rendering', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    ;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
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

  it('renders backend templates without mock return or win-rate metrics', async () => {
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
    expect(container.textContent).not.toContain('+12.5%')
    expect(container.textContent).not.toContain('68%')
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
})
