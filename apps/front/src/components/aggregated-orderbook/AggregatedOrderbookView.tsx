'use client'

import type { AggregatedOrderbookLevel, AggregatedOrderbookMarketType } from '@/lib/api'
import { Check, Info, Settings } from 'lucide-react'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DepthChart } from '@/components/aggregated-orderbook/DepthChart'
import { OrderbookTable } from '@/components/aggregated-orderbook/OrderbookTable'
import { FilterButton } from '@/components/ui/FilterButton'
import { LoadingState } from '@/components/ui/loading'
import { fetchAggregatedOrderbook } from '@/lib/api'

// 后端支持的交易所
const FUTURES_EXCHANGES = ['bybit', 'binance', 'okx']
const SPOT_EXCHANGES = ['binance', 'okx', 'bybit']

// 刷新间隔（毫秒）
const REFRESH_INTERVAL = 3000

const BothIcon = ({ active }: { active: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 4H14" stroke={active ? 'var(--cf-text-strong)' : '#ef4444'} strokeWidth="2" strokeLinecap="round" />
    <path d="M2 7H10" stroke={active ? 'var(--cf-text-strong)' : 'var(--cf-muted)'} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    <path d="M2 10H10" stroke={active ? 'var(--cf-text-strong)' : 'var(--cf-muted)'} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    <path d="M2 13H14" stroke={active ? 'var(--cf-text-strong)' : '#22c55e'} strokeWidth="2" strokeLinecap="round" />
    <path d="M1 4.5L2.5 3L4 4.5" stroke={active ? 'var(--cf-text-strong)' : '#ef4444'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M1 12.5L2.5 14L4 12.5" stroke={active ? 'var(--cf-text-strong)' : '#22c55e'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const BidsIcon = ({ active }: { active: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 4H14" stroke={active ? 'var(--cf-text-strong)' : 'var(--cf-muted)'} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    <path d="M2 7H10" stroke={active ? 'var(--cf-text-strong)' : 'var(--cf-muted)'} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    <path d="M2 10H10" stroke={active ? 'var(--cf-text-strong)' : 'var(--cf-muted)'} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    <path d="M2 13H14" stroke={active ? 'var(--cf-text-strong)' : '#22c55e'} strokeWidth="2" strokeLinecap="round" />
    <path d="M1 12.5L2.5 14L4 12.5" stroke={active ? 'var(--cf-text-strong)' : '#22c55e'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const AsksIcon = ({ active }: { active: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 4H14" stroke={active ? 'var(--cf-text-strong)' : '#ef4444'} strokeWidth="2" strokeLinecap="round" />
    <path d="M2 7H10" stroke={active ? 'var(--cf-text-strong)' : 'var(--cf-muted)'} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    <path d="M2 10H10" stroke={active ? 'var(--cf-text-strong)' : 'var(--cf-muted)'} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    <path d="M2 13H14" stroke={active ? 'var(--cf-text-strong)' : 'var(--cf-muted)'} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    <path d="M1 4.5L2.5 3L4 4.5" stroke={active ? 'var(--cf-text-strong)' : '#ef4444'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

// 转换后端数据到前端组件格式（累计 BTC 数量）
// isAsks: asks 需要从最佳价（最低）向外累计，但显示时是倒序，所以需要反向计算
function transformOrderbookData(
  levels: AggregatedOrderbookLevel[],
  maxSize: number,
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
      price: level.price.toFixed(2),
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
  const [tickSize, setTickSize] = useState('1')
  const [displayMode, setDisplayMode] = useState('both')
  const [selectedExchanges, setSelectedExchanges] = useState<string[]>(FUTURES_EXCHANGES)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)

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

  // Update selected exchanges when market type changes
  useEffect(() => {
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setSelectedExchanges(marketType === 'futures' ? FUTURES_EXCHANGES : SPOT_EXCHANGES)
  }, [marketType])

  // Click outside to close settings
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const toggleExchange = (ex: string) => {
    setSelectedExchanges(prev =>
      prev.includes(ex) ? prev.filter(e => e !== ex) : [...prev, ex],
    )
  }

  // 获取数据
  const fetchData = useCallback(async () => {
    try {
      const apiType: AggregatedOrderbookMarketType = marketType === 'futures' ? 'perp' : 'spot'

      const data = await fetchAggregatedOrderbook({
        base: symbol,
        type: apiType,
        venues: selectedExchanges.join(','),
        depth: 100, // 固定深度，让后端返回足够数据
        tickSize: Number.parseFloat(tickSize), // 用户选择的价格聚合档位
      })

      // 显示限制：both 模式下每边最多 13 条
      const displayLimit = 13

      // 先切片到显示数量，再计算累计
      // Asks: 后端返回 low→high，取前 displayLimit 条（最接近盘口的低价）
      // Bids: 后端返回 high→low，取前 displayLimit 条（最接近盘口的高价）
      const slicedAsks = data.asks.slice(0, displayLimit)
      const slicedBids = data.bids.slice(0, displayLimit)

      // 计算最大 size 用于深度百分比（基于切片后的数据）
      const allSizes = [...slicedAsks, ...slicedBids].map(l => l.sizeTotal)
      const maxSize = Math.max(...allSizes, 1)

      // 转换数据格式
      // Asks: 累计从最低价（最佳卖价）开始，不需要反向
      // Bids: 累计从最高价（最佳买价）开始
      const transformedAsks = transformOrderbookData(slicedAsks, maxSize, false)
      const transformedBids = transformOrderbookData(slicedBids, maxSize, false)

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
    <div className={`bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-xl flex flex-col ${isCompact ? '' : 'shadow-2xl'} min-h-[750px] overflow-hidden h-full`}>
      <LoadingState isLoading={loading} error={!!error} onRetry={fetchData}>
        {orderbook
          ? (
              <>
                <div className={`flex items-center justify-between ${isCompact ? 'p-2' : 'p-4'} border-b border-[color:var(--cf-border)] bg-[color:var(--cf-surface-2)]/70 flex-none`}>
                  <div className={`flex items-center ${isCompact ? 'gap-2' : 'gap-6'}`}>
                    <div className="flex bg-[color:var(--cf-bg)] border border-[color:var(--cf-border)] rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => setMarketType('futures')}
                        className={`${isCompact ? 'px-2 py-1 text-xs' : 'px-6 py-1.5 text-sm'} rounded-md font-medium transition-all ${marketType === 'futures'
                          ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/20'
                          : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text)]'}`}
                      >
                        {t('aggregatedOrderbook.market.futures')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setMarketType('spot')}
                        className={`${isCompact ? 'px-2 py-1 text-xs' : 'px-6 py-1.5 text-sm'} rounded-md font-medium transition-all ${marketType === 'spot'
                          ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/20'
                          : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text)]'}`}
                      >
                        {t('aggregatedOrderbook.market.spot')}
                      </button>
                    </div>
                    <div className="flex bg-[color:var(--cf-bg)] border border-[color:var(--cf-border)] rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => setSymbol('BTC')}
                        className={`${isCompact ? 'px-2 py-1 text-xs' : 'px-4 py-1.5 text-sm'} rounded-md font-medium transition-all ${symbol === 'BTC'
                          ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md'
                          : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text)]'}`}
                      >
                        BTC
                      </button>
                      <button
                        type="button"
                        onClick={() => setSymbol('ETH')}
                        className={`${isCompact ? 'px-2 py-1 text-xs' : 'px-4 py-1.5 text-sm'} rounded-md font-medium transition-all ${symbol === 'ETH'
                          ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md'
                          : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text)]'}`}
                      >
                        ETH
                      </button>
                    </div>
                  </div>
                  {!isCompact && (
                    <div className="flex items-center gap-4 text-xs text-[color:var(--cf-muted)]">
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
                  <div className={`w-full md:${isCompact ? 'w-[58%]' : 'w-1/2'} flex flex-col border-b md:border-b-0 md:border-r border-[color:var(--cf-border)] min-h-[500px] md:min-h-0`}>
                    <div className={`${isCompact ? 'p-1.5' : 'p-4'} border-b border-[color:var(--cf-border)] flex items-center justify-between bg-[color:var(--cf-surface-2)]/50 flex-none`}>
                      <div className={`font-bold text-[color:var(--cf-text-strong)] tracking-tight ${isCompact ? 'text-[11px]' : 'text-sm md:text-lg'}`}>
                        {t('aggregatedOrderbook.sections.realtimeOrderbook', {
                          symbol: `${symbol}/USD`,
                          market: marketType === 'futures' ? t('aggregatedOrderbook.market.futures') : t('aggregatedOrderbook.market.spot'),
                        })}
                      </div>
                      <div className={`flex items-center ${isCompact ? 'gap-1' : 'gap-2 md:gap-4'}`}>
                        <div className="flex bg-[color:var(--cf-bg)] border border-[color:var(--cf-border)] rounded-md overflow-hidden p-0.5 scale-[0.85] origin-right">
                          <button
                            type="button"
                            onClick={() => setDisplayMode('both')}
                            className={`${isCompact ? 'p-0.5' : 'p-2'} transition-all rounded relative ${displayMode === 'both' ? 'text-white' : 'hover:bg-[color:var(--cf-surface-hover)]'}`}
                          >
                            {displayMode === 'both' && <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary rounded" />}
                            <div className="relative z-10">
                              <BothIcon active={displayMode === 'both'} />
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDisplayMode('bids')}
                            className={`${isCompact ? 'p-0.5' : 'p-2'} transition-all rounded relative ${displayMode === 'bids' ? 'text-white' : 'hover:bg-[color:var(--cf-surface-hover)]'}`}
                          >
                            {displayMode === 'bids' && <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary rounded" />}
                            <div className="relative z-10">
                              <BidsIcon active={displayMode === 'bids'} />
                            </div>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDisplayMode('asks')}
                            className={`${isCompact ? 'p-0.5' : 'p-2'} transition-all rounded relative ${displayMode === 'asks' ? 'text-white' : 'hover:bg-[color:var(--cf-surface-hover)]'}`}
                          >
                            {displayMode === 'asks' && <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary rounded" />}
                            <div className="relative z-10">
                              <AsksIcon active={displayMode === 'asks'} />
                            </div>
                          </button>
                        </div>

                        <FilterButton
                          value={tickSize}
                          options={['1', '10', '100']}
                          onChange={setTickSize}
                          minWidth={isCompact ? '35px' : '70px'}
                          size={isCompact ? 'sm' : 'md'}
                          className={isCompact ? 'scale-[0.85] origin-right' : ''}
                        />

                        <div className="relative" ref={settingsRef}>
                          <button
                            type="button"
                            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                            className={`${isCompact ? 'p-0.5' : 'p-2'} rounded-md transition-all active:scale-95 ${isSettingsOpen
                              ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg'
                              : 'text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text)] hover:bg-[color:var(--cf-surface-hover)]'}`}
                          >
                            <Settings className={isCompact ? 'w-3 h-3' : 'w-5 h-5'} />
                          </button>

                          {isSettingsOpen && (
                            <div className={`absolute top-full right-0 mt-2 ${isCompact ? 'w-32' : 'w-48'} bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-lg shadow-2xl z-30 overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-1.5`}>
                              <p className="text-[9px] font-bold text-[color:var(--cf-muted)] uppercase tracking-wider px-2 py-1 mb-0.5">{t('aggregatedOrderbook.settings.exchangeSources')}</p>
                              {(marketType === 'futures' ? FUTURES_EXCHANGES : SPOT_EXCHANGES).map(ex => (
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
                                  <span
                                    className={`${isCompact ? 'text-[9px]' : 'text-sm'} capitalize ${selectedExchanges.includes(ex) ? 'text-[color:var(--cf-text-strong)] font-medium' : 'text-[color:var(--cf-muted)]'}`}
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
                        displayMode={displayMode as 'both' | 'bids' | 'asks'}
                        variant={variant}
                      />
                    </div>
                  </div>

                  <div className={`w-full md:${isCompact ? 'w-[42%]' : 'w-1/2'} flex flex-col min-h-[400px] md:min-h-0`}>
                    <div className={`${isCompact ? 'p-1.5' : 'p-4'} border-b border-[color:var(--cf-border)] flex items-center justify-between bg-[color:var(--cf-surface-2)]/50 flex-none`}>
                      <div className={`font-bold text-[color:var(--cf-text-strong)] tracking-tight ${isCompact ? 'text-[11px]' : 'text-sm md:text-lg'}`}>{t('aggregatedOrderbook.sections.orderDepth')}</div>
                      {!isCompact && (
                        <div className="flex items-center gap-2 text-yellow-500 cursor-help hover:opacity-80 transition-all">
                          <Info className="w-4 h-4 hidden sm:block" />
                          <span className="text-xs md:text-sm">{t('aggregatedOrderbook.sections.liquidityHeatmap')}</span>
                        </div>
                      )}
                    </div>
                    <div className={`flex-1 min-h-0 ${isCompact ? 'p-1' : 'p-4'} flex flex-col`}>
                      <div className="flex-1 min-h-0">
                        <DepthChart bids={depthChartData.bids} asks={depthChartData.asks} />
                      </div>
                      {!isCompact && (
                        <div className="flex items-center justify-between mt-4 text-xs text-[color:var(--cf-muted)] flex-none">
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
