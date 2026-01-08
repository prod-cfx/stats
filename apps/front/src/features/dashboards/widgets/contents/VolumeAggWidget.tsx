'use client'

import React from 'react'
import { AggregatedVolume } from '@/components/aggregated-orderbook/AggregatedVolume'

export function VolumeAggWidget(props: { config: Record<string, any> }) {
  void props
  return (
    <div className="h-full w-full overflow-hidden flex flex-col">
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
        <AggregatedVolume />
      </div>
    </div>
  )
}
