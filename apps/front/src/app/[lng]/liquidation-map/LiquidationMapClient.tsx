'use client'

import dynamic from 'next/dynamic'
import React, { useEffect, useState } from 'react'
import { LiquidationMapHeader } from '@/components/liquidation-map/LiquidationMapHeader'
import {
  generateLiquidationMapMockData,
  liquidationSymbolPrices,
} from '@/lib/liquidation-map/mock-liquidation-map'

const LiquidationMapChart = dynamic(
  () => import('@/components/liquidation-map/LiquidationMapChart').then(mod => mod.LiquidationMapChart),
  {
    ssr: false,
    loading: () => <div className="h-[600px] w-full animate-pulse rounded-lg bg-[color:var(--cf-surface-2)]" />,
  },
)

export function LiquidationMapClient() {
  const [symbol, setSymbol] = useState('BTC')
  const [range, setRange] = useState<'1d' | '7d' | '30d'>('1d')
  const [exchangeType, setExchangeType] = useState('All')
  const [currentPrice, setCurrentPrice] = useState(89083)
  const [data, setData] = useState(() => generateLiquidationMapMockData('BTC', '1d', 'All'))

  useEffect(() => {
    const newPrice = liquidationSymbolPrices[symbol] || 100

    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setCurrentPrice(newPrice)
    // eslint-disable-next-line react-hooks-extra/no-direct-set-state-in-use-effect
    setData(generateLiquidationMapMockData(symbol, range, exchangeType as any))
  }, [symbol, range, exchangeType])

  const handleRefresh = () => {
    setData(generateLiquidationMapMockData(symbol, range, exchangeType as any))
  }

  return (
    <div className="max-w-[1440px] mx-auto w-full flex flex-col gap-6 md:gap-10 p-4 md:p-8">
      <LiquidationMapHeader
        symbol={symbol}
        setSymbol={setSymbol}
        range={range}
        setRange={setRange}
        exchangeType={exchangeType}
        setExchangeType={setExchangeType}
        onRefresh={handleRefresh}
      />

      <div className="flex flex-col gap-4">
        <LiquidationMapChart data={data} currentPrice={currentPrice} />
      </div>
    </div>
  )
}

