'use client'

import { Bell, ChevronDown, Menu, Search, X } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { CoinfluxMark } from '@/components/ui/CoinfluxMark'
import { useToast } from '@/components/ui/toast'
import { useWhaleNotificationUnreadCount } from '@/features/whale-notification/hooks/useWhaleNotificationUnreadCount'
import { useAuth } from '@/hooks/use-auth'
import { getMockMarketList } from '@/lib/market-data/mock-market-list'
import { useMarketDataCatalog } from '@/lib/market-data/useMarketDataCatalog'
import { LanguageSwitcher } from './LanguageSwitcher'
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
  const { info: _info } = useToast()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [extraBases, _setExtraBases] = useState<string[]>([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [expandedMobileMenus, setExpandedMobileMenus] = useState<string[]>([])
  const { session, logout } = useAuth()
  const { unreadCount } = useWhaleNotificationUnreadCount()

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

  const normalizeHref = (href: string) => {
    // If catalog already includes a locale prefix, keep it.
    if (href.startsWith('/zh/') || href.startsWith('/en/')) return href
    // Ensure leading slash
    const p = href.startsWith('/') ? href : `/${href}`
    return withLng(p)
  }

  const dataNavOrder = [
    'nav-liquidation-map',
    'nav-long-short-ratio',
    'nav-aggregated-orderbook',
    'nav-liquidation-data',
    'nav-prediction-market',
    'nav-public-companies',
  ]

  // 临时隐藏：清算地图、爆仓数据（需要时再恢复展示）
  const dataNavHiddenIds = ['nav-liquidation-map', 'nav-liquidation-data']
  const dataChildren = catalogItems
    .filter(x => x.kind === 'nav' && x.href && !dataNavHiddenIds.includes(x.id))
    .slice()
    .sort((a, b) => dataNavOrder.indexOf(a.id) - dataNavOrder.indexOf(b.id))
    .map(x => ({ name: t(x.labelKey), href: normalizeHref(x.href!) }))

  const whaleChildren = [
    { name: t('nav.discover'), href: withLng('/whale-tracking/discover') },
    { name: t('nav.realtime_whales'), href: withLng('/whale-tracking/realtime') },
    { name: t('nav.whale_holdings'), href: withLng('/whale-tracking/holdings') },
    { name: t('nav.whale_notifications'), href: withLng('/whale-tracking/notifications') },
  ]

  // 临时隐藏看板，需要时再恢复
  const navLinks = [
    { name: t('nav.home'), href: withLng('/') },
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

  return (
    <nav className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-4 md:h-20 md:px-8">
      <div className="flex items-center gap-4 md:gap-12">
        <div className="flex items-center gap-3">
          {/* Mobile Menu Button */}
          <button
            type="button"
            className="text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)] md:hidden"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="h-6 w-6" />
          </button>

          <Link href={withLng('/')} className="flex flex-col no-underline">
            <div className="flex items-center">
              <CoinfluxMark className="h-7 w-7 md:h-10 md:w-10" />
              <span className="-ml-1.5 text-xl leading-none font-bold tracking-tight text-[color:var(--cf-text-strong)] md:text-2xl">
                oinflux
              </span>
            </div>
            <span className="hidden pl-0.5 text-[10px] tracking-wider text-[color:var(--cf-muted)] md:block md:text-xs">
              Crypto Data Aggregation
            </span>
          </Link>
        </div>

        <div className="hidden h-full items-center gap-8 md:flex">
          {navLinks.map(link => {
            const isActive =
              pathname === link.href ||
              (link.children && link.children.some(child => pathname === child.href))

            if (link.children) {
              return (
                <div key={link.name} className="group relative flex h-full items-center">
                  <Link
                    href={link.href}
                    className={`relative flex h-full cursor-pointer items-center gap-1 font-medium no-underline transition-all transition-colors ${
                      isActive
                        ? 'text-[color:var(--cf-text-strong)]'
                        : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]'
                    } text-body`}
                  >
                    {link.name}
                    <ChevronDown className="h-4 w-4 transition-transform group-hover:rotate-180" />
                    {isActive && (
                      <div className="from-primary to-secondary absolute right-0 bottom-0 left-0 h-[2px] bg-gradient-to-r" />
                    )}
                  </Link>

                  {/* Dropdown Menu */}
                  <div className="invisible absolute top-[95%] left-0 z-50 w-48 translate-y-2 transform overflow-hidden rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] opacity-0 shadow-xl transition-all duration-200 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100">
                    <div className="py-1">
                      {link.children.map(child => (
                        <Link
                          key={child.name}
                          href={child.href}
                          className={`text-caption block px-4 py-2.5 transition-colors ${
                            pathname === child.href
                              ? 'from-primary to-secondary bg-gradient-to-r text-white'
                              : 'hover:bg-primary/10 hover:text-primary text-[color:var(--cf-text)]'
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
                className={`relative flex h-full items-center font-medium transition-colors ${
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

      <div className="flex items-center gap-2 md:gap-4">
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

        <div className="mx-1 hidden h-6 w-[1px] bg-[color:var(--cf-border)] md:block" />

        <LanguageSwitcher />
        <ThemeToggle />

        <button
          type="button"
          aria-label="whale-notification-bell"
          onClick={() => router.push(withLng('/whale-tracking/notifications'))}
          className="relative rounded-lg p-2 text-[color:var(--cf-muted)] transition-colors hover:bg-[color:var(--cf-surface)] hover:text-[color:var(--cf-text-strong)]"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[16px] rounded-full bg-primary px-1 text-center text-[10px] leading-4 font-bold text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {ENABLE_USER_SYSTEM &&
          (session ? (
            <div className="hidden items-center gap-2 md:flex">
              <Link
                href={withLng('/account')}
                className="rounded-lg border border-[color:var(--cf-border)] px-3 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)]"
              >
                {session.email || session.userId}
              </Link>
              <button
                type="button"
                onClick={logout}
                className="rounded-lg border border-[color:var(--cf-border)] px-3 py-2 text-sm font-semibold text-[color:var(--cf-text-strong)]"
              >
                {t('account.logout', { defaultValue: '登出' })}
              </button>
            </div>
          ) : (
            <Link
              href={withLng('/auth/login')}
              className="from-primary to-secondary shadow-primary/20 hidden rounded-lg bg-gradient-to-r px-4 py-2 text-sm font-bold text-white shadow-lg transition-all hover:opacity-90 active:scale-95 md:flex"
            >
              {t('nav.login')}
            </Link>
          ))}
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="animate-in slide-in-from-top-10 fixed inset-0 z-[60] flex flex-col bg-[color:var(--cf-bg)] duration-200 md:hidden">
          <div className="flex h-16 items-center justify-between border-b border-[color:var(--cf-border)] px-4">
            <div className="flex items-center gap-3">
              <div className="from-primary to-secondary shadow-primary/20 flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br shadow-lg">
                <CoinfluxMark className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-bold text-[color:var(--cf-text-strong)]">Coinflux</span>
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
            {navLinks.map(link => {
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
                  className="border-b border-[color:var(--cf-border)] px-2 py-3 text-lg font-medium text-[color:var(--cf-text-strong)] last:border-0"
                >
                  {link.name}
                </Link>
              )
            })}

            {ENABLE_USER_SYSTEM && (
              <div className="mt-6">
                {session ? (
                  <div className="space-y-2">
                    <Link
                      href={withLng('/account')}
                      onClick={() => setMobileMenuOpen(false)}
                      className="block w-full rounded-xl border border-[color:var(--cf-border)] py-3 text-center text-base font-semibold"
                    >
                      {session.email || session.userId}
                    </Link>
                    <button
                      type="button"
                      onClick={() => {
                        logout()
                        setMobileMenuOpen(false)
                      }}
                      className="w-full rounded-xl border border-[color:var(--cf-border)] py-3 text-base font-semibold"
                    >
                      {t('account.logout', { defaultValue: '登出' })}
                    </button>
                  </div>
                ) : (
                  <Link
                    href={withLng('/auth/login')}
                    onClick={() => setMobileMenuOpen(false)}
                    className="from-primary to-secondary shadow-primary/20 block w-full rounded-xl bg-gradient-to-r py-3 text-center text-lg font-bold text-white shadow-lg"
                  >
                    {t('nav.login')}
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}
