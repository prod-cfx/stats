'use client'

import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterButton } from '@/components/ui/FilterButton'

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
  const { t } = useTranslation()
  const [symbol, setSymbol] = useState((props.config?.symbol as string) || 'BTC')
  const [windowVal, setWindow] = useState((props.config?.window as string) || '4h')

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
      {/* Header: Title + Dropdowns */}
      <div className="flex items-center justify-between gap-2">
        <div className="text-white/90 font-bold text-sm truncate">Long/Short Ratio</div>
        <div className="flex items-center gap-2">
          <FilterButton
            value={symbol}
            options={['BTC', 'ETH', 'SOL', 'XRP']}
            onChange={setSymbol}
            minWidth="70px"
            className="text-xs"
          />
          <FilterButton
            value={windowVal}
            options={[
              { value: '1h', label: '1H' },
              { value: '4h', label: '4H' },
              { value: '24h', label: '24H' },
            ]}
            onChange={setWindow}
            minWidth="60px"
            className="text-xs"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 cf-scrollbar pr-1 flex flex-col gap-4">
        <div className="rounded-xl border border-white/10 bg-[#0d1117]/60 p-3 space-y-2 flex-none">
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

        <div className="rounded-xl border border-white/10 bg-[#0d1117]/60 overflow-hidden flex-none">
          <div className="grid grid-cols-12 gap-2 px-3 py-2 text-[11px] uppercase tracking-widest text-white/40 border-b border-white/10 bg-[#0d1117]/50">
            <div className="col-span-3">Exchange</div>
            <div className="col-span-5">Ratio</div>
            <div className="col-span-2 text-right">Long</div>
            <div className="col-span-2 text-right">Short</div>
          </div>
          <div className="divide-y divide-white/10">
            {rows.map((r) => (
              <div key={r.exchange} className="grid grid-cols-12 gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors items-center">
                <div className="col-span-3 text-white/80 font-medium truncate">{r.exchange}</div>
                <div className="col-span-5 flex flex-col gap-1">
                  <ProgressBar long={r.longPercent} short={r.shortPercent} />
                  <div className="flex items-center justify-between text-[10px] text-white/50">
                    <span className="text-[#4ade80]">{r.longPercent.toFixed(1)}%</span>
                    <span className="text-[#ef4444]">{r.shortPercent.toFixed(1)}%</span>
                  </div>
                </div>
                <div className="col-span-2 text-right font-mono text-xs text-[#4ade80] truncate">{fmtUsd(r.longAmountUsd)}</div>
                <div className="col-span-2 text-right font-mono text-xs text-[#ef4444] truncate">{fmtUsd(r.shortAmountUsd)}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
