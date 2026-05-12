import type {Root} from 'react-dom/client';
import { act } from 'react'
import { createRoot  } from 'react-dom/client'
import { DisplayLogicGraphPreview } from './DisplayLogicGraphPreview'

let mockLanguage = 'zh'

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: {
      language: mockLanguage,
      resolvedLanguage: mockLanguage,
    },
    t: (key: string) => key,
  }),
}))

globalThis.IS_REACT_ACT_ENVIRONMENT = true

describe('displayLogicGraphPreview', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    mockLanguage = 'zh'
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  it('localizes server-provided graph labels and semantic text in English', () => {
    mockLanguage = 'en'

    act(() => {
      root.render(
        <DisplayLogicGraphPreview
          graph={{
            blocks: [
              {
                type: 'IF',
                items: [
                  {
                    kind: 'condition',
                    id: 'condition-rsi-entry',
                    text: 'RSI14 上穿阈值',
                  },
                  {
                    kind: 'action',
                    id: 'action-entry',
                    text: '开多 25%',
                  },
                ],
              },
              {
                type: 'AND_AT_THEN',
                items: [
                  {
                    kind: 'condition',
                    id: 'condition-rsi-exit',
                    text: 'RSI14 高于阈值',
                  },
                  {
                    kind: 'action',
                    id: 'action-exit',
                    text: '平仓',
                  },
                ],
              },
              {
                type: 'EXECUTE',
                items: [
                  {
                    kind: 'execute',
                    id: 'execute-exchange',
                    key: 'exchange',
                    text: '交易所: OKX',
                  },
                  {
                    kind: 'execute',
                    id: 'execute-market-type',
                    key: 'marketType',
                    text: '市场: 现货',
                  },
                  {
                    kind: 'execute',
                    id: 'execute-risk',
                    key: 'risk',
                    text: '风控: 亏损达到 5% -> 平仓',
                  },
                ],
              },
            ],
          }}
          confirmed
          onConfirm={() => {}}
          onRevise={() => {}}
        />,
      )
    })

    expect(container.textContent).toContain('RSI14 crosses above threshold')
    expect(container.textContent).toContain('Open long 25%')
    expect(container.textContent).toContain('RSI14 above threshold')
    expect(container.textContent).toContain('Close position')
    expect(container.textContent).toContain('Exchange: OKX')
    expect(container.textContent).toContain('Market: Spot')
    expect(container.textContent).toContain('Risk: Loss reaches 5% -> Close position')
    expect(container.textContent).not.toContain('交易所')
    expect(container.textContent).not.toContain('开多')
    expect(container.textContent).not.toContain('平仓')
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('renders display blocks with distinct headings and action text', () => {
    act(() => {
      root.render(
        <DisplayLogicGraphPreview
          graph={{
            blocks: [
              {
                type: 'IF',
                items: [
                  {
                    kind: 'condition',
                    id: 'condition-1',
                    text: '3m 内相对前收盘下跌 1%',
                  },
                  {
                    kind: 'action',
                    id: 'action-1',
                    text: '开多',
                  },
                ],
              },
              {
                type: 'AND_AT_THEN',
                items: [
                  {
                    kind: 'condition',
                    id: 'condition-2',
                    text: 'RSI 低于 30',
                  },
                  {
                    kind: 'action',
                    id: 'action-2',
                    text: '减仓',
                  },
                ],
              },
              {
                type: 'OR_THEN',
                items: [
                  {
                    kind: 'condition',
                    id: 'condition-3',
                    text: 'MACD 金叉',
                  },
                  {
                    kind: 'action',
                    id: 'action-3',
                    text: '平仓',
                  },
                ],
              },
              {
                type: 'EXECUTE',
                items: [
                  {
                    kind: 'execute',
                    id: 'execute-1',
                    key: 'exchange',
                    text: '交易所: OKX',
                  },
                ],
              },
            ],
          }}
          confirmed
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
    expect(container.textContent).toContain('THEN')
    expect(container.textContent).toContain('开多')
    expect(container.textContent).toContain('交易所: OKX')
    expect(container.textContent).toContain('aiQuant.messages.confirmedGraph')
    expect(container.querySelector('button')?.disabled).toBe(true)
  })

  it('shows a fallback THEN message when a block has no actions', () => {
    act(() => {
      root.render(
        <DisplayLogicGraphPreview
          graph={{
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
          }}
          onConfirm={() => {}}
          onRevise={() => {}}
        />,
      )
    })

    expect(container.textContent).toContain('IF')
    expect(container.textContent).toContain('THEN')
    expect(container.textContent).toContain('等待策略规则补充')
  })

  it('shows the published snapshot id below graph actions only after confirmation', () => {
    const graph = {
      blocks: [
        {
          type: 'EXECUTE' as const,
          items: [
            {
              kind: 'execute' as const,
              id: 'execute-1',
              key: 'exchange',
              text: '交易所: OKX',
            },
          ],
        },
      ],
    }

    act(() => {
      root.render(
        <DisplayLogicGraphPreview
          graph={graph}
          confirmed
          publishedSnapshotId="snapshot-1"
          onConfirm={() => {}}
          onRevise={() => {}}
        />,
      )
    })

    expect(container.textContent).toContain('aiQuant.messages.snapshotId')
    expect(container.textContent).toContain('snapshot-1')

    act(() => {
      root.render(
        <DisplayLogicGraphPreview
          graph={graph}
          confirmed={false}
          publishedSnapshotId="snapshot-1"
          onConfirm={() => {}}
          onRevise={() => {}}
        />,
      )
    })

    expect(container.textContent).not.toContain('aiQuant.messages.snapshotId')
    expect(container.textContent).not.toContain('snapshot-1')
  })
})
