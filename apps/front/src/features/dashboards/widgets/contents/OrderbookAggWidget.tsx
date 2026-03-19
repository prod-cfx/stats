'use client'

import React from 'react'
import { AggregatedOrderbookView } from '@/components/aggregated-orderbook/AggregatedOrderbookView'

export function OrderbookAggWidget(props: { config: Record<string, any> }) {
  void props
  return (
    <div className="h-full w-full overflow-hidden flex flex-col">
      <div className="flex-1 min-h-0 overflow-auto cf-scrollbar">
        {/* Force a minimum width to trigger horizontal scroll on small tiles, 
            and use h-fit to allow vertical scroll when content exceeds tile height. */}
        <div className="min-w-[500px] h-fit">
          <AggregatedOrderbookView variant="compact" />
        </div>
      </div>
    </div>
  )
}
