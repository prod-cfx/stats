'use client'

import type { OpenInterestApiItem } from '@/lib/api'
import { AlertCircle, ArrowUpDown, ChevronDown, ChevronUp, Loader2, Search } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SectionTitle } from '@/components/ui/Typography'
import { fetchAggregatedOpenInterest } from '@/lib/api'
import { AuthenticationError } from '@/lib/errors'

interface OIData {
  id: string
  rank: number | string
  exchange: string
  logo: string
  oiAsset: number
  oiUsd: number
  ratioPct: number
  change1hPct: number
  change4hPct: number
  change24hPct: number
  oiVolRatio: number
  isTotal?: boolean
}

type SortField = 'oiAsset' | 'oiUsd' | 'ratioPct' | 'change1hPct' | 'change4hPct' | 'change24hPct' | null
type SortDirection = 'asc' | 'desc' | null

// Prefer consistent brand logos, but be resilient: many public logo/CDN domains can be blocked/slow.
// We therefore try multiple sources in order and fall back to an inline SVG if all fail.
const EXCHANGE_LOGO_SOURCES: Record<string, string[]> = {
  CME: ['/images/exchanges/cme.png'],
  Binance: ['/images/exchanges/binance.png'],
  OKX: ['/images/exchanges/okx.png'],
  Bybit: ['/images/exchanges/bybit.png'],
  KuCoin: ['/images/exchanges/kucoin.png'],
  Bitfinex: ['/images/exchanges/bitfinex.png'],
  Bitget: ['/images/exchanges/bitget.png'],
  MEXC: ['/images/exchanges/mexc.png'],
  Hyperliquid: ['/images/exchanges/hyperliquid.png'],
  Gate: ['/images/exchanges/gate.png'],
  'Gate.io': ['/images/exchanges/gate.png'],
  Aster: ['/images/exchanges/aster.png'],
  Lighter: ['/images/exchanges/lighter.svg'],
  Deribit: ['/images/exchanges/deribit.png'],
  Coinbase: ['/images/exchanges/coinbase.png'],
  Kraken: ['/images/exchanges/kraken.png'],
  HTX: ['/images/exchanges/htx.png'],
  Huobi: ['/images/exchanges/htx.png'],
  dYdX: ['https://dydx.exchange/favicon.ico'],
}

const buildMonogramSvgDataUri = (letter: string) =>
  `data:image/svg+xml;utf8,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64">
      <defs>
        <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#6366f1"/>
          <stop offset="1" stop-color="#ec4899"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="64" height="64" rx="32" fill="var(--cf-bg)"/>
      <circle cx="32" cy="32" r="22" fill="url(#g)" opacity="0.35"/>
      <text x="32" y="39" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, Roboto, Arial" font-size="20" font-weight="800" fill="var(--cf-text-strong)">${letter}</text>
    </svg>`,
  )}`

const getExchangeLogoCandidates = (exchange: string, fallback: string) => {
  // Try to match case-insensitive
  const key = Object.keys(EXCHANGE_LOGO_SOURCES).find(k => k.toLowerCase() === exchange.toLowerCase())
  const candidates = key ? EXCHANGE_LOGO_SOURCES[key] : []
  
  const out = [...candidates]
  if (fallback && !fallback.includes('coinmarketcap')) out.push(fallback) // Only use fallback if it's not the generic CMC one which might be broken/blocked
  // Always end with a deterministic inline fallback.
  out.push(buildMonogramSvgDataUri(exchange.slice(0, 1).toUpperCase()))
  return out
}

function ExchangeLogo({
  exchange,
  fallback,
  className,
}: {
  exchange: string
  fallback: string
  className: string
}) {
  const candidates = useMemo(() => getExchangeLogoCandidates(exchange, fallback), [exchange, fallback])
  const [idx, setIdx] = useState(0)

  // Reset when exchange changes
  useEffect(() => setIdx(0), [exchange])

  const src = candidates[Math.min(idx, candidates.length - 1)]

  return (
    <img
      src={src}
      alt={exchange}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setIdx((i) => Math.min(i + 1, candidates.length - 1))}
    />
  )
}

const symbols = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'HYPE', 'BNB', 'ZEC', 'BCH', 'SUI', 'ADA', 'LINK', 'AVAX']

function transformApiData(apiData: OpenInterestApiItem[]): OIData[] {
  if (!apiData || apiData.length === 0) return []

  // 按交易所去重，保留每个交易所的第一条记录（API 已按 dataTimestamp 降序排列，第一条即最新）
  const deduplicatedData = apiData.reduce((acc, item) => {
    if (!acc.some(existing => existing.exchange === item.exchange)) {
      acc.push(item)
    }
    return acc
  }, [] as OpenInterestApiItem[])

  const totalRow = deduplicatedData.find(item => item.exchange === 'All')
  const exchangeRows = deduplicatedData.filter(item => item.exchange !== 'All')
  const totalOiUsd = totalRow?.open_interest_usd ?? exchangeRows.reduce((sum, item) => sum + (item.open_interest_usd ?? 0), 0)

  const result: OIData[] = []

  if (totalRow) {
    result.push({
      id: 'total',
      rank: '',
      exchange: 'ALL',
      logo: '',
      oiAsset: totalRow.open_interest_quantity,
      oiUsd: totalRow.open_interest_usd,
      ratioPct: 100,
      change1hPct: totalRow.open_interest_change_percent_1h ?? 0,
      change4hPct: totalRow.open_interest_change_percent_4h ?? 0,
      change24hPct: totalRow.open_interest_change_percent_24h ?? 0,
      oiVolRatio: 0,
      isTotal: true,
    })
  }

  const sortedExchanges = [...exchangeRows].sort((a, b) => b.open_interest_usd - a.open_interest_usd)

  sortedExchanges.forEach((item, index) => {
    result.push({
      id: `${item.exchange}-${index}`,
      rank: index + 1,
      exchange: item.exchange,
      logo: '', // Logo will be handled by ExchangeLogo component
      oiAsset: item.open_interest_quantity,
      oiUsd: item.open_interest_usd,
      ratioPct: totalOiUsd > 0 ? (item.open_interest_usd / totalOiUsd) * 100 : 0,
      change1hPct: item.open_interest_change_percent_1h ?? 0,
      change4hPct: item.open_interest_change_percent_4h ?? 0,
      change24hPct: item.open_interest_change_percent_24h ?? 0,
      oiVolRatio: 0,
      isTotal: false,
    })
  })

  return result
}

export function AggregatedOI({ variant = 'default' }: { variant?: 'default' | 'compact' }) {
  const { t, i18n } = useTranslation()
  const [activeSymbol, setActiveSymbol] = useState('BTC')
  const [sortField, setSortField] = useState<SortField>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [data, setData] = useState<OIData[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [needsAuth, setNeedsAuth] = useState(false)

  const isCompact = variant === 'compact'

  const loadData = useCallback(async (symbol: string) => {
    setLoading(true)
    setError(null)
    setNeedsAuth(false)

    try {
      const apiData = await fetchAggregatedOpenInterest({ symbol })
      const transformed = transformApiData(apiData)
      setData(transformed)
    } catch (err) {
      if (err instanceof AuthenticationError) {
        setNeedsAuth(true)
        setError(t('aggregatedOrderbook.openInterest.authRequired'))
      } else {
        setError(t('aggregatedOrderbook.openInterest.loadError'))
      }
      setData([])
    } finally {
      setLoading(false)
    }
  }, [t])

  useEffect(() => {
    loadData(activeSymbol)
  }, [activeSymbol, loadData])

  const numberCompact = useMemo(() => {
    const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US'
    return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 2 })
  }, [i18n.language])

  const currencyCompact = useMemo(() => {
    const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US'
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 })
  }, [i18n.language])

  const sortedData = useMemo(() => {
    if (!sortField || !sortDirection) return data

    const exchangeRows = data.filter(row => !row.isTotal)
    const totalRow = data.find(row => row.isTotal)

    exchangeRows.sort((a, b) => {
      const aVal = a[sortField as keyof OIData] as number
      const bVal = b[sortField as keyof OIData] as number
      return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
    })

    return totalRow ? [totalRow, ...exchangeRows] : exchangeRows
  }, [sortField, sortDirection, data])

  const formatSignedPct = (val: number) => `${val >= 0 ? '+' : ''}${val.toFixed(2)}%`
  const formatRatio = (val: number) => `${val.toFixed(2)}%`
  const formatAssetAmount = (val: number) => `${numberCompact.format(val)} ${activeSymbol}`

  const filteredSymbols = useMemo(() => {
    return symbols.filter(s => s.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [searchQuery])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDirection === 'desc') {
        setSortDirection('asc')
      } else if (sortDirection === 'asc') {
        setSortField(null)
        setSortDirection(null)
      } else {
        setSortDirection('desc')
      }
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-[color:var(--cf-muted)] opacity-30 group-hover:opacity-100 transition-opacity" />
    return sortDirection === 'desc'
      ? <ChevronDown className="w-3 h-3 text-primary" />
      : <ChevronUp className="w-3 h-3 text-primary" />
  }

  const renderValueWithColor = (val: number) => {
    const isPositive = val > 0
    const isNegative = val < 0
    return (
      <span className={isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-[color:var(--cf-text-strong)]'}>
        {formatSignedPct(val)}
      </span>
    )
  }

  const renderError = () => (
    <div className="flex flex-col items-center justify-center py-12 gap-4">
      <AlertCircle className={`w-12 h-12 ${needsAuth ? 'text-yellow-500' : 'text-red-500'}`} />
      <p className="text-[color:var(--cf-muted)] text-center">{error}</p>
      {!needsAuth && (
        <button
          type="button"
          onClick={() => loadData(activeSymbol)}
          className="px-4 py-2 bg-primary/20 text-primary rounded-md hover:bg-primary/30 transition-colors"
        >
          {t('common.retry')}
        </button>
      )}
    </div>
  )

  return (
    <div className={`flex flex-col h-full ${isCompact ? 'gap-2' : 'gap-6'}`}>
      <div className="flex items-center justify-between">
        <SectionTitle className={isCompact ? '!text-sm' : ''}>{t('aggregatedOrderbook.openInterest.title', { symbol: activeSymbol })}</SectionTitle>
      </div>

      <div className={`flex flex-col flex-1 min-h-0 bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-xl overflow-hidden ${isCompact ? '' : 'shadow-2xl'}`}>
        {/* Symbol Tabs & Search */}
        <div className={`flex items-center justify-between px-4 border-b border-[color:var(--cf-border)] bg-[color:var(--cf-bg)]/30 ${isCompact ? 'py-1 flex-row-reverse' : ''}`}>
          {!isCompact ? (
            <div className="flex items-center overflow-x-auto cf-scrollbar">
              {symbols.map(s => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setActiveSymbol(s)}
                  className={`px-4 py-3 text-sm font-semibold transition-all relative whitespace-nowrap ${
                    activeSymbol === s
                      ? 'text-[color:var(--cf-text-strong)]'
                      : 'text-[color:var(--cf-muted)] border-transparent hover:text-[color:var(--cf-text-strong)]'
                  }`}
                >
                  {s}
                  {activeSymbol === s && (
                    <>
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-secondary" />
                      <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
                    </>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex-1" />
          )}
          <div className={`flex items-center gap-2 ${isCompact ? 'pr-4 py-1' : 'pl-4 py-2'}`}>
            <div className="relative" ref={dropdownRef}>
              {isCompact ? (
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center justify-between gap-2 bg-[color:var(--cf-bg)] border border-[color:var(--cf-border)] rounded-md px-2 py-1 text-xs text-[color:var(--cf-text-strong)] hover:border-[color:var(--cf-muted)] transition-all min-w-[80px]"
                >
                  <span className="font-medium">{activeSymbol}</span>
                  <ChevronDown className={`w-3 h-3 text-[color:var(--cf-muted)] transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
              ) : (
                <>
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[color:var(--cf-muted)] z-10" />
                  <input
                    type="text"
                    placeholder={t('aggregatedOrderbook.openInterest.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value)
                      setIsDropdownOpen(true)
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    className="bg-[color:var(--cf-bg)] border border-[color:var(--cf-border)] rounded-md pl-9 pr-10 py-1.5 text-sm text-[color:var(--cf-text-strong)] focus:outline-none focus:border-primary transition-all w-48 relative z-10"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[color:var(--cf-muted)] pointer-events-none z-10">
                    <ChevronDown className={`w-4 h-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
                  </div>
                </>
              )}

              {isDropdownOpen && (
                <div className={`absolute top-full ${isCompact ? 'left-0' : 'right-0'} mt-1 bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-md shadow-xl z-50 overflow-hidden cf-scrollbar ${isCompact ? 'w-32 max-h-48' : 'left-0 max-h-60'}`}>
                  {isCompact && (
                    <div className="p-2 border-b border-[color:var(--cf-border)]">
                      <input
                        type="text"
                        placeholder={t('common.search')}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="w-full bg-[color:var(--cf-bg)] border border-[color:var(--cf-border)] rounded px-2 py-1 text-xs text-[color:var(--cf-text-strong)] focus:outline-none focus:border-primary"
                        autoFocus
                      />
                    </div>
                  )}
                  <div className="overflow-y-auto max-h-40 cf-scrollbar">
                    {(searchQuery ? filteredSymbols : symbols).map(s => (
                      <div
                        key={s}
                        onClick={() => {
                          setActiveSymbol(s)
                          setSearchQuery('')
                          setIsDropdownOpen(false)
                        }}
                        className={`px-4 ${isCompact ? 'py-1.5 text-xs' : 'py-2 text-sm'} text-[color:var(--cf-text-strong)] hover:bg-[color:var(--cf-surface-hover)] cursor-pointer transition-colors ${activeSymbol === s ? 'bg-primary/10 text-primary' : ''}`}
                      >
                        {s}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-8 gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
            <span className="text-[color:var(--cf-muted)]">{t('common.loading')}</span>
          </div>
        )}

        {/* Error State */}
        {!loading && error && renderError()}

        {/* Empty State */}
        {!loading && !error && data.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <p className="text-[color:var(--cf-muted)]">{t('common.noData')}</p>
          </div>
        )}

        {/* Table Area */}
        {!loading && !error && data.length > 0 && (
          <div className="flex-1 overflow-auto cf-scrollbar relative">
            <table className="w-full text-left border-collapse min-w-[800px] md:min-w-[1000px]">
              <thead className="sticky top-0 z-10 bg-[color:var(--cf-bg)]">
                <tr className={`text-[color:var(--cf-muted)] uppercase tracking-wider ${isCompact ? 'text-[10px]' : 'text-[10px] md:text-xs'}`}>
                  <th className={`${isCompact ? 'px-2 py-2' : 'px-3 md:px-4 py-4'} font-bold text-center border-b border-[color:var(--cf-border)] w-10 md:w-16`}>{t('aggregatedOrderbook.openInterest.table.rank')}</th>
                  <th className={`${isCompact ? 'px-2 py-2' : 'px-3 md:px-4 py-4'} font-bold border-b border-[color:var(--cf-border)] sticky left-0 z-20 bg-[color:var(--cf-bg)] border-r border-[color:var(--cf-border)]`}>{t('aggregatedOrderbook.openInterest.table.exchange')}</th>
                  <th className={`${isCompact ? 'px-2 py-2' : 'px-3 md:px-4 py-4'} font-bold text-right border-b border-[color:var(--cf-border)]`}>
                    <button 
                      type="button"
                      onClick={() => handleSort('oiAsset')}
                      className="flex items-center justify-end gap-1 w-full group hover:text-[color:var(--cf-text-strong)] transition-colors"
                    >
                      {isCompact ? t('aggregatedOrderbook.openInterest.table.oiBtc', { symbol: '' }) : t('aggregatedOrderbook.openInterest.table.oiBtc', { symbol: activeSymbol })} {renderSortIcon('oiAsset')}
                    </button>
                  </th>
                  <th className={`${isCompact ? 'px-2 py-2' : 'px-3 md:px-4 py-4'} font-bold text-right border-b border-[color:var(--cf-border)]`}>
                    <button 
                      type="button"
                      onClick={() => handleSort('oiUsd')}
                      className="flex items-center justify-end gap-1 w-full group hover:text-[color:var(--cf-text-strong)] transition-colors"
                    >
                      {t('aggregatedOrderbook.openInterest.table.oiUsd')} {renderSortIcon('oiUsd')}
                    </button>
                  </th>
                  <th className={`${isCompact ? 'px-2 py-2' : 'px-3 md:px-4 py-4'} font-bold text-right border-b border-[color:var(--cf-border)]`}>
                    <button 
                      type="button"
                      onClick={() => handleSort('ratioPct')}
                      className="flex items-center justify-end gap-1 w-full group hover:text-[color:var(--cf-text-strong)] transition-colors"
                    >
                      {t('aggregatedOrderbook.openInterest.table.ratio')} {renderSortIcon('ratioPct')}
                    </button>
                  </th>
                  <th className={`${isCompact ? 'px-2 py-2' : 'px-3 md:px-4 py-4'} font-bold text-right border-b border-[color:var(--cf-border)] hidden sm:table-cell`}>
                    <button 
                      type="button"
                      onClick={() => handleSort('change1hPct')}
                      className="flex items-center justify-end gap-1 w-full group hover:text-[color:var(--cf-text-strong)] transition-colors"
                    >
                      {t('aggregatedOrderbook.openInterest.table.change1h')} {renderSortIcon('change1hPct')}
                    </button>
                  </th>
                  <th className={`${isCompact ? 'px-2 py-2' : 'px-3 md:px-4 py-4'} font-bold text-right border-b border-[color:var(--cf-border)] hidden sm:table-cell`}>
                    <button 
                      type="button"
                      onClick={() => handleSort('change4hPct')}
                      className="flex items-center justify-end gap-1 w-full group hover:text-[color:var(--cf-text-strong)] transition-colors"
                    >
                      {t('aggregatedOrderbook.openInterest.table.change4h')} {renderSortIcon('change4hPct')}
                    </button>
                  </th>
                  <th className={`${isCompact ? 'px-2 py-2' : 'px-3 md:px-4 py-4'} font-bold text-right border-b border-[color:var(--cf-border)]`}>
                    <button 
                      type="button"
                      onClick={() => handleSort('change24hPct')}
                      className="flex items-center justify-end gap-1 w-full group hover:text-[color:var(--cf-text-strong)] transition-colors"
                    >
                      {t('aggregatedOrderbook.openInterest.table.change24h')} {renderSortIcon('change24hPct')}
                    </button>
                  </th>
                  <th className={`${isCompact ? 'px-2 py-2' : 'px-3 md:px-4 py-4'} font-bold text-center border-b border-[color:var(--cf-border)] hidden md:table-cell`}>{t('aggregatedOrderbook.openInterest.table.oiVolRatio')}</th>
                </tr>
              </thead>
              <tbody className={isCompact ? 'text-xs' : 'text-[11px] md:text-sm'}>
                {sortedData.map((row) => (
                  <tr 
                    key={row.id} 
                    className={`border-b border-[color:var(--cf-border)]/50 hover:bg-[color:var(--cf-surface-hover)]/30 transition-colors ${
                      row.isTotal ? 'bg-[color:var(--cf-surface-2)]/20 font-bold' : ''
                    }`}
                  >
                    <td className={`${isCompact ? 'px-2 py-2' : 'px-3 md:px-4 py-4'} text-center text-[color:var(--cf-muted)]`}>{row.rank}</td>
                    <td className={`${isCompact ? 'px-2 py-2' : 'px-3 md:px-4 py-4'} sticky left-0 z-10 bg-[color:var(--cf-surface)] border-r border-[color:var(--cf-border)] group-hover:bg-[color:var(--cf-surface-hover)]/30 ${row.isTotal ? 'bg-[color:var(--cf-surface-2)]' : ''}`}>
                      <div className="flex items-center gap-2">
                        <div className={`${isCompact ? 'w-3.5 h-3.5' : 'w-4 h-4 md:w-5 md:h-5'} rounded-full overflow-hidden flex-none border border-[color:var(--cf-border)]`}>
                          <ExchangeLogo
                            exchange={row.exchange}
                            fallback={row.logo}
                            className="w-full h-full object-contain bg-[color:var(--cf-bg)]"
                          />
                        </div>
                        <span className={`${row.isTotal ? 'text-[color:var(--cf-text-strong)] font-bold' : 'text-[color:var(--cf-text)]'} truncate max-w-[60px] md:max-w-none`}>
                          {row.isTotal ? t('common.all') : row.exchange}
                        </span>
                      </div>
                    </td>
                    <td className={`${isCompact ? 'px-2 py-2' : 'px-3 md:px-4 py-4'} text-right text-[color:var(--cf-text-strong)]`}>{formatAssetAmount(row.oiAsset)}</td>
                    <td className={`${isCompact ? 'px-2 py-2' : 'px-3 md:px-4 py-4'} text-right text-[color:var(--cf-text-strong)]`}>{currencyCompact.format(row.oiUsd)}</td>
                    <td className={`${isCompact ? 'px-2 py-2' : 'px-3 md:px-4 py-4'} text-right text-[color:var(--cf-text-strong)]`}>{formatRatio(row.ratioPct)}</td>
                    <td className={`${isCompact ? 'px-2 py-2' : 'px-3 md:px-4 py-4'} text-right font-medium hidden sm:table-cell`}>{renderValueWithColor(row.change1hPct)}</td>
                    <td className={`${isCompact ? 'px-2 py-2' : 'px-3 md:px-4 py-4'} text-right font-medium hidden sm:table-cell`}>{renderValueWithColor(row.change4hPct)}</td>
                    <td className={`${isCompact ? 'px-2 py-2' : 'px-3 md:px-4 py-4'} text-right font-medium`}>{renderValueWithColor(row.change24hPct)}</td>
                    <td className={`${isCompact ? 'px-2 py-2' : 'px-3 md:px-4 py-4'} text-center text-[color:var(--cf-muted)] hidden md:table-cell`}>{row.oiVolRatio.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
