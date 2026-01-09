'use client'

import React, { useMemo } from 'react'

interface Row {
  asset: string
  ticker: string
  company: string
  marketCap: string
  holdingsValue: string
  change24h: string
}

function changeColor(v: string) {
  if (v.startsWith('+')) return 'text-green-400'
  if (v.startsWith('-')) return 'text-red-400'
  return 'text-white/70'
}

export function CryptoStocksWidget(props: { config: Record<string, any> }) {
  const size = (props.config?.size as string) || 'M'
  const isSmall = size === 'S'
  const isLarge = size === 'L' || size === 'XL'

  const textSize = isSmall ? 'text-[10px]' : isLarge ? 'text-base' : 'text-sm'
  const rowHeight = isSmall ? 'py-1.5' : isLarge ? 'py-3' : 'py-2'
  const headerSize = isSmall ? 'text-[9px]' : isLarge ? 'text-xs' : 'text-[11px]'

  const rows = useMemo<Row[]>(() => {
    // Mock: 6 rows, table-like UI (simplified).
    return [
      { asset: 'BTC', ticker: 'MSTR', company: 'MicroStrategy', marketCap: '$47.4B', holdingsValue: '$58.1B', change24h: '+0.10%' },
      { asset: 'USDC', ticker: 'CRCL', company: 'Circle', marketCap: '$17.2B', holdingsValue: '$64.5B', change24h: '+9.87%' },
      { asset: 'BTC', ticker: 'TSLA', company: 'Tesla', marketCap: '$620B', holdingsValue: '$1.2B', change24h: '-0.35%' },
      { asset: 'BTC', ticker: 'SQ', company: 'Block', marketCap: '$40.6B', holdingsValue: '$0.5B', change24h: '+1.42%' },
      { asset: 'BTC', ticker: 'COIN', company: 'Coinbase', marketCap: '$45.1B', holdingsValue: '$0.9B', change24h: '+2.30%' },
      { asset: 'ETH', ticker: 'BMNR', company: 'BitMine', marketCap: '$8.9B', holdingsValue: '$11.6B', change24h: '+0.88%' },
    ]
  }, [])

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Header removed as requested */}
      
      <div className="flex-1 min-h-0 rounded-xl border border-white/10 bg-[#0d1117]/60 flex flex-col overflow-hidden">
        {/* Table Header - Fixed */}
        <div className={`grid grid-cols-12 gap-2 px-3 py-2 ${headerSize} uppercase tracking-widest text-white/40 border-b border-white/10 flex-none`}>
          <div className="col-span-2">Asset</div>
          <div className="col-span-3">Ticker</div>
          <div className="col-span-4">Company</div>
          <div className="col-span-2 text-right">Mkt Cap</div>
          <div className="col-span-1 text-right">24h</div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-auto cf-scrollbar">
          <div className="divide-y divide-white/10">
            {rows.map((r) => (
              <div key={`${r.ticker}-${r.asset}`} className={`grid grid-cols-12 gap-2 px-3 ${rowHeight} ${textSize} hover:bg-white/5 transition-colors`}>
                <div className="col-span-2 flex items-center">
                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded bg-white/5 border border-white/10 ${isSmall ? 'text-[9px]' : 'text-xs'} font-semibold`}>
                    {r.asset}
                  </span>
                </div>
                <div className="col-span-3 font-mono text-white/90 flex items-center">{r.ticker}</div>
                <div className="col-span-4 text-white/80 truncate flex items-center" title={r.company}>{r.company}</div>
                <div className="col-span-2 text-right font-mono text-white/80 flex items-center justify-end">{r.marketCap}</div>
                <div className={`col-span-1 text-right font-mono flex items-center justify-end ${changeColor(r.change24h)}`}>{r.change24h}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={`px-3 py-2 ${isSmall ? 'text-[10px]' : 'text-xs'} text-white/40 border-t border-white/10 flex-none`}>
          * Holdings value shown in detail view
        </div>
      </div>
    </div>
  )
}

