'use client'

import type { OpenInterestApiItem } from '@/lib/api'
import { AlertCircle, ArrowUpDown, ChevronDown, ChevronUp, Loader2, Search } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SectionTitle } from '@/components/ui/Typography'
import { fetchAggregatedOpenInterest, fetchAggregatedVolume } from '@/lib/api'
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

type SortField =
  | 'oiAsset'
  | 'oiUsd'
  | 'ratioPct'
  | 'change1hPct'
  | 'change4hPct'
  | 'change24hPct'
  | null
type SortDirection = 'asc' | 'desc' | null

const MOCK_EXCHANGES = [
  'Binance',
  'OKX',
  'Bybit',
  'Hyperliquid',
  'Gate',
  'Bitget',
  'KuCoin',
  'Coinbase',
  'Kraken',
  'Deribit',
  'CME',
  'MEXC',
  'HTX',
  'dYdX',
  'Aster',
  'Lighter',
] as const

function hashStringToSeed(input: string) {
  // Simple deterministic hash -> uint32
  let h = 2166136261
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

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
  const key = Object.keys(EXCHANGE_LOGO_SOURCES).find(
    k => k.toLowerCase() === exchange.toLowerCase(),
  )
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
  const candidates = useMemo(
    () => getExchangeLogoCandidates(exchange, fallback),
    [exchange, fallback],
  )
  const [idx, setIdx] = useState(0)

  const src = candidates[Math.min(idx, candidates.length - 1)]

  return (
    <img
      src={src}
      alt={exchange}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setIdx(i => Math.min(i + 1, candidates.length - 1))}
    />
  )
}

const symbols = [
  'BTC',
  'ETH',
  'SOL',
  'XRP',
  'DOGE',
  'HYPE',
  'BNB',
  'ZEC',
  'BCH',
  'SUI',
  'ADA',
  'LINK',
  'AVAX',
]

type VolumeByExchange = Record<string, number>

function normalizeExchangeName(exchange: string): string {
  const key = exchange.trim().toLowerCase()
  const aliasMap: Record<string, string> = {
    all: 'all',
    // 常见别名/大小写差异
    'gate.io': 'gate',
    gateio: 'gate',
    gate: 'gate',
    huobi: 'htx',
    htx: 'htx',
    okex: 'okx',
    okx: 'okx',
    bybit: 'bybit',
    binance: 'binance',
    hyperliquid: 'hyperliquid',
  }
  return aliasMap[key] ?? key
}

function transformApiData(
  apiData: OpenInterestApiItem[],
  volumeByExchange: VolumeByExchange = {},
): OIData[] {
  if (!apiData || apiData.length === 0) return []

  // 先按时间降序，避免依赖接口返回顺序
  const sortedApiData = [...apiData].sort((a, b) => {
    const at = a.data_timestamp ? Date.parse(a.data_timestamp) : Number.NEGATIVE_INFINITY
    const bt = b.data_timestamp ? Date.parse(b.data_timestamp) : Number.NEGATIVE_INFINITY
    if (!Number.isFinite(at) && !Number.isFinite(bt)) return 0
    if (!Number.isFinite(at)) return 1
    if (!Number.isFinite(bt)) return -1
    return bt - at
  })

  // 按交易所去重，保留每个交易所的第一条记录（即最新）
  const deduplicatedData = sortedApiData.reduce((acc, item) => {
    if (!acc.some(existing => existing.exchange === item.exchange)) {
      acc.push(item)
    }
    return acc
  }, [] as OpenInterestApiItem[])

  const totalRow = deduplicatedData.find(item => item.exchange === 'All')
  const exchangeRows = deduplicatedData.filter(item => item.exchange !== 'All')
  const totalOiUsd =
    totalRow?.open_interest_usd ??
    exchangeRows.reduce((sum, item) => sum + (item.open_interest_usd ?? 0), 0)
  // 总成交额只统计本表中出现的交易所，避免把非 OI 交易所的成交额混入导致总比值失真
  const totalVolumeUsd = exchangeRows.reduce((sum, item) => {
    const v = volumeByExchange[normalizeExchangeName(item.exchange)]
    return Number.isFinite(v) ? sum + v : sum
  }, 0)

  const result: OIData[] = []

  if (totalRow) {
    const oiVolRatioTotal =
      totalVolumeUsd > 0 && typeof totalRow.open_interest_usd === 'number'
        ? totalRow.open_interest_usd / totalVolumeUsd
        : 0

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
      oiVolRatio: oiVolRatioTotal,
      isTotal: true,
    })
  }

  const sortedExchanges = [...exchangeRows].sort(
    (a, b) => b.open_interest_usd - a.open_interest_usd,
  )

  sortedExchanges.forEach((item, index) => {
    const volumeUsd = volumeByExchange[normalizeExchangeName(item.exchange)] ?? 0
    const oiVolRatio =
      volumeUsd > 0 && typeof item.open_interest_usd === 'number'
        ? item.open_interest_usd / volumeUsd
        : 0

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
      oiVolRatio,
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

  const buildMockOi = useCallback((symbol: string): OIData[] => {
    const rand = mulberry32(hashStringToSeed(`agg-oi:${symbol}`))
    const exchangeRows = MOCK_EXCHANGES.map(ex => {
      // USD OI in billions: ~0.3B .. ~22B (heavy tail)
      const r = rand()
      const oiUsdB = 0.3 + r ** 0.28 * 21.7
      // asset OI roughly proportional (purely illustrative)
      const oiAsset = Math.max(0, oiUsdB * (2500 + rand() * 1800))
      const change1h = (rand() - 0.5) * 2.4
      const change4h = (rand() - 0.5) * 5.0
      const change24h = (rand() - 0.5) * 12.0
      return {
        exchange: ex,
        oiUsd: oiUsdB * 1_000_000_000,
        oiAsset,
        change1hPct: change1h,
        change4hPct: change4h,
        change24hPct: change24h,
      }
    })
      .sort((a, b) => b.oiUsd - a.oiUsd)
      .slice(0, 12)

    // 为 mock 生成对应的 24h 成交量，确保持仓/成交额比值为合理非零数值
    const volumeRows = exchangeRows.map(row => {
      // 让成交额大致与持仓量同量级，但不完全线性
      const volumeMultiplier = 0.5 + rand() * 2.5 // 0.5x ~ 3x
      return {
        exchange: row.exchange,
        volumeUsd: row.oiUsd * volumeMultiplier,
      }
    })

    const totalOiUsd = exchangeRows.reduce((s, r) => s + r.oiUsd, 0)
    const totalOiAsset = exchangeRows.reduce((s, r) => s + r.oiAsset, 0)
    const totalVolumeUsd = volumeRows.reduce((s, r) => s + r.volumeUsd, 0)

    const out: OIData[] = [
      {
        id: 'total',
        rank: '',
        exchange: 'ALL',
        logo: '',
        oiAsset: totalOiAsset,
        oiUsd: totalOiUsd,
        ratioPct: 100,
        change1hPct:
          exchangeRows.reduce((s, r) => s + r.change1hPct, 0) / Math.max(1, exchangeRows.length),
        change4hPct:
          exchangeRows.reduce((s, r) => s + r.change4hPct, 0) / Math.max(1, exchangeRows.length),
        change24hPct:
          exchangeRows.reduce((s, r) => s + r.change24hPct, 0) / Math.max(1, exchangeRows.length),
        oiVolRatio: totalVolumeUsd > 0 ? totalOiUsd / totalVolumeUsd : 0,
        isTotal: true,
      },
      ...exchangeRows.map((r, idx) => {
        const v = volumeRows[idx]?.volumeUsd ?? 0
        const oiVolRatio = v > 0 ? r.oiUsd / v : 0
        return {
          id: `${r.exchange}-${idx}`,
          rank: idx + 1,
          exchange: r.exchange,
          logo: '',
          oiAsset: r.oiAsset,
          oiUsd: r.oiUsd,
          ratioPct: totalOiUsd > 0 ? (r.oiUsd / totalOiUsd) * 100 : 0,
          change1hPct: r.change1hPct,
          change4hPct: r.change4hPct,
          change24hPct: r.change24hPct,
          oiVolRatio,
          isTotal: false,
        }
      }),
    ]

    return out
  }, [])

  const loadData = useCallback(
    async (symbol: string) => {
      setLoading(true)
      setError(null)
      setNeedsAuth(false)

      try {
        const oiItems = await fetchAggregatedOpenInterest({ symbol })

        // 成交额失败不应影响 OI 主数据展示
        const volumeResp = await fetchAggregatedVolume({
          symbol,
          instrumentType: 'PERPETUAL',
          page: 1,
          limit: 100,
        }).catch(() => null)

        const volumeByExchange: VolumeByExchange = {}

        if (volumeResp && Array.isArray(volumeResp.items) && volumeResp.items.length > 0) {
          // 先按 dataTimestamp 降序，保证同交易所取最新一条
          const exchangeRows = volumeResp.items
            .filter(item => item.exchange !== 'All')
            .sort((a, b) =>
              String(b.dataTimestamp || '').localeCompare(String(a.dataTimestamp || '')),
            )

          for (const row of exchangeRows) {
            const key = normalizeExchangeName(row.exchange)
            if (volumeByExchange[key] != null) continue
            const v = Number.parseFloat(row.volumeUsd || '0')
            if (Number.isFinite(v) && v > 0) {
              volumeByExchange[key] = v
            }
          }
        }

        const transformed = transformApiData(oiItems, volumeByExchange)
        if (transformed.length === 0 && process.env.NODE_ENV !== 'production') {
          setData(buildMockOi(symbol))
        } else {
          setData(transformed)
        }
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          // Dev fallback so the UI is demonstrable even when API/auth isn't ready.
          setData(buildMockOi(symbol))
        } else {
          if (err instanceof AuthenticationError) {
            setNeedsAuth(true)
            setError(t('aggregatedOrderbook.openInterest.authRequired'))
          } else {
            setError(t('aggregatedOrderbook.openInterest.loadError'))
          }
          setData([])
        }
      } finally {
        setLoading(false)
      }
    },
    [buildMockOi, t],
  )

  useEffect(() => {
    loadData(activeSymbol)
  }, [activeSymbol, loadData])

  const numberCompact = useMemo(() => {
    const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US'
    return new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 2 })
  }, [i18n.language])

  const currencyCompact = useMemo(() => {
    const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US'
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 2,
    })
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
    if (sortField !== field)
      return (
        <ArrowUpDown className="h-3 w-3 text-[color:var(--cf-muted)] opacity-30 transition-opacity group-hover:opacity-100" />
      )
    return sortDirection === 'desc' ? (
      <ChevronDown className="text-primary h-3 w-3" />
    ) : (
      <ChevronUp className="text-primary h-3 w-3" />
    )
  }

  const renderValueWithColor = (val: number) => {
    const isPositive = val > 0
    const isNegative = val < 0
    return (
      <span
        className={
          isPositive
            ? 'text-green-400'
            : isNegative
              ? 'text-red-400'
              : 'text-[color:var(--cf-text-strong)]'
        }
      >
        {formatSignedPct(val)}
      </span>
    )
  }

  const renderError = () => (
    <div className="flex flex-col items-center justify-center gap-4 py-12">
      <AlertCircle className={`h-12 w-12 ${needsAuth ? 'text-yellow-500' : 'text-red-500'}`} />
      <p className="text-center text-[color:var(--cf-muted)]">{error}</p>
      {!needsAuth && (
        <button
          type="button"
          onClick={() => loadData(activeSymbol)}
          className="bg-primary/20 text-primary hover:bg-primary/30 rounded-md px-4 py-2 transition-colors"
        >
          {t('common.retry')}
        </button>
      )}
    </div>
  )

  return (
    <div className={`flex h-full flex-col ${isCompact ? 'gap-2' : 'gap-6'}`}>
      <div className="flex items-center justify-between">
        <SectionTitle className={isCompact ? '!text-sm' : ''}>
          {t('aggregatedOrderbook.openInterest.title', { symbol: activeSymbol })}
        </SectionTitle>
      </div>

      <div
        className={`flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] ${isCompact ? '' : 'shadow-2xl'}`}
      >
        {/* Symbol Tabs & Search */}
        <div
          className={`flex items-center justify-between border-b border-[color:var(--cf-border)] bg-[color:var(--cf-bg)]/30 px-4 ${isCompact ? 'flex-row-reverse py-1' : ''}`}
        >
          {!isCompact ? (
            <div className="cf-scrollbar flex items-center overflow-x-auto">
              {symbols.map(s => (
                <button
                  type="button"
                  key={s}
                  onClick={() => setActiveSymbol(s)}
                  className={`relative px-4 py-3 text-sm font-semibold whitespace-nowrap transition-all ${
                    activeSymbol === s
                      ? 'text-[color:var(--cf-text-strong)]'
                      : 'border-transparent text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)]'
                  }`}
                >
                  {s}
                  {activeSymbol === s && (
                    <>
                      <div className="from-primary to-secondary absolute right-0 bottom-0 left-0 h-0.5 bg-gradient-to-r" />
                      <div className="from-primary/10 pointer-events-none absolute inset-0 bg-gradient-to-b to-transparent" />
                    </>
                  )}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex-1" />
          )}
          <div className={`flex items-center gap-2 ${isCompact ? 'py-1 pr-4' : 'py-2 pl-4'}`}>
            <div className="relative" ref={dropdownRef}>
              {isCompact ? (
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex min-w-[80px] items-center justify-between gap-2 rounded-md border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-2 py-1 text-xs text-[color:var(--cf-text-strong)] transition-all hover:border-[color:var(--cf-muted)]"
                >
                  <span className="font-medium">{activeSymbol}</span>
                  <ChevronDown
                    className={`h-3 w-3 text-[color:var(--cf-muted)] transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                  />
                </button>
              ) : (
                <>
                  <Search className="absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2 text-[color:var(--cf-muted)]" />
                  <input
                    type="text"
                    placeholder={t('aggregatedOrderbook.openInterest.searchPlaceholder')}
                    value={searchQuery}
                    onChange={e => {
                      setSearchQuery(e.target.value)
                      setIsDropdownOpen(true)
                    }}
                    onFocus={() => setIsDropdownOpen(true)}
                    className="focus:border-primary relative z-10 w-48 rounded-md border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] py-1.5 pr-10 pl-9 text-sm text-[color:var(--cf-text-strong)] transition-all focus:outline-none"
                  />
                  <div className="pointer-events-none absolute top-1/2 right-3 z-10 -translate-y-1/2 text-[color:var(--cf-muted)]">
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}
                    />
                  </div>
                </>
              )}

              {isDropdownOpen && (
                <div
                  className={`absolute top-full ${isCompact ? 'left-0' : 'right-0'} cf-scrollbar z-50 mt-1 overflow-hidden rounded-md border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] shadow-xl ${isCompact ? 'max-h-48 w-32' : 'left-0 max-h-60'}`}
                >
                  {isCompact && (
                    <div className="border-b border-[color:var(--cf-border)] p-2">
                      <input
                        type="text"
                        placeholder={t('common.search')}
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="focus:border-primary w-full rounded border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-2 py-1 text-xs text-[color:var(--cf-text-strong)] focus:outline-none"
                        autoFocus
                      />
                    </div>
                  )}
                  <div className="cf-scrollbar max-h-40 overflow-y-auto">
                    {(searchQuery ? filteredSymbols : symbols).map(s => (
                      <div
                        key={s}
                        onClick={() => {
                          setActiveSymbol(s)
                          setSearchQuery('')
                          setIsDropdownOpen(false)
                        }}
                        className={`px-4 ${isCompact ? 'py-1.5 text-xs' : 'py-2 text-sm'} cursor-pointer text-[color:var(--cf-text-strong)] transition-colors hover:bg-[color:var(--cf-surface-hover)] ${activeSymbol === s ? 'bg-primary/10 text-primary' : ''}`}
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
          <div className="flex items-center justify-center gap-2 py-8">
            <Loader2 className="text-primary h-5 w-5 animate-spin" />
            <span className="text-[color:var(--cf-muted)]">{t('common.loading')}</span>
          </div>
        )}

        {/* Error State */}
        {!loading && error && renderError()}

        {/* Empty State */}
        {!loading && !error && data.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 py-12">
            <p className="text-[color:var(--cf-muted)]">{t('common.noData')}</p>
          </div>
        )}

        {/* Table Area */}
        {!loading && !error && data.length > 0 && (
          <div className="cf-scrollbar relative flex-1 overflow-auto">
            <table className="w-full min-w-[800px] border-collapse text-left md:min-w-[1000px]">
              <thead className="sticky top-0 z-10 bg-[color:var(--cf-bg)]">
                <tr
                  className={`tracking-wider text-[color:var(--cf-muted)] uppercase ${isCompact ? 'text-[10px]' : 'text-[10px] md:text-xs'}`}
                >
                  <th
                    className={`${isCompact ? 'px-2 py-2' : 'px-3 py-4 md:px-4'} w-10 border-b border-[color:var(--cf-border)] text-center font-bold md:w-16`}
                  >
                    {t('aggregatedOrderbook.openInterest.table.rank')}
                  </th>
                  <th
                    className={`${isCompact ? 'px-2 py-2' : 'px-3 py-4 md:px-4'} sticky left-0 z-20 border-r border-b border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] font-bold`}
                  >
                    {t('aggregatedOrderbook.openInterest.table.exchange')}
                  </th>
                  <th
                    className={`${isCompact ? 'px-2 py-2' : 'px-3 py-4 md:px-4'} border-b border-[color:var(--cf-border)] text-right font-bold`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort('oiAsset')}
                      className="group flex w-full items-center justify-end gap-1 transition-colors hover:text-[color:var(--cf-text-strong)]"
                    >
                      {isCompact
                        ? t('aggregatedOrderbook.openInterest.table.oiBtc', { symbol: '' })
                        : t('aggregatedOrderbook.openInterest.table.oiBtc', {
                            symbol: activeSymbol,
                          })}{' '}
                      {renderSortIcon('oiAsset')}
                    </button>
                  </th>
                  <th
                    className={`${isCompact ? 'px-2 py-2' : 'px-3 py-4 md:px-4'} border-b border-[color:var(--cf-border)] text-right font-bold`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort('oiUsd')}
                      className="group flex w-full items-center justify-end gap-1 transition-colors hover:text-[color:var(--cf-text-strong)]"
                    >
                      {t('aggregatedOrderbook.openInterest.table.oiUsd')} {renderSortIcon('oiUsd')}
                    </button>
                  </th>
                  <th
                    className={`${isCompact ? 'px-2 py-2' : 'px-3 py-4 md:px-4'} border-b border-[color:var(--cf-border)] text-right font-bold`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort('ratioPct')}
                      className="group flex w-full items-center justify-end gap-1 transition-colors hover:text-[color:var(--cf-text-strong)]"
                    >
                      {t('aggregatedOrderbook.openInterest.table.ratio')}{' '}
                      {renderSortIcon('ratioPct')}
                    </button>
                  </th>
                  <th
                    className={`${isCompact ? 'px-2 py-2' : 'px-3 py-4 md:px-4'} hidden border-b border-[color:var(--cf-border)] text-right font-bold sm:table-cell`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort('change1hPct')}
                      className="group flex w-full items-center justify-end gap-1 transition-colors hover:text-[color:var(--cf-text-strong)]"
                    >
                      {t('aggregatedOrderbook.openInterest.table.change1h')}{' '}
                      {renderSortIcon('change1hPct')}
                    </button>
                  </th>
                  <th
                    className={`${isCompact ? 'px-2 py-2' : 'px-3 py-4 md:px-4'} hidden border-b border-[color:var(--cf-border)] text-right font-bold sm:table-cell`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort('change4hPct')}
                      className="group flex w-full items-center justify-end gap-1 transition-colors hover:text-[color:var(--cf-text-strong)]"
                    >
                      {t('aggregatedOrderbook.openInterest.table.change4h')}{' '}
                      {renderSortIcon('change4hPct')}
                    </button>
                  </th>
                  <th
                    className={`${isCompact ? 'px-2 py-2' : 'px-3 py-4 md:px-4'} border-b border-[color:var(--cf-border)] text-right font-bold`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort('change24hPct')}
                      className="group flex w-full items-center justify-end gap-1 transition-colors hover:text-[color:var(--cf-text-strong)]"
                    >
                      {t('aggregatedOrderbook.openInterest.table.change24h')}{' '}
                      {renderSortIcon('change24hPct')}
                    </button>
                  </th>
                  <th
                    className={`${isCompact ? 'px-2 py-2' : 'px-3 py-4 md:px-4'} hidden border-b border-[color:var(--cf-border)] text-center font-bold md:table-cell`}
                  >
                    {t('aggregatedOrderbook.openInterest.table.oiVolRatio')}
                  </th>
                </tr>
              </thead>
              <tbody className={isCompact ? 'text-xs' : 'text-[11px] md:text-sm'}>
                {sortedData.map(row => (
                  <tr
                    key={row.id}
                    className={`border-b border-[color:var(--cf-border)]/50 transition-colors hover:bg-[color:var(--cf-surface-hover)]/30 ${
                      row.isTotal ? 'bg-[color:var(--cf-surface-2)]/20 font-bold' : ''
                    }`}
                  >
                    <td
                      className={`${isCompact ? 'px-2 py-2' : 'px-3 py-4 md:px-4'} text-center text-[color:var(--cf-muted)]`}
                    >
                      {row.rank}
                    </td>
                    <td
                      className={`${isCompact ? 'px-2 py-2' : 'px-3 py-4 md:px-4'} sticky left-0 z-10 border-r border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] group-hover:bg-[color:var(--cf-surface-hover)]/30 ${row.isTotal ? 'bg-[color:var(--cf-surface-2)]' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className={`${isCompact ? 'h-3.5 w-3.5' : 'h-4 w-4 md:h-5 md:w-5'} flex-none overflow-hidden rounded-full border border-[color:var(--cf-border)]`}
                        >
                          <ExchangeLogo
                            exchange={row.exchange}
                            fallback={row.logo}
                            className="h-full w-full bg-[color:var(--cf-bg)] object-contain"
                          />
                        </div>
                        <span
                          className={`${row.isTotal ? 'font-bold text-[color:var(--cf-text-strong)]' : 'text-[color:var(--cf-text)]'} max-w-[60px] truncate md:max-w-none`}
                        >
                          {row.isTotal ? t('common.all') : row.exchange}
                        </span>
                      </div>
                    </td>
                    <td
                      className={`${isCompact ? 'px-2 py-2' : 'px-3 py-4 md:px-4'} text-right text-[color:var(--cf-text-strong)]`}
                    >
                      {formatAssetAmount(row.oiAsset)}
                    </td>
                    <td
                      className={`${isCompact ? 'px-2 py-2' : 'px-3 py-4 md:px-4'} text-right text-[color:var(--cf-text-strong)]`}
                    >
                      {currencyCompact.format(row.oiUsd)}
                    </td>
                    <td
                      className={`${isCompact ? 'px-2 py-2' : 'px-3 py-4 md:px-4'} text-right text-[color:var(--cf-text-strong)]`}
                    >
                      {formatRatio(row.ratioPct)}
                    </td>
                    <td
                      className={`${isCompact ? 'px-2 py-2' : 'px-3 py-4 md:px-4'} hidden text-right font-medium sm:table-cell`}
                    >
                      {renderValueWithColor(row.change1hPct)}
                    </td>
                    <td
                      className={`${isCompact ? 'px-2 py-2' : 'px-3 py-4 md:px-4'} hidden text-right font-medium sm:table-cell`}
                    >
                      {renderValueWithColor(row.change4hPct)}
                    </td>
                    <td
                      className={`${isCompact ? 'px-2 py-2' : 'px-3 py-4 md:px-4'} text-right font-medium`}
                    >
                      {renderValueWithColor(row.change24hPct)}
                    </td>
                    <td
                      className={`${isCompact ? 'px-2 py-2' : 'px-3 py-4 md:px-4'} hidden text-center text-[color:var(--cf-muted)] md:table-cell`}
                    >
                      {row.oiVolRatio.toFixed(4)}
                    </td>
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
