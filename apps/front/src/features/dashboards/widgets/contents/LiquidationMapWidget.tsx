'use client'

import React, { useMemo, useState } from 'react'
import { LiquidationMapChart } from '@/components/liquidation-map/LiquidationMapChart'
import { generateLiquidationMapMockData, liquidationSymbolPrices } from '@/lib/liquidation-map/mock-liquidation-map'

type Range = '1d' | '7d' | '30d'

export function LiquidationMapWidget(props: { config: Record<string, any> }) {
  const initialSymbol = (props.config?.symbol as string) || 'BTC'
  const initialRange = (String(props.config?.range || '1D').toLowerCase() as Range) || '1d'
  const initialScope = (props.config?.scope as string) || 'ALL'

  const [symbol] = useState(initialSymbol)
  const [range] = useState<Range>(initialRange)
  const [scope] = useState(initialScope)

  const currentPrice = liquidationSymbolPrices[symbol] ?? 100

  const data = useMemo(() => {
    // Step override to keep widget lighter than the full page.
    const exchangeType = scope === 'DEX' ? 'DEX' : scope === 'CEX' ? 'CEX' : 'All'
    return generateLiquidationMapMockData(symbol, range, exchangeType as any, currentPrice, 90)
  }, [currentPrice, range, scope, symbol])

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="flex items-center justify-between text-xs text-white/50 flex-shrink-0">
        <div className="flex items-center gap-2">
          <span>
            Symbol: <span className="text-white/80 font-semibold">{symbol}</span>
          </span>
          <span className="text-white/20">•</span>
          <span>
            Range: <span className="text-white/80 font-semibold">{range.toUpperCase()}</span>
          </span>
          <span className="text-white/20">•</span>
          <span>
            Scope: <span className="text-white/80 font-semibold">{scope}</span>
          </span>
        </div>
        <div className="text-right">
          <div className="text-white/50">Current</div>
          <div className="font-mono text-white/90">{currentPrice.toLocaleString()}</div>
        </div>
      </div>

      <div className="flex-1 min-h-0 max-h-full rounded-xl border border-white/10 bg-[#0d1117]/60 overflow-hidden">
        <LiquidationMapChart
          data={data}
          currentPrice={currentPrice}
          mode="full"
          className="w-full h-full max-h-full"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-white/10 bg-white/5 p-2">
          <div className="text-white/50">Above current</div>
          <div className="font-mono text-[#ef4444]">
            ${(data.cumulativeShort?.[data.cumulativeShort.length - 1] ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-white/5 p-2">
          <div className="text-white/50">Below current</div>
          <div className="font-mono text-[#22c55e]">
            ${(data.cumulativeLong?.[0] ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>
    </div>
  )
}
