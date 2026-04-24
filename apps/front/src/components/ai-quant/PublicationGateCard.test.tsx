/** @jest-environment jsdom */

import { describe, expect, it } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { PublicationGateCard } from './PublicationGateCard'

describe('PublicationGateCard', () => {
  it('renders expected vs actual values when publish gate blocks venue drift', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <PublicationGateCard
          gate={{
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
        />,
      )
    })

    expect(container.textContent).toContain('exchange')
    expect(container.textContent).toContain('okx')
    expect(container.textContent).toContain('binance')
    expect(container.textContent).toContain('confirmed snapshot and compiled artifact exchange mismatch')

    await act(async () => {
      root.unmount()
    })
    document.body.innerHTML = ''
  })
})
