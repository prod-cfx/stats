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

  it('keeps symbol and time dropdown menus outside clipping overflow', async () => {
    await act(async () => {
      root.render(<LongShortRatioClient />)
    })

    const symbolButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent?.includes('BTC'))
    const toolbar = symbolButton?.parentElement?.parentElement?.parentElement

    expect(toolbar).not.toBeNull()
    expect(toolbar?.className).not.toContain('overflow-x-auto')
    expect(toolbar?.className).toContain('overflow-visible')
  })
})
