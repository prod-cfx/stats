'use client'

import React from 'react'
import { ExchangeLiquidationTable } from '@/components/liquidation-data/ExchangeLiquidationTable'
import { LiquidationInfoBar } from '@/components/liquidation-data/LiquidationInfoBar'
import { LiquidationSummary } from '@/components/liquidation-data/LiquidationSummary'

export function LiquidationDataClient() {
  return (
    <div className="flex flex-col gap-6 md:gap-8 w-full p-4 md:p-8 max-w-[1440px] mx-auto">
      <LiquidationSummary />
      <LiquidationInfoBar />
      <ExchangeLiquidationTable />
    </div>
  )
}


