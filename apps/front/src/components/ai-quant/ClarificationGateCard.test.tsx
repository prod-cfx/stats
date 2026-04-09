/** @jest-environment jsdom */

import { describe, expect, it, jest } from '@jest/globals'
import React from 'react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { ClarificationGateCard } from './ClarificationGateCard'

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

describe('ClarificationGateCard', () => {
  it('renders the current pending clarification and submits a structured answer', async () => {
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
})
