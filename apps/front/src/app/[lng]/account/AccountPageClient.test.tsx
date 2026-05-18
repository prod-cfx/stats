/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { AccountPageClient } from './AccountPageClient'

const mockReplace = jest.fn()
const mockLogout = jest.fn()
const mockSendEmailCode = jest.fn()
const mockBindEmail = jest.fn()
const mockSuccess = jest.fn()
const mockError = jest.fn()
const mockOpenAuth = jest.fn()
const setInputValue = (input: HTMLInputElement, value: string) => {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
  setter?.call(input, value)
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}
let mockSession = {
  email: '15demo@qq.com',
  loginMethods: ['email'],
  userId: 'cmp0uen6800016kg5d1k4bk2e',
} as {
  email?: string
  loginMethods: string[]
  userId: string
  telegram?: { username: string }
}

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => new URLSearchParams('tab=settings'),
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'account.accountInfo': 'Account',
        'account.hideEmail': 'Hide email',
        'account.logout': 'Logout',
        'account.mainAccount': 'Main account',
        'account.settings': 'Settings',
        'account.showEmail': 'Show email',
        'account.telegramDesktopAvailable': 'Desktop available',
        'account.telegramLogin': 'Telegram Login',
        'account.title': 'Account Center',
        'account.userId': 'UserId',
        'account.userIdCopied': 'Copied',
        'account.inputEmail': 'Email',
        'account.inputCode': 'Code',
        'account.sendCode': 'Send Code',
        'account.bindEmail': 'Bind Email',
        'account.bindEmailFailed': 'Failed to bind email',
        'account.sendCodeFailed': 'Failed to send code',
        'aiQuant.apiConfigDesc': 'Configure exchange credentials.',
        'aiQuant.apiConfigTitle': 'Exchange API Configuration',
        'aiQuant.title': 'AI Quant',
        'common.copy': 'Copy',
      }
      return translations[key] ?? key
    },
  }),
}))

jest.mock('@/components/ui/toast', () => ({
  useToast: () => ({ error: mockError, success: mockSuccess }),
}))

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    bindEmail: mockBindEmail,
    isLoading: false,
    logout: mockLogout,
    sendEmailCode: mockSendEmailCode,
    session: mockSession,
  }),
}))

jest.mock('@/features/auth/AuthSheetProvider', () => ({
  useAuthSheet: () => ({ openAuth: mockOpenAuth }),
}))

jest.mock('@/components/account/ExchangeApiSection', () => ({
  ExchangeApiSection: () => <div data-testid="exchange-api-section" />,
}))

jest.mock('@/components/account/AiQuantSection', () => ({
  AiQuantSection: () => <div data-testid="ai-quant-section" />,
}))

jest.mock('@/features/auth/components/TelegramLoginButtons', () => ({
  TelegramLoginButtons: ({
    onAvailabilityChange,
  }: {
    onAvailabilityChange?: (state: { webAvailable: boolean; desktopAvailable: boolean }) => void
  }) => {
    React.useEffect(() => {
      onAvailabilityChange?.({ webAvailable: false, desktopAvailable: true })
    }, [onAvailabilityChange])
    return <div data-testid="telegram-login-buttons" />
  },
}))

describe('AccountPageClient', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot> | null

  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
    jest.clearAllMocks()
    mockSession = {
      email: '15demo@qq.com',
      loginMethods: ['email'],
      userId: 'cmp0uen6800016kg5d1k4bk2e',
    }
  })

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount()
      })
      root = null
    }
    document.body.innerHTML = ''
    jest.restoreAllMocks()
  })

  it('renders a local avatar without exposing the user id to third-party image services', async () => {
    await act(async () => {
      root?.render(<AccountPageClient lng="zh" />)
    })

    const avatar = container.querySelector('[data-testid="account-local-avatar"]')

    expect(container.querySelector('img[src*="api.dicebear.com"]')).toBeNull()
    expect(avatar?.querySelectorAll('span[aria-hidden="true"] > span')).toHaveLength(25)
    expect(avatar?.className).toContain('rounded-full')
  })

  it('opens the auth sheet with the current account URL when unauthenticated', async () => {
    mockSession = null as unknown as typeof mockSession

    await act(async () => {
      root?.render(<AccountPageClient lng="zh" />)
    })

    expect(mockOpenAuth).toHaveBeenCalledWith({ lng: 'zh', redirect: '/zh/account?tab=settings', closeRedirect: '/zh' })
    expect(mockReplace).not.toHaveBeenCalledWith('/zh/auth/login')
  })

  it('logs out without routing to the login page', async () => {
    mockLogout.mockImplementationOnce(() => {
      mockSession = null as unknown as typeof mockSession
    })

    await act(async () => {
      root?.render(<AccountPageClient lng="zh" />)
    })

    await act(async () => {
      ;(Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Logout') as HTMLButtonElement).click()
      root?.render(<AccountPageClient lng="zh" />)
    })

    expect(mockLogout).toHaveBeenCalled()
    expect(mockOpenAuth).not.toHaveBeenCalled()
    expect(mockReplace).not.toHaveBeenCalledWith('/zh/auth/login')
  })

  it('shows the account identifier without the account center prefix', async () => {
    await act(async () => {
      root?.render(<AccountPageClient lng="zh" />)
    })

    const heading = container.querySelector('h1')

    expect(heading?.textContent).toBe('15***@qq.com')
    expect(heading?.textContent).not.toContain('Account Center')
  })

  it('keeps email masked by default and toggles full email with one reveal button', async () => {
    await act(async () => {
      root?.render(<AccountPageClient lng="zh" />)
    })

    const heading = container.querySelector('h1')
    const showEmailButton = container.querySelector('button[aria-label="Show email"]') as HTMLButtonElement

    expect(heading?.textContent).toBe('15***@qq.com')
    expect(container.textContent).not.toContain('15demo@qq.com')
    expect(showEmailButton).not.toBeNull()

    await act(async () => {
      showEmailButton.click()
    })

    expect(heading?.textContent).toBe('15demo@qq.com')

    await act(async () => {
      ;(container.querySelector('button[aria-label="Hide email"]') as HTMLButtonElement).click()
    })

    expect(heading?.textContent).toBe('15***@qq.com')
  })

  it('right-aligns account actions on mobile while preserving desktop layout', async () => {
    await act(async () => {
      root?.render(<AccountPageClient lng="zh" />)
    })

    const copyButton = container.querySelector('button[aria-label="Copy"]')
    const mainAccountBadge = Array.from(container.querySelectorAll('span')).find(span => span.textContent === 'Main account')
    const telegramActions = container.querySelector('[data-testid="telegram-login-buttons"]')?.parentElement

    expect(copyButton).not.toBeNull()
    expect(mainAccountBadge?.className).toContain('self-end')
    expect(mainAccountBadge?.className).toContain('md:self-auto')
    expect(telegramActions?.className).toContain('justify-end')
  })

  it('shows toast errors when email binding requests fail', async () => {
    mockSession = {
      loginMethods: [],
      userId: 'cmp0uen6800016kg5d1k4bk2e',
    }
    mockSendEmailCode.mockRejectedValueOnce(new Error('send failed'))
    mockBindEmail.mockRejectedValueOnce(new Error('bind failed'))

    await act(async () => {
      root?.render(<AccountPageClient lng="zh" />)
    })

    const emailInput = container.querySelector('input[placeholder="Email"]') as HTMLInputElement
    const codeInput = container.querySelector('input[placeholder="Code"]') as HTMLInputElement
    await act(async () => {
      setInputValue(emailInput, 'user@example.com')
    })
    await act(async () => {
      ;(Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Send Code') as HTMLButtonElement).click()
    })

    await act(async () => {
      setInputValue(codeInput, '123456')
    })
    await act(async () => {
      ;(Array.from(container.querySelectorAll('button')).find(button => button.textContent === 'Bind Email') as HTMLButtonElement).click()
    })

    expect(mockError).toHaveBeenCalledWith('send failed')
    expect(mockError).toHaveBeenCalledWith('bind failed')
  })
})
