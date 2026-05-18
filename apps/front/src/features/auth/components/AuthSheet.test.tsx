/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

const onOpenChangeMock = jest.fn()
const onSuccessMock = jest.fn()

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue ?? key }),
}))

jest.mock('@/features/auth/api', () => ({
  getTelegramLoginConfigRequest: jest.fn(async () => ({ betaCodeGateEnabled: false, botName: 'coinflux_bot' })),
}))

jest.mock('@/features/auth/components/EmailOtpForm', () => ({
  EmailOtpForm: ({
    betaCode,
    onBetaCodeChange,
    onSuccess,
  }: {
    betaCode?: string
    onBetaCodeChange?: (value: string) => void
    onSuccess: () => void
  }) => (
    <div>
      <input disabled data-testid="beta-code-proxy" value={betaCode ?? ''} onChange={event => onBetaCodeChange?.(event.target.value)} />
      <div data-testid="set-beta-code" onClick={() => onBetaCodeChange?.('beta-42')} />
      <button type="button" data-testid="email-success" onClick={onSuccess}>
        email-form
      </button>
    </div>
  ),
}))

jest.mock('@/features/auth/components/TelegramLoginButtons', () => ({
  TelegramLoginButtons: ({ redirect }: { redirect?: string }) => (
    <div data-testid="telegram-buttons" data-redirect={redirect}>
      telegram-buttons
    </div>
  ),
}))

describe('AuthSheet', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    onOpenChangeMock.mockReset()
    onSuccessMock.mockReset()
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

  it('renders nothing when closed', async () => {
    const { AuthSheet } = await import('./AuthSheet')

    act(() => {
      root.render(<AuthSheet open={false} lng="zh" onOpenChange={onOpenChangeMock} />)
    })

    expect(container.querySelector('[data-testid="auth-sheet-panel"]')).toBeNull()
  })

  it('renders mobile sheet and desktop dialog classes with theme tokens', async () => {
    const { AuthSheet } = await import('./AuthSheet')

    act(() => {
      root.render(
        <AuthSheet
          open
          lng="zh"
          redirect="/zh/ai-quant"
          onOpenChange={onOpenChangeMock}
          onSuccess={onSuccessMock}
        />,
      )
    })

    await act(async () => {
      await Promise.resolve()
    })

    const panel = container.querySelector('[data-testid="auth-sheet-panel"]')
    const backdrop = container.querySelector('[data-testid="auth-sheet-backdrop"]')
    const close = container.querySelector('[data-testid="auth-sheet-close"]')
    const telegram = container.querySelector('[data-testid="telegram-buttons"]')

    expect(backdrop?.className).toContain('fixed')
    expect(panel?.getAttribute('role')).toBe('dialog')
    expect(panel?.getAttribute('aria-modal')).toBe('true')
    expect(panel?.className).toContain('cf-mobile-login-sheet')
    expect(panel?.className).toContain('rounded-t-[28px]')
    expect(panel?.className).toContain('md:rounded-lg')
    expect(panel?.className).toContain('bg-[color:var(--cf-surface)]')
    expect(panel?.className).not.toContain('bg-white')
    expect(close?.className).toContain('h-10')
    expect(telegram?.getAttribute('data-redirect')).toBe('/zh/ai-quant')
  })

  it('closes when close is clicked and calls onSuccess after email success', async () => {
    const { AuthSheet } = await import('./AuthSheet')

    act(() => {
      root.render(
        <AuthSheet
          open
          lng="zh"
          redirect="/zh/account"
          onOpenChange={onOpenChangeMock}
          onSuccess={onSuccessMock}
        />,
      )
    })

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="auth-sheet-close"]')?.click()
    })
    expect(onOpenChangeMock).toHaveBeenCalledWith(false)

    await act(async () => {
      container.querySelector<HTMLButtonElement>('[data-testid="email-success"]')?.click()
    })
    expect(onSuccessMock).toHaveBeenCalledWith('/zh/account')
  })

  it('clears beta code when closed before the next open', async () => {
    const { AuthSheet } = await import('./AuthSheet')

    await act(async () => {
      root.render(<AuthSheet open lng="zh" onOpenChange={onOpenChangeMock} />)
      await Promise.resolve()
    })

    await act(async () => {
      container.querySelector<HTMLElement>('[data-testid="set-beta-code"]')?.click()
    })
    expect(container.querySelector<HTMLInputElement>('[data-testid="beta-code-proxy"]')?.value).toBe('beta-42')

    await act(async () => {
      root.render(<AuthSheet open={false} lng="zh" onOpenChange={onOpenChangeMock} />)
    })
    await act(async () => {
      root.render(<AuthSheet open lng="zh" onOpenChange={onOpenChangeMock} />)
      await Promise.resolve()
    })

    expect(container.querySelector<HTMLInputElement>('[data-testid="beta-code-proxy"]')?.value).toBe('')
  })

  it('uses non-modal semantics for fallback pages', async () => {
    const { AuthSheet } = await import('./AuthSheet')

    act(() => {
      root.render(<AuthSheet open fallbackPage lng="zh" onOpenChange={onOpenChangeMock} />)
    })

    const panel = container.querySelector('[data-testid="auth-sheet-panel"]')

    expect(container.querySelector('[data-testid="auth-sheet-backdrop"]')).toBeNull()
    expect(panel?.getAttribute('role')).toBe('region')
    expect(panel?.getAttribute('aria-modal')).not.toBe('true')
  })

  it('closes on Escape and traps Tab inside non-fallback modal', async () => {
    const { AuthSheet } = await import('./AuthSheet')

    act(() => {
      root.render(<AuthSheet open lng="zh" onOpenChange={onOpenChangeMock} />)
    })

    const close = container.querySelector<HTMLButtonElement>('[data-testid="auth-sheet-close"]')
    const emailSuccess = container.querySelector<HTMLButtonElement>('[data-testid="email-success"]')

    expect(document.activeElement).toBe(close)

    await act(async () => {
      close?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    })
    expect(document.activeElement).toBe(emailSuccess)

    await act(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onOpenChangeMock).toHaveBeenCalledWith(false)
  })
})
