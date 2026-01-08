'use client'

import React, { useMemo } from 'react'
import { OrderbookTable } from '@/components/aggregated-orderbook/OrderbookTable'

interface OrderItem {
  price: string
  amount: string
  total: string
  exchanges: string[]
  depthPercent: number
}

function hashToUnit(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0) / 2 ** 32
}

const EX_LOGOS = [
  'https://s2.coinmarketcap.com/static/img/exchanges/64x64/270.png', // binance
  'https://s2.coinmarketcap.com/static/img/exchanges/64x64/302.png', // okx
  'https://s2.coinmarketcap.com/static/img/exchanges/64x64/542.png', // bybit
  'https://s2.coinmarketcap.com/static/img/exchanges/64x64/311.png', // kucoin
  'https://s2.coinmarketcap.com/static/img/exchanges/64x64/513.png', // bitget
]

function fmtNum(n: number, digits = 2) {
  if (!Number.isFinite(n)) return '-'
  return n.toLocaleString(undefined, { maximumFractionDigits: digits })
}

export function AggregatedOrderbookWidget(props: { config: Record<string, any> }) {
  const symbol = (props.config?.symbol as string) || 'BTCUSDT'
  const marketType = (props.config?.marketType as string) || 'swap'
  const depth = Number(props.config?.depth ?? 10)

  const { asks, bids, mid } = useMemo(() => {
    const midPrice = symbol.toUpperCase().includes('BTC') ? 89940 : 3345
    const depthLevel = Math.max(1, Math.min(50, depth))
    const priceStep = Math.max(0.5, (symbol.toUpperCase().includes('BTC') ? 1 : 0.5) * depthLevel)
    const rows = 60

    const mk = (isAsk: boolean): OrderItem[] =>
      Array.from({ length: rows }, (_, i) => {
        const p = midPrice + (isAsk ? 1 : -1) * (i + 1) * priceStep
        const amount = 10 + 80 * hashToUnit(`${symbol}:${marketType}:${depth}:${isAsk ? 'a' : 'b'}:${i}:amt`)
        const total = amount * (1 + 2 * hashToUnit(`${symbol}:${i}:tot`))
        const depthPercent = Math.min(100, Math.max(0, (i / rows) * 100))
        const exCount = 1 + Math.floor(hashToUnit(`${symbol}:${i}:ex`) * 3)
        const exchanges = Array.from({ length: exCount }, (_, k) => EX_LOGOS[(i + k) % EX_LOGOS.length])
        return {
          price: p.toFixed(2),
          amount: amount.toFixed(4),
          total: total.toFixed(0),
          exchanges,
          depthPercent: 100 - depthPercent,
        }
      })

    return { asks: mk(true), bids: mk(false), mid: midPrice }
  }, [depth, marketType, symbol])

  const spread = Math.abs(Number.parseFloat(asks[0]?.price ?? '0') - Number.parseFloat(bids[0]?.price ?? '0'))
  const spreadPct = mid ? (spread / mid) * 100 : 0

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="flex items-center justify-between gap-4">
        <div className="text-xs text-white/50">
          Symbol: <span className="text-white/80 font-semibold">{symbol}</span>
          <span className="text-white/20"> • </span>
          Type: <span className="text-white/80 font-semibold">{marketType}</span>
          <span className="text-white/20"> • </span>
          Depth: <span className="text-white/80 font-semibold">{depth}</span>
        </div>
        <div className="text-right text-xs">
          <div className="text-white/50">Spread</div>
          <div className="font-mono text-white/80">
            {fmtNum(spread, 2)} ({spreadPct.toFixed(3)}%)
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 overflow-hidden">
        <OrderbookTable
          asks={asks}
          bids={bids}
          currentPrice={{
            price: fmtNum(mid, 2),
            usdPrice: fmtNum(mid, 2),
            change: '+0.00',
            changePercent: '+0.00%',
          }}
          displayMode="both"
        />
      </div>
    </div>
  )
}

