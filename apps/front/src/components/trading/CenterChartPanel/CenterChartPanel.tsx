'use client'

import type { TradingViewChartRef } from '@/components/tradingview/TradingViewChart'
import type { DataSource } from '@/types/trading'
import { Search, Star, X } from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMarketDataCatalog } from '@/lib/market-data/useMarketDataCatalog'
import { useLocalStorageState } from '@/lib/storage/useLocalStorageState'
import { TradingViewChart } from './TradingViewChart'

export type MarketType = 'futures' | 'spot'

interface CenterChartPanelProps {
  isAggregated: boolean
  setIsAggregated: (v: boolean) => void
  selectedExchange: DataSource
  setSelectedExchange: (v: DataSource) => void
  symbol: string
  marketType: MarketType
  variant?: 'default' | 'compact'
}

export const CenterChartPanel = ({
  isAggregated,
  setIsAggregated,
  selectedExchange,
  setSelectedExchange,
  symbol,
  marketType,
  variant = 'default',
}: CenterChartPanelProps) => {
  const { t } = useTranslation()
  const [interval] = useState('15m')
  const [isIndicatorModalOpen, setIsIndicatorModalOpen] = useState(false)
  const [indicatorSearch, setIndicatorSearch] = useState('')

  const tvChartRef = useRef<TradingViewChartRef | null>(null)
  // timeframes: toolbar 已迁移到 TradingView header；保留 interval state 用于驱动 chart

  const isCompact = variant === 'compact'

  const { items: catalogItems } = useMarketDataCatalog()

  // NOTE: v2 是为了避免旧版本误写入的本地缓存导致“默认全部已添加”
  const storageKey = `trade:chart-indicators:v2:${symbol}:${interval}`
  const { value: activeIds, setValue: setActiveIds } = useLocalStorageState<string[]>(
    storageKey,
    [],
  )

  const chartIndicatorItems = catalogItems
    .filter(x => x.kind === 'chartSeries' || x.kind === 'chartOverlay')
    // Remove "Aggregated Orderbook" from indicator modal list (UI-only)
    .filter(x => x.id !== 'aggregated-orderbook')
    .map(x => ({
      ...x,
      name: t(x.labelKey),
      isActive: activeIds.includes(x.id),
      kind: x.kind as 'chartSeries' | 'chartOverlay',
    }))

  const featuredIndicators = chartIndicatorItems.filter(x => x.group === 'featured')
  const visibleIndicators = featuredIndicators.filter(x => {
    const q = indicatorSearch.trim().toLowerCase()
    if (!q) return true
    return x.name.toLowerCase().includes(q)
  })

  const toggleIndicator = (id: string) => {
    // TradingView Charting Library：集成逻辑
    if (id === 'tv:rsi') {
      tvChartRef.current?.addStudy('Relative Strength Index')
      return
    }
    if (id === 'tv:macd') {
      tvChartRef.current?.addStudy('MACD')
      return
    }
    if (id === 'tv:ma') {
      tvChartRef.current?.addStudy('Moving Average')
      return
    }

    // Coinflux 自定义“精选指标”：用 Charting Library 的 custom studies 融合进 TV
    if (
      id === 'long-short-ratio' ||
      id === 'aggregated-open-interest' ||
      id === 'aggregated-volume' ||
      id === 'liquidation-data'
    ) {
      // IMPORTANT:
      // - 不要在这里直接 ensure/remove，否则会与下面的 useEffect 同步逻辑“双触发”
      //   => 造成同一个指标被 createStudy 两次（你看到的“点一次出现两条/两个 pane”）
      setActiveIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
      return
    }

    setActiveIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  // 同步 activeIds 到 TV custom studies
  useEffect(() => {
    const chart = tvChartRef.current
    if (!chart) return
    const ids: Array<
      'long-short-ratio' | 'aggregated-open-interest' | 'aggregated-volume' | 'liquidation-data'
    > = ['long-short-ratio', 'aggregated-open-interest', 'aggregated-volume', 'liquidation-data']
    ids.forEach(id => {
      if (activeIds.includes(id)) chart.ensureCustomIndicator(id)
      else chart.removeCustomIndicator(id)
    })
  }, [activeIds])

  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[color:var(--cf-bg)]">
      {/* Chart Toolbar
          NOTE: 已迁移到 TradingView Charting Library header（避免时间周期/指标/聚合控件重复显示）。
          这里保留空位（不渲染），以免影响整体布局/间距。 */}

      {/* Main Chart Area */}
      <div className="relative w-full flex-1 overflow-hidden">
        <TradingViewChart
          ref={tvChartRef}
          symbol={symbol}
          interval={interval}
          isAggregated={isAggregated}
          selectedExchange={selectedExchange}
          marketType={marketType}
          onSelectExchange={exchange => {
            setSelectedExchange(exchange)
          }}
          onToggleAggregate={() => {
            setIsAggregated(!isAggregated)
          }}
          onOpenIndicator={() => {
            setIsIndicatorModalOpen(true)
          }}
          onOpenDataIndicator={() => {
            setIsIndicatorModalOpen(true)
          }}
          activeIndicators={chartIndicatorItems
            .filter(x => x.isActive)
            .map(x => ({
              id: x.id,
              label: x.name,
              kind: x.kind,
              href: x.href,
            }))}
          onRemoveIndicator={id => setActiveIds(prev => prev.filter(x => x !== id))}
        />
      </div>

      {/* Indicator Modal */}
      {isIndicatorModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div
            className={`${isCompact ? 'h-[300px] w-[400px]' : 'h-[400px] w-[600px]'} flex flex-col overflow-hidden rounded-lg border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] shadow-2xl`}
          >
            {/* Modal Header */}
            <div
              className={`flex items-center justify-between ${isCompact ? 'p-2' : 'p-4'} border-b border-[color:var(--cf-border)]`}
            >
              <span
                className={`font-bold text-[color:var(--cf-text)] ${isCompact ? 'text-xs' : 'text-sm'}`}
              >
                {t('chart.modal.featured')}
              </span>
              <button
                type="button"
                onClick={() => setIsIndicatorModalOpen(false)}
                className="text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex flex-1 overflow-hidden">
              {/* Main List (sidebar removed) */}
              <div className="flex flex-1 flex-col gap-2 overflow-hidden p-2">
                {/* Search */}
                <div className="flex items-center gap-2">
                  <div className="relative min-w-0 flex-1">
                    <Search className="absolute top-1/2 left-2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--cf-muted)]" />
                    <input
                      type="text"
                      placeholder={t('chart.modal.search')}
                      value={indicatorSearch}
                      onChange={e => setIndicatorSearch(e.target.value)}
                      className="w-full rounded border border-[color:var(--cf-border)] bg-[color:var(--cf-bg)] py-1 pr-2 pl-7 text-xs text-[color:var(--cf-text)] focus:border-[#58a6ff] focus:outline-none"
                    />
                  </div>
                </div>

                <div className="cf-scrollbar flex flex-1 flex-col gap-0.5 overflow-y-auto">
                  {visibleIndicators.map(ind => (
                    <button
                      key={ind.id}
                      type="button"
                      onClick={() => toggleIndicator(ind.id)}
                      className={`flex items-center justify-between ${isCompact ? 'px-2 py-1.5' : 'px-3 py-2.5'} group rounded text-left transition-colors ${
                        ind.isActive
                          ? 'bg-[color:var(--cf-surface-2)]'
                          : 'hover:bg-[color:var(--cf-surface-hover)]'
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <Star
                          className={`h-3.5 w-3.5 ${ind.starred ? 'fill-yellow-500 text-yellow-500' : 'text-[color:var(--cf-muted)] group-hover:text-[color:var(--cf-text)]'}`}
                        />
                        <span
                          className={`truncate text-xs ${ind.isActive ? 'text-[color:var(--cf-text)]' : 'text-[color:var(--cf-muted)] group-hover:text-[color:var(--cf-text)]'}`}
                        >
                          {ind.name}
                        </span>
                      </div>
                      <div
                        className={`text-xs ${ind.isActive ? 'text-primary' : 'text-[color:var(--cf-muted)]'}`}
                      >
                        {ind.isActive ? t('chart.indicator.added') : t('chart.indicator.add')}
                      </div>
                    </button>
                  ))}

                  {visibleIndicators.length === 0 && (
                    <div className="px-3 py-6 text-center text-xs text-[color:var(--cf-muted)]">
                      {t('chart.modal.noResults')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
