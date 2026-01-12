'use client';

import { ChevronDown, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMarketDataCatalog } from '@/lib/market-data/useMarketDataCatalog'
import { useToast } from '@/components/ui/toast';
import { getMockMarketList } from '@/lib/market-data/mock-market-list'
import { getToken } from '@/lib/auth-storage'
import { API_BASE_URL } from '@/lib/api-client'
import { LanguageSwitcher } from './LanguageSwitcher';

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
  const pathname = usePathname();
  const router = useRouter()
  const { t } = useTranslation();
  const { info } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [extraBases, setExtraBases] = useState<string[]>([])

  // Phase 1: 搜索交互先隐藏（后续要恢复，只需改为 true）
  const ENABLE_GLOBAL_SEARCH = false
  // Phase 1: 用户系统先隐藏
  const ENABLE_USER_SYSTEM = false

  // 从 pathname 提取当前语言
  const currentLng = useMemo(() => {
    const pathLng = pathname?.split('/')[1];
    return (pathLng === 'zh' || pathLng === 'en') ? pathLng : 'zh';
  }, [pathname]);
  
  // 辅助函数：为路径添加语言前缀
  const withLng = (path: string) => `/${currentLng}${path}`;

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

  const dataChildren = catalogItems
    .filter((x) => x.kind === 'nav' && x.href)
    .slice()
    .sort((a, b) => dataNavOrder.indexOf(a.id) - dataNavOrder.indexOf(b.id))
    .map((x) => ({ name: t(x.labelKey), href: normalizeHref(x.href!) }))

  const navLinks = [
    { name: t('nav.home'), href: withLng('/') },
    { 
      name: t('nav.data'), 
      href: withLng('/liquidation-map'),
      children: dataChildren.length
        ? dataChildren
        : [
        { name: t('nav.liquidation_map'), href: withLng('/liquidation-map') },
        { name: t('nav.long_short_ratio'), href: withLng('/long-short-ratio') },
        { name: t('nav.aggregated_orderbook'), href: withLng('/aggregated-orderbook') },
        { name: t('nav.liquidation_data'), href: withLng('/liquidation-data') },
        { name: t('nav.prediction_market'), href: withLng('/prediction-market') },
        { name: t('nav.public_companies'), href: withLng('/public-companies') },
      ],
    },
    { 
      name: t('nav.whales'), 
      href: withLng('/whale-tracking/discover'),
      children: [
        { name: t('nav.discover'), href: withLng('/whale-tracking/discover') },
        { name: t('nav.realtime_whales'), href: withLng('/whale-tracking/realtime') },
        { name: t('nav.whale_holdings'), href: withLng('/whale-tracking/holdings') },
      ]
    },
    { name: t('nav.dashboard'), href: withLng('/dashboard') },
  ];

  const searchItems = useMemo(() => {
    const items: Array<{ label: string; href: string; group: string }> = []

    // Flatten navbar items (including children)
    for (const link of navLinks) {
      items.push({ label: link.name, href: link.href, group: t('nav.home') })
      if (link.children?.length) {
        for (const child of link.children) {
          items.push({ label: child.name, href: child.href, group: link.name })
        }
      }
    }

    // Also include catalog nav items (in case navLinks fallback differs)
    for (const x of catalogItems) {
      if (x.kind !== 'nav' || !x.href) continue
      const href = normalizeHref(x.href)
      items.push({ label: t(x.labelKey), href, group: t('nav.data') })
    }

    // De-dup by href
    const seen = new Set<string>()
    return items.filter((it) => {
      if (seen.has(it.href)) return false
      seen.add(it.href)
      return true
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- normalizeHref depends on currentLng
  }, [catalogItems, currentLng, t])

  const filteredSearchItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return searchItems.slice(0, 8)
    const hits = searchItems
      .filter((it) => it.label.toLowerCase().includes(q) || it.href.toLowerCase().includes(q))
      .slice(0, 12)
    return hits
  }, [searchItems, searchQuery])

  const indicatorEntries = useMemo(() => {
    // Use catalog chartSeries/chartOverlay. Prefer href (full page) when present; otherwise route to trade as a fallback.
    const entries: SearchEntry[] = []
    for (const x of catalogItems) {
      if (x.kind !== 'chartSeries' && x.kind !== 'chartOverlay') continue
      const label = t(x.labelKey)
      const href = x.href ? normalizeHref(x.href) : withLng('/trade')
      entries.push({
        id: `indicator:${x.id}`,
        type: 'indicator',
        label,
        subtitle: x.href ? t('chart.indicator.openFull') : t('nav.trade') ?? '行情',
        href,
        keywords: [x.id, x.group || '', x.kind],
      })
    }
    return entries
  // eslint-disable-next-line react-hooks/exhaustive-deps -- normalizeHref depends on currentLng
  }, [catalogItems, currentLng, t])

  const hotCoins = useMemo(() => {
    // Reuse the same market list used by TopBar, so search + top bar stay consistent.
    const futuresAgg = getMockMarketList({ marketType: 'futures', isAggregated: true, selectedExchange: 'binance' })
    const spotAgg = getMockMarketList({ marketType: 'spot', isAggregated: true, selectedExchange: 'binance' })

    // Merge by base
    const spotByBase = new Map(spotAgg.map((x) => [x.base, x]))
    return futuresAgg.slice(0, 10).map((f) => {
      const s = spotByBase.get(f.base)
      const name = f.base // No coin metadata yet; keep symbol as name for now.
      const price = f.price
      const changePct = f.changePct
      const perpTurnoverUsd = f.volume
      const spotTurnoverUsd = s?.volume ?? f.volume * 0.6
      // rough: market cap placeholder based on turnover (until real backend wired)
      const marketCapUsd = Math.max(perpTurnoverUsd, spotTurnoverUsd) * 20
      return {
        name,
        symbol: f.base,
        marketCapUsd,
        perpTurnoverUsd,
        spotTurnoverUsd,
        price,
        changePct,
      }
    })
  }, [])

  // Optional backend merge: if user has token, enrich the searchable universe with backend trading pairs bases.
  // This endpoint is RequireAuth, so without user system it will just be skipped.
  useEffect(() => {
    if (!ENABLE_GLOBAL_SEARCH) return
    if (!searchOpen) return
    const token = getToken()
    if (!token) return

    let cancelled = false

    ;(async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/markets/pairs`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        })

        if (!res.ok) return
        const data = (await res.json()) as Array<{ baseAsset?: string; quoteAsset?: string; enabled?: boolean }>
        if (!Array.isArray(data)) return

        const bases = Array.from(
          new Set(
            data
              .filter((x) => (x?.enabled ?? true) !== false)
              .filter((x) => !x.quoteAsset || x.quoteAsset === 'USDT')
              .map((x) => (x.baseAsset ? String(x.baseAsset).toUpperCase() : ''))
              .filter(Boolean),
          ),
        ).slice(0, 200)

        if (!cancelled) setExtraBases(bases)
      } catch {
        // ignore
      }
    })()

    return () => {
      cancelled = true
    }
  }, [ENABLE_GLOBAL_SEARCH, searchOpen])

  const featureShortcuts = useMemo(() => {
    // Use existing routes (no user system required).
    return [
      { label: 'Hyperliquid鲸鱼实时监控', href: withLng('/whale-tracking/realtime') },
      { label: '资金费率', href: withLng('/trade') }, // placeholder route (trade page has funding UI)
      { label: '牛市逃顶信号清单', href: withLng('/dashboard') }, // placeholder
      { label: '爆仓数据', href: withLng('/liquidation-data') },
      { label: '潜力币筛选器', href: withLng('/dashboard') }, // placeholder
    ]
  }, [withLng])

  const addressCandidate = useMemo(() => {
    const q = searchQuery.trim()
    if (/^0x[a-fA-F0-9]{6,}$/.test(q)) return q
    return null
  }, [searchQuery])

  const toTradeHref = (base: string) => {
    const symbol = `${base.toUpperCase()}USDT`
    return withLng(`/trade?symbol=${encodeURIComponent(symbol)}&marketType=futures`)
  }

  const baseEntries = useMemo(() => {
    const entries: SearchEntry[] = []

    // Coins
    const hotSymbols = new Set(hotCoins.map((c) => c.symbol))
    for (const c of hotCoins) {
      entries.push({
        id: `coin:${c.symbol}`,
        type: 'coin',
        label: `${c.name} (${c.symbol})`,
        subtitle: `行情 · ${c.symbol}USDT`,
        href: toTradeHref(c.symbol),
        keywords: [c.name, c.symbol, `${c.symbol}USDT`, 'coin', 'ticker'],
      })
    }
    // Add extra bases from backend (if any) that are not in the hot list.
    for (const base of extraBases) {
      if (hotSymbols.has(base)) continue
      entries.push({
        id: `coin:${base}`,
        type: 'coin',
        label: `${base}`,
        subtitle: `行情 · ${base}USDT`,
        href: toTradeHref(base),
        keywords: [base, `${base}USDT`, 'coin', 'pair'],
      })
    }

    // Features
    for (const x of featureShortcuts) {
      entries.push({
        id: `feature:${x.href}`,
        type: 'feature',
        label: x.label,
        subtitle: '功能',
        href: x.href,
        keywords: [x.label],
      })
    }

    // Pages (nav items)
    for (const it of searchItems) {
      entries.push({
        id: `page:${it.href}`,
        type: 'page',
        label: it.label,
        subtitle: it.group,
        href: it.href,
        keywords: [it.label, it.group, it.href],
      })
    }

    // Indicators
    for (const ind of indicatorEntries) {
      entries.push(ind)
    }

    // De-dup by href+label+type
    const seen = new Set<string>()
    return entries.filter((e) => {
      const k = `${e.type}:${e.href}:${e.label}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
  }, [featureShortcuts, hotCoins, indicatorEntries, searchItems, toTradeHref])

  const addressEntries = useMemo(() => {
    if (!addressCandidate) return []
    const a = addressCandidate
    return [
      {
        id: `address:${a}`,
        type: 'address',
        label: a,
        subtitle: '钱包 / 合约地址 · 查看画像',
        href: withLng(`/whale-tracking/profile?address=${encodeURIComponent(a)}`),
      } satisfies SearchEntry,
    ]
  }, [addressCandidate, withLng])

  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) {
      // Default view: show grouped sections even without query.
      const coins = baseEntries.filter((e) => e.type === 'coin').slice(0, 12)
      const features = baseEntries.filter((e) => e.type === 'feature').slice(0, 8)
      const indicators = baseEntries.filter((e) => e.type === 'indicator').slice(0, 8)
      const pages = baseEntries.filter((e) => e.type === 'page').slice(0, 8)
      return [...addressEntries, ...coins, ...features, ...indicators, ...pages]
    }

    function scoreEntry(e: SearchEntry): number {
      const hay = [e.label, e.subtitle ?? '', ...(e.keywords ?? [])].join(' ').toLowerCase()
      if (!hay.includes(q)) return -1
      // simple scoring: startsWith > includes; shorter is better
      let s = 0
      if (e.label.toLowerCase().startsWith(q)) s += 50
      if ((e.keywords ?? []).some((k) => String(k).toLowerCase().startsWith(q))) s += 30
      s += Math.max(0, 20 - e.label.length / 5)
      return s
    }

    const hits = baseEntries
      .map((e) => ({ e, s: scoreEntry(e) }))
      .filter((x) => x.s >= 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 30)
      .map((x) => x.e)

    return [...addressEntries, ...hits]
  }, [addressEntries, baseEntries, searchQuery])

  // Use a single active index across ALL selectable entries.
  useEffect(() => {
    if (!ENABLE_GLOBAL_SEARCH) return
    setActiveIndex(0)
  }, [ENABLE_GLOBAL_SEARCH, searchQuery, searchOpen])

  // Keep activeIndex within bounds when list changes.
  useEffect(() => {
    if (!ENABLE_GLOBAL_SEARCH) return
    if (activeIndex < 0) {
      setActiveIndex(0)
      return
    }
    if (filteredEntries.length === 0) {
      if (activeIndex !== 0) setActiveIndex(0)
      return
    }
    if (activeIndex > filteredEntries.length - 1) {
      setActiveIndex(filteredEntries.length - 1)
    }
  }, [ENABLE_GLOBAL_SEARCH, activeIndex, filteredEntries.length])

  useEffect(() => {
    if (!ENABLE_GLOBAL_SEARCH) return
    // Global hotkey: "/" to focus search
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      const isTyping =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          (target as any).isContentEditable)

      if (!isTyping && e.key === '/') {
        e.preventDefault()
        setSearchOpen(true)
        setTimeout(() => searchInputRef.current?.focus(), 0)
      }

      if (searchOpen && e.key === 'Escape') {
        setSearchOpen(false)
        setActiveIndex(0)
        searchInputRef.current?.blur()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [ENABLE_GLOBAL_SEARCH, searchOpen])

  useEffect(() => {
    if (!ENABLE_GLOBAL_SEARCH) return
    // Close on click outside
    const onDown = (e: MouseEvent) => {
      if (!searchWrapRef.current) return
      if (!searchWrapRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
        setActiveIndex(0)
      }
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [ENABLE_GLOBAL_SEARCH])

  useEffect(() => {
    if (!ENABLE_GLOBAL_SEARCH) return
    // Close on route change
    setSearchOpen(false)
    setActiveIndex(0)
  }, [ENABLE_GLOBAL_SEARCH, pathname])

  useEffect(() => {
    if (!ENABLE_GLOBAL_SEARCH) return
    // Prevent body scroll when modal is open
    if (!searchOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [ENABLE_GLOBAL_SEARCH, searchOpen])

  useEffect(() => {
    if (!ENABLE_GLOBAL_SEARCH) return
    // Reset active index when query changes
    setActiveIndex(0)
  }, [ENABLE_GLOBAL_SEARCH, searchQuery])

  const handleSelectSearchItem = (href: string) => {
    setSearchOpen(false)
    setSearchQuery('')
    setActiveIndex(0)
    router.push(href)
  }

  const formatCompactZh = (n: number) => {
    // minimal zh compact formatting: 亿/万亿 (fallback)
    if (!Number.isFinite(n)) return '0'
    if (n >= 1e12) return `${(n / 1e12).toFixed(2)}万亿`
    if (n >= 1e8) return `${(n / 1e8).toFixed(2)}亿`
    return `${Math.round(n)}`
  }

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
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary font-semibold">
          {mid}
        </span>
        {after}
      </>
    )
  }

  return (
    <nav className="h-20 bg-[#0d1117] border-b border-[#30363d] px-8 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-12">
        <Link href={withLng('/')} className="flex items-center gap-3 no-underline">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary to-secondary shadow-lg shadow-primary/20" />
          <div className="flex flex-col">
            <span className="text-white font-bold text-xl leading-tight">Coinflux</span>
            <span className="text-[#8b949e] text-xs">Crypto Data Aggregation</span>
          </div>
        </Link>
        
        <div className="hidden md:flex items-center gap-8 h-full">
            {navLinks.map((link) => {
            const isActive = pathname === link.href || (link.children && link.children.some(child => pathname === child.href));
            
            if (link.children) {
              return (
                <div key={link.name} className="relative group h-full flex items-center">
                  <Link 
                    href={link.href}
                    className={`font-medium transition-colors flex items-center gap-1 h-full transition-all cursor-pointer no-underline relative ${
                      isActive 
                        ? 'text-[#e6edf3]' 
                        : 'text-[#8b949e] hover:text-[#e6edf3]'
                    } text-body`}
                  >
                    {link.name}
                    <ChevronDown className="w-4 h-4 transition-transform group-hover:rotate-180" />
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary to-secondary" />
                    )}
                  </Link>
                  
                  {/* Dropdown Menu */}
                  <div className="absolute top-[95%] left-0 w-48 bg-[#161b22] border border-[#30363d] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-2 group-hover:translate-y-0 overflow-hidden z-50">
                    <div className="py-1">
                      {link.children.map((child) => (
                        <Link 
                          key={child.name} 
                          href={child.href}
                          className={`block px-4 py-2.5 text-caption transition-colors ${
                            pathname === child.href 
                              ? 'bg-gradient-to-r from-primary to-secondary text-white' 
                              : 'text-[#c9d1d9] hover:bg-primary/10 hover:text-primary'
                          }`}
                        >
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <Link 
                key={link.name} 
                href={link.href} 
                className={`font-medium transition-colors no-underline flex items-center h-full transition-all relative ${
                  isActive 
                    ? 'text-[#e6edf3]' 
                    : 'text-[#8b949e] hover:text-[#e6edf3]'
                } text-body`}
              >
                {link.name}
                {isActive && (
                  <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary to-secondary" />
                )}
              </Link>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-4">
        {ENABLE_GLOBAL_SEARCH && (
          <div className="relative group" ref={searchWrapRef}>
            <svg width="0" height="0" className="absolute">
              <defs>
                <linearGradient id="search_icon_gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--color-primary)" />
                  <stop offset="100%" stopColor="var(--color-secondary)" />
                </linearGradient>
              </defs>
            </svg>
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8b949e] group-focus-within:text-primary transition-colors z-10"
              style={{
                stroke: 'url(#search_icon_gradient)',
              }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-md opacity-0 group-focus-within:opacity-100 transition-opacity p-[1.5px] pointer-events-none">
              <div className="w-full h-full bg-[#0d1117] rounded-[5px]" />
            </div>
            <button
              type="button"
              className="bg-[#21262d] border border-[#30363d] rounded-md pl-10 pr-4 py-2 text-caption text-[#e6edf3] transition-all w-64 relative z-0 text-left"
              onClick={() => {
                setSearchOpen(true)
                setTimeout(() => searchInputRef.current?.focus(), 0)
              }}
              aria-label={t('nav.search')}
            >
              <span className="text-[#8b949e]">{t('nav.search')}</span>
              <span className="ml-2 text-[11px] text-[#8b949e] opacity-70">/</span>
            </button>
          </div>
        )}
        {ENABLE_USER_SYSTEM && (
          <>
            <button 
              type="button" 
              className="px-4 py-2 text-label font-medium text-[#e6edf3] hover:text-white transition-colors"
              onClick={() => info('Coming Soon')}
            >
              {t('nav.login')}
            </button>
            <button 
              type="button" 
              className="px-6 py-2 text-label font-medium bg-gradient-to-r from-primary to-secondary rounded-md text-white shadow-lg shadow-primary/20 hover:opacity-90 transition-all active:scale-95"
              onClick={() => info('Coming Soon')}
            >
              {t('nav.register')}
            </button>
          </>
        )}
        <LanguageSwitcher />
      </div>

      {/* Global Search Modal (Coinglass-style) */}
      {ENABLE_GLOBAL_SEARCH && searchOpen && (
        <div className="fixed inset-0 z-[100]">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => {
              setSearchOpen(false)
              setSearchQuery('')
              setActiveIndex(0)
            }}
          />
          <div className="relative mx-auto mt-20 w-[920px] max-w-[92vw]">
            <div className="bg-[#0d1117] border border-[#30363d] rounded-2xl shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-[#30363d] flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 flex-1">
                  <div className="relative flex-1">
                    <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary rounded-xl opacity-100 p-[1.5px]">
                      <div className="w-full h-full bg-[#0d1117] rounded-[11px]" />
                    </div>
                    <div className="relative flex items-center">
                      <Search
                        className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5"
                        style={{ stroke: 'url(#search_icon_gradient)' }}
                      />
                      <input
                        ref={searchInputRef}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="搜索币种、指标、合约地址"
                        className="w-full bg-transparent pl-12 pr-12 py-3 text-sm text-[#e6edf3] placeholder-[#8b949e] focus:outline-none"
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') {
                            e.preventDefault()
                            setSearchOpen(false)
                            setSearchQuery('')
                            setActiveIndex(0)
                            return
                          }
                          if (e.key === 'ArrowDown') {
                            e.preventDefault()
                            setActiveIndex((i) => Math.min(i + 1, Math.max(0, filteredEntries.length - 1)))
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault()
                            setActiveIndex((i) => Math.max(0, i - 1))
                          } else if (e.key === 'Enter') {
                            e.preventDefault()
                            const item = filteredEntries[activeIndex]
                            if (item) handleSelectSearchItem(item.href)
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8b949e] hover:text-[#c9d1d9] transition-colors text-xl"
                        onClick={() => {
                          setSearchOpen(false)
                          setSearchQuery('')
                          setActiveIndex(0)
                        }}
                        aria-label="close"
                      >
                        ×
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="px-6 py-5 max-h-[70vh] overflow-y-auto cf-scrollbar">
                {/* Grouped UI (币种 / 指标 / 地址 / 功能 / 页面), but still one global index for keyboard navigation */}
                {filteredEntries.length === 0 ? (
                  <div className="px-2 py-6 text-sm text-[#8b949e]">未找到匹配项</div>
                ) : (
                  (() => {
                    const groupOrder: Array<{ type: SearchEntryType; title: string }> = [
                      { type: 'address', title: '地址' },
                      { type: 'coin', title: '币种' },
                      { type: 'indicator', title: '指标' },
                      { type: 'feature', title: '功能' },
                      { type: 'page', title: '页面' },
                    ]

                    let globalIdx = 0
                    const sections = groupOrder
                      .map((g) => ({
                        ...g,
                        items: filteredEntries.filter((e) => e.type === g.type),
                      }))
                      .filter((s) => s.items.length > 0)

                    return (
                      <div className="space-y-6">
                        {sections.map((section) => {
                          return (
                            <div key={section.type}>
                              <div className="text-xs text-[#8b949e] mb-2 flex items-center justify-between">
                                <span>{section.title}</span>
                                {section.type === 'coin' && extraBases.length > 0 && (
                                  <span className="text-[11px] text-[#8b949e] opacity-70">
                                    已合并后端交易对：{extraBases.length}
                                  </span>
                                )}
                              </div>
                              <div className="space-y-2">
                                {section.items.map((entry) => {
                                  const idx = globalIdx++
                                  const isActive = idx === activeIndex

                                  return (
                                    <button
                                      key={entry.id}
                                      type="button"
                                      onMouseEnter={() => setActiveIndex(idx)}
                                      onClick={() => handleSelectSearchItem(entry.href)}
                                      className={`w-full text-left px-4 py-3 rounded-xl border transition-colors flex items-center justify-between gap-4 ${
                                        isActive
                                          ? 'bg-[#1f2937] border-[#30363d]'
                                          : 'bg-[#161b22] border-[#30363d] hover:bg-[#21262d]'
                                      }`}
                                    >
                                      <div className="min-w-0">
                                        <div className="text-sm text-[#e6edf3] truncate">
                                          {highlight(entry.label)}
                                        </div>
                                        <div className="text-[11px] text-[#8b949e] truncate">
                                          {entry.subtitle ?? section.title}
                                        </div>
                                      </div>
                                      <div className="text-[11px] text-[#8b949e] flex-none">↵</div>
                                    </button>
                                  )
                                })}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
};
