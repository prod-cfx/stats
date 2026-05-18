/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

const replaceMock = jest.fn()

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
}))

jest.mock('@/features/auth/components/AuthSheet', () => ({
  AuthSheet: ({
    open,
    redirect,
    onOpenChange,
    onSuccess,
  }: {
    open: boolean
    redirect?: string
    onOpenChange: (open: boolean) => void
    onSuccess?: (redirect?: string) => void
  }) =>
    open ? (
      <div data-testid="auth-sheet" data-redirect={redirect}>
        <button type="button" data-testid="close-auth" onClick={() => onOpenChange(false)}>
          close
        </button>
        <button type="button" data-testid="success-auth" onClick={() => onSuccess?.(redirect)}>
          success
        </button>
      </div>
    ) : null,
}))

describe('AuthSheetProvider', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    replaceMock.mockReset()
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

  it('opens, closes, and redirects after success', async () => {
    const { AuthSheetProvider, useAuthSheet } = await import('./AuthSheetProvider')

    function Harness() {
      const { openAuth } = useAuthSheet()
      return (
        <button type="button" data-testid="open-auth" onClick={() => openAuth({ lng: 'zh', redirect: '/zh/ai-quant' })}>
          open
        </button>
      )
    }

    act(() => {
      root.render(
        <AuthSheetProvider>
          <Harness />
        </AuthSheetProvider>,
      )
    })

    expect(container.querySelector('[data-testid="auth-sheet"]')).toBeNull()

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="open-auth"]')?.click()
    })
    expect(container.querySelector('[data-testid="auth-sheet"]')?.getAttribute('data-redirect')).toBe('/zh/ai-quant')

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="close-auth"]')?.click()
    })
    expect(container.querySelector('[data-testid="auth-sheet"]')).toBeNull()

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="open-auth"]')?.click()
    })
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="success-auth"]')?.click()
    })
    expect(container.querySelector('[data-testid="auth-sheet"]')).toBeNull()
    expect(replaceMock).toHaveBeenCalledWith('/zh/ai-quant')
  })

  it.each([
    'https://evil.example/zh/account',
    '//evil.example/zh/account',
    '/en/account',
    'javascript:alert(1)',
    '',
  ])('does not redirect to unsafe target %s', async unsafeRedirect => {
    const { AuthSheetProvider, useAuthSheet } = await import('./AuthSheetProvider')

    function Harness() {
      const { openAuth } = useAuthSheet()
      return (
        <button type="button" data-testid="open-auth" onClick={() => openAuth({ lng: 'zh', redirect: unsafeRedirect })}>
          open
        </button>
      )
    }

    act(() => {
      root.render(
        <AuthSheetProvider>
          <Harness />
        </AuthSheetProvider>,
      )
    })

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="open-auth"]')?.click()
    })
    expect(container.querySelector('[data-testid="auth-sheet"]')?.getAttribute('data-redirect')).toBeNull()
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="success-auth"]')?.click()
    })

    expect(replaceMock).not.toHaveBeenCalled()
  })

  it('allows localized root query redirects', async () => {
    const { AuthSheetProvider, useAuthSheet } = await import('./AuthSheetProvider')

    function Harness() {
      const { openAuth } = useAuthSheet()
      return (
        <button type="button" data-testid="open-auth" onClick={() => openAuth({ lng: 'zh', redirect: '/zh?from=nav' })}>
          open
        </button>
      )
    }

    act(() => {
      root.render(
        <AuthSheetProvider>
          <Harness />
        </AuthSheetProvider>,
      )
    })

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="open-auth"]')?.click()
    })
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="success-auth"]')?.click()
    })

    expect(replaceMock).toHaveBeenCalledWith('/zh?from=nav')
  })

  it('navigates to safe fallback when a protected auth sheet is closed', async () => {
    const { AuthSheetProvider, useAuthSheet } = await import('./AuthSheetProvider')

    function Harness() {
      const { openAuth } = useAuthSheet()
      return (
        <button
          type="button"
          data-testid="open-auth"
          onClick={() => openAuth({ lng: 'zh', redirect: '/zh/account', closeRedirect: '/zh' })}
        >
          open
        </button>
      )
    }

    act(() => {
      root.render(
        <AuthSheetProvider>
          <Harness />
        </AuthSheetProvider>,
      )
    })

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="open-auth"]')?.click()
    })
    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="close-auth"]')?.click()
    })

    expect(replaceMock).toHaveBeenCalledWith('/zh')
  })
})
