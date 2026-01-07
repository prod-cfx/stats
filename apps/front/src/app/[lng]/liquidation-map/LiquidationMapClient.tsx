'use client'

import React, { useEffect, useState } from 'react'
import { LiquidationMapChart } from '@/components/liquidation-map/LiquidationMapChart'
import { LiquidationMapHeader } from '@/components/liquidation-map/LiquidationMapHeader'
import {
  generateLiquidationMapMockData,
  liquidationSymbolPrices,
} from '@/lib/liquidation-map/mock-liquidation-map'

export function LiquidationMapClient() {
  const [symbol, setSymbol] = useState('BTC')
  const [range, setRange] = useState<'1d' | '7d' | '30d'>('1d')
  const [exchangeType, setExchangeType] = useState('All')
  const [currentPrice, setCurrentPrice] = useState(89083)
  const [data, setData] = useState(() => generateLiquidationMapMockData('BTC', '1d', 'All'))

  useEffect(() => {
    const newPrice = liquidationSymbolPrices[symbol] || 100

    setCurrentPrice(newPrice)
    setData(generateLiquidationMapMockData(symbol, range, exchangeType as any))
  }, [symbol, range, exchangeType])

  const handleRefresh = () => {
    setData(generateLiquidationMapMockData(symbol, range, exchangeType as any))
  }

  return (
    <div className="max-w-[1440px] mx-auto w-full flex flex-col gap-10">
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


