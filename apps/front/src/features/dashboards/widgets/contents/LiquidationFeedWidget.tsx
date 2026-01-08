'use client'

import React from 'react'
import { ExchangeLiquidationTable } from '@/components/liquidation-data/ExchangeLiquidationTable'

export function LiquidationFeedWidget(props: { config: Record<string, any> }) {
  void props
  // Reuse the existing ExchangeLiquidationTable component which provides "Aggregated Liquidation" data by exchange.
  // We hide the title since the widget shell provides one.
  return (
    <div className="h-full w-full overflow-hidden flex flex-col p-1">
      <ExchangeLiquidationTable showTitle={false} />
    </div>
  )
}
