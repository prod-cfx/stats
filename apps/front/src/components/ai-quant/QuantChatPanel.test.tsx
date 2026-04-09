/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QuantChatPanel } from './QuantChatPanel'

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('react-markdown', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}))

jest.mock('remark-gfm', () => ({
  __esModule: true,
  default: () => {},
}))

jest.mock('lucide-react', () => {
  const Icon = () => null
  return {
    ArrowUp: Icon,
    Bot: Icon,
    Check: Icon,
    ChevronsUpDown: Icon,
    Play: Icon,
    Search: Icon,
    Settings2: Icon,
    User: Icon,
  }
})

describe('QuantChatPanel range settings', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot> | null

  const baseParams = {
    exchange: 'binance' as const,
    symbol: 'BTCUSDT',
    buyWindowMin: 3,
    buyDropPct: 1,
    sellWindowMin: 15,
    sellRisePct: 2,
    positionPct: 10,
    backtestRangePreset: '30D' as const,
    backtestStart: '2026-02-22T00:00:00.000Z',
    backtestEnd: '2026-03-24T00:00:00.000Z',
  }

  beforeEach(() => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
      configurable: true,
      value: jest.fn(),
    })
  })

  const triggerInputChange = (element: HTMLInputElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set
    setter?.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  }

  const triggerTextareaChange = (element: HTMLTextAreaElement, value: string) => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set
    setter?.call(element, value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  }

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount()
      })
      root = null
    }
    document.body.innerHTML = ''
  })

  it('renders range preset options 7D/30D/90D/1Y/custom by default', async () => {
    const onParamChange = jest.fn()

    await act(async () => {
      root?.render(
        <QuantChatPanel
          messages={[{ id: 'm1', role: 'assistant', content: 'hello' }]}
          paramSchema={null}
          paramValues={baseParams}
          onParamChange={onParamChange}
          onSend={() => {}}
          onRunBacktest={() => {}}
        />,
      )
    })

    await act(async () => {
      container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.textContent).toContain('7D')
    expect(container.textContent).toContain('30D')
    expect(container.textContent).toContain('90D')
    expect(container.textContent).toContain('1Y')
    expect(container.textContent).toContain('aiQuant.customRange')
  })

  it('shows custom datetime inputs and triggers onParamsChange when values change', async () => {
    const onParamChange = jest.fn()
    const Harness = () => {
      const [paramValues, setParamValues] = React.useState(baseParams)
      return (
        <QuantChatPanel
          messages={[{ id: 'm1', role: 'assistant', content: 'hello' }]}
          paramSchema={null}
          paramValues={paramValues}
          onParamChange={(key, value) => {
            onParamChange(key, value)
            setParamValues(prev => ({ ...prev, [key]: value }))
          }}
          onSend={() => {}}
          onRunBacktest={() => {}}
        />
      )
    }

    await act(async () => {
      root?.render(<Harness />)
    })

    await act(async () => {
      container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const customBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('aiQuant.customRange'))
    expect(customBtn).toBeTruthy()

    await act(async () => {
      customBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const callCountAfterCustom = onParamChange.mock.calls.length

    const dateInputs = container.querySelectorAll('input[type="datetime-local"]')
    expect(dateInputs).toHaveLength(2)

    const startInput = dateInputs[0] as HTMLInputElement
    await act(async () => {
      triggerInputChange(startInput, '2026-01-01T00:00')
    })
    const callCountAfterStart = onParamChange.mock.calls.length

    const endInput = dateInputs[1] as HTMLInputElement
    await act(async () => {
      triggerInputChange(endInput, '2026-02-01T00:00')
    })

    expect(onParamChange).toHaveBeenCalled()
    const calls = onParamChange.mock.calls
    expect(calls.some(([key, value]) => key === 'backtestRangePreset' && value === 'CUSTOM')).toBe(true)
    expect(callCountAfterStart).toBeGreaterThan(callCountAfterCustom)
    expect(onParamChange.mock.calls.length).toBeGreaterThan(callCountAfterStart)
  })

  it('does not submit when Enter is pressed during IME composition', async () => {
    const onSend = jest.fn()

    await act(async () => {
      root?.render(
        <QuantChatPanel
          messages={[{ id: 'm1', role: 'assistant', content: 'hello' }]}
          paramSchema={null}
          paramValues={{}}
          onParamChange={() => {}}
          onSend={onSend}
          onRunBacktest={() => {}}
        />,
      )
    })

    const textarea = container.querySelector('textarea')
    expect(textarea).toBeTruthy()

    await act(async () => {
      triggerTextareaChange(textarea as HTMLTextAreaElement, '测试消息')
    })

    await act(async () => {
      const composingEvent = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperty(composingEvent, 'isComposing', {
        configurable: true,
        value: true,
      })
      textarea?.dispatchEvent(composingEvent)
    })

    await act(async () => {
      const keyCode229Event = new KeyboardEvent('keydown', {
        key: 'Enter',
        bubbles: true,
        cancelable: true,
      })
      Object.defineProperty(keyCode229Event, 'keyCode', {
        configurable: true,
        value: 229,
      })
      textarea?.dispatchEvent(keyCode229Event)
    })

    expect(onSend).not.toHaveBeenCalled()
  })

  it('renders clarification and publication gate cards when provided', async () => {
    await act(async () => {
      root?.render(
        <QuantChatPanel
          messages={[{ id: 'm1', role: 'assistant', content: 'hello' }]}
          paramSchema={null}
          paramValues={{}}
          clarificationGate={{
            blocked: true,
            items: [
              {
                key: 'market.marketType',
                field: 'marketType',
                reason: 'missing_market_type',
                question: '这条策略包含做空，请确认使用现货还是合约/永续？',
                allowedAnswers: ['spot', 'perp'],
                blocking: true,
                status: 'pending',
              },
            ],
          }}
          publicationGate={{
            passed: false,
            blockingMismatches: [
              {
                field: 'exchange',
                expected: 'okx',
                actual: 'binance',
                reason: 'confirmed snapshot and compiled artifact exchange mismatch',
              },
            ],
          }}
          onClarificationAnswer={() => {}}
          onParamChange={() => {}}
          onSend={() => {}}
          onRunBacktest={() => {}}
        />,
      )
    })

    expect(container.textContent).toContain('这条策略包含做空，请确认使用现货还是合约/永续？')
    expect(container.textContent).toContain('confirmed snapshot and compiled artifact exchange mismatch')
  })
})
