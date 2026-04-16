/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { BacktestSummaryCard } from './BacktestSummaryCard'

jest.mock('react-i18next', () => ({
  // eslint-disable-next-line react-hooks-extra/no-unnecessary-use-prefix
  useTranslation: () => ({
    i18n: {
      language: 'zh',
      resolvedLanguage: 'zh',
    },
    t: (key: string) => ({
      'aiQuant.backtestResult': '回测结果',
      'aiQuant.messages.backtestDrawdownLimit': '最大回撤不超过 20% 方可部署',
      'aiQuant.messages.backtestDrawdownFail': '回撤超标，暂不允许部署',
      'aiQuant.fullScreen': '全屏查看',
      'aiQuant.maxDrawdown': '最大回撤',
      'aiQuant.closedReturn': '已平仓收益',
      'aiQuant.closedWinRate': '已平仓胜率',
      'aiQuant.closedTradeCount': '已平仓交易数',
      'aiQuant.openTradeCount': '未平仓笔数',
      'aiQuant.openPnl': 'Open P&L',
      'aiQuant.messages.returnToChat': '返回对话继续优化',
      'aiQuant.deploy': '一键部署',
    }[key] ?? key),
  }),
}))

describe('BacktestSummaryCard', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    ;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true
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


  it('renders spot backtest summaries with holding-oriented labels and metrics', async () => {
    await act(async () => {
      root.render(
        <BacktestSummaryCard
          result={{
            id: 'bt-spot',
            symbol: 'BTCUSDT',
            startAt: '2026-04-01T00:00:00.000Z',
            endAt: '2026-04-15T00:00:00.000Z',
            maxDrawdownPct: 0.32,
            totalReturnPct: 0,
            winRatePct: 0,
            tradeCount: 0,
            openTradeCount: 1,
            openPnl: 2.49,
          }}
          marketType="spot"
          canDeploy
          onOpenFullScreen={() => undefined}
          onOptimize={() => undefined}
          onDeploy={() => undefined}
        />,
      )
    })

    expect(container.textContent).toContain('现货回测')
    expect(container.textContent).toContain('收益率')
    expect(container.textContent).toContain('已完成交易')
    expect(container.textContent).toContain('当前持仓')
    expect(container.textContent).toContain('持仓浮盈浮亏')
    expect(container.textContent).not.toContain('暂不允许部署')
    expect(container.textContent).not.toContain('已平仓收益')
    expect(container.textContent).not.toContain('已平仓胜率')
    expect(container.textContent).not.toContain('未平仓笔数')
  })

  it('renders open trade count and open pnl when present', async () => {
    await act(async () => {
      root.render(
        <BacktestSummaryCard
          result={{
            id: 'bt-1',
            symbol: 'BTCUSDT',
            startAt: '2026-04-01T00:00:00.000Z',
            endAt: '2026-04-15T00:00:00.000Z',
            maxDrawdownPct: 0.32,
            totalReturnPct: 0,
            winRatePct: 0,
            tradeCount: 0,
            openTradeCount: 1,
            openPnl: 2.49,
          }}
          marketType="perp"
          canDeploy={false}
          onOpenFullScreen={() => undefined}
          onOptimize={() => undefined}
          onDeploy={() => undefined}
        />,
      )
    })

    expect(container.textContent).toContain('未平仓笔数')
    expect(container.textContent).toContain('1')
    expect(container.textContent).toContain('已平仓收益')
    expect(container.textContent).toContain('已平仓胜率')
    expect(container.textContent).toContain('已平仓交易数')
    expect(container.textContent).toContain('Open P&L')
    expect(container.textContent).toContain('+2.49')
  })

  it('shows drawdown failure copy when open-only results exceed the deploy threshold', async () => {
    await act(async () => {
      root.render(
        <BacktestSummaryCard
          result={{
            id: 'bt-open-drawdown-fail',
            symbol: 'BTCUSDT',
            startAt: '2026-04-01T00:00:00.000Z',
            endAt: '2026-04-15T00:00:00.000Z',
            maxDrawdownPct: 20.5,
            totalReturnPct: 0,
            winRatePct: 0,
            tradeCount: 0,
            openTradeCount: 1,
            openPnl: -1.25,
          }}
          marketType="perp"
          canDeploy={false}
          onOpenFullScreen={() => undefined}
          onOptimize={() => undefined}
          onDeploy={() => undefined}
        />,
      )
    })

    expect(container.textContent).toContain('回撤超标，暂不允许部署')
    expect(container.textContent).not.toContain('未形成已完成交易')
  })
})
