'use client'

import type { DataSource, MarketType } from '@/components/trading/CenterChartPanel/TradingViewLightweightChart'
import React from 'react'
import { TradingViewLightweightChart } from '@/components/trading/CenterChartPanel/TradingViewLightweightChart'

export function KlineWidget(props: { config: Record<string, any> }) {
  const symbol = (props.config?.symbol as string) || 'BTCUSDT'
  const interval = (props.config?.interval as string) || '15m'
  // Venue might be "OKX", "Binance", etc. Map to lowercase for DataSource.
  const venue = (props.config?.venue as string) || 'OKX'
  const selectedExchange = (venue.toLowerCase() === 'binance' ? 'binance' : 'okx') as DataSource
  
  // Default to aggregated=false if specific venue selected, or true if we want agg.
  // The user prompt implies "use the one from Market page", which defaults to aggregated=true usually,
  // but let's respect the venue config if possible.
  const isAggregated = venue === 'AGG' // Example logic, adjust as needed

  const marketType = (props.config?.marketType as string) || 'futures' as MarketType

  return (
    <div className="h-full w-full max-h-full overflow-hidden flex flex-col bg-[#0d1117]">
      <div className="flex-1 min-h-0 overflow-hidden">
        <TradingViewLightweightChart
          symbol={symbol}
          interval={interval}
          isAggregated={isAggregated}
          selectedExchange={selectedExchange}
          marketType={marketType as MarketType}
          activeIndicators={[]}
          onRemoveIndicator={() => {}}
          isDashboard={true}
        />
      </div>
    </div>
  )
}
