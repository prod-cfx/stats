/** @jest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Navbar } from './Navbar'

const mockOpenAuth = jest.fn()
const mockLogout = jest.fn()
const mockRouterReplace = jest.fn()
let mockSession: null | { email: string, loginMethods: string[], userId: string } = null
let mockUsePathname = () => '/zh/aggregated-orderbook'
let mockUseSearchParams = () => new URLSearchParams('tab=depth')

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a href={String(href)} {...props}>
      {children}
    </a>
  ),
}))

jest.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
  useSearchParams: () => mockUseSearchParams(),
  useRouter: () => ({ push: jest.fn(), replace: mockRouterReplace }),
}))

jest.mock('@/features/auth/AuthSheetProvider', () => ({
  useAuthSheet: () => ({ openAuth: mockOpenAuth }),
}))

jest.mock('lucide-react', () => ({
  Bell: () => null,
  Bot: () => null,
  ChevronDown: () => null,
  ChevronRight: () => null,
  FileText: () => null,
  Github: () => null,
  LogIn: () => null,
  LogOut: () => null,
  Menu: () => null,
  Search: () => null,
  Send: () => null,
  Settings: () => null,
  X: () => null,
}))

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) =>
      ({
        'account.logout': '登出',
        'account.settings': '账户设置',
        'common.comingSoonDesc': '即将开放',
        'common.comingSoonTitle': '即将开放',
        'footer.tagline': '专业的加密资产数据聚合终端',
        'nav.aiQuant': 'AI量化',
        'nav.aggregated_orderbook': '聚合盘口',
        'nav.data': '数据',
        'nav.discover': '发现',
        'nav.login': '登录',
        'nav.closeMenu': '关闭菜单',
        'nav.long_short_ratio': '多空比',
        'nav.marketData': '行情',
        'nav.openMenu': '打开菜单',
        'nav.prediction_market': '预测市场',
        'nav.public_companies': '上市公司',
        'nav.realtime_whales': '实时鲸鱼',
        'nav.whale_holdings': '鲸鱼持仓',
        'nav.whale_notifications': '鲸鱼通知',
        'nav.whales': '鲸鱼',
      }[key] ?? options?.defaultValue ?? key),
  }),
}))

jest.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({ session: mockSession, logout: mockLogout }),
}))

jest.mock('@/components/ui/toast', () => ({
  useToast: () => ({ info: jest.fn() }),
}))

jest.mock('@/features/whale-notification/hooks/useWhaleNotificationInbox', () => ({
  useWhaleNotificationInbox: () => ({ items: [], markAllRead: jest.fn() }),
}))

jest.mock('@/features/whale-notification/hooks/useWhaleNotificationUnreadCount', () => ({
  useWhaleNotificationUnreadCount: () => ({ unreadCount: 0, refresh: jest.fn() }),
}))

jest.mock('@/lib/market-data/useMarketDataCatalog', () => ({
  useMarketDataCatalog: () => ({
    items: [
      {
        id: 'nav-long-short-ratio',
        kind: 'nav',
        labelKey: 'nav.long_short_ratio',
        href: '/long-short-ratio',
      },
      {
        id: 'nav-aggregated-orderbook',
        kind: 'nav',
        labelKey: 'nav.aggregated_orderbook',
        href: '/aggregated-orderbook',
      },
    ],
  }),
}))

jest.mock('@/components/account/UserAvatar', () => ({
  UserAvatar: () => null,
}))

jest.mock('@/components/ui/CoinfluxMark', () => ({
  CoinfluxMark: () => null,
}))

jest.mock('./LanguageSwitcher', () => ({
  LanguageSwitcher: () => null,
}))

jest.mock('./ThemeToggle', () => ({
  ThemeToggle: () => null,
}))

describe('Navbar mobile menu', () => {
  let container: HTMLDivElement
  let root: ReturnType<typeof createRoot>

  beforeEach(() => {
    ;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
      true
    mockOpenAuth.mockClear()
    mockLogout.mockClear()
    mockSession = null
    mockUsePathname = () => '/zh/aggregated-orderbook'
    mockUseSearchParams = () => new URLSearchParams('tab=depth')
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

  it('keeps mobile submenu cards visible while exposing expanded state to assistive tech', async () => {
    await act(async () => {
      root.render(<Navbar />)
    })

    const mobileMenuButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      button => button.getAttribute('aria-label') === '打开菜单',
    )

    await act(async () => {
      mobileMenuButton?.click()
    })

    const dataButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      button => button.textContent === '数据',
    )
    expect(container.querySelector<HTMLButtonElement>('button[aria-label="关闭菜单"]')).not.toBeNull()
    expect(dataButton).toBeDefined()
    expect(dataButton?.getAttribute('aria-expanded')).toBe('false')

    await act(async () => {
      dataButton?.click()
    })

    expect(dataButton?.getAttribute('aria-expanded')).toBe('true')
    expect(dataButton?.getAttribute('aria-controls')).toBe('mobile-nav-submenu-1')

    const submenu = container.querySelector<HTMLElement>('#mobile-nav-submenu-1')
    expect(submenu?.getAttribute('role')).toBe('region')
    expect(submenu?.getAttribute('aria-label')).toBe('数据')
    expect(submenu?.className).toContain('rounded-lg')
    expect(submenu?.className).toContain('ring-1')
    expect(submenu?.className).toContain('bg-[color:var(--cf-surface)]/80')

    const submenuItems = Array.from(submenu?.querySelectorAll<HTMLAnchorElement>('a') ?? [])
    expect(submenuItems).toHaveLength(3)
    expect(submenuItems[1]?.className).toContain('border-t')
  })

  it('opens the auth sheet from desktop login without linking to the login route', async () => {
    await act(async () => {
      root.render(<Navbar />)
    })

    expect(container.querySelector('a[href="/zh/auth/login"]')).toBeNull()

    const desktopLoginButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      button => button.textContent === '登录',
    )

    expect(desktopLoginButton).toBeDefined()

    await act(async () => {
      desktopLoginButton?.click()
    })

    expect(mockOpenAuth).toHaveBeenCalledTimes(1)
    expect(mockOpenAuth).toHaveBeenCalledWith({
      lng: 'zh',
      redirect: '/zh/aggregated-orderbook?tab=depth',
    })
  })

  it('opens the auth sheet from mobile login and closes the mobile menu', async () => {
    await act(async () => {
      root.render(<Navbar />)
    })

    const mobileMenuButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      button => button.getAttribute('aria-label') === '打开菜单',
    )

    await act(async () => {
      mobileMenuButton?.click()
    })

    const mobileLoginButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button'))
      .filter(button => button.textContent === '登录')
      .pop()

    expect(mobileLoginButton).toBeDefined()

    await act(async () => {
      mobileLoginButton?.click()
    })

    expect(mockOpenAuth).toHaveBeenCalledTimes(1)
    expect(mockOpenAuth).toHaveBeenCalledWith({
      lng: 'zh',
      redirect: '/zh/aggregated-orderbook?tab=depth',
    })
    expect(
      Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
        button => button.textContent === '数据',
      ),
    ).toBeUndefined()
  })

  it('suppresses account auth gate when logging out from the account menu', async () => {
    const { shouldSuppressAuthGate } = await import('@/features/auth/auth-gate-suppression')
    mockSession = {
      email: 'user@example.com',
      loginMethods: ['email'],
      userId: 'user-1',
    }
    mockUsePathname = () => '/zh/account'
    mockUseSearchParams = () => new URLSearchParams('tab=settings')

    await act(async () => {
      root.render(<Navbar />)
    })

    const accountButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      button => button.getAttribute('aria-label') === '账户设置',
    )
    await act(async () => {
      accountButton?.click()
    })

    const logoutButton = Array.from(container.querySelectorAll<HTMLButtonElement>('button')).find(
      button => button.textContent === '登出',
    )
    await act(async () => {
      logoutButton?.click()
    })

    expect(mockLogout).toHaveBeenCalledTimes(1)
    expect(shouldSuppressAuthGate()).toBe(true)
    expect(mockRouterReplace).toHaveBeenCalledWith('/zh')
  })
})
