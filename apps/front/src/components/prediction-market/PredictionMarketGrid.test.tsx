/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { PredictionMarketGrid } from './PredictionMarketGrid'

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    i18n: { language: 'en' },
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key,
  }),
}))

jest.mock('@/hooks/use-mock-data', () => ({
  useMockData: () => ({
    data: [
      {
        id: 'market-1',
        title: 'Will BTC close above 100k?',
        options: [
          { label: 'Yes', probability: '0.62' },
          { label: 'No', probability: '0.38' },
        ],
        status: 'LIVE',
        volume24h: '1200',
        rules: { paragraphs: ['Market resolves on close.'] },
      },
    ],
    loading: false,
    error: null,
    reload: jest.fn(),
  }),
}))

jest.mock('@/lib/api', () => ({
  fetchPredictionMarkets: jest.fn(),
}))

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
  configurable: true,
  value: true,
})

describe('PredictionMarketGrid', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
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

  it('does not nest prediction card controls inside another button', async () => {
    await act(async () => {
      root.render(<PredictionMarketGrid />)
    })

    const buttons = Array.from(container.querySelectorAll('button'))

    expect(buttons.some(button => button.querySelector('button'))).toBe(false)
  })

  it.each([
    ['click', () => new MouseEvent('click', { bubbles: true })],
    ['Enter', () => new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })],
    ['Space', () => new KeyboardEvent('keydown', { key: ' ', bubbles: true })],
  ])('does not open details when an inner card button receives %s', async (_name, createEvent) => {
    await act(async () => {
      root.render(<PredictionMarketGrid />)
    })

    await act(async () => {
      container.querySelector('button')?.dispatchEvent(createEvent())
    })

    expect(document.body.textContent).not.toContain('predictionMarket.modal.title')
  })

  it.each([
    ['click', () => new MouseEvent('click', { bubbles: true })],
    ['Enter', () => new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })],
  ])('opens details when the card surface receives %s', async (_name, createEvent) => {
    await act(async () => {
      root.render(<PredictionMarketGrid />)
    })

    await act(async () => {
      container.querySelector<HTMLElement>('[role="button"]')?.dispatchEvent(createEvent())
    })

    expect(document.body.textContent).toContain('predictionMarket.modal.title')
  })
})
