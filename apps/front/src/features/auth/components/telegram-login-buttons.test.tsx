/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { TelegramLoginButtons } from './TelegramLoginButtons'

const createTelegramDesktopIntentMock = jest.fn()

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))

jest.mock('lucide-react', () => ({
  Send: () => null,
}))

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    createTelegramDesktopIntent: createTelegramDesktopIntentMock,
  }),
}))

jest.mock('../telegram-env', () => ({
  canShowTelegramDesktopEntry: () => true,
  isTelegramWebAppEnv: () => false,
}))

jest.mock('../api', () => ({
  getTelegramWebAuthorizeUrlRequest: jest.fn(),
  getTelegramLoginConfigRequest: jest.fn(async () => ({
    botName: 'cfx_login_staging_bot',
  })),
}))

describe('TelegramLoginButtons desktop flow', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot> | null

  beforeEach(() => {
    ;(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)

    createTelegramDesktopIntentMock.mockResolvedValue({
      intentId: 'intent-1',
      deepLink: 'tg://resolve?domain=cfx_login_staging_bot&start=cfx_login_abc123',
      webLink: 'https://t.me/cfx_login_staging_bot?start=cfx_login_abc123',
      callbackUrl: 'https://front.example.test/zh/auth/telegram/callback?source=desktop&intent=login&desktop_intent=intent-1',
      expiresInSeconds: 300,
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
    document.body.innerHTML = ''
  })

  it('should not auto-redirect to callback via timeout after launching desktop app', async () => {
    const timeoutSpy = jest.spyOn(window, 'setTimeout')

    await act(async () => {
      root?.render(<TelegramLoginButtons lng="zh" intent="login" />)
    })

    await act(async () => {
      await Promise.resolve()
    })

    const desktopButton = Array.from(container.querySelectorAll('button'))
      .find(button => button.textContent?.includes('auth.telegramDesktop'))

    expect(desktopButton).toBeTruthy()

    await act(async () => {
      desktopButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
      await Promise.resolve()
    })

    expect(createTelegramDesktopIntentMock).toHaveBeenCalledWith({
      intent: 'login',
      lng: 'zh',
      redirect: undefined,
    })
    expect(timeoutSpy).not.toHaveBeenCalled()
  })
})
