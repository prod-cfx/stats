/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { ClarificationGateCard } from './ClarificationGateCard'

jest.mock('react-i18next', () => ({
  // eslint-disable-next-line react-hooks-extra/no-unnecessary-use-prefix
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => {
      const translations: Record<string, string> = {
        'aiQuant.clarificationGateTitle': '需要补充澄清',
        'aiQuant.clarificationGateInputPlaceholder': '请输入补充信息',
        'aiQuant.clarificationGateSubmit': '提交澄清',
      }
      return translations[key] ?? options?.defaultValue ?? key
    },
  }),
}))

describe('ClarificationGateCard', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot> | null

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount()
      })
      root = null
    }
    document.body.innerHTML = ''
  })

  it('renders localized freeform clarification copy instead of the english fallback and trims answers', async () => {
    const onAnswer = jest.fn()

    await act(async () => {
      root?.render(
        <ClarificationGateCard
          gate={{
            blocked: true,
            items: [
              {
                key: 'symbol',
                field: 'symbol',
                reason: 'missing symbol',
                question: '请确认交易对',
                blocking: true,
                status: 'pending',
              },
            ],
          }}
          onAnswer={onAnswer}
        />,
      )
    })

    expect(container.textContent).toContain('需要补充澄清')
    expect(container.textContent).toContain('提交澄清')
    expect(container.textContent).not.toContain('Submit')

    const input = container.querySelector(
      '[data-testid="clarification-freeform-input"]',
    ) as HTMLInputElement | null
    const submit = container.querySelector(
      '[data-testid="clarification-freeform-submit"]',
    ) as HTMLButtonElement | null

    expect(input?.placeholder).toBe('请输入补充信息')
    expect(submit?.disabled).toBe(true)

    await act(async () => {
      if (!input) return
      Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')
        ?.set?.call(input, '  BTCUSDT  ')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })

    expect(submit?.disabled).toBe(false)

    await act(async () => {
      submit?.click()
    })

    expect(onAnswer).toHaveBeenCalledWith('symbol', 'BTCUSDT')
  })
})
