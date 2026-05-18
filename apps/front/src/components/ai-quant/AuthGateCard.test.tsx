/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { AuthGateCard } from './AuthGateCard'

const mockOpenAuth = jest.fn()

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) =>
      ({
        'aiQuant.authGate.title': 'Sign in required',
        'aiQuant.authGate.description': 'Sign in to continue.',
        'aiQuant.authGate.login': 'Login',
      })[key] ?? key,
  }),
}))

jest.mock('@/features/auth/AuthSheetProvider', () => ({
  useAuthSheet: () => ({ openAuth: mockOpenAuth }),
}))

describe('AuthGateCard', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    mockOpenAuth.mockReset()
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

  it('opens auth sheet instead of linking to login', async () => {
    await act(async () => {
      root.render(<AuthGateCard lng="zh" />)
    })

    expect(container.querySelector('a[href="/zh/auth/login"]')).toBeNull()

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button')?.click()
    })

    expect(mockOpenAuth).toHaveBeenCalledWith({ lng: 'zh', redirect: '/zh/ai-quant' })
  })
})
