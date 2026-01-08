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
  const sort = (props.config?.sort as string) || 'marketCap'

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
      <div className="flex items-center justify-between text-xs text-white/50">
        <span>Watchlist: <span className="text-white/80 font-semibold">ALL</span></span>
        <span>Sort: <span className="text-white/80 font-semibold">{sort}</span></span>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0d1117]/60 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[11px] uppercase tracking-widest text-white/40 border-b border-white/10">
          <div className="col-span-2">Asset</div>
          <div className="col-span-3">Ticker</div>
          <div className="col-span-4">Company</div>
          <div className="col-span-2 text-right">Mkt Cap</div>
          <div className="col-span-1 text-right">24h</div>
        </div>

        <div className="divide-y divide-white/10">
          {rows.map((r) => (
            <div key={`${r.ticker}-${r.asset}`} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors">
              <div className="col-span-2">
                <span className="inline-flex items-center px-2 py-0.5 rounded bg-white/5 border border-white/10 text-xs font-semibold">
                  {r.asset}
                </span>
              </div>
              <div className="col-span-3 font-mono text-white/90">{r.ticker}</div>
              <div className="col-span-4 text-white/80 truncate">{r.company}</div>
              <div className="col-span-2 text-right font-mono text-white/80">{r.marketCap}</div>
              <div className={`col-span-1 text-right font-mono ${changeColor(r.change24h)}`}>{r.change24h}</div>
            </div>
          ))}
        </div>

        <div className="px-3 py-2 text-xs text-white/40 border-t border-white/10">
          * Holdings value shown in detail view (mock)
        </div>
      </div>
    </div>
  )
}

