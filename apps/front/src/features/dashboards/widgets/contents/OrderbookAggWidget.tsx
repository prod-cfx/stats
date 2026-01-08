'use client'

import React from 'react'
import { AggregatedOrderbookView } from '@/components/aggregated-orderbook/AggregatedOrderbookView'

export function OrderbookAggWidget(props: { config: Record<string, any> }) {
  void props
  return (
    <div className="h-full w-full overflow-hidden flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <AggregatedOrderbookView />
      </div>
    </div>
  )
}
