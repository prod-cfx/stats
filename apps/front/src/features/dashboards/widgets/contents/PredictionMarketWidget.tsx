'use client'

import React, { useMemo } from 'react'

interface PredictionItem {
  id: string
  title: string
  status: 'LIVE' | 'RESOLVED' | 'CLOSED'
  volume: string
  yes: number
  no: number
  category: string
}

function Badge({ status }: { status: PredictionItem['status'] }) {
  const color =
    status === 'LIVE' ? 'bg-green-500/15 text-green-400 border-green-500/20' : status === 'RESOLVED'
      ? 'bg-blue-500/15 text-blue-400 border-blue-500/20'
      : 'bg-[#30363d] text-[#8b949e] border-white/10'
  const label = status === 'LIVE' ? 'LIVE' : status === 'RESOLVED' ? 'RESOLVED' : 'CLOSED'
  return <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${color}`}>{label}</span>
}

function Progress({ yes, no }: { yes: number; no: number }) {
  return (
    <div className="w-full h-2 rounded bg-white/5 border border-white/10 overflow-hidden flex">
      <div className="h-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${yes}%` }} />
      <div className="h-full bg-gradient-to-r from-red-500/80 to-red-600/80" style={{ width: `${no}%` }} />
    </div>
  )
}

export function PredictionMarketWidget(props: { config: Record<string, any> }) {
  const category = (props.config?.category as string) || 'BTC'
  const size = (props.config?.size as string) || 'M'
  const isSmall = size === 'S'
  const isLarge = size === 'L' || size === 'XL'

  // Adaptive styles
  const titleSize = isSmall ? 'text-xs' : isLarge ? 'text-base' : 'text-sm'
  const badgeSize = isSmall ? 'text-[9px] px-1.5' : 'text-[10px] px-2'
  const subTextSize = isSmall ? 'text-[10px]' : 'text-xs'
  const gapSize = isSmall ? 'gap-2' : 'gap-3'
  const paddingSize = isSmall ? 'p-2' : 'p-3'

  const items = useMemo<PredictionItem[]>(() => {
    // Mock (6~8 items). Keep simple and consistent with existing site style.
    return [
      { id: 'p1', title: `${category} to break ATH this month?`, status: 'LIVE', volume: '$12.4m', yes: 58, no: 42, category },
      { id: 'p2', title: `ETF net inflow > $1B this week?`, status: 'LIVE', volume: '$8.1m', yes: 46, no: 54, category },
      { id: 'p3', title: `Fed rate cut before Q3?`, status: 'LIVE', volume: '$5.7m', yes: 39, no: 61, category },
      { id: 'p4', title: `${category} closes above 80k on Friday?`, status: 'LIVE', volume: '$4.2m', yes: 52, no: 48, category },
      { id: 'p5', title: `ETH/BTC ratio > 0.06 by month-end?`, status: 'LIVE', volume: '$3.1m', yes: 33, no: 67, category },
      { id: 'p6', title: `New L2 airdrop announced this week?`, status: 'LIVE', volume: '$2.6m', yes: 41, no: 59, category },
      { id: 'p7', title: `${category} funding turns negative for 24h?`, status: 'LIVE', volume: '$1.9m', yes: 27, no: 73, category },
    ]
  }, [category])

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="flex items-center justify-end">
        <div className="text-xs text-white/50">{items.length} markets</div>
      </div>

      <div className={`flex-1 overflow-y-auto min-h-0 grid grid-cols-1 ${gapSize} cf-scrollbar pr-1`}>
        {items.map((p) => (
          <div
            key={p.id}
            className={`rounded-xl border border-white/10 bg-[#0d1117]/60 hover:bg-[#0d1117]/80 transition-colors ${paddingSize}`}
          >
            <div className={`flex items-start justify-between ${gapSize}`}>
              <div className="min-w-0">
                <div className={`${titleSize} font-semibold text-white truncate`}>{p.title}</div>
                <div className={`flex items-center gap-2 mt-1 ${subTextSize} text-white/50`}>
                  <span>{p.volume} volume</span>
                  <span className="text-white/20">•</span>
                  <span className="uppercase tracking-widest">{p.category}</span>
                </div>
              </div>
              <div className="flex-none">
                <Badge status={p.status} />
              </div>
            </div>

            <div className={`mt-3 space-y-2`}>
              <Progress yes={p.yes} no={p.no} />
              <div className={`flex items-center justify-between ${isSmall ? 'text-[10px]' : 'text-[11px]'} text-white/60`}>
                <span>Yes <span className="text-white/80 font-semibold">{p.yes}%</span></span>
                <span>No <span className="text-white/80 font-semibold">{p.no}%</span></span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

