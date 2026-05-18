/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { EmailOtpForm } from './components/EmailOtpForm'
import { TelegramLoginButtons } from './components/TelegramLoginButtons'

const sendEmailCodeMock = jest.fn()
const loginWithEmailCodeMock = jest.fn()
const createTelegramDesktopIntentMock = jest.fn()

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('lucide-react', () => ({
  Send: () => null,
}))

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    sendEmailCode: sendEmailCodeMock,
    loginWithEmailCode: loginWithEmailCodeMock,
    createTelegramDesktopIntent: createTelegramDesktopIntentMock,
  }),
}))

jest.mock('./telegram-env', () => ({
  canShowTelegramDesktopEntry: () => true,
  isTelegramWebAppEnv: () => false,
}))

jest.mock('./api', () => ({
  getTelegramWebAuthorizeUrlRequest: jest.fn(),
  getTelegramLoginConfigRequest: jest.fn(async () => ({
    botName: 'cfx_login_staging_bot',
  })),
}))

async function fillEmail(container: HTMLElement, value = 'user@example.com') {
  const inputs = Array.from(container.querySelectorAll('input'))
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(inputs[0], value)
    inputs[0]!.dispatchEvent(new Event('input', { bubbles: true }))
    await Promise.resolve()
  })
  return inputs
}

async function sendCode(container: HTMLElement) {
  const sendButton = Array.from(container.querySelectorAll('button')).find(
    button => button.textContent === 'auth.sendCode',
  )
  await act(async () => {
    sendButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await Promise.resolve()
  })
}

async function fillCodeAndSubmit(container: HTMLElement, code = '123456') {
  const inputs = Array.from(container.querySelectorAll('input'))
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set?.call(inputs[1], code)
    inputs[1]!.dispatchEvent(new Event('input', { bubbles: true }))
    container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    await Promise.resolve()
  })
}

describe('beta code login flow', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot> | null

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    sendEmailCodeMock.mockResolvedValue(undefined)
    loginWithEmailCodeMock.mockResolvedValue(undefined)
    createTelegramDesktopIntentMock.mockResolvedValue({
      intentId: 'intent-1',
      deepLink: 'tg://resolve?domain=cfx_login_staging_bot&start=cfx_login_abc123',
      webLink: 'https://t.me/cfx_login_staging_bot?start=cfx_login_abc123',
      callbackUrl: 'https://front.example.test/zh/auth/telegram/callback?source=desktop&intent=login&desktop_intent=intent-1',
      expiresInSeconds: 300,
    })
    const apiMock = jest.requireMock('./api') as {
      getTelegramWebAuthorizeUrlRequest: jest.Mock
    }
    apiMock.getTelegramWebAuthorizeUrlRequest.mockResolvedValue({
      authorizeUrl: 'https://oauth.telegram.org/auth?bot_id=1',
    })
    jest.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount()
      })
      root = null
    }
    jest.restoreAllMocks()
    jest.clearAllMocks()
    window.sessionStorage.clear()
    document.body.innerHTML = ''
  })

  it('renders beta code field in the email form', async () => {
    await act(async () => {
      root?.render(<EmailOtpForm betaCode="" betaCodeGateEnabled onBetaCodeChange={() => {}} onSuccess={() => {}} />)
    })

    const betaCodeLabel = Array.from(container.querySelectorAll('label'))
      .find(label => label.textContent === 'auth.betaCode') as HTMLLabelElement | undefined
    expect(betaCodeLabel?.control).toBe(container.querySelector('#beta-code-input'))
    expect(container.textContent).toContain('auth.betaCodeHint')
  })

  it('hides beta code field in the email form when beta gate is disabled', async () => {
    await act(async () => {
      root?.render(<EmailOtpForm betaCode="" betaCodeGateEnabled={false} onBetaCodeChange={() => {}} onSuccess={() => {}} />)
    })

    expect(container.querySelector('#beta-code-input')).toBeNull()
    expect(container.textContent).not.toContain('auth.betaCode')
    expect(container.textContent).not.toContain('auth.betaCodeHint')
  })

  it('passes beta code when submitting an email code login', async () => {
    await act(async () => {
      root?.render(<EmailOtpForm betaCode=" beta-42 " betaCodeGateEnabled onBetaCodeChange={() => {}} onSuccess={() => {}} />)
    })

    await fillEmail(container, 'User@Example.COM ')
    await sendCode(container)
    await fillCodeAndSubmit(container)

    expect(loginWithEmailCodeMock).toHaveBeenCalledWith('user@example.com', '123456', ' beta-42 ')
  })

  it('rejects malformed email before requesting a code', async () => {
    await act(async () => {
      root?.render(<EmailOtpForm betaCode="" betaCodeGateEnabled={false} onBetaCodeChange={() => {}} onSuccess={() => {}} />)
    })

    await fillEmail(container, 'foo@')
    await act(async () => {
      container.querySelector('form')?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await Promise.resolve()
    })

    expect(sendEmailCodeMock).not.toHaveBeenCalled()
    expect(loginWithEmailCodeMock).not.toHaveBeenCalled()
    expect(container.textContent).toContain('auth.emailOtpErrors.invalidEmail')
  })

  it('shows get beta code hint when email login fails without a beta code', async () => {
    await act(async () => {
      root?.render(<EmailOtpForm betaCode="" betaCodeGateEnabled onBetaCodeChange={() => {}} onSuccess={() => {}} />)
    })

    await fillEmail(container)
    await sendCode(container)
    await fillCodeAndSubmit(container)

    expect(container.textContent).toContain('auth.betaCodeRequired')
    expect(container.textContent).not.toContain('HTTP_400')
    expect(loginWithEmailCodeMock).not.toHaveBeenCalled()
  })

  it('shows localized email code errors from backend code without raw backend text', async () => {
    loginWithEmailCodeMock.mockRejectedValueOnce(
      Object.assign(new Error('Verification code is invalid'), {
        code: 'AUTH_VERIFICATION_CODE_INVALID',
        statusCode: 400,
      }),
    )

    await act(async () => {
      root?.render(<EmailOtpForm betaCode="beta-42" betaCodeGateEnabled onBetaCodeChange={() => {}} onSuccess={() => {}} />)
    })

    await fillEmail(container)
    await sendCode(container)
    await fillCodeAndSubmit(container)

    expect(container.textContent).toContain('auth.emailOtpErrors.invalidCode')
    expect(container.textContent).not.toContain('Verification code is invalid')
    expect(container.textContent).not.toContain('AUTH_VERIFICATION_CODE_INVALID')
  })

  it('falls back to localized login failure for unknown auth errors without raw codes', async () => {
    loginWithEmailCodeMock.mockRejectedValueOnce(
      Object.assign(new Error('API_ERROR'), {
        code: 'API_ERROR',
        statusCode: 500,
      }),
    )

    await act(async () => {
      root?.render(<EmailOtpForm betaCode="beta-42" betaCodeGateEnabled onBetaCodeChange={() => {}} onSuccess={() => {}} />)
    })

    await fillEmail(container)
    await sendCode(container)
    await fillCodeAndSubmit(container)

    expect(container.textContent).toContain('auth.loginFailed')
    expect(container.textContent).not.toContain('API_ERROR')
  })

  it('allows Telegram login intent when beta code is missing', async () => {
    window.sessionStorage.setItem('auth:telegram:betaCode', 'STALE-CODE')

    await act(async () => {
      root?.render(<TelegramLoginButtons lng="zh" intent="login" betaCode="   " />)
    })
    await act(async () => {
      await Promise.resolve()
    })

    const webButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent?.includes('auth.telegramWeb'))
    const desktopButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent?.includes('auth.telegramDesktop'))

    await act(async () => {
      webButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      desktopButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    const apiMock = jest.requireMock('./api') as {
      getTelegramWebAuthorizeUrlRequest: jest.Mock
    }
    expect(apiMock.getTelegramWebAuthorizeUrlRequest).toHaveBeenCalledWith({
      intent: 'login',
      lng: 'zh',
      redirect: undefined,
    })
    expect(createTelegramDesktopIntentMock).toHaveBeenCalledWith({
      intent: 'login',
      lng: 'zh',
      redirect: undefined,
    })
    expect(window.sessionStorage.getItem('auth:telegram:betaCode')).toBeNull()
    expect(window.sessionStorage.getItem('auth:telegram:desktop:intent-1:betaCode')).toBeNull()
    expect(container.textContent).not.toContain('auth.betaCodeRequired')
  })
})
