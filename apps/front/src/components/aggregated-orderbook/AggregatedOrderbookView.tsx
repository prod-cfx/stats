'use client'

import { Check, Info, Settings } from 'lucide-react'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DepthChart } from '@/components/aggregated-orderbook/DepthChart'
import { OrderbookTable } from '@/components/aggregated-orderbook/OrderbookTable'
import { FilterButton } from '@/components/ui/FilterButton'
import { LoadingState } from '@/components/ui/loading'
import { SectionTitle } from '@/components/ui/Typography'
import { useMockData } from '@/hooks/use-mock-data'

const EXCHANGE_LOGOS = [
  'https://s2.coinmarketcap.com/static/img/exchanges/64x64/270.png',
  'https://s2.coinmarketcap.com/static/img/exchanges/64x64/302.png',
  'https://s2.coinmarketcap.com/static/img/exchanges/64x64/542.png',
  'https://s2.coinmarketcap.com/static/img/exchanges/64x64/16.png',
  'https://s2.coinmarketcap.com/static/img/exchanges/64x64/87.png',
]

const FUTURES_EXCHANGES = ['bybit', 'binance', 'bitmex', 'okx', 'hype']
const SPOT_EXCHANGES = ['binance', 'okx', 'hype']

const BothIcon = ({ active }: { active: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 4H14" stroke={active ? 'white' : '#ef4444'} strokeWidth="2" strokeLinecap="round" />
    <path d="M2 7H10" stroke={active ? 'white' : '#8b949e'} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    <path d="M2 10H10" stroke={active ? 'white' : '#8b949e'} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    <path d="M2 13H14" stroke={active ? 'white' : '#22c55e'} strokeWidth="2" strokeLinecap="round" />
    <path d="M1 4.5L2.5 3L4 4.5" stroke={active ? 'white' : '#ef4444'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M1 12.5L2.5 14L4 12.5" stroke={active ? 'white' : '#22c55e'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const BidsIcon = ({ active }: { active: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 4H14" stroke={active ? 'white' : '#8b949e'} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    <path d="M2 7H10" stroke={active ? 'white' : '#8b949e'} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    <path d="M2 10H10" stroke={active ? 'white' : '#8b949e'} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    <path d="M2 13H14" stroke={active ? 'white' : '#22c55e'} strokeWidth="2" strokeLinecap="round" />
    <path d="M1 12.5L2.5 14L4 12.5" stroke={active ? 'white' : '#22c55e'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

const AsksIcon = ({ active }: { active: boolean }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 4H14" stroke={active ? 'white' : '#ef4444'} strokeWidth="2" strokeLinecap="round" />
    <path d="M2 7H10" stroke={active ? 'white' : '#8b949e'} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    <path d="M2 10H10" stroke={active ? 'white' : '#8b949e'} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    <path d="M2 13H14" stroke={active ? 'white' : '#8b949e'} strokeWidth="2" strokeLinecap="round" opacity="0.5" />
    <path d="M1 4.5L2.5 3L4 4.5" stroke={active ? 'white' : '#ef4444'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export function AggregatedOrderbookView({ variant = 'default' }: { variant?: 'default' | 'compact' }) {
  const { t, i18n } = useTranslation()
  const [marketType, setMarketType] = useState('futures')
  const [symbol, setSymbol] = useState('BTC')
  const [rowCount, setRowCount] = useState('10')
  const [displayMode, setDisplayMode] = useState('both')
  const [selectedExchanges, setSelectedExchanges] = useState<string[]>(FUTURES_EXCHANGES)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)

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

  const { data: orderbook, loading, error, reload } = useMockData(
    async () => {
      const midPrice = symbol === 'BTC' ? 89940.00 : 3345.00
      const count = 100 // Generate up to 100 rows internally
      const depthLevel = Number.parseInt(rowCount, 10) || 10
      const priceStep = 10 * depthLevel

      const generateRows = (isAsk: boolean) => Array.from({ length: count }, (_, i) => {
        const price = (midPrice + (isAsk ? 1 : -1) * (i + 1) * priceStep).toFixed(2)
        const amount = (Math.random() * 50 + 10).toFixed(4)
        const total = (Math.random() * 500 + 100).toFixed(0)
        return {
          price,
          amount,
          total,
          exchanges: EXCHANGE_LOGOS.slice(0, Math.min(selectedExchanges.length, 3)),
          depthPercent: Math.random() * 80 + 20,
        }
      })

      return {
        asks: generateRows(true),
        bids: generateRows(false),
        currentPrice: {
          price: midPrice.toFixed(2),
          usdPrice: midPrice.toFixed(2),
          change: '+135.56',
          changePercent: '+0.15%',
        },
      }
    },
    [symbol, marketType, rowCount, selectedExchanges],
  )

  const depthChartData = useMemo(() => {
    if (!orderbook)
      return { bids: [], asks: [] }

    let bidTotal = 0
    const bidPoints = orderbook.bids.map((b: any) => {
      bidTotal += Number.parseFloat(b.amount)
      const amount = Number.parseFloat(b.amount)
      return {
        price: Number.parseFloat(b.price),
        amount,
        total: bidTotal,
        exchangeBreakdown: selectedExchanges.length > 0 ? selectedExchanges.map(ex => ({
          name: ex,
          amount: amount / selectedExchanges.length,
          color: '#22c55e',
        })) : [],
      }
    })

    let askTotal = 0
    const askPoints = orderbook.asks.map((a: any) => {
      askTotal += Number.parseFloat(a.amount)
      const amount = Number.parseFloat(a.amount)
      return {
        price: Number.parseFloat(a.price),
        amount,
        total: askTotal,
        exchangeBreakdown: selectedExchanges.length > 0 ? selectedExchanges.map(ex => ({
          name: ex,
          amount: amount / selectedExchanges.length,
          color: '#ef4444',
        })) : [],
      }
    })

    return { bids: bidPoints, asks: askPoints }
  }, [orderbook, selectedExchanges])

  return (
    <div className={`bg-[#161b22] border border-[#30363d] rounded-xl flex flex-col ${isCompact ? 'min-h-fit overflow-visible' : 'min-h-[750px] shadow-2xl h-full overflow-hidden'}`}>
      <LoadingState isLoading={loading} error={error} onRetry={reload}>
        {orderbook ? (
          <>
            <div className={`flex items-center justify-between ${isCompact ? 'p-2' : 'p-4'} border-b border-[#30363d] bg-[#0d1117]/30 flex-none`}>
              <div className={`flex items-center ${isCompact ? 'gap-2' : 'gap-6'}`}>
                <div className="flex bg-[#0d1117] border border-[#30363d] rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setMarketType('futures')}
                    className={`${isCompact ? 'px-2 py-1 text-xs' : 'px-6 py-1.5 text-sm'} rounded-md font-medium transition-all ${marketType === 'futures'
                      ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/20'
                      : 'text-[#8b949e] hover:text-[#c9d1d9]'}`}
                  >
                    {t('aggregatedOrderbook.market.futures')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setMarketType('spot')}
                    className={`${isCompact ? 'px-2 py-1 text-xs' : 'px-6 py-1.5 text-sm'} rounded-md font-medium transition-all ${marketType === 'spot'
                      ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-lg shadow-primary/20'
                      : 'text-[#8b949e] hover:text-[#c9d1d9]'}`}
                  >
                    {t('aggregatedOrderbook.market.spot')}
                  </button>
                </div>
                <div className="flex bg-[#0d1117] border border-[#30363d] rounded-lg p-0.5">
                  <button
                    type="button"
                    onClick={() => setSymbol('BTC')}
                    className={`${isCompact ? 'px-2 py-1 text-xs' : 'px-4 py-1.5 text-sm'} rounded-md font-medium transition-all ${symbol === 'BTC'
                      ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md'
                      : 'text-[#8b949e] hover:text-[#c9d1d9]'}`}
                  >
                    BTC
                  </button>
                  <button
                    type="button"
                    onClick={() => setSymbol('ETH')}
                    className={`${isCompact ? 'px-2 py-1 text-xs' : 'px-4 py-1.5 text-sm'} rounded-md font-medium transition-all ${symbol === 'ETH'
                      ? 'bg-gradient-to-r from-primary to-secondary text-white shadow-md'
                      : 'text-[#8b949e] hover:text-[#c9d1d9]'}`}
                  >
                    ETH
                  </button>
                </div>
              </div>
              {!isCompact && (
                <div className="flex items-center gap-4 text-xs text-[#8b949e]">
                  <span>
                    {t('aggregatedOrderbook.stats.volume24h')}
                    :
                    {' '}
                    <span className="text-[#e6edf3]">
                      {numberCompact.format(68200)}
                      {' '}
                      BTC
                    </span>
                  </span>
                  <span>
                    {t('aggregatedOrderbook.stats.turnover24h')}
                    :
                    {' '}
                    <span className="text-[#e6edf3]">{currencyCompact.format(71_590_000)}</span>
                  </span>
                </div>
              )}
            </div>

            <div className={`flex-1 flex ${isCompact ? 'min-h-fit' : 'min-h-0'} overflow-hidden`}>
              <div className={`${isCompact ? 'w-[58%] min-h-fit' : 'w-1/2 flex flex-col'} border-r border-[#30363d]`}>
                <div className={`${isCompact ? 'p-1.5' : 'p-4'} border-b border-[#30363d] flex items-center justify-between bg-[#0d1117]/20 flex-none`}>
                  <SectionTitle className={isCompact ? 'text-[9px]' : 'text-lg'}>
                    {t('aggregatedOrderbook.sections.realtimeOrderbook', {
                      symbol: `${symbol}/USDT`,
                      market: marketType === 'futures' ? t('aggregatedOrderbook.market.futures') : t('aggregatedOrderbook.market.spot'),
                    })}
                  </SectionTitle>
                  <div className={`flex items-center ${isCompact ? 'gap-1' : 'gap-4'}`}>
                    <div className="flex bg-[#0d1117] border border-[#30363d] rounded-md overflow-hidden p-0.5 scale-[0.85] origin-right">
                      <button
                        type="button"
                        onClick={() => setDisplayMode('both')}
                        className={`${isCompact ? 'p-0.5' : 'p-2'} transition-all rounded relative ${displayMode === 'both' ? 'text-white' : 'hover:bg-white/5'}`}
                      >
                        {displayMode === 'both' && <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary rounded" />}
                        <div className="relative z-10">
                          <BothIcon active={displayMode === 'both'} />
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDisplayMode('bids')}
                        className={`${isCompact ? 'p-0.5' : 'p-2'} transition-all rounded relative ${displayMode === 'bids' ? 'text-white' : 'hover:bg-white/5'}`}
                      >
                        {displayMode === 'bids' && <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary rounded" />}
                        <div className="relative z-10">
                          <BidsIcon active={displayMode === 'bids'} />
                        </div>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDisplayMode('asks')}
                        className={`${isCompact ? 'p-0.5' : 'p-2'} transition-all rounded relative ${displayMode === 'asks' ? 'text-white' : 'hover:bg-white/5'}`}
                      >
                        {displayMode === 'asks' && <div className="absolute inset-0 bg-gradient-to-br from-primary to-secondary rounded" />}
                        <div className="relative z-10">
                          <AsksIcon active={displayMode === 'asks'} />
                        </div>
                      </button>
                    </div>

                    <FilterButton
                      value={rowCount}
                      options={['1', '10', '100']}
                      onChange={setRowCount}
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
                          : 'text-[#8b949e] hover:text-white hover:bg-[#30363d]'}`}
                      >
                        <Settings className={isCompact ? 'w-3 h-3' : 'w-5 h-5'} />
                      </button>

                      {isSettingsOpen && (
                        <div className={`absolute top-full right-0 mt-2 ${isCompact ? 'w-32' : 'w-48'} bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl z-30 overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-1.5`}>
                          <p className="text-[9px] font-bold text-[#8b949e] uppercase tracking-wider px-2 py-1 mb-0.5">{t('aggregatedOrderbook.settings.exchangeSources')}</p>
                          {(marketType === 'futures' ? FUTURES_EXCHANGES : SPOT_EXCHANGES).map(ex => (
                            <button
                              key={ex}
                              type="button"
                              onClick={() => toggleExchange(ex)}
                              className="w-full flex items-center gap-2 px-2 py-1 rounded-md transition-colors hover:bg-white/5 group text-left"
                            >
                              <div
                                className={`w-3 h-3 rounded border flex items-center justify-center transition-all ${selectedExchanges.includes(ex)
                                  ? 'bg-primary border-primary'
                                  : 'border-[#30363d] group-hover:border-[#8b949e]'}`}
                              >
                                {selectedExchanges.includes(ex) && <Check className="w-2 h-2 text-white" />}
                              </div>
                              <span
                                className={`${isCompact ? 'text-[9px]' : 'text-sm'} capitalize ${selectedExchanges.includes(ex) ? 'text-white font-medium' : 'text-[#8b949e]'}`}
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
                    displayMode={displayMode as any} 
                    variant={variant}
                  />
                </div>
              </div>

              <div className={`${isCompact ? 'w-[42%] min-h-fit' : 'w-1/2 flex flex-col min-h-0'}`}>
                <div className={`${isCompact ? 'p-1.5' : 'p-4'} border-b border-[#30363d] flex items-center justify-between bg-[#0d1117]/20 flex-none`}>
                  <SectionTitle className={isCompact ? 'text-[9px]' : 'text-lg'}>{t('aggregatedOrderbook.sections.orderDepth')}</SectionTitle>
                  {!isCompact && (
                    <div className="flex items-center gap-2 text-yellow-500 cursor-help hover:opacity-80 transition-all">
                      <Info className="w-4 h-4" />
                      <span className="text-sm">{t('aggregatedOrderbook.sections.liquidityHeatmap')}</span>
                    </div>
                  )}
                </div>
                <div className={`flex-1 min-h-0 ${isCompact ? 'p-1' : 'p-4'} flex flex-col`}>
                  <div className="flex-1 min-h-0">
                    <DepthChart bids={depthChartData.bids} asks={depthChartData.asks} />
                  </div>
                  {!isCompact && (
                    <div className="flex items-center justify-between mt-4 text-xs text-[#8b949e] flex-none">
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
                        BTC
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : null}
      </LoadingState>
    </div>
  )
}
