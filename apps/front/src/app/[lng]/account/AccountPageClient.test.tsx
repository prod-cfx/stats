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

jest.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => new URLSearchParams('tab=settings'),
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'account.accountInfo': 'Account',
        'account.logout': 'Logout',
        'account.mainAccount': 'Main account',
        'account.settings': 'Settings',
        'account.telegramDesktopAvailable': 'Desktop available',
        'account.telegramLogin': 'Telegram Login',
        'account.title': 'Account Center',
        'account.userId': 'UserId',
        'account.userIdCopied': 'Copied',
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
  useToast: () => ({ success: mockSuccess }),
}))

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    bindEmail: mockBindEmail,
    isLoading: false,
    logout: mockLogout,
    sendEmailCode: mockSendEmailCode,
    session: {
      email: '15demo@qq.com',
      loginMethods: ['email'],
      userId: 'cmp0uen6800016kg5d1k4bk2e',
    },
  }),
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

  it('renders a deterministic DiceBear identicon avatar from the user id', async () => {
    await act(async () => {
      root?.render(<AccountPageClient lng="zh" />)
    })

    const avatar = container.querySelector('img[src*="api.dicebear.com"]')

    expect(avatar).toBeInstanceOf(HTMLImageElement)
    expect(avatar?.getAttribute('src')).toBe('https://api.dicebear.com/7.x/identicon/svg?seed=cmp0uen6800016kg5d1k4bk2e')
    expect(avatar?.className).toContain('object-contain')
  })
})
