'use client'

import React, { useMemo } from 'react'

interface Row {
  exchange: string
  longPercent: number
  shortPercent: number
  longAmountUsd: number
  shortAmountUsd: number
}

function ProgressBar({ long, short }: { long: number; short: number }) {
  return (
    <div className="relative w-full h-3 bg-[#0d1117] rounded-md overflow-hidden flex border border-white/10">
      <div className="h-full bg-gradient-to-r from-[#22c55e] to-[#4ade80]" style={{ width: `${long}%` }} />
      <div className="h-full bg-gradient-to-r from-[#ef4444] to-[#dc2626]" style={{ width: `${short}%` }} />
    </div>
  )
}

function fmtUsd(v: number) {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 }).format(v)
  } catch {
    return `$${(v / 1e9).toFixed(2)}B`
  }
}

export function LongShortRatioWidget(props: { config: Record<string, any> }) {
  const symbol = (props.config?.symbol as string) || 'BTC'
  const window = (props.config?.window as string) || '4h'

  const summary = useMemo(() => {
    const longPercent = 50.8
    const shortPercent = 49.2
    return {
      longPercent,
      shortPercent,
      longAmountUsd: 4.35e9,
      shortAmountUsd: 4.28e9,
    }
  }, [])

  const rows = useMemo<Row[]>(() => {
    return [
      { exchange: 'Binance', longPercent: 52.4, shortPercent: 47.6, longAmountUsd: 1.17e9, shortAmountUsd: 1.061e9 },
      { exchange: 'OKX', longPercent: 54.7, shortPercent: 45.3, longAmountUsd: 5.74e8, shortAmountUsd: 4.75e8 },
      { exchange: 'Bybit', longPercent: 51.7, shortPercent: 48.3, longAmountUsd: 4.93e8, shortAmountUsd: 4.61e8 },
      { exchange: 'KuCoin', longPercent: 47.2, shortPercent: 52.8, longAmountUsd: 2.09e7, shortAmountUsd: 2.34e7 },
      { exchange: 'Gate', longPercent: 47.4, shortPercent: 52.6, longAmountUsd: 4.92e8, shortAmountUsd: 5.46e8 },
      { exchange: 'Bitget', longPercent: 49.0, shortPercent: 51.0, longAmountUsd: 3.0e8, shortAmountUsd: 3.13e8 },
    ]
  }, [])

  return (
    <div className="h-full flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-white/50">Symbol</div>
          <div className="text-white font-bold">{symbol}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-white/50">Window</div>
          <div className="text-white/80 font-semibold">{window}</div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0d1117]/60 p-3 space-y-2">
        <div className="flex items-center justify-between text-xs text-white/60">
          <span>Long <span className="text-white/90 font-semibold">{summary.longPercent.toFixed(1)}%</span></span>
          <span>Short <span className="text-white/90 font-semibold">{summary.shortPercent.toFixed(1)}%</span></span>
        </div>
        <ProgressBar long={summary.longPercent} short={summary.shortPercent} />
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-lg border border-white/10 bg-white/5 p-2">
            <div className="text-white/50">Long (USD)</div>
            <div className="text-[#4ade80] font-semibold">{fmtUsd(summary.longAmountUsd)}</div>
          </div>
          <div className="rounded-lg border border-white/10 bg-white/5 p-2">
            <div className="text-white/50">Short (USD)</div>
            <div className="text-[#ef4444] font-semibold">{fmtUsd(summary.shortAmountUsd)}</div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-white/10 bg-[#0d1117]/60 overflow-hidden">
        <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[11px] uppercase tracking-widest text-white/40 border-b border-white/10">
          <div className="col-span-3">Exchange</div>
          <div className="col-span-5">Ratio</div>
          <div className="col-span-2 text-right">Long</div>
          <div className="col-span-2 text-right">Short</div>
        </div>
        <div className="divide-y divide-white/10">
          {rows.map((r) => (
            <div key={r.exchange} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors items-center">
              <div className="col-span-3 text-white/80 font-medium">{r.exchange}</div>
              <div className="col-span-5 flex flex-col gap-1">
                <ProgressBar long={r.longPercent} short={r.shortPercent} />
                <div className="flex items-center justify-between text-[11px] text-white/50">
                  <span className="text-[#4ade80]">{r.longPercent.toFixed(1)}%</span>
                  <span className="text-[#ef4444]">{r.shortPercent.toFixed(1)}%</span>
                </div>
              </div>
              <div className="col-span-2 text-right font-mono text-[#4ade80]">{fmtUsd(r.longAmountUsd)}</div>
              <div className="col-span-2 text-right font-mono text-[#ef4444]">{fmtUsd(r.shortAmountUsd)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

