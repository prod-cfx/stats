'use client'

import type { AggregatedOrderbookLevel, AggregatedOrderbookMarket, AggregatedOrderbookQueryType } from '@/lib/api'
import { Check, ChevronDown, Info, Search, Settings } from 'lucide-react'
import dynamic from 'next/dynamic'
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { OrderbookTable } from '@/components/aggregated-orderbook/OrderbookTable'
import { ExchangeLogo } from '@/components/ui/ExchangeLogo'
import { FilterButton } from '@/components/ui/FilterButton'
import { LoadingState } from '@/components/ui/loading'
import { fetchAggregatedOrderbook, fetchAggregatedOrderbookMarkets } from '@/lib/api'

const DepthChart = dynamic(
  () => import('@/components/aggregated-orderbook/DepthChart').then(mod => mod.DepthChart),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-[color:var(--cf-surface-2)]" />,
  },
)

// 后端支持的交易所
const DEFAULT_EXCHANGES = ['bybit', 'binance', 'bitmax', 'okx', 'hyperliquid']
const FALLBACK_MARKETS: AggregatedOrderbookMarket[] = [
  { base: 'BTC', type: 'perp', venues: DEFAULT_EXCHANGES },
  { base: 'ETH', type: 'perp', venues: DEFAULT_EXCHANGES },
  { base: 'BTC', type: 'spot', venues: DEFAULT_EXCHANGES },
  { base: 'ETH', type: 'spot', venues: DEFAULT_EXCHANGES },
]
const HOT_MARKET_PRIORITY = ['BTC', 'ETH', 'SOL', 'BNB', 'XRP', 'DOGE', 'ADA', 'LINK', 'AVAX', 'HYPE', 'LTC', 'BCH', 'DOT', 'TRX', 'TON', 'SUI', 'AAVE', 'UNI', 'NEAR', 'ARB', 'OP', 'APT', 'ETC', 'FIL', 'INJ', 'ATOM', 'SEI', 'WIF', 'ENA']
const HOT_MARKET_PRIORITY_MAP = new Map(HOT_MARKET_PRIORITY.map((base, index) => [base, index]))
const SYMBOL_TICK_SIZE_OPTIONS: Record<string, string[]> = {
  BTC: ['1', '10', '100'],
  ETH: ['0.1', '1', '10'],
  BNB: ['0.1', '1', '10'],
  BCH: ['0.1', '1', '10'],
  AAVE: ['0.01', '0.1', '1'],
  SOL: ['0.01', '0.1', '1'],
  LINK: ['0.01', '0.1', '1'],
  AVAX: ['0.01', '0.1', '1'],
  LTC: ['0.01', '0.1', '1'],
  INJ: ['0.01', '0.1', '1'],
  ETC: ['0.01', '0.1', '1'],
  DOT: ['0.001', '0.01', '0.1'],
  TON: ['0.001', '0.01', '0.1'],
  UNI: ['0.001', '0.01', '0.1'],
  NEAR: ['0.001', '0.01', '0.1'],
  APT: ['0.001', '0.01', '0.1'],
  ATOM: ['0.001', '0.01', '0.1'],
  FIL: ['0.001', '0.01', '0.1'],
  ADA: ['0.0001', '0.001', '0.01'],
  DOGE: ['0.0001', '0.001', '0.01'],
  XRP: ['0.0001', '0.001', '0.01'],
  ARB: ['0.0001', '0.001', '0.01'],
  OP: ['0.0001', '0.001', '0.01'],
  TRX: ['0.0001', '0.001', '0.01'],
  SUI: ['0.0001', '0.001', '0.01'],
  SEI: ['0.0001', '0.001', '0.01'],
  WIF: ['0.0001', '0.001', '0.01'],
  ENA: ['0.0001', '0.001', '0.01'],
}
const DEFAULT_TICK_SIZE_OPTIONS = ['0.01', '0.1', '1']

// 刷新间隔（毫秒）
const REFRESH_INTERVAL = 3000

function toApiMarketType(marketType: 'futures' | 'spot'): AggregatedOrderbookQueryType {
  return marketType === 'futures' ? 'perp' : 'spot'
}

function marketsForType(
  markets: AggregatedOrderbookMarket[],
  marketType: 'futures' | 'spot',
): AggregatedOrderbookMarket[] {
  const apiType = toApiMarketType(marketType)
  return sortMarketsByPriority(markets.filter(market => market.type === apiType))
}

function sortMarketsByPriority(markets: AggregatedOrderbookMarket[]): AggregatedOrderbookMarket[] {
  return [...markets].sort((a, b) => {
    const aPriority = HOT_MARKET_PRIORITY_MAP.get(a.base) ?? Number.MAX_SAFE_INTEGER
    const bPriority = HOT_MARKET_PRIORITY_MAP.get(b.base) ?? Number.MAX_SAFE_INTEGER
    return aPriority - bPriority || a.base.localeCompare(b.base) || a.type.localeCompare(b.type)
  })
}

function getTickSizeOptionsForBase(base: string): string[] {
  return SYMBOL_TICK_SIZE_OPTIONS[base.toUpperCase()] ?? DEFAULT_TICK_SIZE_OPTIONS
}

function getDefaultTickSizeForBase(base: string): string {
  return getTickSizeOptionsForBase(base)[0]!
}

function getPriceDecimalsForTickSize(tickSize: string): number {
  const [, decimals = ''] = tickSize.split('.')
  return Math.max(2, decimals.length)
}

function pickMarket(
  markets: AggregatedOrderbookMarket[],
  marketType: 'futures' | 'spot',
  preferredBase: string,
): AggregatedOrderbookMarket {
  const candidates = marketsForType(markets.length ? markets : FALLBACK_MARKETS, marketType)
  return candidates.find(market => market.base === preferredBase) ?? candidates[0] ?? FALLBACK_MARKETS[0]!
}

const BothIcon = memo(({ active }: { active: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 4H14" stroke={active ? 'white' : '#ef4444'} strokeWidth="2" strokeLinecap="round" />
    <path d="M2 7H10" stroke={active ? 'white' : 'var(--cf-muted)'} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    <path d="M2 10H10" stroke={active ? 'white' : 'var(--cf-muted)'} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    <path d="M2 13H14" stroke={active ? 'white' : '#22c55e'} strokeWidth="2" strokeLinecap="round" />
    <path d="M1 4.5L2.5 3L4 4.5" stroke={active ? 'white' : '#ef4444'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M1 12.5L2.5 14L4 12.5" stroke={active ? 'white' : '#22c55e'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
))

const BidsIcon = memo(({ active }: { active: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 4H14" stroke={active ? 'white' : 'var(--cf-muted)'} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    <path d="M2 7H10" stroke={active ? 'white' : 'var(--cf-muted)'} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    <path d="M2 10H10" stroke={active ? 'white' : 'var(--cf-muted)'} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    <path d="M2 13H14" stroke={active ? 'white' : '#22c55e'} strokeWidth="2" strokeLinecap="round" />
    <path d="M1 12.5L2.5 14L4 12.5" stroke={active ? 'white' : '#22c55e'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
))

const AsksIcon = memo(({ active }: { active: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 4H14" stroke={active ? 'white' : '#ef4444'} strokeWidth="2" strokeLinecap="round" />
    <path d="M2 7H10" stroke={active ? 'white' : 'var(--cf-muted)'} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    <path d="M2 10H10" stroke={active ? 'white' : 'var(--cf-muted)'} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    <path d="M2 13H14" stroke={active ? 'white' : 'var(--cf-muted)'} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    <path d="M1 4.5L2.5 3L4 4.5" stroke={active ? 'white' : '#ef4444'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
))

// 转换后端数据到前端组件格式（累计 base asset 数量）
// isAsks: asks 需要从最佳价（最低）向外累计，但显示时是倒序，所以需要反向计算
function transformOrderbookData(
  levels: AggregatedOrderbookLevel[],
  maxSize: number,
  priceDecimals: number,
  isAsks: boolean = false,
) {
  // Asks: 后端返回 low→high，显示 high→low，累计应从 low 开始
  // Bids: 后端返回 high→low，显示 high→low，累计从 high 开始
  // 对于 asks，先反转计算累计，再反转回来
  const orderedLevels = isAsks ? [...levels].reverse() : levels
  let cumulative = 0
  const result = orderedLevels.map((level) => {
    cumulative += level.sizeTotal
    const depthPercent = maxSize > 0 ? (level.sizeTotal / maxSize) * 100 : 0
    return {
      price: level.price.toFixed(priceDecimals),
      amount: level.sizeTotal.toFixed(4),
      total: cumulative.toFixed(4),
      exchanges: level.details.map(d => d.venueId),
      depthPercent,
    }
  })
  return isAsks ? result.reverse() : result
}

export function AggregatedOrderbookView({ variant = 'default' }: { variant?: 'default' | 'compact' }) {
  const { t, i18n } = useTranslation()
  const [marketType, setMarketType] = useState<'futures' | 'spot'>('futures')
  const [symbol, setSymbol] = useState('BTC')
  const [availableMarkets, setAvailableMarkets] = useState<AggregatedOrderbookMarket[]>([])
  const [tickSize, setTickSize] = useState('1')
  const [displayMode, setDisplayMode] = useState('both')
  const [selectedExchanges, setSelectedExchanges] = useState<string[]>(DEFAULT_EXCHANGES)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [isSymbolMenuOpen, setIsSymbolMenuOpen] = useState(false)
  const [symbolSearch, setSymbolSearch] = useState('')
  const settingsRef = useRef<HTMLDivElement>(null)
  const symbolMenuRef = useRef<HTMLDivElement>(null)

  // API 状态
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [orderbook, setOrderbook] = useState<{
    asks: ReturnType<typeof transformOrderbookData>
    bids: ReturnType<typeof transformOrderbookData>
    currentPrice: { price: string, usdPrice: string, change: string, changePercent: string }
  } | null>(null)

  const isCompact = variant === 'compact'

  const currencyCompact = useMemo(() => {
    const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US'
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 2,
    })
  }, [i18n.language])

  const numberCompact = useMemo(() => {
    const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US'
    return new Intl.NumberFormat(locale, {
      notation: 'compact',
      maximumFractionDigits: 2,
    })
  }, [i18n.language])

  const marketOptions = useMemo(
    () => marketsForType(availableMarkets, marketType),
    [availableMarkets, marketType],
  )

  const filteredMarketOptions = useMemo(() => {
    const query = symbolSearch.trim().toUpperCase()
    if (!query) return marketOptions
    return marketOptions.filter(market => market.base.includes(query))
  }, [marketOptions, symbolSearch])

  const currentMarket = useMemo(
    () => pickMarket(availableMarkets, marketType, symbol),
    [availableMarkets, marketType, symbol],
  )

  const handleMarketTypeChange = useCallback((nextMarketType: 'futures' | 'spot') => {
    if (nextMarketType === marketType)
      return

    const nextMarket = pickMarket(availableMarkets, nextMarketType, symbol)
    setMarketType(nextMarketType)
    setSymbol(nextMarket.base)
    setTickSize(getDefaultTickSizeForBase(nextMarket.base))
    setSelectedExchanges(nextMarket.venues)
  }, [availableMarkets, marketType, symbol])

  const handleSymbolChange = useCallback((nextBase: string) => {
    const nextMarket = marketOptions.find(market => market.base === nextBase)
    if (!nextMarket) return
    setSymbol(nextMarket.base)
    setTickSize(getDefaultTickSizeForBase(nextMarket.base))
    setSelectedExchanges(nextMarket.venues)
    setSymbolSearch('')
    setIsSymbolMenuOpen(false)
  }, [marketOptions])

  useEffect(() => {
    let ignore = false

    fetchAggregatedOrderbookMarkets()
      .then((markets) => {
        if (ignore) return
        setAvailableMarkets(markets)
        if (markets.length === 0) return
        const nextMarket = pickMarket(markets, marketType, symbol)
        setSymbol(nextMarket.base)
        setTickSize(getDefaultTickSizeForBase(nextMarket.base))
        setSelectedExchanges(nextMarket.venues)
      })
      .catch(() => undefined)

    return () => {
      ignore = true
    }
  }, [marketType, symbol])

  // Click outside to close settings
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false)
      }
      if (symbolMenuRef.current && !symbolMenuRef.current.contains(event.target as Node)) {
        setIsSymbolMenuOpen(false)
        setSymbolSearch('')
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleExchange = useCallback((ex: string) => {
    setSelectedExchanges(prev =>
      prev.includes(ex) ? prev.filter(e => e !== ex) : [...prev, ex],
    )
  }, [])

  // 获取数据
  const fetchData = useCallback(async () => {
    try {
      const apiType = toApiMarketType(marketType)

      const data = await fetchAggregatedOrderbook({
        base: symbol,
        type: apiType,
        venues: selectedExchanges.join(','),
        depth: 100, // 固定深度，让后端返回足够数据
        tickSize: Number.parseFloat(tickSize), // 用户选择的价格聚合档位
      })

      // 保留后端返回的完整深度，展示层再按模式做采样。
      const allSizes = [...data.asks, ...data.bids].map(l => l.sizeTotal)
      const maxSize = Math.max(...allSizes, 1)

      // 转换数据格式
      // Asks: 累计从最低价（最佳卖价）开始，不需要反向
      // Bids: 累计从最高价（最佳买价）开始
      const priceDecimals = getPriceDecimalsForTickSize(tickSize)
      const transformedAsks = transformOrderbookData(data.asks, maxSize, priceDecimals, false)
      const transformedBids = transformOrderbookData(data.bids, maxSize, priceDecimals, false)

      setOrderbook({
        asks: transformedAsks,
        bids: transformedBids,
        currentPrice: {
          price: data.midPrice.toFixed(2),
          usdPrice: data.midPrice.toFixed(2),
          change: '0.00',
          changePercent: '0.00%',
        },
      })
      setError(null)
    }
    catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch orderbook'))
    }
    finally {
      setLoading(false)
    }
  }, [symbol, marketType, tickSize, selectedExchanges])

  // 初始加载和自动刷新
  useEffect(() => {
    fetchData()
    const interval = setInterval(fetchData, REFRESH_INTERVAL)
    return () => clearInterval(interval)
  }, [fetchData])

  const tickSizeOptions = useMemo(() => getTickSizeOptionsForBase(symbol), [symbol])

  const depthChartData = useMemo(() => {
    if (!orderbook)
      return { bids: [], asks: [] }

    let bidTotal = 0
    const bidPoints = orderbook.bids.map((b) => {
      const amount = Number.parseFloat(b.amount)
      bidTotal += amount
      return {
        price: Number.parseFloat(b.price),
        amount,
        total: bidTotal,
        exchangeBreakdown: selectedExchanges.length > 0
          ? selectedExchanges.map(ex => ({
              name: ex,
              amount: amount / selectedExchanges.length,
              color: '#22c55e',
            }))
          : [],
      }
    })

    let askTotal = 0
    const askPoints = orderbook.asks.map((a) => {
      const amount = Number.parseFloat(a.amount)
      askTotal += amount
      return {
        price: Number.parseFloat(a.price),
        amount,
        total: askTotal,
        exchangeBreakdown: selectedExchanges.length > 0
          ? selectedExchanges.map(ex => ({
              name: ex,
              amount: amount / selectedExchanges.length,
              color: '#ef4444',
            }))
          : [],
      }
    })

    return { bids: bidPoints, asks: askPoints }
  }, [orderbook, selectedExchanges])

  return (
    <div className={`bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-lg flex flex-col ${isCompact ? '' : 'shadow-sm'} min-h-[560px] md:min-h-[750px] overflow-hidden h-full`}>
      <LoadingState isLoading={loading} error={!!error} onRetry={fetchData}>
        {orderbook
          ? (
              <>
                <div className={`flex flex-wrap items-center justify-between gap-3 ${isCompact ? 'p-2' : 'p-3'} border-b border-[color:var(--cf-border)] bg-[color:var(--cf-surface-2)]/60 flex-none`}>
                  <div className={`flex min-w-0 flex-wrap items-center ${isCompact ? 'gap-2' : 'gap-3'}`}>
                    <div className="flex bg-[color:var(--cf-bg)] border border-[color:var(--cf-border)] rounded-md p-0.5">
                      <button
                        type="button"
                        onClick={() => handleMarketTypeChange('futures')}
                        className={`${isCompact ? 'px-2 py-1' : 'px-4 py-1.5'} rounded !text-xs !font-semibold !leading-5 transition-colors ${marketType === 'futures'
                          ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-sm shadow-primary/20'
                          : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text)]'}`}
                      >
                        {t('aggregatedOrderbook.market.futures')}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMarketTypeChange('spot')}
                        className={`${isCompact ? 'px-2 py-1' : 'px-4 py-1.5'} rounded !text-xs !font-semibold !leading-5 transition-colors ${marketType === 'spot'
                          ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-sm shadow-primary/20'
                          : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text)]'}`}
                      >
                        {t('aggregatedOrderbook.market.spot')}
                      </button>
                    </div>
                    <div className="relative" ref={symbolMenuRef}>
                      <button
                        type="button"
                        onClick={() => setIsSymbolMenuOpen(prev => !prev)}
                        disabled={marketOptions.length === 0}
                        className={`${isCompact ? 'h-8 min-w-24 pl-3 pr-8' : 'h-9 min-w-32 pl-3.5 pr-9'} relative rounded-md border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] text-left !text-xs !font-semibold !leading-5 text-[color:var(--cf-text-strong)] shadow-sm outline-none transition-colors hover:border-[color:var(--cf-muted)] focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-60`}
                      >
                        {symbol}
                        <ChevronDown className={`${isCompact ? 'right-2 h-3.5 w-3.5' : 'right-2.5 h-4 w-4'} pointer-events-none absolute top-1/2 -translate-y-1/2 text-[color:var(--cf-muted)]`} />
                      </button>

                      {isSymbolMenuOpen && (
                        <div className={`${isCompact ? 'w-40' : 'w-48'} absolute left-0 top-full z-30 mt-2 overflow-hidden rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-1.5 shadow-sm animate-in fade-in zoom-in-95 duration-150`}>
                          <div className="relative mb-1">
                            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--cf-muted)]" />
                            <input
                              value={symbolSearch}
                              onChange={event => setSymbolSearch(event.target.value)}
                              placeholder="Search"
                              className="h-8 w-full rounded-md border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] pl-7 pr-2 !text-xs !font-normal !leading-5 text-[color:var(--cf-text)] outline-none transition-colors placeholder:text-[color:var(--cf-muted)] focus:border-primary focus:ring-2 focus:ring-primary/20"
                            />
                          </div>
                          <div className="max-h-56 overflow-y-auto">
                            {filteredMarketOptions.map(market => (
                              <button
                                key={`${market.type}:${market.base}`}
                                type="button"
                                onClick={() => handleSymbolChange(market.base)}
                                className={`flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors hover:bg-[color:var(--cf-surface-hover)] ${market.base === symbol ? 'text-[color:var(--cf-text-strong)] !font-semibold' : 'text-[color:var(--cf-muted)] !font-normal'}`}
                              >
                                <span className="!text-xs !leading-5">{market.base}</span>
                                {market.base === symbol && <Check className="h-3.5 w-3.5 text-primary" />}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  {!isCompact && (
                    <div className="flex items-center gap-4 !text-xs !font-normal !leading-5 text-[color:var(--cf-muted)]">
                      <span>
                        {t('aggregatedOrderbook.stats.volume24h')}
                        :
                        {' '}
                        <span className="text-[color:var(--cf-text)]">
                          {numberCompact.format(68200)}
                          {' '}
                          BTC
                        </span>
                      </span>
                      <span>
                        {t('aggregatedOrderbook.stats.turnover24h')}
                        :
                        {' '}
                        <span className="text-[color:var(--cf-text)]">{currencyCompact.format(71_590_000)}</span>
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden overflow-y-auto md:overflow-y-hidden">
                  <div className={`w-full md:${isCompact ? 'w-[58%]' : 'w-1/2'} flex flex-col border-b md:border-b-0 md:border-r border-[color:var(--cf-border)] min-h-[420px] md:min-h-0`}>
                    <div className={`${isCompact ? 'p-1.5' : 'p-3'} border-b border-[color:var(--cf-border)] flex items-center justify-between bg-[color:var(--cf-surface-2)]/50 flex-none`}>
                      <div className={`!font-semibold text-[color:var(--cf-text-strong)] tracking-normal ${isCompact ? '!text-[11px] !leading-4' : '!text-[15px] !leading-[22px]'}`}>
                        {t('aggregatedOrderbook.sections.realtimeOrderbook', {
                          symbol: `${symbol}/USD`,
                          market: marketType === 'futures' ? t('aggregatedOrderbook.market.futures') : t('aggregatedOrderbook.market.spot'),
                        })}
                      </div>
                      <div className={`flex items-center ${isCompact ? 'gap-1' : 'gap-2 md:gap-3'}`}>
                        <div className="flex items-center gap-1 rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] p-1">
                          <button
                            type="button"
                            onClick={() => setDisplayMode('both')}
                            className={`${isCompact ? 'h-6 w-6' : 'h-7 w-7'} relative flex items-center justify-center rounded-md transition-colors ${displayMode === 'both' ? 'bg-gradient-to-br from-primary to-secondary text-white shadow-sm' : 'text-[color:var(--cf-muted)] hover:bg-[color:var(--cf-surface-hover)]'}`}
                            aria-label={t('aggregatedOrderbook.displayMode.both', { defaultValue: 'Both sides' })}
                          >
                            <div className="relative z-10">
                              <BothIcon active={displayMode === 'both'} />
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDisplayMode('bids')}
                            className={`${isCompact ? 'h-6 w-6' : 'h-7 w-7'} relative flex items-center justify-center rounded-md transition-colors ${displayMode === 'bids' ? 'bg-gradient-to-br from-primary to-secondary text-white shadow-sm' : 'text-[color:var(--cf-muted)] hover:bg-[color:var(--cf-surface-hover)]'}`}
                            aria-label={t('aggregatedOrderbook.displayMode.bids', { defaultValue: 'Bids only' })}
                          >
                            <div className="relative z-10">
                              <BidsIcon active={displayMode === 'bids'} />
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDisplayMode('asks')}
                            className={`${isCompact ? 'h-6 w-6' : 'h-7 w-7'} relative flex items-center justify-center rounded-md transition-colors ${displayMode === 'asks' ? 'bg-gradient-to-br from-primary to-secondary text-white shadow-sm' : 'text-[color:var(--cf-muted)] hover:bg-[color:var(--cf-surface-hover)]'}`}
                            aria-label={t('aggregatedOrderbook.displayMode.asks', { defaultValue: 'Asks only' })}
                          >
                            <div className="relative z-10">
                              <AsksIcon active={displayMode === 'asks'} />
                            </div>
                          </button>
                        </div>

                        <FilterButton
                          value={tickSize}
                          options={tickSizeOptions}
                          onChange={setTickSize}
                          minWidth={isCompact ? '35px' : '70px'}
                          size={isCompact ? 'sm' : 'md'}
                          className={isCompact ? 'scale-[0.85] origin-right' : ''}
                        />

                        <div className="relative" ref={settingsRef}>
                          <button
                            type="button"
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                            className={`${isCompact ? 'h-6 w-6' : 'h-8 w-8'} flex items-center justify-center rounded-lg transition-colors ${isSettingsOpen
                              ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-sm'
                              : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text)] hover:bg-[color:var(--cf-surface-hover)]'}`}
                          >
                            <Settings className={isCompact ? 'w-3 h-3' : 'w-4 h-4'} />
                          </button>

                          {isSettingsOpen && (
                            <div className={`absolute top-full right-0 mt-2 ${isCompact ? 'w-32' : 'w-44'} animate-in fade-in zoom-in-95 z-30 overflow-hidden rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-1.5 shadow-sm duration-150`}>
                              <p className="!text-[10px] !font-semibold !leading-4 text-[color:var(--cf-muted)] uppercase tracking-normal px-2 py-1 mb-0.5">{t('aggregatedOrderbook.settings.exchangeSources')}</p>
                              {currentMarket.venues.map(ex => (
                                <button
                                  key={ex}
                                  type="button"
                                  onClick={() => toggleExchange(ex)}
                                  className="w-full flex items-center gap-2 px-2 py-1 rounded-md transition-colors hover:bg-[color:var(--cf-surface-hover)] group text-left"
                                >
                                  <div
                                    className={`w-3 h-3 rounded border flex items-center justify-center transition-all ${selectedExchanges.includes(ex)
                                      ? 'bg-primary border-primary'
                                      : 'border-[color:var(--cf-border)] group-hover:border-[color:var(--cf-muted)]'}`}
                                  >
                                    {selectedExchanges.includes(ex) && <Check className="w-2 h-2 text-white" />}
                                  </div>
                                  <ExchangeLogo name={ex} size={isCompact ? 12 : 14} className="shrink-0" />
                                  <span
                                    className={`${isCompact ? '!text-[9px] !leading-4' : '!text-xs !leading-5'} capitalize ${selectedExchanges.includes(ex) ? 'text-[color:var(--cf-text-strong)] !font-semibold' : 'text-[color:var(--cf-muted)] !font-normal'}`}
                                  >
                                    {ex}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 min-h-0 overflow-hidden">
                      <OrderbookTable
                        asks={orderbook.asks}
                        bids={orderbook.bids}
                        currentPrice={orderbook.currentPrice}
                        baseAsset={symbol}
                        displayMode={displayMode as 'both' | 'bids' | 'asks'}
                        variant={variant}
                      />
                    </div>
                  </div>

                  <div className={`w-full md:${isCompact ? 'w-[42%]' : 'w-1/2'} flex flex-col min-h-[400px] md:min-h-0`}>
                    <div className={`${isCompact ? 'p-1.5' : 'p-3'} border-b border-[color:var(--cf-border)] flex items-center justify-between bg-[color:var(--cf-surface-2)]/50 flex-none`}>
                      <div className={`!font-semibold text-[color:var(--cf-text-strong)] tracking-normal ${isCompact ? '!text-[11px] !leading-4' : '!text-[15px] !leading-[22px]'}`}>{t('aggregatedOrderbook.sections.orderDepth')}</div>
                      {!isCompact && (
                        <div className="flex items-center gap-2 text-yellow-500 cursor-help hover:opacity-80 transition-opacity">
                          <Info className="w-4 h-4 hidden sm:block" />
                          <span className="!text-xs !font-semibold !leading-5">{t('aggregatedOrderbook.sections.liquidityHeatmap')}</span>
                        </div>
                      )}
                    </div>
                    <div className={`flex-1 min-h-0 ${isCompact ? 'p-1' : 'p-3'} flex flex-col`}>
                      <div className="flex-1 min-h-0">
                        <DepthChart bids={depthChartData.bids} asks={depthChartData.asks} />
                      </div>
                      {!isCompact && (
                        <div className="flex items-center justify-between mt-3 !text-xs !font-normal !leading-5 text-[color:var(--cf-muted)] flex-none">
                          <div className="flex items-center gap-8">
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-green-500/50 rounded-sm" />
                              <span>{t('aggregatedOrderbook.legend.bids')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 bg-red-500/50 rounded-sm" />
                              <span>{t('aggregatedOrderbook.legend.asks')}</span>
                            </div>
                          </div>
                          <span>
                            {t('aggregatedOrderbook.legend.unit')}
                            :
                            {' '}
                            {symbol}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )
          : null}
      </LoadingState>
    </div>
  )
}
