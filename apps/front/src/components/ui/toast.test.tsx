/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { ToastProvider, useToast } from './toast'

function ToastTrigger() {
  const { success } = useToast()

  return (
    <button
      type="button"
      onClick={() => success('Saved')}
    >
      Show toast
    </button>
  )
}

describe('ToastProvider timers', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    ;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    jest.useFakeTimers()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    await act(async () => {
      root.unmount()
    })
    jest.useRealTimers()
    container.remove()
  })

  it('clears pending auto-dismiss timers on provider unmount', async () => {
    const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout')

    await act(async () => {
      root.render(
        <ToastProvider>
          <ToastTrigger />
        </ToastProvider>,
      )
    })

    await act(async () => {
      container.querySelector('button')?.click()
    })

    await act(async () => {
      root.unmount()
    })

    expect(clearTimeoutSpy).toHaveBeenCalled()
    clearTimeoutSpy.mockRestore()
  })
})
