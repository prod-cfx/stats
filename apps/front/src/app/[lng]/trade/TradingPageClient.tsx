'use client'

import type { DataSource, MarketType } from '@/types/trading'
import { useSearchParams } from 'next/navigation'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { BottomPanel } from '@/components/trading/bottom-panel'
import { CenterChartPanel } from '@/components/trading/center-chart-panel'
import { LeftTradePanel } from '@/components/trading/left-trade-panel'
import { RightPanel } from '@/components/trading/right-panel'
import { TopBar } from '@/components/trading/top-bar'

function normalizeSymbol(raw: string | null): string | null {
  if (!raw) return null
  const s = raw.trim().toUpperCase()
  if (!s) return null
  // Accept BTC → BTCUSDT
  if (/^[A-Z0-9]{2,10}$/.test(s) && !s.endsWith('USDT')) return `${s}USDT`
  // Accept BTCUSDT
  if (/^[A-Z0-9]{2,10}USDT$/.test(s)) return s
  return null
}

export default function TradingPageClient() {
  const searchParams = useSearchParams()
  const [isAggregated, setIsAggregated] = useState(true)
  const [selectedExchange, setSelectedExchange] = useState<DataSource>('binance')
  const [marketType, setMarketType] = useState<MarketType>('futures')
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT')

  const initializedRef = useRef(false)

  const initialFromUrl = useMemo(() => {
    const symbol = normalizeSymbol(searchParams?.get('symbol') ?? null)
    const mt = searchParams?.get('marketType')
    const marketTypeParam: MarketType | null =
      mt === 'spot' || mt === 'futures' ? (mt as MarketType) : null
    const agg = searchParams?.get('agg')
    const isAggParam = agg === '1' ? true : agg === '0' ? false : null
    return { symbol, marketType: marketTypeParam, isAggregated: isAggParam }
  }, [searchParams])

  // Init from URL params or localStorage (first mount only).
  useEffect(() => {
    if (initializedRef.current) return
    initializedRef.current = true

    try {
      const lsSymbol = normalizeSymbol(localStorage.getItem('trade.selectedSymbol'))
      const lsMarketType = localStorage.getItem('trade.marketType') as MarketType | null
      const lsAgg = localStorage.getItem('trade.isAggregated')

      const symbol = initialFromUrl.symbol ?? lsSymbol ?? 'BTCUSDT'
      const mt =
        initialFromUrl.marketType ??
        (lsMarketType === 'spot' || lsMarketType === 'futures' ? lsMarketType : null) ??
        'futures'
      const agg =
        initialFromUrl.isAggregated ?? (lsAgg === '0' ? false : lsAgg === '1' ? true : null) ?? true

      /* eslint-disable react-hooks-extra/no-direct-set-state-in-use-effect -- one-time hydration */
      setSelectedSymbol(symbol)
      setMarketType(mt)
      setIsAggregated(agg)
      /* eslint-enable react-hooks-extra/no-direct-set-state-in-use-effect */
    } catch {
      // ignore
    }
  }, [initialFromUrl])

  // If user navigates to the same page with different query params (e.g. via global search),
  // update state accordingly. Only apply when URL actually provides overrides.
  useEffect(() => {
    if (!searchParams) return
    const hasOverrides =
      searchParams.has('symbol') || searchParams.has('marketType') || searchParams.has('agg')
    if (!hasOverrides) return

    const nextSymbol = normalizeSymbol(searchParams.get('symbol'))
    const nextMarketTypeRaw = searchParams.get('marketType')
    const nextMarketType: MarketType | null =
      nextMarketTypeRaw === 'spot' || nextMarketTypeRaw === 'futures'
        ? (nextMarketTypeRaw as MarketType)
        : null
    const agg = searchParams.get('agg')
    const nextAgg: boolean | null = agg === '1' ? true : agg === '0' ? false : null

    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- event-driven navigation update
    if (nextSymbol && nextSymbol !== selectedSymbol) setSelectedSymbol(nextSymbol)
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- event-driven navigation update
    if (nextMarketType && nextMarketType !== marketType) setMarketType(nextMarketType)
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect -- event-driven navigation update
    if (typeof nextAgg === 'boolean' && nextAgg !== isAggregated) setIsAggregated(nextAgg)
  }, [isAggregated, marketType, searchParams, selectedSymbol])

  // Persist to localStorage so global search can deep-link without a user system.
  useEffect(() => {
    try {
      localStorage.setItem('trade.selectedSymbol', selectedSymbol)
      localStorage.setItem('trade.marketType', marketType)
      localStorage.setItem('trade.isAggregated', isAggregated ? '1' : '0')
    } catch {
      // ignore
    }
  }, [isAggregated, marketType, selectedSymbol])

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-[color:var(--cf-bg)] text-[color:var(--cf-text)]">
      <div className="flex-none">
        <Navbar />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {/* Top Bar fixed below Navbar */}
        <div className="flex-none">
          <TopBar
            isAggregated={isAggregated}
            selectedExchange={selectedExchange}
            marketType={marketType}
            setMarketType={setMarketType}
            selectedSymbol={selectedSymbol}
            setSelectedSymbol={setSelectedSymbol}
          />
        </div>

        <div className="flex flex-1 overflow-hidden p-4 md:p-8">
          <div className="mx-auto flex w-full max-w-[1440px] gap-4 overflow-hidden">
            {/* Left Panel - Fixed Width */}
            <div className="flex min-h-0 w-[280px] flex-none flex-col">
              <LeftTradePanel
                symbol={selectedSymbol}
                isAggregated={isAggregated}
                selectedExchange={selectedExchange}
              />
            </div>

            {/* Center Content (Chart + Bottom Area) */}
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex min-h-0 flex-1">
                {/* Main Chart Section */}
                <CenterChartPanel
                  isAggregated={isAggregated}
                  setIsAggregated={setIsAggregated}
                  selectedExchange={selectedExchange}
                  setSelectedExchange={setSelectedExchange}
                  symbol={selectedSymbol}
                  marketType={marketType}
                />
              </div>

              {/* Bottom Tabs Section */}
              <BottomPanel symbol={selectedSymbol} />
            </div>

            {/* Right Panel - Fixed Width */}
            <div className="flex min-h-0 w-[320px] flex-none flex-col">
              <RightPanel
                isAggregated={isAggregated}
                selectedExchange={selectedExchange}
                symbol={selectedSymbol}
                marketType={marketType}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-none">
        <Footer />
      </div>
    </div>
  )
}
