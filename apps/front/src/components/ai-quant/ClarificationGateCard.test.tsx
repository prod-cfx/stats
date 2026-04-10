/** @jest-environment jsdom */

import { describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { ClarificationGateCard } from './ClarificationGateCard'

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe('ClarificationGateCard', () => {
  it('renders the current pending clarification and submits a structured answer', async () => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const onAnswer = jest.fn()

    await act(async () => {
      root.render(
        <ClarificationGateCard
          gate={{
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
          onAnswer={onAnswer}
        />,
      )
    })

    expect(container.textContent).toContain('这条策略包含做空，请确认使用现货还是合约/永续？')

    await act(async () => {
      Array.from(container.querySelectorAll('button'))
        .find(button => button.textContent === 'perp')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onAnswer).toHaveBeenCalledWith('market.marketType', 'perp')

    await act(async () => {
      root.unmount()
    })
    document.body.innerHTML = ''
  })

  it('renders a free-form clarification input when no allowed answers are provided', async () => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const onAnswer = jest.fn()

    await act(async () => {
      root.render(
        <ClarificationGateCard
          gate={{
            blocked: true,
            items: [
              {
                key: 'riskRules.earlyStop.action',
                field: 'riskRules.earlyStop.action',
                reason: 'missing_early_stop_action',
                question: '请补充连续 3 根 K 线跌破布林带下轨时的处理动作',
                blocking: true,
                status: 'pending',
              },
            ],
          }}
          onAnswer={onAnswer}
        />,
      )
    })

    const input = container.querySelector(
      '[data-testid="clarification-freeform-input"]',
    ) as HTMLInputElement | null
    expect(input).not.toBeNull()

    await act(async () => {
      if (input) {
        Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
          ?.set
          ?.call(input, '减半仓位')
        input.dispatchEvent(new Event('input', { bubbles: true }))
        input.dispatchEvent(new Event('change', { bubbles: true }))
      }
    })

    await act(async () => {
      container
        .querySelector('[data-testid="clarification-freeform-submit"]')
        ?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(onAnswer).toHaveBeenCalledWith('riskRules.earlyStop.action', '减半仓位')

    await act(async () => {
      root.unmount()
    })
    document.body.innerHTML = ''
  })
})
