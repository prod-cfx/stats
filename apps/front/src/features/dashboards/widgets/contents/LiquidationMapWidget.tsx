'use client'

import { RefreshCcw } from 'lucide-react'
import dynamic from 'next/dynamic'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterButton } from '@/components/ui/FilterButton'
import { generateLiquidationMapMockData, liquidationSymbolPrices } from '@/lib/liquidation-map/mock-liquidation-map'

const LiquidationMapChart = dynamic(
  () => import('@/components/liquidation-map/LiquidationMapChart').then(mod => mod.LiquidationMapChart),
  {
    ssr: false,
    loading: () => <div className="h-full w-full animate-pulse rounded-lg bg-[color:var(--cf-surface-2)]" />,
  },
)

type Range = '1d' | '7d' | '30d'

export function LiquidationMapWidget(props: { config: Record<string, any> }) {
  const { t } = useTranslation()
  const initialSymbol = (props.config?.symbol as string) || 'BTC'
  const initialRange = (String(props.config?.range || '1D').toLowerCase() as Range) || '1d'
  const initialScope = (props.config?.scope as string) || 'ALL'

  const [symbol, setSymbol] = useState(initialSymbol)
  const [range, setRange] = useState<Range>(initialRange)
  const [scope, setScope] = useState(initialScope)
  
  const isCompact = props.config?.size === 'S'
  const currentPrice = liquidationSymbolPrices[symbol] ?? 100

  const data = useMemo(() => {
    // Step override to keep widget lighter than the full page.
    const exchangeType = scope === 'DEX' ? 'DEX' : scope === 'CEX' ? 'CEX' : 'All'
    return generateLiquidationMapMockData(symbol, range, exchangeType as any, currentPrice, 90)
  }, [currentPrice, range, scope, symbol])

  const onRefresh = () => {
    // Re-trigger memo or fetch logic if real API
    // For mock, just a visual effect
  }

  return (
    <div className="h-full flex flex-col gap-3">
      {/* Header with Filters */}
      <div className="flex items-center justify-between text-xs text-[color:var(--cf-muted)] flex-shrink-0">
        <div className="text-[color:var(--cf-text-strong)] font-bold text-sm tracking-tight truncate">
          {t('liquidationMap.title', { symbol: t(`symbols.${symbol}`, { defaultValue: symbol }) })}
        </div>
        <div className="flex items-center gap-2">
          <FilterButton 
            value={scope} 
            options={[
              { value: 'ALL', label: t('liquidationMap.exchangeType.all') },
              { value: 'CEX', label: t('liquidationMap.exchangeType.cex') },
              { value: 'DEX', label: t('liquidationMap.exchangeType.dex') },
            ]} 
            onChange={setScope}
            size="sm"
          />
          <FilterButton 
            value={symbol} 
            options={['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'HYPE', 'LINK', 'AVAX', 'ADA']} 
            onChange={setSymbol}
            size="sm"
          />
          <FilterButton 
            value={range} 
            options={[
              { value: '1d', label: t('liquidationMap.range.1d') },
              { value: '7d', label: t('liquidationMap.range.7d') },
              { value: '30d', label: t('liquidationMap.range.30d') },
            ]} 
            onChange={(v) => setRange(v as any)}
            size="sm"
          />
          <button 
            type="button"
            onClick={(e) => {
              const btn = e.currentTarget.querySelector('svg');
              btn?.classList.add('animate-spin');
              setTimeout(() => btn?.classList.remove('animate-spin'), 500);
              onRefresh();
            }}
            className="p-1 bg-[color:var(--cf-surface-2)] border border-[color:var(--cf-border)] rounded-md text-[color:var(--cf-text)] hover:bg-[color:var(--cf-surface-hover)] hover:border-[color:var(--cf-text-muted)] transition-all active:scale-95 group shadow-sm h-[26px] w-[26px] flex items-center justify-center"
          >
            <RefreshCcw className="w-3.5 h-3.5 transition-transform" />
          </button>
        </div>
      </div>

      <div className="flex-1 min-h-0 max-h-full rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] overflow-hidden relative">
        <div className={`absolute ${isCompact ? 'top-[44px]' : 'top-2'} right-2 z-10 text-right pointer-events-none transition-all duration-300`}>
          <div className="text-[10px] text-[color:var(--cf-muted)]">{t('liquidationMap.current')}</div>
          <div className="font-mono text-xs text-[color:var(--cf-text-strong)] font-bold bg-[color:var(--cf-surface)]/80 px-1.5 py-0.5 rounded backdrop-blur-sm border border-[color:var(--cf-border)]">
            ${currentPrice.toLocaleString()}
          </div>
        </div>
        <LiquidationMapChart
          data={data}
          currentPrice={currentPrice}
          mode="full"
          className="w-full h-full max-h-full"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface-2)] p-2 flex items-center justify-between">
          <div className="text-[color:var(--cf-muted)]">{t('liquidationMap.above')}</div>
          <div className="font-mono text-[#ef4444] font-medium">
            ${(data.cumulativeShort?.[data.cumulativeShort.length - 1] ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface-2)] p-2 flex items-center justify-between">
          <div className="text-[color:var(--cf-muted)]">{t('liquidationMap.below')}</div>
          <div className="font-mono text-[#22c55e] font-medium">
            ${(data.cumulativeLong?.[0] ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>
    </div>
  )
}
