/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
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
    const setter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value',
    )?.set
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

    expect(container.textContent).toContain('aiQuant.backtestSettingsTitle')
    expect(container.textContent).toContain('7D')
    expect(container.textContent).toContain('30D')
    expect(container.textContent).toContain('90D')
    expect(container.textContent).toContain('1Y')
    expect(container.textContent).toContain('aiQuant.customRange')
  })

  it('shows custom datetime inputs and applies them after confirm', async () => {
    const onParamChange = jest.fn()
    const Harness = () => {
      const [paramValues, setParamValues] = React.useState({
        ...baseParams,
        backtestInitialCash: 10000,
        backtestLeverage: 1,
        backtestSlippageBps: 10,
        backtestFeeBps: 5,
        backtestPriceSource: 'close',
        backtestAllowPartial: true,
      })
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

    const customBtn = Array.from(container.querySelectorAll('button')).find(btn =>
      btn.textContent?.includes('aiQuant.customRange'),
    )
    expect(customBtn).toBeTruthy()

    await act(async () => {
      customBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const dateInputs = container.querySelectorAll('input[type="datetime-local"]')
    expect(dateInputs).toHaveLength(2)

    const startInput = dateInputs[0] as HTMLInputElement
    await act(async () => {
      triggerInputChange(startInput, '2026-01-01T00:00')
    })

    const endInput = dateInputs[1] as HTMLInputElement
    await act(async () => {
      triggerInputChange(endInput, '2026-02-01T00:00')
    })

    const confirmButton = Array.from(container.querySelectorAll('button')).find(btn =>
      btn.textContent?.includes('aiQuant.backtestConfirmSettings'),
    )
    expect(confirmButton).toBeTruthy()

    await act(async () => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onParamChange).toHaveBeenCalled()
    const calls = onParamChange.mock.calls
    expect(calls.some(([key, value]) => key === 'backtestRangePreset' && value === 'CUSTOM')).toBe(
      true,
    )
    expect(
      calls.some(([key, value]) => key === 'backtestStart' && value === '2026-01-01T00:00:00.000Z'),
    ).toBe(true)
    expect(
      calls.some(([key, value]) => key === 'backtestEnd' && value === '2026-02-01T00:00:00.000Z'),
    ).toBe(true)
  })

  it('renders explicit backtest execution controls even when paramSchema is null', async () => {
    await act(async () => {
      root?.render(
        <QuantChatPanel
          messages={[{ id: 'm1', role: 'assistant', content: 'hello' }]}
          paramSchema={null}
          paramValues={{
            ...baseParams,
            backtestInitialCash: 10000,
            backtestLeverage: 2,
            backtestSlippageBps: 10,
            backtestFeeBps: 5,
            backtestPriceSource: 'close',
            backtestAllowPartial: true,
          }}
          onParamChange={() => {}}
          onSend={() => {}}
          onRunBacktest={() => {}}
        />,
      )
    })

    await act(async () => {
      container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.textContent).toContain('aiQuant.backtestInitialCash')
    expect(container.textContent).toContain('aiQuant.backtestLeverage')
    expect(container.textContent).toContain('aiQuant.backtestSlippageBps')
    expect(container.textContent).toContain('aiQuant.backtestFeeBps')
    expect(container.textContent).toContain('aiQuant.backtestPriceSource')
    expect(container.textContent).toContain('aiQuant.backtestAllowPartial')
  })

  it('shows inline validation for invalid backtest execution values', async () => {
    await act(async () => {
      root?.render(
        <QuantChatPanel
          messages={[{ id: 'm1', role: 'assistant', content: 'hello' }]}
          paramSchema={null}
          paramValues={{
            ...baseParams,
            backtestInitialCash: 0,
            backtestLeverage: -1,
            backtestSlippageBps: -3,
            backtestFeeBps: -2,
            backtestPriceSource: 'bad-source',
            backtestAllowPartial: 'bad',
          }}
          onParamChange={() => {}}
          onSend={() => {}}
          onRunBacktest={() => {}}
        />,
      )
    })

    await act(async () => {
      container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.textContent).toContain('aiQuant.messages.positiveNumber')
    expect(container.textContent).toContain('aiQuant.messages.nonNegativeNumber')
    expect(container.textContent).toContain('aiQuant.messages.invalidPriceSource')
    expect(container.textContent).toContain('aiQuant.messages.invalidBoolean')
  })

  it('edits backtest params locally and only applies them after confirm', async () => {
    const onParamChange = jest.fn()

    await act(async () => {
      root?.render(
        <QuantChatPanel
          messages={[{ id: 'm1', role: 'assistant', content: 'hello' }]}
          paramSchema={null}
          paramValues={{
            ...baseParams,
            backtestInitialCash: 10000,
            backtestLeverage: 2,
            backtestSlippageBps: 10,
            backtestFeeBps: 5,
            backtestPriceSource: 'close',
            backtestAllowPartial: true,
          }}
          onParamChange={onParamChange}
          onSend={() => {}}
          onRunBacktest={() => {}}
        />,
      )
    })

    await act(async () => {
      container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const numberInputs = container.querySelectorAll('input[type="number"]')
    expect(numberInputs.length).toBeGreaterThanOrEqual(4)

    await act(async () => {
      triggerInputChange(numberInputs[0] as HTMLInputElement, '20000')
    })

    expect(onParamChange).not.toHaveBeenCalled()
    expect(container.textContent).toContain('aiQuant.backtestDraftPending')

    const confirmButton = Array.from(container.querySelectorAll('button')).find(btn =>
      btn.textContent?.includes('aiQuant.backtestConfirmSettings'),
    )
    expect(confirmButton).toBeTruthy()

    await act(async () => {
      confirmButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onParamChange).toHaveBeenCalledWith('backtestInitialCash', 20000)
    expect(container.textContent).not.toContain('aiQuant.backtestDraftPending')
  })

  it('cancels backtest param edits without applying them', async () => {
    const onParamChange = jest.fn()

    await act(async () => {
      root?.render(
        <QuantChatPanel
          messages={[{ id: 'm1', role: 'assistant', content: 'hello' }]}
          paramSchema={null}
          paramValues={{
            ...baseParams,
            backtestInitialCash: 10000,
            backtestLeverage: 2,
            backtestSlippageBps: 10,
            backtestFeeBps: 5,
            backtestPriceSource: 'close',
            backtestAllowPartial: true,
          }}
          onParamChange={onParamChange}
          onSend={() => {}}
          onRunBacktest={() => {}}
        />,
      )
    })

    await act(async () => {
      container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const numberInputs = container.querySelectorAll('input[type="number"]')
    await act(async () => {
      triggerInputChange(numberInputs[0] as HTMLInputElement, '20000')
    })

    const cancelButton = Array.from(container.querySelectorAll('button')).find(btn =>
      btn.textContent?.includes('aiQuant.backtestClosePanel'),
    )
    expect(cancelButton).toBeTruthy()

    await act(async () => {
      cancelButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onParamChange).not.toHaveBeenCalled()
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

  it('shows only backtest params in the settings panel and hides strategy params', async () => {
    await act(async () => {
      root?.render(
        <QuantChatPanel
          messages={[{ id: 'm1', role: 'assistant', content: 'hello' }]}
          paramSchema={{
            type: 'object',
            properties: {
              positionPct: { type: 'number', title: 'Position %' },
              buyWindowMin: { type: 'number', title: 'Buy Window (min)' },
            },
            required: ['positionPct'],
          }}
          paramValues={{
            ...baseParams,
            backtestInitialCash: 10000,
            backtestLeverage: 1,
            backtestPriceSource: 'close',
          }}
          onParamChange={() => {}}
          onSend={() => {}}
          onRunBacktest={() => {}}
        />,
      )
    })

    await act(async () => {
      container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.textContent).toContain('aiQuant.backtestInitialCash')
    expect(container.textContent).toContain('aiQuant.backtestLeverage')
    expect(container.textContent).toContain('aiQuant.backtestPriceSource')
    expect(container.textContent).not.toContain('Position %')
    expect(container.textContent).not.toContain('Buy Window (min)')
  })

  it('disables start backtest while there are unconfirmed draft changes', async () => {
    await act(async () => {
      root?.render(
        <QuantChatPanel
          messages={[{ id: 'm1', role: 'assistant', content: 'hello' }]}
          paramSchema={null}
          paramValues={{
            ...baseParams,
            backtestInitialCash: 10000,
            backtestLeverage: 2,
            backtestSlippageBps: 10,
            backtestFeeBps: 5,
            backtestPriceSource: 'close',
            backtestAllowPartial: true,
          }}
          onParamChange={() => {}}
          onSend={() => {}}
          onRunBacktest={() => {}}
        />,
      )
    })

    await act(async () => {
      container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const numberInputs = container.querySelectorAll('input[type="number"]')
    await act(async () => {
      triggerInputChange(numberInputs[0] as HTMLInputElement, '20000')
    })

    const runButton = container.querySelector(
      '[data-testid="run-backtest"]',
    ) as HTMLButtonElement | null
    expect(runButton?.disabled).toBe(true)
    expect(container.textContent).toContain('aiQuant.backtestDraftPending')
  })

  it('renders a dedicated settings action bar so mobile users can always reach the controls', async () => {
    await act(async () => {
      root?.render(
        <QuantChatPanel
          messages={[{ id: 'm1', role: 'assistant', content: 'hello' }]}
          paramSchema={null}
          paramValues={{
            ...baseParams,
            backtestInitialCash: 10000,
            backtestLeverage: 2,
            backtestSlippageBps: 10,
            backtestFeeBps: 5,
            backtestPriceSource: 'close',
            backtestAllowPartial: true,
          }}
          onParamChange={() => {}}
          onSend={() => {}}
          onRunBacktest={() => {}}
        />,
      )
    })

    await act(async () => {
      container.querySelector('button')?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const actions = container.querySelector('[data-testid="backtest-settings-actions"]')
    expect(actions).toBeTruthy()
    expect(actions?.className).toContain('shrink-0')
    expect(actions?.textContent).toContain('aiQuant.backtestClosePanel')
    expect(actions?.textContent).toContain('aiQuant.backtestConfirmSettings')
    expect(actions?.querySelectorAll('button')).toHaveLength(2)
    expect(actions?.querySelector('button')?.className).toContain('w-full')
  })

  it('does not render a separate clarification card while still showing publication gate content', async () => {
    await act(async () => {
      root?.render(
        <QuantChatPanel
          messages={[
            {
              id: 'm1',
              role: 'assistant',
              content: '这条策略包含做空，请确认使用现货还是合约/永续？',
            },
          ]}
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
    expect(container.textContent).toContain(
      'confirmed snapshot and compiled artifact exchange mismatch',
    )
    expect(container.querySelector('[data-testid="clarification-freeform-input"]')).toBeNull()
  })
})
