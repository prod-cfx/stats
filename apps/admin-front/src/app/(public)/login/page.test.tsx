/** @jest-environment jsdom */

import { App } from 'antd'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

const loginAdmin = jest.fn()
const login = jest.fn()
const replace = jest.fn()
const push = jest.fn()

jest.mock('@/lib/api', () => ({
  loginAdmin,
}))

jest.mock('@/components/providers/AuthProvider', () => ({
  useAuth: () => ({
    login,
    session: null,
  }),
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push,
    replace,
  }),
}))

Object.defineProperty(globalThis, 'IS_REACT_ACT_ENVIRONMENT', {
  configurable: true,
  value: true,
})

describe('LoginPage bottom sheet', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    loginAdmin.mockReset()
    login.mockReset()
    push.mockReset()
    replace.mockReset()
    window.localStorage.clear()

    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: jest.fn(() => ({
        matches: false,
        addListener: jest.fn(),
        removeListener: jest.fn(),
        addEventListener: jest.fn(),
        removeEventListener: jest.fn(),
        dispatchEvent: jest.fn(),
      })),
    })

    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    container.remove()
  })

  it('opens login form from first-screen entry and submits credentials', async () => {
    const { default: LoginPage } = await import('./page')

    act(() => {
      root.render(
        <App>
          <LoginPage />
        </App>,
      )
    })

    const entryButton = container.querySelector('[data-testid="login-sheet-entry"]') as HTMLButtonElement
    expect(entryButton?.textContent).toContain('登录')
    expect(container.querySelector('[role="dialog"]')).toBeNull()

    act(() => {
      entryButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.querySelector('[role="dialog"]')?.textContent).toContain('管理员登录')

    loginAdmin.mockResolvedValueOnce({
      accessToken: 'token',
      admin: { id: 'admin-1', username: 'admin' },
    })

    act(() => {
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    })

    await act(async () => {
      await Promise.resolve()
    })

    expect(loginAdmin).toHaveBeenCalledWith({ username: 'admin', password: 'admin123' })
    expect(login).toHaveBeenCalledWith({
      accessToken: 'token',
      admin: { id: 'admin-1', username: 'admin' },
    })
    expect(push).toHaveBeenCalledWith('/dashboard')
  })

  it('keeps sheet layer hidden before first open', async () => {
    const { default: LoginPage } = await import('./page')

    act(() => {
      root.render(
        <App>
          <LoginPage />
        </App>,
      )
    })

    const layer = container.querySelector('.login-sheet-layer') as HTMLDivElement
    expect(layer.hidden).toBe(true)
    expect(container.querySelector('[role="dialog"]')).toBeNull()
  })

  it('closes with Escape and returns focus to entry button', async () => {
    const { default: LoginPage } = await import('./page')

    act(() => {
      root.render(
        <App>
          <LoginPage />
        </App>,
      )
    })

    const entryButton = container.querySelector('[data-testid="login-sheet-entry"]') as HTMLButtonElement
    act(() => {
      entryButton.focus()
      entryButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.querySelector('[role="dialog"]')).not.toBeNull()

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    })

    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(entryButton)
  })

  it('closes when clicking the sheet mask', async () => {
    const { default: LoginPage } = await import('./page')

    act(() => {
      root.render(
        <App>
          <LoginPage />
        </App>,
      )
    })

    const entryButton = container.querySelector('[data-testid="login-sheet-entry"]') as HTMLButtonElement
    act(() => {
      entryButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.querySelector('[role="dialog"]')).not.toBeNull()

    const mask = container.querySelector('.login-sheet-mask') as HTMLButtonElement
    act(() => {
      mask.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(entryButton)
  })

  it('closes when clicking the sheet close icon', async () => {
    const { default: LoginPage } = await import('./page')

    act(() => {
      root.render(
        <App>
          <LoginPage />
        </App>,
      )
    })

    const entryButton = container.querySelector('[data-testid="login-sheet-entry"]') as HTMLButtonElement
    act(() => {
      entryButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.querySelector('[role="dialog"]')).not.toBeNull()

    const closeButton = container.querySelector('.login-sheet-close') as HTMLButtonElement
    act(() => {
      closeButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    expect(container.querySelector('[role="dialog"]')).toBeNull()
    expect(document.activeElement).toBe(entryButton)
  })

  it('keeps keyboard focus inside the open sheet', async () => {
    const { default: LoginPage } = await import('./page')

    act(() => {
      root.render(
        <App>
          <LoginPage />
        </App>,
      )
    })

    const entryButton = container.querySelector('[data-testid="login-sheet-entry"]') as HTMLButtonElement
    act(() => {
      entryButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const dialog = container.querySelector('[role="dialog"]') as HTMLElement
    const closeButton = container.querySelector('.login-sheet-close') as HTMLButtonElement
    const submitButton = container.querySelector('button[type="submit"]') as HTMLButtonElement

    act(() => {
      submitButton.focus()
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    })
    expect(document.activeElement).toBe(closeButton)

    act(() => {
      closeButton.focus()
      dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }))
    })
    expect(document.activeElement).toBe(submitButton)
  })

  it('moves the mobile login sheet above the visual viewport keyboard', async () => {
    const listeners: Record<string, Array<() => void>> = {}
    const visualViewport = {
      height: 560,
      offsetTop: 0,
      addEventListener: jest.fn((event: string, listener: () => void) => {
        listeners[event] = [...(listeners[event] ?? []), listener]
      }),
      removeEventListener: jest.fn(),
    }
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 })
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: visualViewport })
    const { default: LoginPage } = await import('./page')

    act(() => {
      root.render(
        <App>
          <LoginPage />
        </App>,
      )
    })

    const entryButton = container.querySelector('[data-testid="login-sheet-entry"]') as HTMLButtonElement
    act(() => {
      entryButton.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    })

    const dialog = container.querySelector<HTMLElement>('[role="dialog"]')
    const usernameInput = dialog?.querySelector<HTMLInputElement>('input[autocomplete="username"]')

    act(() => {
      usernameInput?.focus()
      listeners.resize?.forEach(listener => listener())
    })

    expect(dialog?.style.getPropertyValue('--mobile-keyboard-inset')).toBe('240px')
    expect(dialog?.className).toContain('login-sheet--keyboard-aware')
  })
})
