'use client'

import type { DataSource, MarketType } from '@/types/trading'
import dynamic from 'next/dynamic'
import React, { useState } from 'react'
import { Footer } from '@/components/layout/Footer'
import { Navbar } from '@/components/layout/Navbar'
import { RightPanel } from '@/components/trading/right-panel'
import { TopBar } from '@/components/trading/top-bar'
import { Skeleton } from '@/components/ui/loading'

const CenterChartPanel = dynamic(
  () => import('@/components/trading/center-chart-panel').then(mod => mod.CenterChartPanel),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full min-h-[320px] w-full rounded-none" height="100%" />,
  },
)

export function MarketPageClient() {
  const [isAggregated, setIsAggregated] = useState(true)
  const [selectedExchange, setSelectedExchange] = useState<DataSource>('binance')
  const [marketType, setMarketType] = useState<MarketType>('futures')
  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT')

  return (
    <div className="flex min-h-screen w-full flex-col bg-[color:var(--cf-bg)] text-[color:var(--cf-text)]">
      <div className="flex-none">
        <Navbar />
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
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

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex min-h-0 w-full flex-col md:flex-row">
            <div className="relative flex h-[50vh] min-w-0 flex-none flex-col overflow-hidden border-b border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] md:h-[calc(100vh-120px)] md:flex-1 md:border-b-0">
              <CenterChartPanel
                isAggregated={isAggregated}
                setIsAggregated={setIsAggregated}
                selectedExchange={selectedExchange}
                setSelectedExchange={setSelectedExchange}
                symbol={selectedSymbol}
                marketType={marketType}
              />
            </div>

            <div className="cf-scrollbar h-auto w-full flex-none overflow-y-visible border-l-0 border-[color:var(--cf-border)] pr-1 pb-10 md:h-[calc(100vh-120px)] md:w-[20%] md:max-w-[340px] md:min-w-[240px] md:overflow-y-auto md:border-l md:pb-0">
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
      <Footer />
    </div>
  )
}
