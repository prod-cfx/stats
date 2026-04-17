import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { LogicGraphPreview } from './LogicGraphPreview'

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

describe('LogicGraphPreview', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('renders display-style block headings instead of entry and exit sections', () => {
    act(() => {
      root.render(
        <LogicGraphPreview
          graph={{
            version: 2,
            status: 'confirmed',
            trigger: [
              {
                id: 'trigger-price-drop',
                subject: 'BTCUSDT',
                operator: '3m 内相对前收盘下跌 1%',
                value: 'true',
              },
              {
                id: 'trigger-rsi',
                subject: 'BTCUSDT',
                operator: 'RSI 低于 30',
                value: 'true',
                join: 'AND',
              },
              {
                id: 'trigger-macd',
                subject: 'BTCUSDT',
                operator: 'MACD 金叉',
                value: 'true',
                join: 'OR',
              },
            ],
            actions: [
              {
                id: 'action-price-drop',
                action: 'BUY',
                target: 'BTCUSDT',
                amount: '10%',
              },
              {
                id: 'action-rsi',
                action: 'SELL',
                target: 'BTCUSDT',
                amount: '5%',
              },
              {
                id: 'action-macd',
                action: 'CLOSE',
                target: 'BTCUSDT',
                amount: '100%',
              },
            ],
            risk: ['等待风控规则补充'],
            meta: {
              exchange: 'okx',
              symbol: 'BTCUSDT',
              timeframe: '3m/15m',
              positionPct: 10,
              executionTags: ['marketType: spot'],
            },
          }}
          confirmDisabled
          onConfirm={() => {}}
          onRevise={() => {}}
        />,
      )
    })

    expect(container.textContent).toContain('IF')
    expect(container.textContent).toContain('AND AT THEN')
    expect(container.textContent).toContain('OR THEN')
    expect(container.textContent).toContain('EXECUTE')
    expect(container.textContent).not.toContain('ENTRY')
    expect(container.textContent).not.toContain('EXIT')
    expect(container.textContent).toContain('BUY 10% 的 BTCUSDT')
    expect(container.textContent).toContain('aiQuant.messages.confirmedGraph')
    expect(container.querySelector('button')?.disabled).toBe(true)
  })

  it('keeps legacy actions visible when there are more actions than triggers', () => {
    act(() => {
      root.render(
        <LogicGraphPreview
          graph={{
            version: 2,
            status: 'draft',
            trigger: [
              {
                id: 'trigger-price-drop',
                subject: 'BTCUSDT',
                operator: '3m 内相对前收盘下跌 1%',
                value: 'true',
              },
            ],
            actions: [
              {
                id: 'action-1',
                action: 'BUY',
                target: 'BTCUSDT',
                amount: '10%',
              },
              {
                id: 'action-2',
                action: 'SELL',
                target: 'BTCUSDT',
                amount: '5%',
              },
              {
                id: 'action-3',
                action: 'CLOSE',
                target: 'BTCUSDT',
                amount: '100%',
              },
            ],
            risk: [],
            meta: {
              exchange: 'okx',
              symbol: 'BTCUSDT',
              timeframe: '3m/15m',
              positionPct: 10,
              executionTags: ['marketType: spot'],
            },
          }}
          confirmDisabled
          onConfirm={() => {}}
          onRevise={() => {}}
        />,
      )
    })

    expect(container.textContent).toContain('BUY 10% 的 BTCUSDT')
    expect(container.textContent).toContain('SELL 5% 的 BTCUSDT')
    expect(container.textContent).toContain('CLOSE 100% 的 BTCUSDT')
  })
})
