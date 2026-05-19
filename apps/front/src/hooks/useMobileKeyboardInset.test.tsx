/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { useMobileKeyboardInset } from './useMobileKeyboardInset'

interface MutableVisualViewport {
  height: number
  offsetTop: number
  addEventListener: jest.Mock
  removeEventListener: jest.Mock
}

describe('useMobileKeyboardInset', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>
  let listeners: Record<string, Array<() => void>>
  let viewport: MutableVisualViewport

  function Harness() {
    const keyboard = useMobileKeyboardInset({ enabled: true })
    return (
      <div
        data-testid="target"
        data-open={keyboard.isKeyboardOpen ? 'true' : 'false'}
        data-inset={keyboard.keyboardInset}
        style={keyboard.style}
      >
        <input onBlur={keyboard.onBlur} onFocus={keyboard.onFocus} />
      </div>
    )
  }

  function ContainerHarness() {
    const keyboard = useMobileKeyboardInset({ enabled: true })
    return (
      <div
        data-testid="container-target"
        data-open={keyboard.isKeyboardOpen ? 'true' : 'false'}
        data-inset={keyboard.keyboardInset}
        onBlur={keyboard.onBlur}
        onFocus={keyboard.onFocus}
        style={keyboard.style}
      >
        <input data-testid="first-input" />
        <input data-testid="second-input" />
      </div>
    )
  }

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    listeners = {}
    viewport = {
      height: 700,
      offsetTop: 0,
      addEventListener: jest.fn((event: string, listener: () => void) => {
        listeners[event] = [...(listeners[event] ?? []), listener]
      }),
      removeEventListener: jest.fn((event: string, listener: () => void) => {
        listeners[event] = (listeners[event] ?? []).filter(item => item !== listener)
      }),
    }
    Object.defineProperty(window, 'innerHeight', {
      configurable: true,
      value: 800,
    })
    Object.defineProperty(window, 'visualViewport', {
      configurable: true,
      value: viewport,
    })
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
    jest.useRealTimers()
  })

  it('tracks visual viewport keyboard inset while focused and resets after blur', () => {
    jest.useFakeTimers()

    act(() => {
      root.render(<Harness />)
    })

    const target = container.querySelector<HTMLElement>('[data-testid="target"]')
    const input = container.querySelector<HTMLInputElement>('input')

    expect(target?.dataset.inset).toBe('0')
    expect(target?.style.getPropertyValue('--mobile-keyboard-inset')).toBe('0px')

    act(() => {
      input?.focus()
    })
    expect(target?.dataset.open).toBe('true')
    expect(target?.dataset.inset).toBe('100')

    act(() => {
      viewport.height = 500
      listeners.resize?.forEach(listener => listener())
    })

    expect(target?.dataset.inset).toBe('300')
    expect(target?.style.getPropertyValue('--mobile-keyboard-inset')).toBe('300px')

    act(() => {
      input?.blur()
      jest.advanceTimersByTime(120)
    })

    expect(target?.dataset.open).toBe('false')
    expect(target?.dataset.inset).toBe('0')
  })

  it('keeps the inset while focus moves inside the same container', () => {
    jest.useFakeTimers()

    act(() => {
      root.render(<ContainerHarness />)
    })

    const target = container.querySelector<HTMLElement>('[data-testid="container-target"]')
    const firstInput = container.querySelector<HTMLInputElement>('[data-testid="first-input"]')
    const secondInput = container.querySelector<HTMLInputElement>('[data-testid="second-input"]')

    act(() => {
      firstInput?.focus()
    })

    expect(target?.dataset.open).toBe('true')
    expect(target?.dataset.inset).toBe('100')

    act(() => {
      secondInput?.focus()
      jest.advanceTimersByTime(120)
    })

    expect(target?.dataset.open).toBe('true')
    expect(target?.dataset.inset).toBe('100')
  })
})
