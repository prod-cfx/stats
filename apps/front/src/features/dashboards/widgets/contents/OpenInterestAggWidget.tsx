'use client'

import React from 'react'
import { AggregatedOI } from '@/components/aggregated-orderbook/AggregatedOI'

export function OpenInterestAggWidget(props: { config: Record<string, any> }) {
  void props
  // Config can be used here later if we want to drive the symbol/view from the widget settings
  // For now, we reuse the self-contained component as requested.
  return (
    <div className="h-full w-full overflow-hidden flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <AggregatedOI />
      </div>
    </div>
  )
}
