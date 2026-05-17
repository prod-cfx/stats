'use client'

import { Bell, Bot, ChevronDown, ChevronRight, FileText, Github, LogOut, Menu, Search, Send, Settings, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CoinfluxMark } from '@/components/ui/CoinfluxMark'
import { useToast } from '@/components/ui/toast'
import { useWhaleNotificationInbox } from '@/features/whale-notification/hooks/useWhaleNotificationInbox'
import { useWhaleNotificationUnreadCount } from '@/features/whale-notification/hooks/useWhaleNotificationUnreadCount'
import { useAuth } from '@/hooks/use-auth'
import { getMockMarketList } from '@/lib/market-data/mock-market-list'
import { useMarketDataCatalog } from '@/lib/market-data/useMarketDataCatalog'
import { LanguageSwitcher } from './LanguageSwitcher'
import {
  buildDataNavLinks,
  buildMobileWhaleLinks,
} from './navbar.nav-data'
import { ThemeToggle } from './ThemeToggle'

type SearchEntryType = 'coin' | 'indicator' | 'feature' | 'page' | 'address'

interface SearchEntry {
  id: string
  type: SearchEntryType
  label: string
  subtitle?: string
  href: string
  // used for filtering/scoring
  keywords?: string[]
}

export const Navbar = () => {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useTranslation()
  const { info } = useToast()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const bellWrapRef = useRef<HTMLDivElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [extraBases, _setExtraBases] = useState<string[]>([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [expandedMobileMenus, setExpandedMobileMenus] = useState<string[]>([])
  const [bellOpen, setBellOpen] = useState(false)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const accountMenuRef = useRef<HTMLDivElement>(null)
  const { session, logout } = useAuth()
  const { unreadCount, refresh: refreshUnreadCount } = useWhaleNotificationUnreadCount()
  const inbox = useWhaleNotificationInbox()

  // Phase 1: 搜索交互先隐藏（后续要恢复，只需改为 true）
  const ENABLE_GLOBAL_SEARCH = false
  const ENABLE_USER_SYSTEM = true

  // 从 pathname 提取当前语言
  const currentLng = useMemo(() => {
    const pathLng = pathname?.split('/')[1]
    return pathLng === 'zh' || pathLng === 'en' ? pathLng : 'zh'
  }, [pathname])

  // 辅助函数：为路径添加语言前缀
  const withLng = useCallback((path: string) => `/${currentLng}${path}`, [currentLng])

  const { items: catalogItems } = useMarketDataCatalog()

  const dataChildren = buildDataNavLinks({ lng: currentLng, t, catalogItems })

  const whaleChildren = [
    { name: t('nav.discover'), href: withLng('/whale-tracking/discover') },
    { name: t('nav.realtime_whales'), href: withLng('/whale-tracking/realtime') },
    { name: t('nav.whale_holdings'), href: withLng('/whale-tracking/holdings') },
    { name: t('nav.whale_notifications'), href: withLng('/whale-tracking/notifications') },
  ]

  // 临时隐藏看板，需要时再恢复
  const navLinks = [
    { name: t('nav.aiQuant', { defaultValue: 'AI量化' }), href: withLng('/ai-quant') },
    {
      name: t('nav.data'),
      href: '#',
      children: dataChildren,
    },
    {
      name: t('nav.whales'),
      href: '#',
      children: whaleChildren,
    },
    // { name: t('nav.dashboard'), href: withLng('/dashboard') },
  ]

  const mobileNavLinks = [
    { name: t('nav.aiQuant', { defaultValue: 'AI量化' }), href: withLng('/ai-quant') },
    {
      name: t('nav.data'),
      href: '#',
      children: dataChildren,
    },
    {
      name: t('nav.whales'),
      href: '#',
      children: buildMobileWhaleLinks({ lng: currentLng, t }),
    },
  ]

  const accountDisplayName = session?.email || session?.telegram?.username || session?.userId || ''
  const accountInitials = accountDisplayName.startsWith('@')
    ? accountDisplayName.slice(1, 3).toUpperCase()
    : accountDisplayName.slice(0, 2).toUpperCase()
  const accountIdLabel = session
    ? `id:${session.userId.length <= 14 ? session.userId : `${session.userId.slice(0, 5)}...${session.userId.slice(-6)}`}`
    : ''
  const year = new Date().getFullYear()

  // 获取热门搜索建议（示例）
  // 实际场景：可以基于 extraBases 或 mock market list 动态生成
  const searchResults: SearchEntry[] = useMemo(() => {
    if (!searchQuery) return []

    const q = searchQuery.toLowerCase()
    const results: SearchEntry[] = []

    // 1. Pages（看板已临时隐藏，不再出现在搜索建议中）
    if ('liquidation'.includes(q) || 'map'.includes(q) || '清算'.includes(q)) {
      results.push({
        id: 'p-liq',
        type: 'page',
        label: t('nav.liquidation_map'),
        href: withLng('/liquidation-map'),
      })
    }

    // 2. Coins (Mock data + extraBases)
    const mockList = getMockMarketList({
      marketType: 'futures',
      isAggregated: true,
      selectedExchange: 'binance',
    }) // { base, quote, ... }
    // 简单去重
    const seen = new Set<string>()

    // extraBases first
    extraBases.forEach(base => {
      if (base.toLowerCase().includes(q) && !seen.has(base)) {
        seen.add(base)
        results.push({
          id: `c-${base}`,
          type: 'coin',
          label: base,
          subtitle: 'Perpetual', // 假设
          href: withLng(`/market/${base}-USDT`),
        })
      }
    })

    // mock list
    mockList.forEach(m => {
      if (
        (m.base.toLowerCase().includes(q) || m.displaySymbol.toLowerCase().includes(q)) &&
        !seen.has(m.base)
      ) {
        seen.add(m.base)
        results.push({
          id: `c-${m.base}`,
          type: 'coin',
          label: m.base,
          subtitle: 'Perpetual',
          href: withLng(`/market/${m.base}-USDT`), // 假设路由
        })
      }
    })

    return results.slice(0, 8)
  }, [searchQuery, extraBases, t, withLng])

  const _handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchResults.length > 0) {
      router.push(searchResults[activeIndex].href)
      setSearchOpen(false)
    } else {
      // 默认搜索跳转
      // router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIndex(prev => (prev + 1) % searchResults.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIndex(prev => (prev - 1 + searchResults.length) % searchResults.length)
    } else if (e.key === 'Escape') {
      setSearchOpen(false)
    }
  }

  // 点击外部关闭搜索
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(event.target as Node)) {
        setSearchOpen(false)
      }
      if (accountMenuRef.current && !accountMenuRef.current.contains(event.target as Node)) {
        setAccountMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // 快捷键 / (Focus search)
  useEffect(() => {
    let focusTimer: ReturnType<typeof setTimeout> | null = null
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key === '/' &&
        !searchOpen &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault()
        setSearchOpen(true)
        if (focusTimer) clearTimeout(focusTimer)
        focusTimer = setTimeout(() => searchInputRef.current?.focus(), 0)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (focusTimer) clearTimeout(focusTimer)
    }
  }, [searchOpen])

  useEffect(() => {
    setMobileMenuOpen(false)
    setBellOpen(false)
    setAccountMenuOpen(false)
  }, [pathname])

  // 高亮匹配文字
  const highlight = (label: string) => {
    const q = searchQuery.trim()
    if (!q) return label
    const idx = label.toLowerCase().indexOf(q.toLowerCase())
    if (idx === -1) return label
    const before = label.slice(0, idx)
    const mid = label.slice(idx, idx + q.length)
    const after = label.slice(idx + q.length)
    return (
      <>
        {before}
        <span className="from-primary to-secondary bg-gradient-to-r bg-clip-text font-semibold text-transparent">
          {mid}
        </span>
        {after}
      </>
    )
  }

  const toggleMobileSubmenu = (name: string) => {
    setExpandedMobileMenus(prev =>
      prev.includes(name) ? prev.filter(item => item !== name) : [...prev, name],
    )
  }

  const openMobileMenu = () => {
    setBellOpen(false)
    setAccountMenuOpen(false)
    setMobileMenuOpen(true)
  }

  const handleMobileFooterSocialClick = () => {
    info(
      t('common.comingSoonTitle', { defaultValue: 'Coming Soon' }),
      t('common.comingSoonDesc', { defaultValue: 'This link will be available soon.' }),
    )
  }

  const recentInboxItems = useMemo(() => inbox.items.slice(0, 5), [inbox.items])

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (bellWrapRef.current && !bellWrapRef.current.contains(event.target as Node)) {
        setBellOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
    }
  }, [])

  return (
    <nav className="sticky top-0 z-50 flex h-14 items-center justify-between border-b border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-4 md:h-16 md:px-6">
      <div className="flex items-center gap-4 md:gap-10">
        <div className="flex items-center gap-2.5">
          {/* Mobile Menu Button */}
          <button
            type="button"
            className="text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)] md:hidden"
            onClick={openMobileMenu}
          >
            <Menu className="h-5 w-5" />
          </button>

          <Link href={withLng('/')} className="flex flex-col no-underline">
            <div className="flex items-center">
              <CoinfluxMark className="h-7 w-7" />
              <span className="-ml-1.5 !text-base !font-semibold !leading-6 tracking-tight text-[color:var(--cf-text-strong)]">
                oinflux
              </span>
            </div>
            <span className="hidden pl-0.5 !text-[11px] !font-normal !leading-4 tracking-[0.08em] text-[color:var(--cf-muted)] md:block">
              Crypto Data Aggregation
            </span>
          </Link>
        </div>

        <div className="hidden h-full items-center gap-6 md:flex">
          {navLinks.map(link => {
            const isActive =
              pathname === link.href ||
              (link.href === withLng('/ai-quant') && pathname === withLng('/')) ||
              (link.children && link.children.some(child => pathname === child.href))

            if (link.children) {
              return (
                <div key={link.name} className="group relative flex h-full items-center">
                  <Link
                    href={link.href}
                    className={`relative flex h-full cursor-pointer items-center gap-1 !text-[13px] !font-semibold !leading-5 no-underline transition-colors ${
                      isActive
                        ? 'text-[color:var(--cf-text-strong)]'
                        : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]'
                    }`}
                  >
                    {link.name}
                    <ChevronDown className="h-3.5 w-3.5 transition-transform group-hover:rotate-180" />
                    {isActive && (
                      <div className="from-primary to-secondary absolute right-0 bottom-0 left-0 h-[2px] bg-gradient-to-r" />
                    )}
                  </Link>

                  {/* Dropdown Menu */}
                  <div className="invisible absolute top-[95%] left-0 z-50 w-40 translate-y-1.5 transform overflow-hidden rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] opacity-0 shadow-sm transition-all duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                    <div className="py-1.5">
                      {link.children.map(child => (
                        <Link
                          key={child.name}
                          href={child.href}
                          className={`mx-1.5 block rounded-md px-3 py-2 !text-xs !font-semibold !leading-5 transition-colors ${
                            pathname === child.href
                              ? 'from-primary to-secondary bg-gradient-to-r !text-white'
                              : 'text-[color:var(--cf-text)] hover:bg-[color:var(--cf-surface-hover)] hover:text-[color:var(--cf-text-strong)]'
                          }`}
                        >
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              )
            }

            return (
              <Link
                key={link.name}
                href={link.href}
                className={`relative flex h-full items-center !text-[13px] !font-semibold !leading-5 transition-colors ${
                  isActive
                    ? 'text-[color:var(--cf-text-strong)]'
                    : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]'
                }`}
              >
                {link.name}
                {isActive && (
                  <div className="from-primary to-secondary absolute right-0 bottom-0 left-0 h-[2px] bg-gradient-to-r" />
                )}
              </Link>
            )
          })}
        </div>
      </div>

      <div className="flex items-center gap-1.5 md:gap-2.5">
        {/* Global Search - Phase 1 Hidden */}
        {ENABLE_GLOBAL_SEARCH && (
          <div className="relative" ref={searchWrapRef}>
            <div
              className={`flex items-center transition-all duration-300 ${
                searchOpen
                  ? 'w-full bg-[color:var(--cf-surface-2)] md:w-80'
                  : 'w-8 bg-transparent md:w-10'
              } h-8 overflow-hidden rounded-full md:h-10`}
            >
              <button
                type="button"
                onClick={() => {
                  setSearchOpen(!searchOpen)
                  if (!searchOpen) setTimeout(() => searchInputRef.current?.focus(), 100)
                }}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)] md:h-10 md:w-10"
              >
                <Search className="h-4 w-4 md:h-5 md:w-5" />
              </button>

              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('nav.search') || 'Search...'}
                className={`h-full w-full border-none bg-transparent px-2 text-sm text-[color:var(--cf-text)] outline-none ${
                  searchOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
                }`}
              />

              {searchOpen && searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="mr-3 text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Search Results Dropdown */}
            {searchOpen && searchQuery && (
              <div className="animate-in fade-in zoom-in-95 absolute top-full right-0 z-50 mt-2 w-[calc(100vw-32px)] overflow-hidden rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] shadow-2xl duration-200 md:w-96">
                {searchResults.length > 0 ? (
                  <div className="py-2">
                    {searchResults.map((result, idx) => (
                      <Link
                        key={result.id}
                        href={result.href}
                        onClick={() => setSearchOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-[color:var(--cf-surface-hover)] ${
                          idx === activeIndex ? 'bg-[color:var(--cf-surface-hover)]' : ''
                        }`}
                      >
                        <div
                          className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                            result.type === 'coin'
                              ? 'bg-primary/10 text-primary'
                              : result.type === 'page'
                                ? 'bg-purple-500/10 text-purple-500'
                                : 'bg-[color:var(--cf-surface-2)] text-[color:var(--cf-muted)]'
                          }`}
                        >
                          {result.type === 'coin' ? 'C' : result.type === 'page' ? 'P' : '#'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium text-[color:var(--cf-text-strong)]">
                            {highlight(result.label)}
                          </div>
                          {result.subtitle && (
                            <div className="truncate text-xs text-[color:var(--cf-muted)]">
                              {result.subtitle}
                            </div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-sm text-[color:var(--cf-muted)]">
                    {t('modal.noResults') || 'No results found'}
                  </div>
                )}
                <div className="flex justify-between border-t border-[color:var(--cf-border)] bg-[color:var(--cf-surface-2)] px-4 py-2 text-[10px] text-[color:var(--cf-muted)]">
                  <span>
                    Select{' '}
                    <kbd className="rounded bg-[color:var(--cf-surface)] px-1 font-sans">↑↓</kbd>
                  </span>
                  <span>
                    Open{' '}
                    <kbd className="rounded bg-[color:var(--cf-surface)] px-1 font-sans">Enter</kbd>
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="mx-1 hidden h-5 w-[1px] bg-[color:var(--cf-border)] md:block" />

        <LanguageSwitcher />
        <ThemeToggle />

        <div className="relative" ref={bellWrapRef}>
          <button
            type="button"
            aria-label="whale-notification-bell"
            onClick={() => setBellOpen(prev => !prev)}
            className="relative inline-flex min-h-10 w-10 items-center justify-center rounded-full text-[color:var(--cf-muted)] transition-colors hover:bg-[color:var(--cf-surface)] hover:text-[color:var(--cf-text-strong)] md:min-h-8 md:w-8"
          >
            <Bell className="h-4 w-4" />
            {unreadCount > 0 && (
              <span className="pointer-events-none absolute -top-0.5 -right-0.5 min-w-[16px] rounded-full bg-primary px-1 text-center text-[10px] leading-4 font-bold text-white">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {bellOpen && (
            <div className="fixed top-16 right-4 left-4 z-[80] flex max-h-[min(24rem,calc(100dvh-5rem))] flex-col overflow-hidden rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] shadow-2xl md:absolute md:top-full md:right-0 md:left-auto md:mt-2 md:max-h-[min(32rem,calc(100dvh-5rem))] md:w-[calc(100vw-2rem)] md:max-w-sm">
              <div className="flex items-center justify-between border-b border-[color:var(--cf-border)] px-4 py-3">
                <div className="text-sm font-semibold text-[color:var(--cf-text-strong)]">
                  {t('whaleTracking.notifications.tabs.inbox')} ({unreadCount})
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={async () => {
                      await inbox.markAllRead()
                      await refreshUnreadCount()
                    }}
                    className="rounded px-2 py-1 text-xs text-primary transition-colors hover:bg-primary/10"
                  >
                    {t('whaleTracking.notifications.actions.markAllRead')}
                  </button>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-2">
                {inbox.loading ? (
                  <div className="px-2 py-8 text-center text-sm text-[color:var(--cf-muted)]">
                    {t('common.loading')}
                  </div>
                ) : !recentInboxItems.length ? (
                  <div className="px-2 py-8 text-center text-sm text-[color:var(--cf-muted)]">
                    {t('whaleTracking.notifications.emptyInbox')}
                  </div>
                ) : (
                  recentInboxItems.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={async () => {
                        if (!item.read) {
                          await inbox.markRead(item.id)
                          await refreshUnreadCount()
                        }
                        setBellOpen(false)
                        router.push(withLng('/whale-tracking/notifications'))
                      }}
                      className={`mb-2 w-full rounded-lg border p-3 text-left transition-colors last:mb-0 ${
                        item.read
                          ? 'border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] hover:bg-[color:var(--cf-surface-hover)]'
                          : 'border-primary/40 bg-primary/5 hover:bg-primary/10'
                      }`}
                    >
                      <div className="line-clamp-1 text-sm font-semibold text-[color:var(--cf-text-strong)]">
                        {item.title}
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs text-[color:var(--cf-muted)]">
                        {item.content}
                      </div>
                      <div className="mt-1 text-[10px] text-[color:var(--cf-muted)]">
                        {new Date(item.createdAt).toLocaleString()}
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div className="border-t border-[color:var(--cf-border)] p-2">
                <button
                  type="button"
                  onClick={() => {
                    setBellOpen(false)
                    const target = withLng('/whale-tracking/notifications')
                    if (pathname === target) {
                      router.refresh()
                      return
                    }
                    router.push(target)
                  }}
                  className="w-full rounded-lg px-3 py-2 text-sm font-medium text-[color:var(--cf-text-strong)] transition-colors hover:bg-[color:var(--cf-surface-hover)]"
                >
                  {t('nav.whale_notifications')}
                </button>
              </div>
            </div>
          )}
        </div>

        {ENABLE_USER_SYSTEM &&
          (session ? (
            <div ref={accountMenuRef} className="relative flex items-center">
              <button
                type="button"
                onClick={() => setAccountMenuOpen(prev => !prev)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-[color:var(--cf-text-strong)] transition-opacity hover:opacity-90"
                aria-label={t('account.settings')}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] text-xs font-semibold text-[color:var(--cf-text-strong)]">
                  {accountInitials}
                </span>
              </button>

              {accountMenuOpen && (
                <div className="absolute top-[calc(100%+0.65rem)] right-0 z-50 w-[min(15rem,calc(100vw-2rem))] overflow-hidden rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] shadow-sm">
                  <div className="flex items-center gap-2.5 border-b border-[color:var(--cf-border)] px-3.5 py-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] text-xs font-semibold text-[color:var(--cf-text-strong)]">
                      {accountInitials}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate !text-[13px] !font-semibold !leading-5 text-[color:var(--cf-text-strong)]">
                        {accountDisplayName}
                      </div>
                      <div className="mt-0.5 truncate font-mono !text-xs !font-normal !leading-[18px] text-[color:var(--cf-muted)]">
                        {accountIdLabel}
                      </div>
                    </div>
                  </div>
                  <Link
                    href={withLng('/account?tab=settings')}
                    onClick={() => setAccountMenuOpen(false)}
                    className="flex items-center gap-2.5 border-b border-[color:var(--cf-border)] px-3.5 py-2.5 !text-[13px] !font-semibold !leading-5 text-[color:var(--cf-text)] transition hover:bg-[color:var(--cf-surface-hover)] hover:text-[color:var(--cf-text-strong)]"
                  >
                    <Settings className="h-4 w-4 text-[color:var(--cf-muted)]" />
                    {t('account.settings')}
                  </Link>
                  <Link
                    href={withLng('/account?tab=ai-quant')}
                    onClick={() => setAccountMenuOpen(false)}
                    className="flex items-center gap-2.5 border-b border-[color:var(--cf-border)] px-3.5 py-2.5 !text-[13px] !font-semibold !leading-5 text-[color:var(--cf-text)] transition hover:bg-[color:var(--cf-surface-hover)] hover:text-[color:var(--cf-text-strong)]"
                  >
                    <Bot className="h-4 w-4 text-[color:var(--cf-muted)]" />
                    {t('nav.aiQuant')}
                  </Link>
                  <button
                    type="button"
                    onClick={() => {
                      logout()
                      setAccountMenuOpen(false)
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left !text-[13px] !font-semibold !leading-5 text-red-500 transition hover:bg-red-500/10"
                  >
                    <LogOut className="h-4 w-4" />
                    {t('account.logout', { defaultValue: '登出' })}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href={withLng('/auth/login')}
              className="from-primary to-secondary shadow-primary/15 flex min-h-9 items-center rounded-full bg-gradient-to-r px-3.5 !text-xs !font-semibold !leading-5 whitespace-nowrap text-white shadow-md transition-opacity hover:opacity-90 md:min-h-8"
            >
              {t('nav.login')}
            </Link>
          ))}
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="animate-in slide-in-from-top-10 fixed inset-0 z-[60] flex flex-col bg-[color:var(--cf-bg)] duration-200 md:hidden">
          <div className="flex h-16 items-center justify-between border-b border-[color:var(--cf-border)] px-4">
            <div className="flex items-center">
              <CoinfluxMark className="h-7 w-7" />
              <span className="-ml-1.5 text-xl leading-none font-bold tracking-tight text-[color:var(--cf-text-strong)]">
                oinflux
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-4">
            {mobileNavLinks.map(link => {
              const hasChildren = link.children && link.children.length > 0
              const isExpanded = expandedMobileMenus.includes(link.name)

              if (hasChildren) {
                return (
                  <div key={link.name} className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => toggleMobileSubmenu(link.name)}
                      className="flex items-center justify-between px-2 py-3 text-lg font-medium text-[color:var(--cf-text-strong)]"
                    >
                      {link.name}
                      <ChevronDown
                        className={`h-5 w-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      />
                    </button>

                    {isExpanded && (
                      <div className="mb-2 flex flex-col overflow-hidden rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)]">
                        {link.children!.map(child => (
                          <Link
                            key={child.name}
                            href={child.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className="border-b border-[color:var(--cf-border)] px-4 py-3 text-base text-[color:var(--cf-text)] last:border-0 hover:bg-[color:var(--cf-surface-hover)]"
                          >
                            {child.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                )
              }

              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center justify-between px-2 py-3 text-lg font-medium text-[color:var(--cf-text-strong)]"
                >
                  <span>{link.name}</span>
                  <ChevronRight className="h-5 w-5 text-[color:var(--cf-muted)]" />
                </Link>
              )
            })}

            <div className="mt-auto border-t border-[color:var(--cf-border)]/70 pt-6">
              <div className="flex flex-col items-center gap-3">
                <Link
                  href={withLng('/')}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center no-underline"
                >
                  <CoinfluxMark className="h-7 w-7" />
                  <span className="-ml-1.5 text-xl leading-none font-bold tracking-tight text-[color:var(--cf-text-strong)]">
                    oinflux
                  </span>
                </Link>
                <p className="text-center text-sm text-[color:var(--cf-muted)]">
                  {t('footer.tagline', { defaultValue: '专业的加密资产 数据聚合与多维行情分析终端' })}
                </p>
                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={handleMobileFooterSocialClick}
                    className="flex h-10 w-10 items-center justify-center rounded-md text-[color:var(--cf-muted)] transition-colors hover:text-[color:var(--cf-text-strong)]"
                    aria-label="Telegram"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleMobileFooterSocialClick}
                    className="flex h-10 w-10 items-center justify-center rounded-md text-[color:var(--cf-muted)] transition-colors hover:text-[color:var(--cf-text-strong)]"
                    aria-label="X"
                  >
                    <X className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleMobileFooterSocialClick}
                    className="flex h-10 w-10 items-center justify-center rounded-md text-[color:var(--cf-muted)] transition-colors hover:text-[color:var(--cf-text-strong)]"
                    aria-label="GitHub"
                  >
                    <Github className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleMobileFooterSocialClick()
                      setMobileMenuOpen(false)
                    }}
                    className="flex h-10 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-[color:var(--cf-muted)] no-underline transition-colors hover:text-[color:var(--cf-text-strong)]"
                  >
                    <FileText className="h-4 w-4" />
                    {t('nav.docs', { defaultValue: '文档' })}
                  </button>
                </div>
              </div>
              <div className="mt-5 border-t border-[color:var(--cf-border)]/50 pt-5 text-center text-xs leading-6 text-[color:var(--cf-muted)]">
                <p>
                  {t('footer.copyrightLine', { year })}
                  <br />
                  {t('footer.ownership')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  )
}
