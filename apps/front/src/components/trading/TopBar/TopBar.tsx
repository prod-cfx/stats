'use client'

import type { Socket } from 'socket.io-client'
import type { TickerData } from '@/lib/api'
import type { DataSource, MarketType } from '@/types/trading'
import { ChevronDown, Info, Search } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { io } from 'socket.io-client'
import { fetchKlineData } from '@/lib/api'
import { getMockMarketList } from '@/lib/market-data/mock-market-list'
import { getWsBaseUrl } from '@/lib/ws'
import { logger } from '@/utils/logger'
import { calculateTopBarDisplayValues } from './price-change'

interface TopBarProps {
  isAggregated: boolean
  selectedExchange: DataSource
  marketType: MarketType
  setMarketType: (v: MarketType) => void
  selectedSymbol: string // chart symbol format, e.g. BTCUSDT
  setSelectedSymbol: (v: string) => void
  variant?: 'default' | 'compact'
}

interface MarketItem {
  displaySymbol: string
  chartSymbol: string
  base: string
  price: number
  changePct: number
  volume: number
}

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

// 交易所名称映射
const EXCHANGE_MAP: Record<DataSource, string> = {
  binance: 'BINANCE',
  okx: 'OKX',
  bybit: 'BYBIT',
}

const QUOTE_CURRENCIES = ['USDT', 'USDC', 'BUSD', 'USD', 'EUR', 'BTC', 'ETH'] as const

function extractBaseSymbol(symbol: string): string {
  for (const quote of QUOTE_CURRENCIES) {
    if (symbol.endsWith(quote)) {
      return symbol.slice(0, -quote.length)
    }
  }
  return symbol
}

// NOTE: 价格/涨跌幅的纯计算逻辑在 ./price-change.ts，避免测试引入 UI 依赖。

export const TopBar = ({
  isAggregated,
  selectedExchange,
  marketType,
  setMarketType,
  selectedSymbol,
  setSelectedSymbol,
  variant = 'default',
}: TopBarProps) => {
  const { t, i18n } = useTranslation('common')
  const [isSymbolMenuOpen, setIsSymbolMenuOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [tickerData, setTickerData] = useState<TickerData | null>(null)
  const [klineClosePrice, setKlineClosePrice] = useState<number | null>(null)
  const [wsConnectionStatus, setWsConnectionStatus] = useState<ConnectionStatus>('disconnected')
  const setWsStatus = useCallback((status: ConnectionStatus) => {
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- centralized setter for effects
    setWsConnectionStatus(status)
  }, [])
  const menuRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<Socket | null>(null)
  const prevSymbolRef = useRef<string | null>(null)
  const selectedSymbolRef = useRef<string>(selectedSymbol)
  const lastKlineUpdateTimeRef = useRef<number>(0)
  const klineParamsRef = useRef<{ symbol: string; exchange?: DataSource }>({ symbol: '' })
  const THROTTLE_INTERVAL = 1000

  // Sync selectedSymbolRef with selectedSymbol state
  useEffect(() => {
    selectedSymbolRef.current = selectedSymbol
  }, [selectedSymbol])

  const isCompact = variant === 'compact'

  // NOTE: Work around a ReactNode type mismatch (multiple @types/react copies) that can make lucide icons fail JSX typing.
  const ChevronDownIcon = ChevronDown as unknown as React.ComponentType<any>
  const InfoIcon = Info as unknown as React.ComponentType<any>
  const SearchIcon = Search as unknown as React.ComponentType<any>

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsSymbolMenuOpen(false)
      }
    }
    if (isSymbolMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isSymbolMenuOpen])

  const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US'
  const priceFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }),
    [locale],
  )
  const priceFormatter2 = useMemo(
    () => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }),
    [locale],
  )
  const compactFormatter = useMemo(
    () => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 2 }),
    [locale],
  )
  const formatUsd = (n: number) => `$${priceFormatter.format(n)}`
  const formatUsd2 = (n: number) => `$${priceFormatter2.format(n)}`
  const formatPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

  const selectedBase = useMemo(() => {
    if (!selectedSymbol) return 'BTC'
    return extractBaseSymbol(selectedSymbol)
  }, [selectedSymbol])

  useEffect(() => {
    klineParamsRef.current = {
      symbol: selectedSymbol,
      exchange: isAggregated ? undefined : selectedExchange,
    }
  }, [selectedSymbol, isAggregated, selectedExchange])

  const fetchLatestKline = async (params: { symbol: string; exchange?: DataSource }) => {
    if (!params.symbol) return
    try {
      const to = Math.floor(Date.now() / 1000)
      const from = to - 60
      const bars = await fetchKlineData({
        symbol: params.symbol,
        interval: '1m',
        from,
        to,
        exchange: params.exchange,
      })
      const latestClose = bars.at(-1)?.close
      setKlineClosePrice(
        typeof latestClose === 'number' && Number.isFinite(latestClose) ? latestClose : null,
      )
    } catch (error) {
      logger.error('Failed to fetch kline data:', error)
      setKlineClosePrice(null)
    }
  }

  // Fetch latest kline close price from API (one-shot on params change)
  useEffect(() => {
    if (!selectedSymbol) return
    fetchLatestKline({
      symbol: selectedSymbol,
      exchange: isAggregated ? undefined : selectedExchange,
    })
  }, [selectedSymbol, isAggregated, selectedExchange])

  // WebSocket real-time kline updates
  useEffect(() => {
    if (!selectedSymbol) return

    if (!socketRef.current) {
      const wsBaseUrl = getWsBaseUrl()
      setWsStatus('connecting')
      socketRef.current = io(`${wsBaseUrl}/kline`, {
        transports: ['websocket'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionAttempts: 5,
      })

      const socket = socketRef.current

      socket.on('connect', () => {
        logger.debug('[TopBar] WebSocket connected')
        logger.debug(`[TopBar] Current selectedSymbol: ${selectedSymbol}`)
        logger.debug(`[TopBar] Current selectedSymbolRef: ${selectedSymbolRef.current}`)
        setWsStatus('connected')
        // 使用闭包中的 selectedSymbol,因为 prevSymbolRef.current 在首次连接时还未设置
        if (selectedSymbol) {
          // 订阅 K线
          socket.emit('subscribe', { symbol: selectedSymbol, interval: '1m' })
          logger.debug(`[TopBar] Subscribed to kline: ${selectedSymbol}`)

          // 订阅 Ticker
          const exchange = EXCHANGE_MAP[selectedExchange] ?? 'BINANCE'
          const instrumentType = marketType === 'spot' ? 'SPOT' : 'PERPETUAL'
          socket.emit('subscribeTicker', {
            symbol: selectedBase,
            exchange: isAggregated ? undefined : exchange,
            instrumentType: isAggregated ? undefined : instrumentType,
          })
          logger.debug(`[TopBar] Subscribed to ticker: ${selectedBase}`)
        }
        fetchLatestKline(klineParamsRef.current)
      })

      socket.on('kline', (data: { symbol: string; interval: string; bar: { close: number } }) => {
        logger.debug(`[TopBar] Received kline data:`, data)
        const { symbol, bar } = data

        logger.debug(
          `[TopBar] Comparing symbols - received: ${symbol}, current: ${selectedSymbolRef.current}`,
        )

        // Validate symbol matches current subscription
        if (symbol !== selectedSymbolRef.current) {
          logger.debug(
            `[TopBar] Ignoring kline for ${symbol}, current: ${selectedSymbolRef.current}`,
          )
          return
        }

        logger.debug(`[TopBar] Symbol matched! Processing bar.close: ${bar.close}`)

        if (Number.isFinite(bar.close)) {
          const now = Date.now()
          if (now - lastKlineUpdateTimeRef.current >= THROTTLE_INTERVAL) {
            logger.debug(`[TopBar] Updating klineClosePrice to ${bar.close}`)
            setKlineClosePrice(bar.close)
            lastKlineUpdateTimeRef.current = now
            logger.debug(`[TopBar] Real-time price update: ${bar.close} for ${symbol}`)
          } else {
            logger.debug(
              `[TopBar] Throttled - skipping update (${now - lastKlineUpdateTimeRef.current}ms since last)`,
            )
          }
        } else {
          logger.warn(`[TopBar] Invalid bar.close value: ${bar.close}`)
        }
      })

      socket.on('ping', () => {
        logger.debug('[TopBar] Ping sent')
      })

      socket.on('pong', (latency: number) => {
        logger.debug(`[TopBar] Pong received, latency: ${latency}ms`)
      })

      socket.on('disconnect', () => {
        logger.debug('[TopBar] WebSocket disconnected')
        setWsStatus('disconnected')
      })

      socket.on('connect_error', error => {
        logger.error('[TopBar] WebSocket connection error:', error)
        setWsStatus('error')
      })

      socket.on('error', error => {
        logger.error('[TopBar] WebSocket error:', error)
        setWsStatus('error')
      })

      // Ticker WebSocket 事件监听器
      socket.on(
        'tickerSubscribed',
        (data: {
          exchange: string
          instrumentType: string
          symbol: string
          subscriptionKey: string
        }) => {
          logger.debug('[TopBar] Ticker subscribed:', data)
        },
      )

      socket.on(
        'ticker',
        (data: {
          symbol: string
          currentPrice: number | null
          indexPrice: number | null
          fundingRate: number | null
          priceChangePercent24h: number | null
          volumeUsd: number | null
          openInterestUsd: number | null
          timestamp: number
        }) => {
          logger.debug('[TopBar] Received ticker data:', data)

          // Use ref to avoid stale closure
          const currentSymbol = selectedSymbolRef.current
          let currentBase = 'BTC'
          if (currentSymbol) {
            currentBase = extractBaseSymbol(currentSymbol)
          }

          // 验证 symbol 是否匹配当前订阅
          if (data.symbol !== currentBase) {
            logger.debug(`[TopBar] Ignoring ticker for ${data.symbol}, current: ${currentBase}`)
            return
          }

          // 更新 tickerData
          setTickerData({
            symbol: data.symbol,
            currentPrice: data.currentPrice?.toString() ?? '0',
            indexPrice: data.indexPrice?.toString() ?? undefined,
            fundingRate: data.fundingRate?.toString() ?? undefined,
            priceChangePercent24h: data.priceChangePercent24h?.toString() ?? undefined,
            volumeUsd: data.volumeUsd?.toString() ?? '0',
            openInterestUsd: data.openInterestUsd?.toString() ?? undefined,
          })
        },
      )

      socket.on(
        'tickerUnsubscribed',
        (data: {
          exchange: string
          instrumentType: string
          symbol: string
          subscriptionKey: string
        }) => {
          logger.debug('[TopBar] Ticker unsubscribed:', data)
        },
      )
    }

    const socket = socketRef.current
    const prevSymbol = prevSymbolRef.current

    if (prevSymbol && prevSymbol !== selectedSymbol) {
      // 取消订阅旧的 K线
      socket.emit('unsubscribe', { symbol: prevSymbol, interval: '1m' })

      // 取消订阅旧的 Ticker
      const prevBase = extractBaseSymbol(prevSymbol)
      const exchange = EXCHANGE_MAP[selectedExchange] ?? 'BINANCE'
      const instrumentType = marketType === 'spot' ? 'SPOT' : 'PERPETUAL'
      socket.emit('unsubscribeTicker', {
        symbol: prevBase,
        exchange: isAggregated ? undefined : exchange,
        instrumentType: isAggregated ? undefined : instrumentType,
      })
    }

    prevSymbolRef.current = selectedSymbol
    lastKlineUpdateTimeRef.current = 0

    if (socket.connected) {
      // 订阅新的 K线
      socket.emit('subscribe', { symbol: selectedSymbol, interval: '1m' })

      // 订阅新的 Ticker
      const exchange = EXCHANGE_MAP[selectedExchange] ?? 'BINANCE'
      const instrumentType = marketType === 'spot' ? 'SPOT' : 'PERPETUAL'
      socket.emit('subscribeTicker', {
        symbol: selectedBase,
        exchange: isAggregated ? undefined : exchange,
        instrumentType: isAggregated ? undefined : instrumentType,
      })
    } else {
      setWsStatus('connecting')
    }

    return () => {}
  }, [selectedSymbol, setWsStatus, selectedExchange, marketType, isAggregated, selectedBase])

  useEffect(() => {
    return () => {
      if (!socketRef.current) return
      if (prevSymbolRef.current) {
        // 取消订阅 K线
        socketRef.current.emit('unsubscribe', {
          symbol: prevSymbolRef.current,
          interval: '1m',
        })

        // 取消订阅 Ticker
        const prevBase = extractBaseSymbol(prevSymbolRef.current)
        const exchange = EXCHANGE_MAP[selectedExchange] ?? 'BINANCE'
        const instrumentType = marketType === 'spot' ? 'SPOT' : 'PERPETUAL'
        socketRef.current.emit('unsubscribeTicker', {
          symbol: prevBase,
          exchange: isAggregated ? undefined : exchange,
          instrumentType: isAggregated ? undefined : instrumentType,
        })
      }
      socketRef.current.disconnect()
      socketRef.current = null
    }
  }, [selectedExchange, marketType, isAggregated])

  // Mock raw values (keep as numbers so locale switching works)
  const basePriceByAsset: Record<string, number> = {
    BTC: 87010.0,
    ETH: 4850.2,
    SOL: 145.8,
    XRP: 1.12,
    BNB: 620.5,
    DOGE: 0.38,
    ADA: 0.75,
    AVAX: 42.6,
    LINK: 18.9,
    DOT: 8.4,
  }

  // Use API data if available, otherwise fallback to mock
  const basePrice = basePriceByAsset[selectedBase] ?? 100

  // 顶部“主价格”展示变量 lastPrice：
  // 优先级：实时 K 线收盘价 klineClosePrice > tickerData.currentPrice > mock（依赖 selectedBase + isAggregated/selectedExchange）。
  const lastPrice =
    klineClosePrice ??
    (tickerData
      ? Number.parseFloat(tickerData.currentPrice)
      : isAggregated
        ? basePrice
        : selectedExchange === 'binance'
          ? basePrice * 1.0001
          : basePrice * 0.9999)

  const changePctByAsset: Record<string, number> = {
    BTC: -0.45,
    ETH: 1.25,
    SOL: 5.4,
    XRP: -2.3,
    BNB: 0.8,
    DOGE: 8.5,
    ADA: -1.1,
    AVAX: 3.2,
    LINK: 0.5,
    DOT: -0.9,
  }

  const fallbackPct = changePctByAsset[selectedBase] ?? 0.5

  // 顶部主价格/24h 涨跌幅统一口径（严格以 ticker 为准）；ticker 缺失时回退到 mock。
  const { displayLastPrice, displayChangePct, displayChangeAbs } = calculateTopBarDisplayValues({
    tickerData,
    isAggregated,
    isBinance: selectedExchange === 'binance',
    basePrice,
    fallbackPct,
  })

  // Index price and mark price
  const indexPrice =
    tickerData && tickerData.indexPrice
      ? Number.parseFloat(tickerData.indexPrice)
      : lastPrice * 1.0005
  const markPrice = lastPrice // Use currentPrice as mark price

  // Funding rate
  const fundingRatePct =
    tickerData && tickerData.fundingRate ? Number.parseFloat(tickerData.fundingRate) * 100 : 0.004

  // 24h high/low - fallback to mock calculation
  const low24h = lastPrice * 0.994
  const high24h = lastPrice * 1.012

  // Open interest / volume should match the selected base asset (not hardcoded BTC)
  const openInterestByAsset: Record<string, number> = {
    BTC: 24_000,
    ETH: 180_000,
    SOL: 2_600_000,
    XRP: 85_000_000,
    BNB: 120_000,
    DOGE: 950_000_000,
    ADA: 220_000_000,
    AVAX: 1_800_000,
    LINK: 12_500_000,
    DOT: 35_000_000,
  }
  const volume24hByAsset: Record<string, number> = {
    BTC: 68_200,
    ETH: 520_000,
    SOL: 8_500_000,
    XRP: 1_250_000_000,
    BNB: 340_000,
    DOGE: 5_800_000_000,
    ADA: 1_900_000_000,
    AVAX: 6_200_000,
    LINK: 48_000_000,
    DOT: 92_000_000,
  }

  const oiBase = openInterestByAsset[selectedBase] ?? 10_000
  const volBase = volume24hByAsset[selectedBase] ?? 50_000

  const exchangeMultiplier = isAggregated ? 1 : selectedExchange === 'binance' ? 0.6 : 0.4

  // Use API data if available, otherwise fallback to mock
  const openInterest =
    tickerData && tickerData.openInterestUsd
      ? Number.parseFloat(tickerData.openInterestUsd) / lastPrice // Convert USD to base asset quantity
      : oiBase * exchangeMultiplier

  const volume24h =
    tickerData && tickerData.volumeUsd
      ? Number.parseFloat(tickerData.volumeUsd) / lastPrice // Convert USD to base asset quantity
      : volBase * exchangeMultiplier

  // Mock Market Data
  const marketList = useMemo(() => {
    return getMockMarketList({ marketType, isAggregated, selectedExchange }) as MarketItem[]
  }, [marketType, isAggregated, selectedExchange])

  const filteredMarketList = useMemo(() => {
    const q = searchQuery.trim().toUpperCase()
    if (!q) return marketList
    return marketList.filter(
      m => m.displaySymbol.toUpperCase().includes(q) || m.base.toUpperCase().includes(q),
    )
  }, [marketList, searchQuery])

  const selectedDisplaySymbol = useMemo(() => {
    if (!selectedSymbol) return 'BTCUSDT' // 默认值
    if (marketType === 'spot' && selectedSymbol.endsWith('USDT')) {
      return `${selectedSymbol.slice(0, -4)}/USDT`
    }
    return selectedSymbol
  }, [marketType, selectedSymbol])

  return (
    <div
      className={`${isCompact ? 'h-[48px]' : 'h-[61px]'} flex w-full items-center border-b border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] text-[color:var(--cf-text)]`}
    >
      {/* Left Area: Removed Navigation */}

      {/* Center & Right Area: Full width now */}
      <div className="relative flex h-full min-w-0 flex-1 items-center gap-2 px-2 md:gap-6 md:px-4">
        {wsConnectionStatus === 'error' && (
          <div className="absolute top-0 right-0 mt-2 mr-2">
            <div className="flex items-center gap-1 rounded bg-red-500/10 px-2 py-1 text-xs text-red-500">
              <span className="h-2 w-2 rounded-full bg-red-500" />
              <span>实时数据连接失败</span>
            </div>
          </div>
        )}

        {wsConnectionStatus === 'connecting' && (
          <div className="absolute top-0 right-0 mt-2 mr-2">
            <div className="flex items-center gap-1 rounded bg-yellow-500/10 px-2 py-1 text-xs text-yellow-500">
              <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
              <span>连接中...</span>
            </div>
          </div>
        )}
        {/* Symbol and Main Price */}
        <div className="relative flex flex-none items-center gap-2 md:gap-4" ref={menuRef}>
          <button
            type="button"
            className={`group flex cursor-pointer items-center gap-2 rounded transition-colors hover:bg-[color:var(--cf-surface-hover)] ${isCompact ? 'p-1' : 'p-1'}`}
            onClick={() => setIsSymbolMenuOpen(!isSymbolMenuOpen)}
          >
            <div
              className={`${isCompact ? 'h-5 w-5 text-[9px]' : 'h-6 w-6 text-[10px]'} flex items-center justify-center rounded-full bg-orange-500 font-bold text-black`}
            >
              ₿
            </div>
            <div className="flex items-center gap-1">
              <span
                className={`font-bold whitespace-nowrap ${isCompact ? 'text-sm' : 'text-base'}`}
              >
                {t('trade.symbolWithType', {
                  symbol: selectedDisplaySymbol,
                  type: marketType === 'futures' ? t('trade.perpTag') : t('trade.market_type_spot'),
                })}
              </span>
              <ChevronDownIcon
                className={`${isCompact ? 'h-3 w-3' : 'h-4 w-4'} text-[color:var(--cf-muted)] transition-transform group-hover:text-[color:var(--cf-text)] ${isSymbolMenuOpen ? 'rotate-180' : ''}`}
              />
            </div>
          </button>

          {/* Symbol Selector Dropdown */}
          {isSymbolMenuOpen && (
            <div
              className={`animate-in fade-in zoom-in-95 absolute top-full left-0 z-50 mt-2 flex w-[90vw] max-w-[480px] flex-col overflow-hidden rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] shadow-2xl duration-100 md:w-[480px]`}
            >
              {/* Header / Tabs */}
              <div className="flex items-center border-b border-[color:var(--cf-border)]">
                <button
                  type="button"
                  className={`flex-1 ${isCompact ? 'py-2 text-xs' : 'py-3 text-sm'} font-medium transition-colors ${marketType === 'futures' ? 'bg-[color:var(--cf-surface-2)] text-[color:var(--cf-text)]' : 'text-[color:var(--cf-muted)] hover:bg-[color:var(--cf-surface-hover)] hover:text-[color:var(--cf-text)]'}`}
                  onClick={() => setMarketType('futures')}
                >
                  {t('trade.market_type_futures')}
                </button>
                <button
                  type="button"
                  className={`flex-1 ${isCompact ? 'py-2 text-xs' : 'py-3 text-sm'} font-medium transition-colors ${marketType === 'spot' ? 'bg-[color:var(--cf-surface-2)] text-[color:var(--cf-text)]' : 'text-[color:var(--cf-muted)] hover:bg-[color:var(--cf-surface-hover)] hover:text-[color:var(--cf-text)]'}`}
                  onClick={() => setMarketType('spot')}
                >
                  {t('trade.market_type_spot')}
                </button>
              </div>

              {/* Search Bar */}
              <div
                className={`${isCompact ? 'p-2' : 'p-3'} border-b border-[color:var(--cf-border)]`}
              >
                <div className="relative">
                  <SearchIcon className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-[color:var(--cf-muted)]" />
                  <input
                    type="text"
                    placeholder={t('chart.modal.search')}
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className={`w-full rounded border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] ${isCompact ? 'py-1 text-xs' : 'py-1.5 text-sm'} pr-3 pl-9 text-[color:var(--cf-text)] placeholder-[color:var(--cf-muted)] focus:border-[#58a6ff] focus:outline-none`}
                  />
                </div>
              </div>

              {/* List Header */}
              <div
                className={`grid grid-cols-4 ${isCompact ? 'px-3 py-1.5' : 'px-4 py-2'} bg-[color:var(--cf-surface-2)] text-xs text-[color:var(--cf-muted)]`}
              >
                <div className="col-span-1 text-left">{t('trade.column_symbol')}</div>
                <div className="col-span-1 text-right">{t('trade.column_price')}</div>
                <div className="col-span-1 text-right">{t('trade.column_change')}</div>
                <div className="col-span-1 text-right">{t('trade.column_volume')}</div>
              </div>

              {/* Market List */}
              <div className="cf-scrollbar max-h-[400px] flex-1 overflow-y-auto pr-1">
                {filteredMarketList.map(item => {
                  const isSelected = item.chartSymbol === selectedSymbol
                  return (
                    <button
                      key={`${marketType}-${item.chartSymbol}`}
                      type="button"
                      className={`grid w-full grid-cols-4 text-left ${isCompact ? 'px-3 py-2' : 'px-4 py-2.5'} cursor-pointer border-b border-[color:var(--cf-border)]/50 text-xs transition-colors last:border-0 ${
                        isSelected
                          ? 'bg-[color:var(--cf-surface-2)]'
                          : 'hover:bg-[color:var(--cf-surface-hover)]'
                      }`}
                      onClick={() => {
                        setSelectedSymbol(item.chartSymbol)
                        setIsSymbolMenuOpen(false)
                      }}
                    >
                      <div className="col-span-1 flex min-w-0 items-center gap-2 text-left">
                        <span
                          className={`truncate font-bold ${isSelected ? 'text-[color:var(--cf-text-strong)]' : 'text-[color:var(--cf-text)]'}`}
                        >
                          {item.displaySymbol}
                        </span>
                        {marketType === 'futures' && !isCompact && (
                          <span className="ml-1 rounded border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] px-1.5 py-0.5 text-[10px] whitespace-nowrap text-[color:var(--cf-muted)]">
                            {t('trade.perpTag')}
                          </span>
                        )}
                      </div>
                      <div className="col-span-1 text-right font-mono text-[color:var(--cf-text)]">
                        {priceFormatter.format(item.price)}
                      </div>
                      <div
                        className={`col-span-1 text-right font-medium ${item.changePct >= 0 ? 'text-[#22c55e]' : 'text-[#ef4444]'}`}
                      >
                        {formatPct(item.changePct)}
                      </div>
                      <div className="col-span-1 text-right text-[color:var(--cf-text)]">
                        {compactFormatter.format(item.volume)}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* 顶部主价格 + 24h 涨跌幅展示：
            - 价格：displayLastPrice（ticker last 优先；ticker 缺失时回退到 mock；不再使用 klineClosePrice 覆盖展示）
            - 涨跌幅：displayChangePct（ticker 24h 涨跌幅优先；ticker 缺失时回退到 mock 百分比） */}
        <div className="flex flex-col">
          <span
            className={`${isCompact ? 'text-base' : 'text-lg'} leading-tight font-semibold text-[#ef4444]`}
          >
            {priceFormatter.format(displayLastPrice)}
          </span>
          <div className="flex items-center gap-2 text-[10px] leading-tight text-[#ef4444]">
            <span>
              {displayChangeAbs >= 0
                ? `+${priceFormatter.format(displayChangeAbs)}`
                : priceFormatter.format(displayChangeAbs)}
            </span>
            <span>{formatPct(displayChangePct)}</span>
          </div>
        </div>

        {/* Market Stats - Flexible list with reduced gap for small screens */}
        <div
          className={`flex flex-1 items-center gap-3 md:gap-6 ${isCompact ? 'text-[10px]' : 'text-[11px]'} no-scrollbar overflow-x-auto`}
        >
          <div className="flex min-w-fit flex-col">
            <span className="whitespace-nowrap text-[color:var(--cf-muted)]">
              {t('trade.index_price')}
            </span>
            <span className="whitespace-nowrap text-[color:var(--cf-text)]">
              {formatUsd(indexPrice)}
            </span>
          </div>
          <div className="flex min-w-fit flex-col">
            <span className="whitespace-nowrap text-[color:var(--cf-muted)]">
              {t('trade.mark_price')}
            </span>
            <span className="whitespace-nowrap text-[color:var(--cf-text)]">
              {formatUsd(markPrice)}
            </span>
          </div>
          <div className="flex min-w-fit flex-col">
            <div className="flex items-center gap-1">
              <span className="whitespace-nowrap text-[color:var(--cf-muted)]">
                {t('trade.funding_rate')}
              </span>
              <InfoIcon className="h-3 w-3 text-[color:var(--cf-muted)]" />
            </div>
            <span className="whitespace-nowrap text-orange-400">{formatPct(fundingRatePct)}</span>
          </div>
          <div className="flex min-w-fit flex-col">
            <span className="whitespace-nowrap text-[color:var(--cf-muted)]">
              {t('trade.24h_low')}
            </span>
            <span className="whitespace-nowrap text-[color:var(--cf-text)]">
              {formatUsd2(low24h)}
            </span>
          </div>
          <div className="flex min-w-fit flex-col">
            <span className="whitespace-nowrap text-[color:var(--cf-muted)]">
              {t('trade.24h_high')}
            </span>
            <span className="whitespace-nowrap text-[color:var(--cf-text)]">
              {formatUsd(high24h)}
            </span>
          </div>
          <div className="flex min-w-fit flex-col">
            <span className="whitespace-nowrap text-[color:var(--cf-muted)]">
              {t('trade.open_interest')}
            </span>
            <span className="whitespace-nowrap text-[color:var(--cf-text)]">
              {compactFormatter.format(openInterest)} {selectedBase}
            </span>
          </div>
          <div className="flex min-w-fit flex-col">
            <span className="whitespace-nowrap text-[color:var(--cf-muted)]">
              {t('trade.24h_volume')}
            </span>
            <span className="whitespace-nowrap text-[color:var(--cf-text)]">
              {compactFormatter.format(volume24h)} {selectedBase}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
