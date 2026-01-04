'use client'

import React, { useEffect, useState } from 'react'
import { LiquidationMapChart } from '@/components/liquidation-map/LiquidationMapChart'
import { LiquidationMapHeader } from '@/components/liquidation-map/LiquidationMapHeader'

const symbolPrices: Record<string, number> = {
  BTC: 89083,
  ETH: 3345,
  SOL: 168,
  XRP: 2.5,
  DOGE: 0.4,
  BNB: 620,
  HYPE: 18.5,
  LINK: 15.2,
  AVAX: 35.8,
  ADA: 0.8,
}

const generateMockData = (symbol: string, range: '1d' | '7d' | '30d', exchangeType: string = 'All') => {
  const labels: string[] = []
  const currentPrice = symbolPrices[symbol] || 100
  // Use a +/- 15% range to ensure current price is exactly centered
  const startPrice = currentPrice * 0.85
  const endPrice = currentPrice * 1.15
  const stepCount = 150
  const step = (endPrice - startPrice) / stepCount

  for (let i = 0; i <= stepCount; i++) {
    const price = startPrice + i * step
    // For BTC/ETH/BNB (high price), round to int. For others, keep 2 decimals if > 10, or 3 decimals if < 10.
    if (price > 100) {
      labels.push(Math.round(price).toString())
    }
    else if (price > 10) {
      labels.push(price.toFixed(2))
    }
    else {
      labels.push(price.toFixed(3))
    }
  }

  const multiplier = range === '1d' ? 1 : range === '7d' ? 2.5 : 5

  const bybit: number[] = []
  const okx: number[] = []
  const binance: number[] = []
  const dex: number[] = []

  labels.forEach((label) => {
    const price = Number.parseFloat(label)
    const dist = Math.abs(price - currentPrice)

    // Smooth intensity based on distance from current price
    const intensity = Math.max(0, (1 - dist / (currentPrice * 0.15)) * 40 * multiplier * (Math.random() * 0.5 + 0.5))

    // Add bars even close to center, but maybe smaller
    const minIntensity = dist < (currentPrice * 0.01) ? intensity * 0.3 : intensity

    if (intensity > 0) {
      // Respect CEX/DEX filtering
      const showCEX = exchangeType === 'All' || exchangeType === 'CEX'
      const showDEX = exchangeType === 'All' || exchangeType === 'DEX'

      bybit.push(showCEX ? Math.round(minIntensity * 0.2) : 0)
      okx.push(showCEX ? Math.round(minIntensity * 0.3) : 0)
      binance.push(showCEX ? Math.round(minIntensity * 0.35) : 0)
      dex.push(showDEX ? Math.round(minIntensity * 0.15) : 0)
    }
    else {
      bybit.push(0)
      okx.push(0)
      binance.push(0)
      dex.push(0)
    }
  })

  // Calculate Cumulative values starting FROM the center
  const cumulativeLong = Array.from({ length: labels.length }).fill(null) as Array<number | null>
  const cumulativeShort = Array.from({ length: labels.length }).fill(null) as Array<number | null>

  // Find index of current price (middle of labels)
  const currentIdx = Math.floor(labels.length / 2)

  // Cumulative Long: Sum from center towards LEFT (lower prices)
  // Start with 0 at the current price
  let longSum = 0
  cumulativeLong[currentIdx] = 0
  for (let i = currentIdx - 1; i >= 0; i--) {
    const barTotal = (bybit[i] + okx[i] + binance[i] + dex[i])
    longSum += barTotal * 0.15
    cumulativeLong[i] = longSum
  }

  // Cumulative Short: Sum from center towards RIGHT (higher prices)
  // Start with 0 at the current price
  let shortSum = 0
  cumulativeShort[currentIdx] = 0
  for (let i = currentIdx + 1; i < labels.length; i++) {
    const barTotal = (bybit[i] + okx[i] + binance[i] + dex[i])
    shortSum += barTotal * 0.15
    cumulativeShort[i] = shortSum
  }

  return { labels, bybit, okx, binance, dex, cumulativeLong, cumulativeShort }
}

export function LiquidationMapClient() {
  const [symbol, setSymbol] = useState('BTC')
  const [range, setRange] = useState<'1d' | '7d' | '30d'>('1d')
  const [exchangeType, setExchangeType] = useState('All')
  const [currentPrice, setCurrentPrice] = useState(89083)
  const [data, setData] = useState(() => generateMockData('BTC', '1d', 'All'))

  useEffect(() => {
    const newPrice = symbolPrices[symbol] || 100

    setCurrentPrice(newPrice)
    setData(generateMockData(symbol, range, exchangeType))
  }, [symbol, range, exchangeType])

  const handleRefresh = () => {
    setData(generateMockData(symbol, range, exchangeType))
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


