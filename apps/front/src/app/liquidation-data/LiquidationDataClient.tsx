'use client'

import React from 'react'
import { ExchangeLiquidationTable } from '@/components/liquidation-data/ExchangeLiquidationTable'
import { LiquidationInfoBar } from '@/components/liquidation-data/LiquidationInfoBar'
import { LiquidationSummary } from '@/components/liquidation-data/LiquidationSummary'

export function LiquidationDataClient() {
  return (
    <>
      <LiquidationSummary />
      <LiquidationInfoBar />
      <ExchangeLiquidationTable />
    </>
  )
}


