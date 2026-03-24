/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { QuantChatPanel } from './QuantChatPanel'

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
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
    const onParamsChange = jest.fn()

    await act(async () => {
      root?.render(
        <QuantChatPanel
          messages={[{ id: 'm1', role: 'assistant', content: 'hello' }]}
          params={baseParams}
          onParamsChange={onParamsChange}
          onSend={() => {}}
          onRunBacktest={() => {}}
        />,
      )
    })

    expect(container.textContent).toContain('7D')
    expect(container.textContent).toContain('30D')
    expect(container.textContent).toContain('90D')
    expect(container.textContent).toContain('1Y')
    expect(container.textContent).toContain('aiQuant.customRange')
  })

  it('shows custom datetime inputs and triggers onParamsChange when values change', async () => {
    const onParamsChange = jest.fn()
    const Harness = () => {
      const [params, setParams] = React.useState(baseParams)
      return (
        <QuantChatPanel
          messages={[{ id: 'm1', role: 'assistant', content: 'hello' }]}
          params={params}
          onParamsChange={(next) => {
            onParamsChange(next)
            setParams(next)
          }}
          onSend={() => {}}
          onRunBacktest={() => {}}
        />
      )
    }

    await act(async () => {
      root?.render(<Harness />)
    })

    const customBtn = Array.from(container.querySelectorAll('button')).find(btn => btn.textContent?.includes('aiQuant.customRange'))
    expect(customBtn).toBeTruthy()

    await act(async () => {
      customBtn?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })
    const callCountAfterCustom = onParamsChange.mock.calls.length

    const dateInputs = container.querySelectorAll('input[type="datetime-local"]')
    expect(dateInputs).toHaveLength(2)

    const startInput = dateInputs[0] as HTMLInputElement
    await act(async () => {
      triggerInputChange(startInput, '2026-01-01T00:00')
    })
    const callCountAfterStart = onParamsChange.mock.calls.length

    const endInput = dateInputs[1] as HTMLInputElement
    await act(async () => {
      triggerInputChange(endInput, '2026-02-01T00:00')
    })

    expect(onParamsChange).toHaveBeenCalled()
    const calls = onParamsChange.mock.calls.map(call => call[0])
    expect(calls.some((value: any) => value.backtestRangePreset === 'CUSTOM')).toBe(true)
    expect(callCountAfterStart).toBeGreaterThan(callCountAfterCustom)
    expect(onParamsChange.mock.calls.length).toBeGreaterThan(callCountAfterStart)
  })
})
