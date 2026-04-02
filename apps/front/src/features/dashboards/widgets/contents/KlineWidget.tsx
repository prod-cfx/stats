'use client'

import type { DataSource, MarketType } from '@/types/trading'
import dynamic from 'next/dynamic'
import React, { useMemo, useState } from 'react'
import { TopBar } from '@/components/trading/top-bar'
import { Skeleton } from '@/components/ui/loading'

const CenterChartPanel = dynamic(
  () => import('@/components/trading/center-chart-panel').then(mod => mod.CenterChartPanel),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full min-h-[280px] w-full rounded-none" height="100%" />,
  },
)

export function KlineWidget(props: { config: Record<string, any> }) {
  // Keep only initial symbol from config; other interactions should be handled by the embedded UI.
  const initialSymbol = (props.config?.symbol as string) || 'BTCUSDT'

  const [isAggregated, setIsAggregated] = useState(true)
  const [selectedExchange, setSelectedExchange] = useState<DataSource>('binance')
  const [marketType, setMarketType] = useState<MarketType>('futures')
  const [selectedSymbol, setSelectedSymbol] = useState(initialSymbol)

  // When marketType switches to spot, TopBar shows BTC/USDT but selectedSymbol stays BTCUSDT; that's OK.
  const symbolForChart = useMemo(() => selectedSymbol || 'BTCUSDT', [selectedSymbol])

  return (
    <div className="h-full w-full max-h-full overflow-hidden flex flex-col bg-[#0d1117] cf-scrollbar-scope">
      {/* Full header + symbol dropdown interactions (same as trade page) */}
      <div className="flex-none">
        <TopBar
          isAggregated={isAggregated}
          selectedExchange={selectedExchange}
          marketType={marketType}
          setMarketType={setMarketType}
          selectedSymbol={symbolForChart}
          setSelectedSymbol={setSelectedSymbol}
          variant="compact"
        />
      </div>

      {/* Timeframe / aggregation / indicators toolbar + chart (same as trade page center panel) */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <CenterChartPanel
          isAggregated={isAggregated}
          setIsAggregated={setIsAggregated}
          selectedExchange={selectedExchange}
          setSelectedExchange={setSelectedExchange}
          symbol={symbolForChart}
          marketType={marketType}
          variant="compact"
        />
      </div>
    </div>
  )
}
