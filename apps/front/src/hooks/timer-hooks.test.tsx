/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { useEventListener } from './useEventListener'
import { useInterval } from './useInterval'
import { useTimeout } from './useTimeout'

describe('timer and listener hooks', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    jest.useFakeTimers()
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
    jest.useRealTimers()
  })

  it('runs the latest interval callback and clears the interval on unmount', () => {
    const calls: number[] = []

    function Probe() {
      const [value, setValue] = useState(1)
      useInterval(() => calls.push(value), 100)
      return <button type="button" onClick={() => setValue(2)}>update</button>
    }

    act(() => {
      root.render(<Probe />)
    })

    act(() => {
      jest.advanceTimersByTime(100)
    })
    act(() => {
      container.querySelector('button')?.click()
    })
    act(() => {
      jest.advanceTimersByTime(100)
    })

    act(() => {
      root.unmount()
    })
    act(() => {
      jest.advanceTimersByTime(300)
    })

    expect(calls).toEqual([1, 2])
  })

  it('runs timeout once and cancels it on unmount', () => {
    const onTimeout = jest.fn()

    function Probe() {
      useTimeout(onTimeout, 100)
      return null
    }

    act(() => {
      root.render(<Probe />)
    })
    act(() => {
      root.unmount()
    })

    act(() => {
      jest.advanceTimersByTime(100)
    })

    expect(onTimeout).not.toHaveBeenCalled()
  })

  it('subscribes to and cleans up DOM event listeners', () => {
    const onResize = jest.fn()

    function Probe() {
      useEventListener(window, 'resize', onResize)
      return null
    }

    act(() => {
      root.render(<Probe />)
    })

    window.dispatchEvent(new Event('resize'))
    act(() => {
      root.unmount()
    })
    window.dispatchEvent(new Event('resize'))

    expect(onResize).toHaveBeenCalledTimes(1)
  })
})
