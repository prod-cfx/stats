'use client';

import type { TradingViewChartRef } from '@/components/tradingview/TradingViewChart'
import type { DataSource } from '@/types/trading';
import { X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMarketDataCatalog } from '@/lib/market-data/useMarketDataCatalog'
import { useLocalStorageState } from '@/lib/storage/useLocalStorageState'
import { TradingViewChart } from './TradingViewChart';

export type MarketType = 'futures' | 'spot';

interface CenterChartPanelProps {
  isAggregated: boolean;
  setIsAggregated: (v: boolean) => void;
  selectedExchange: DataSource;
  setSelectedExchange: (v: DataSource) => void;
  symbol: string;
  marketType: MarketType;
  variant?: 'default' | 'compact';
}

export const CenterChartPanel = ({ 
  isAggregated, 
  setIsAggregated, 
  selectedExchange, 
  setSelectedExchange, 
  symbol, 
  marketType, 
  variant = 'default'
}: CenterChartPanelProps) => {
  const { t } = useTranslation();
  const [interval] = useState('15m');
  const [isIndicatorModalOpen, setIsIndicatorModalOpen] = useState(false);
  // Removed local state: isAggregated, selectedExchange
  const tvChartRef = useRef<TradingViewChartRef | null>(null)

  const isCompact = variant === 'compact';

  const { items: catalogItems } = useMarketDataCatalog()

  const storageKey = `trade:chart-indicators:${symbol}:${interval}`
  const { value: activeIds, setValue: setActiveIds } = useLocalStorageState<string[]>(storageKey, [])

  const chartIndicatorItems = catalogItems
    .filter((x) => x.kind === 'chartSeries' || x.kind === 'chartOverlay')
    // Remove "Aggregated Orderbook" from indicator modal list (UI-only)
    .filter((x) => x.id !== 'aggregated-orderbook')
    .map((x) => ({
      ...x,
      name: t(x.labelKey),
      isActive: activeIds.includes(x.id),
      kind: x.kind as 'chartSeries' | 'chartOverlay',
    }))

  // “精选指标”弹窗：只保留指定的几个入口，其它内容全部隐藏
  const allowedIndicatorIds = new Set<string>([
    // overlay
    'liquidation-map',
    // data indicators (custom studies)
    'long-short-ratio',
    'aggregated-open-interest',
    'aggregated-volume',
    'liquidation-data',
  ])
  const visibleIndicators = chartIndicatorItems.filter((x) => allowedIndicatorIds.has(x.id))

  const toggleIndicator = (id: string) => {
    // TradingView Charting Library：优先把“指标”叠加到 K 线（study）
    // - 对于常见内置指标：直接 addStudy
    // - 对于无法映射/不兼容的名称：TradingViewChart.addStudy 内部会 fallback 打开原生指标面板
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

    // Coinflux 自定义“精选指标”：用 Charting Library 的 custom studies 融合进 TV（像 MACD 一样的 pane）
    if (id === 'long-short-ratio' || id === 'aggregated-open-interest' || id === 'aggregated-volume' || id === 'liquidation-data') {
      const enabled = !activeIds.includes(id)
      if (enabled) tvChartRef.current?.ensureCustomIndicator(id)
      else tvChartRef.current?.removeCustomIndicator(id)
      setActiveIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
      return
    }

    // 其他“指标/精选指标”仍沿用原 state（便于保留现有 UI 交互与后续迁移）
    setActiveIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  // 当 activeIds 从 localStorage 复原 / 或用户切换时，同步到 TradingView 的 custom studies（pane 指标）
  useEffect(() => {
    const chart = tvChartRef.current
    if (!chart) return
    const ids: Array<'long-short-ratio' | 'aggregated-open-interest' | 'aggregated-volume' | 'liquidation-data'> = [
      'long-short-ratio',
      'aggregated-open-interest',
      'aggregated-volume',
      'liquidation-data',
    ]
    ids.forEach((id) => {
      if (activeIds.includes(id)) chart.ensureCustomIndicator(id)
      else chart.removeCustomIndicator(id)
    })
  }, [activeIds])

  return (
    <div className="flex-1 flex flex-col bg-[color:var(--cf-bg)] overflow-hidden min-h-0 relative w-full">
      {/* 当使用 TradingView Charting Library 时：
          - 不再渲染页面原有周期条/表头控件（避免与 TV 自带 header/timeframe 工具重复）
          - 聚合/指标/精选指标等入口由 TV header 自定义按钮提供 */}

      {/* Main Chart Area */}
      <div className="flex-1 relative overflow-hidden w-full">
        <TradingViewChart
          ref={tvChartRef}
          symbol={symbol}
          interval={interval}
          isAggregated={isAggregated}
          selectedExchange={selectedExchange}
          marketType={marketType}
          onSelectExchange={(exchange) => {
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
            .filter((x) => x.isActive)
            .map((x) => ({
              id: x.id,
              label: x.name,
              kind: x.kind,
              href: x.href,
            }))}
          onRemoveIndicator={(id) => setActiveIds((prev) => prev.filter((x) => x !== id))}
        />
      </div>

      {/* Indicator Modal - using fixed positioning to escape container clipping in small widgets */}
      {isIndicatorModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className={`${isCompact ? 'w-[400px] h-[300px]' : 'w-[600px] h-[400px]'} bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-lg shadow-2xl flex flex-col overflow-hidden`}>
            {/* Modal Header */}
            <div className={`flex items-center justify-between ${isCompact ? 'p-2' : 'p-4'} border-b border-[color:var(--cf-border)]`}>
              <span className={`text-[color:var(--cf-text)] font-bold ${isCompact ? 'text-xs' : 'text-sm'}`}>{t('chart.modal.featured')}</span>
              <button type="button" onClick={() => setIsIndicatorModalOpen(false)} className="text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text)]">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 cf-scrollbar">
              {/* Coinflux 指标（只保留指定的几个） */}
              <div className="rounded border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)]">
                {visibleIndicators.map((ind) => (
                  <button
                    key={ind.id}
                    type="button"
                    onClick={() => toggleIndicator(ind.id)}
                    className={`flex w-full items-center justify-between ${isCompact ? 'px-2 py-2' : 'px-3 py-3'} border-b border-[color:var(--cf-border)] last:border-b-0 text-left hover:bg-[color:var(--cf-surface-hover)]`}
                  >
                    <span className="text-xs text-[color:var(--cf-text)]">{ind.name}</span>
                    <span className={`text-xs ${ind.isActive ? 'text-primary' : 'text-[color:var(--cf-muted)]'}`}>
                      {ind.isActive ? t('chart.indicator.added') : t('chart.indicator.add')}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
