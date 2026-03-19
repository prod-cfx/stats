'use client'

import { Bitcoin, Coins, Globe, Landmark, MoreHorizontal, Rocket, Shield } from 'lucide-react'
import React, { useMemo } from 'react'

interface PredictionOption {
  label: string
  probability: string
}

interface PredictionItem {
  id: string
  title: string
  icon: React.ReactNode
  iconBgColor: string
  options?: PredictionOption[]
  probability?: string
  status?: string
  volume?: string
}

const initialPredictions: PredictionItem[] = [
  {
    id: 'btc-2025-price',
    title: 'What price will Bitcoin hit in 2025?',
    icon: <Bitcoin className="w-full h-full text-white" />,
    iconBgColor: 'bg-orange-500',
    options: [
      { label: '↑ 1,000,000', probability: '86%' },
      { label: '↑ 250,000', probability: '20%' },
    ],
    status: 'LIVE',
    volume: '$35m',
  },
  {
    id: 'lighter-fdv',
    title: 'Lighter market cap (FDV) one day after launch?',
    icon: <Rocket className="w-full h-full text-white" />,
    iconBgColor: 'bg-primary',
    options: [
      { label: '>$1B', probability: '86%' },
      { label: '>$2B', probability: '84%' },
    ],
    volume: '$35m',
  },
  {
    id: 'eth-2025-price',
    title: 'What price will Ethereum hit in 2025?',
    icon: <Coins className="w-full h-full text-white" />,
    iconBgColor: 'bg-secondary',
    options: [
      { label: '$17,000', probability: '16%' },
      { label: '$14,000', probability: '86%' },
    ],
    status: 'LIVE',
    volume: '$12m',
  },
  {
    id: 'lighter-airdrop-day',
    title: 'What day will the Lighter airdrop be?',
    icon: <Shield className="w-full h-full text-white" />,
    iconBgColor: 'bg-indigo-600',
    options: [
      { label: 'December 22', probability: '26%' },
      { label: 'December 23', probability: '15%' },
    ],
    volume: '$5m',
  },
  {
    id: 'btc-above-dec23',
    title: 'Bitcoin above __ on December 23?',
    icon: <Bitcoin className="w-full h-full text-white" />,
    iconBgColor: 'bg-orange-500',
    options: [
      { label: '78,000', probability: '100%' },
      { label: '80,000', probability: '100%' },
    ],
    status: 'LIVE',
    volume: '$8m',
  },
  {
    id: 'satoshi-move-2025',
    title: 'Will Satoshi move any Bitcoin in 2025?',
    icon: <Globe className="w-full h-full text-white" />,
    iconBgColor: 'bg-slate-600',
    probability: '<1%',
    volume: '$21m',
  },
  {
    id: 'mstr-sell-by',
    title: 'MicroStrategy sells any Bitcoin by __?',
    icon: <Landmark className="w-full h-full text-white" />,
    iconBgColor: 'bg-primary',
    options: [
      { label: 'December 31, 2025', probability: '86%' },
      { label: 'December 30, 2025', probability: '86%' },
    ],
    volume: '$12m',
  },
  {
    id: 'eth-2026-price',
    title: 'What price will Ethereum hit in 2026?',
    icon: <Coins className="w-full h-full text-white" />,
    iconBgColor: 'bg-secondary',
    options: [
      { label: '$100,000', probability: '86%' },
      { label: '$80,000', probability: '86%' },
    ],
    status: 'LIVE',
    volume: '$4m',
  },
  {
    id: 'trump-mention-btc',
    title: 'Trump to mention "Bitcoin" in Inauguration Speech?',
    icon: <Globe className="w-full h-full text-white" />,
    iconBgColor: 'bg-blue-600',
    options: [
      { label: 'Yes', probability: '64%' },
      { label: 'No', probability: '36%' },
    ],
    status: 'LIVE',
    volume: '$2.5m',
  },
  {
    id: 'sol-flip-eth',
    title: 'Solana to flip Ethereum in Market Cap by June?',
    icon: <Coins className="w-full h-full text-white" />,
    iconBgColor: 'bg-purple-600',
    options: [
      { label: 'Yes', probability: '12%' },
      { label: 'No', probability: '88%' },
    ],
    volume: '$45m',
  },
  {
    id: 'next-legal-tender',
    title: 'Next country to adopt Bitcoin as legal tender?',
    icon: <Landmark className="w-full h-full text-white" />,
    iconBgColor: 'bg-green-600',
    options: [
      { label: 'Paraguay', probability: '25%' },
      { label: 'Argentina', probability: '18%' },
    ],
    volume: '$1.2m',
  },
  {
    id: 'spacex-doge',
    title: 'SpaceX to accept DOGE for Moon Mission?',
    icon: <Rocket className="w-full h-full text-white" />,
    iconBgColor: 'bg-orange-400',
    options: [
      { label: 'Yes', probability: '42%' },
      { label: 'No', probability: '58%' },
    ],
    status: 'LIVE',
    volume: '$9m',
  },
]

export function PredictionMarketWidget(props: { config: Record<string, any> }) {
  const size = (props.config?.size as string) || 'M'
  const isSmall = size === 'S'
  const isLarge = size === 'L' || size === 'XL'

  // Adaptive styles
  const cardPadding = isSmall ? 'p-3' : isLarge ? 'p-5' : 'p-4'
  const iconBoxSize = isSmall ? 'w-6 h-6' : isLarge ? 'w-10 h-10' : 'w-8 h-8'
  const titleSize = isSmall ? 'text-xs' : isLarge ? 'text-base' : 'text-sm'
  const optionTextSize = isSmall ? 'text-[10px]' : isLarge ? 'text-sm' : 'text-xs'
  const footerTextSize = isSmall ? 'text-[9px]' : 'text-xs'
  const gapSize = isSmall ? 'gap-2' : 'gap-3'

  const items = useMemo(() => initialPredictions, [])

  return (
    <div className="h-full flex flex-col gap-3">
      <div className="flex items-center justify-end flex-none">
        <div className={`text-xs text-[color:var(--cf-muted)]`}>{items.length} markets</div>
      </div>

      <div className={`flex-1 overflow-y-auto min-h-0 grid grid-cols-1 ${gapSize} cf-scrollbar pr-1`}>
        {items.map((p) => (
          <div
            key={p.id}
            className={`bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-xl ${cardPadding} flex flex-col relative group hover:border-primary/50 transition-colors`}
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-3">
              <div className={`flex ${gapSize} items-start`}>
                {p.icon && (
                  <div className={`${iconBoxSize} rounded-lg flex items-center justify-center flex-shrink-0 ${p.iconBgColor || 'bg-[color:var(--cf-surface-2)]'} p-1.5`}>
                    {p.icon}
                  </div>
                )}
                <h3 className={`${titleSize} font-bold text-[color:var(--cf-text-strong)] leading-snug line-clamp-2 pr-4`}>
                  {p.title}
                </h3>
              </div>
            </div>

            {/* Options */}
            <div className="flex-1 space-y-2 mb-3">
              {p.options ? (
                p.options.map((option, idx) => (
                  <div key={idx} className={`flex justify-between items-center ${optionTextSize}`}>
                    <span className="text-[color:var(--cf-text)]">{option.label}</span>
                    <span className="text-[color:var(--cf-text-strong)] font-medium">{option.probability}</span>
                  </div>
                ))
              ) : p.probability ? (
                <div className="flex flex-col items-center justify-center py-1">
                  <span className={`text-[color:var(--cf-text-strong)] ${isLarge ? 'text-2xl' : 'text-xl'} font-bold`}>{p.probability}</span>
                  <span className="text-[color:var(--cf-muted)] text-[9px] uppercase tracking-wider mt-0.5">probability</span>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center mt-auto">
              <div className="flex items-center gap-2">
                {p.status === 'LIVE' && (
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#f87171] animate-pulse" />
                    <span className={`text-[#f87171] ${footerTextSize} font-bold tracking-wider`}>LIVE</span>
                  </div>
                )}
                {p.volume && (
                  <span className={`text-[color:var(--cf-muted)] ${footerTextSize} font-medium`}>{p.volume} Vol.</span>
                )}
              </div>
              <button type="button" className="text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)] transition-colors">
                <MoreHorizontal className={`w-4 h-4`} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
