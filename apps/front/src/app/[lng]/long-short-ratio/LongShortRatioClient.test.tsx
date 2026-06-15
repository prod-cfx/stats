/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { LongShortRatioClient } from './LongShortRatioClient'

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'zh' },
    t: (key: string, values?: Record<string, string>) => values?.symbol ? `${key}:${values.symbol}` : key,
  }),
}))

jest.mock('@/lib/api', () => ({
  fetchExchangeLongShortRatio: jest.fn(async () => []),
}))

describe('LongShortRatioClient filters', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
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

  it('keeps filters horizontally scrollable on mobile and outside clipping overflow on desktop', async () => {
    await act(async () => {
      root.render(<LongShortRatioClient />)
    })

    const symbolButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent?.includes('BTC'))
    const toolbar = symbolButton?.parentElement?.parentElement?.parentElement

    expect(toolbar).not.toBeNull()
    expect(toolbar?.className).toContain('overflow-x-auto')
    expect(toolbar?.className).toContain('md:overflow-visible')
  })

  it('renders filter menus outside the scrollable toolbar', async () => {
    await act(async () => {
      root.render(<LongShortRatioClient />)
    })

    const symbolButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent?.includes('BTC'))
    const toolbar = symbolButton?.parentElement?.parentElement?.parentElement

    expect(symbolButton).toBeDefined()
    expect(toolbar).not.toBeNull()

    await act(async () => {
      symbolButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const solOption = Array.from(document.body.querySelectorAll('button'))
      .find(button => button.textContent === 'SOL')

    expect(solOption).toBeDefined()
    expect(toolbar?.contains(solOption ?? null)).toBe(false)
  })
})
