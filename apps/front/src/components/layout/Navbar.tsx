'use client';

import { ChevronDown, Menu, Search, X } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CoinfluxMark } from '@/components/ui/CoinfluxMark'
import { useToast } from '@/components/ui/toast'
import { getMockMarketList } from '@/lib/market-data/mock-market-list'
import { useMarketDataCatalog } from '@/lib/market-data/useMarketDataCatalog'
import { LanguageSwitcher } from './LanguageSwitcher';
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
  const pathname = usePathname();
  const router = useRouter()
  const { t } = useTranslation();
  const { info: _info } = useToast();
  const searchInputRef = useRef<HTMLInputElement>(null)
  const searchWrapRef = useRef<HTMLDivElement>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const [extraBases, _setExtraBases] = useState<string[]>([])
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [expandedMobileMenus, setExpandedMobileMenus] = useState<string[]>([])

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

  const whaleChildren = [
    { name: t('nav.discover'), href: withLng('/whale-tracking/discover') },
    { name: t('nav.realtime_whales'), href: withLng('/whale-tracking/realtime') },
    { name: t('nav.whale_holdings'), href: withLng('/whale-tracking/holdings') },
  ]

  const navLinks = [
    { name: t('nav.home'), href: withLng('/') },
    { 
      name: t('nav.data'), 
      href: '#',
      children: dataChildren
    },
    {
      name: t('nav.whales'),
      href: '#',
      children: whaleChildren
    },
    { name: t('nav.dashboard'), href: withLng('/dashboard') },
  ];

  // Close mobile menu when route changes
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  // 获取热门搜索建议（示例）
  // 实际场景：可以基于 extraBases 或 mock market list 动态生成
  const searchResults: SearchEntry[] = useMemo(() => {
    if (!searchQuery) return []
    
    const q = searchQuery.toLowerCase()
    const results: SearchEntry[] = []

    // 1. Pages
    if ('dashboard'.includes(q) || '看板'.includes(q)) {
      results.push({ id: 'p-dash', type: 'page', label: t('nav.dashboard'), href: withLng('/dashboard') })
    }
    if ('liquidation'.includes(q) || 'map'.includes(q) || '清算'.includes(q)) {
      results.push({ id: 'p-liq', type: 'page', label: t('nav.liquidation_map'), href: withLng('/liquidation-map') })
    }

    // 2. Coins (Mock data + extraBases)
    const mockList = getMockMarketList() // { base, quote, ... }
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
      if ((m.base.toLowerCase().includes(q) || m.symbol.toLowerCase().includes(q)) && !seen.has(m.base)) {
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
    e.preventDefault();
    if (searchResults.length > 0) {
      router.push(searchResults[activeIndex].href)
      setSearchOpen(false)
    } else {
      // 默认搜索跳转
      // router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
    }
  };

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
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // 快捷键 / (Focus search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && !searchOpen && !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [searchOpen]);

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
        <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary font-semibold">
          {mid}
        </span>
        {after}
      </>
    )
  }

  const toggleMobileSubmenu = (name: string) => {
    setExpandedMobileMenus(prev => 
      prev.includes(name) 
        ? prev.filter(item => item !== name)
        : [...prev, name]
    )
  }

  return (
    <nav className="h-16 md:h-20 bg-[color:var(--cf-bg)] border-b border-[color:var(--cf-border)] px-4 md:px-8 flex items-center justify-between sticky top-0 z-50">
      <div className="flex items-center gap-4 md:gap-12">
        <div className="flex items-center gap-3">
          {/* Mobile Menu Button */}
          <button 
            className="md:hidden text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]"
            onClick={() => setMobileMenuOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </button>
          
          <Link href={withLng('/')} className="flex flex-col no-underline">
            <div className="flex items-center">
              <CoinfluxMark className="w-7 h-7 md:w-10 md:h-10" />
              <span className="text-[color:var(--cf-text-strong)] font-bold text-xl md:text-2xl leading-none tracking-tight -ml-1.5">oinflux</span>
            </div>
            <span className="hidden md:block text-[color:var(--cf-muted)] text-[10px] md:text-xs tracking-wider pl-0.5">Crypto Data Aggregation</span>
          </Link>
        </div>
        
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
                        ? 'text-[color:var(--cf-text-strong)]' 
                        : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]'
                    } text-body`}
                  >
                    {link.name}
                    <ChevronDown className="w-4 h-4 transition-transform group-hover:rotate-180" />
                    {isActive && (
                      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-primary to-secondary" />
                    )}
                  </Link>
                  
                  {/* Dropdown Menu */}
                  <div className="absolute top-[95%] left-0 w-48 bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform translate-y-2 group-hover:translate-y-0 overflow-hidden z-50">
                    <div className="py-1">
                      {link.children.map((child) => (
                        <Link 
                          key={child.name} 
                          href={child.href}
                          className={`block px-4 py-2.5 text-caption transition-colors ${
                            pathname === child.href 
                              ? 'bg-gradient-to-r from-primary to-secondary text-white' 
                              : 'text-[color:var(--cf-text)] hover:bg-primary/10 hover:text-primary'
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
                className={`font-medium transition-colors h-full flex items-center relative ${
                  isActive
                    ? 'text-[color:var(--cf-text-strong)]'
                    : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]'
                }`}
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

      <div className="flex items-center gap-2 md:gap-4">
        {/* Global Search - Phase 1 Hidden */}
        {ENABLE_GLOBAL_SEARCH && (
          <div className="relative" ref={searchWrapRef}>
            <div 
              className={`flex items-center transition-all duration-300 ${
                searchOpen ? 'w-full md:w-80 bg-[color:var(--cf-surface-2)]' : 'w-8 md:w-10 bg-transparent'
              } h-8 md:h-10 rounded-full overflow-hidden`}
            >
              <button 
                onClick={() => {
                  setSearchOpen(!searchOpen)
                  if (!searchOpen) setTimeout(() => searchInputRef.current?.focus(), 100)
                }}
                className="w-8 h-8 md:w-10 md:h-10 flex items-center justify-center text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)] flex-shrink-0"
              >
                <Search className="w-4 h-4 md:w-5 md:h-5" />
              </button>
              
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('nav.search') || 'Search...'}
                className={`w-full h-full bg-transparent border-none outline-none text-sm text-[color:var(--cf-text)] px-2 ${
                  searchOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
              />
              
              {searchOpen && searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="mr-3 text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Search Results Dropdown */}
            {searchOpen && searchQuery && (
              <div className="absolute top-full right-0 mt-2 w-[calc(100vw-32px)] md:w-96 bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-200">
                {searchResults.length > 0 ? (
                  <div className="py-2">
                    {searchResults.map((result, idx) => (
                      <Link
                        key={result.id}
                        href={result.href}
                        onClick={() => setSearchOpen(false)}
                        className={`flex items-center gap-3 px-4 py-3 hover:bg-[color:var(--cf-surface-hover)] transition-colors ${
                          idx === activeIndex ? 'bg-[color:var(--cf-surface-hover)]' : ''
                        }`}
                      >
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                          result.type === 'coin' ? 'bg-primary/10 text-primary' : 
                          result.type === 'page' ? 'bg-purple-500/10 text-purple-500' :
                          'bg-[color:var(--cf-surface-2)] text-[color:var(--cf-muted)]'
                        }`}>
                          {result.type === 'coin' ? 'C' : result.type === 'page' ? 'P' : '#'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-[color:var(--cf-text-strong)] truncate">
                            {highlight(result.label)}
                          </div>
                          {result.subtitle && (
                            <div className="text-xs text-[color:var(--cf-muted)] truncate">{result.subtitle}</div>
                          )}
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-[color:var(--cf-muted)] text-sm">
                    {t('modal.noResults') || 'No results found'}
                  </div>
                )}
                <div className="px-4 py-2 bg-[color:var(--cf-surface-2)] border-t border-[color:var(--cf-border)] flex justify-between text-[10px] text-[color:var(--cf-muted)]">
                  <span>Select <kbd className="font-sans bg-[color:var(--cf-surface)] px-1 rounded">↑↓</kbd></span>
                  <span>Open <kbd className="font-sans bg-[color:var(--cf-surface)] px-1 rounded">Enter</kbd></span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="hidden md:block w-[1px] h-6 bg-[color:var(--cf-border)] mx-1" />
        
        <LanguageSwitcher />
        <ThemeToggle />
        
        {/* User System - Phase 1 Hidden */}
        {ENABLE_USER_SYSTEM && (
          <button className="hidden md:flex px-4 py-2 bg-gradient-to-r from-primary to-secondary hover:opacity-90 text-white rounded-lg text-sm font-bold transition-all shadow-lg shadow-primary/20 active:scale-95">
            {t('nav.login')}
          </button>
        )}
      </div>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-[60] bg-[color:var(--cf-bg)] md:hidden flex flex-col animate-in slide-in-from-top-10 duration-200">
          <div className="h-16 px-4 flex items-center justify-between border-b border-[color:var(--cf-border)]">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary shadow-lg shadow-primary/20 flex items-center justify-center">
                <CoinfluxMark className="w-5 h-5 text-white" />
              </div>
              <span className="text-[color:var(--cf-text-strong)] font-bold text-lg">Coinflux</span>
            </div>
            <button 
              onClick={() => setMobileMenuOpen(false)}
              className="p-2 text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
            {navLinks.map((link) => {
              const hasChildren = link.children && link.children.length > 0;
              const isExpanded = expandedMobileMenus.includes(link.name);
              
              if (hasChildren) {
                return (
                  <div key={link.name} className="flex flex-col">
                    <button 
                      onClick={() => toggleMobileSubmenu(link.name)}
                      className="flex items-center justify-between py-3 px-2 text-lg font-medium text-[color:var(--cf-text-strong)]"
                    >
                      {link.name}
                      <ChevronDown className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                    
                    {isExpanded && (
                      <div className="flex flex-col bg-[color:var(--cf-surface)] rounded-lg overflow-hidden border border-[color:var(--cf-border)] mb-2">
                        {link.children!.map((child) => (
                          <Link
                            key={child.name}
                            href={child.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className="py-3 px-4 text-base text-[color:var(--cf-text)] hover:bg-[color:var(--cf-surface-hover)] border-b border-[color:var(--cf-border)] last:border-0"
                          >
                            {child.name}
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <Link
                  key={link.name}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="py-3 px-2 text-lg font-medium text-[color:var(--cf-text-strong)] border-b border-[color:var(--cf-border)] last:border-0"
                >
                  {link.name}
                </Link>
              );
            })}
            
            {ENABLE_USER_SYSTEM && (
              <div className="mt-6">
                <button className="w-full py-3 bg-gradient-to-r from-primary to-secondary text-white rounded-xl font-bold text-lg shadow-lg shadow-primary/20">
                  {t('nav.login')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};
