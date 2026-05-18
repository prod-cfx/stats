/** @jest-environment jsdom */

import { App } from 'antd'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'

const login = jest.fn()
const replace = jest.fn()
const push = jest.fn()
const registerAdmin = jest.fn()

jest.mock('@/lib/api', () => ({
  registerAdmin,
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

describe('RegisterPage auth card', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    registerAdmin.mockReset()
    login.mockReset()
    push.mockReset()
    replace.mockReset()

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

  it('renders the shared auth card without the login sheet layout', async () => {
    const { default: RegisterPage } = await import('./page')

    act(() => {
      root.render(
        <App>
          <RegisterPage />
        </App>,
      )
    })

    expect(container.querySelector('.center-container')).not.toBeNull()
    expect(container.querySelector('.auth-card')?.textContent).toContain('创建管理员')
    expect(container.querySelector('.login-sheet-layer')).toBeNull()
    expect(container.querySelector('button[type="submit"]')?.textContent).toContain('注册并登录')
  })
})
