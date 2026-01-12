'use client'

import React from 'react'
import { AggregatedVolume } from '@/components/aggregated-orderbook/AggregatedVolume'

export function VolumeAggWidget(props: { config: Record<string, any> }) {
  const isCompact = props.config?.size === 'S'
  
  return (
    <div className="h-full w-full overflow-hidden flex flex-col">
      <div className="flex-1 min-h-0 overflow-auto cf-scrollbar">
        <AggregatedVolume variant={isCompact ? 'compact' : 'default'} />
      </div>
    </div>
  )
}
