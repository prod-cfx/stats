'use client';

import type { TradingViewChartRef } from '@/components/tradingview/TradingViewChart'
import type { DataSource } from '@/types/trading';
import { BarChart2, ChevronDown, Eye, Search, Settings, Star, X } from 'lucide-react';
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
  const [interval, setInterval] = useState('15m');
  const [isIndicatorModalOpen, setIsIndicatorModalOpen] = useState(false);
  const [indicatorTab, setIndicatorTab] = useState<'featured' | 'options'>('featured')
  const [indicatorSearch, setIndicatorSearch] = useState('')
  
  const tvChartRef = useRef<TradingViewChartRef | null>(null)
  const [isExchangeMenuOpen, setIsExchangeMenuOpen] = useState(false);
  const exchangeMenuRef = useRef<HTMLDivElement>(null);
  const timeframes = ['1s', '1m', '5m', '15m', '1h', '4h', '1d'];

  const isCompact = variant === 'compact';

  // Close exchange menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (exchangeMenuRef.current && !exchangeMenuRef.current.contains(event.target as Node)) {
        setIsExchangeMenuOpen(false);
      }
    };

    if (isExchangeMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isExchangeMenuOpen]);

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

  const featuredIndicators = chartIndicatorItems.filter((x) => x.group === 'featured')
  const optionIndicators = chartIndicatorItems.filter((x) => x.group === 'options')
  const visibleIndicators = (indicatorTab === 'featured' ? featuredIndicators : optionIndicators)
    .filter((x) => {
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
    if (id === 'long-short-ratio' || id === 'aggregated-open-interest' || id === 'aggregated-volume' || id === 'liquidation-data') {
      const enabled = !activeIds.includes(id)
      if (enabled) tvChartRef.current?.ensureCustomIndicator(id as any)
      else tvChartRef.current?.removeCustomIndicator(id as any)
      setActiveIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
      return
    }

    setActiveIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  // 同步 activeIds 到 TV custom studies
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

  const getTimeframeLabel = (tf: string) => {
    if (tf === '1s') return t('chart.timeframes.1s');
    if (tf === '1m') return t('chart.timeframes.1m');
    if (tf === '5m') return t('chart.timeframes.5m');
    if (tf === '15m') return t('chart.timeframes.15m');
    if (tf === '1h') return t('chart.timeframes.1h');
    if (tf === '4h') return t('chart.timeframes.4h');
    if (tf === '1d') return t('chart.timeframes.1d');
    return tf;
  };

  return (
    <div className="flex-1 flex flex-col bg-[color:var(--cf-bg)] overflow-hidden min-h-0 relative w-full">
      {/* Chart Toolbar */}
      <div className={`${isCompact ? 'h-[36px] px-1' : 'h-[48px] px-2'} bg-[color:var(--cf-surface)] border-b border-[color:var(--cf-border)] flex items-center justify-between z-20 flex-shrink-0`}>
        <div className="flex items-center gap-1 h-full overflow-x-auto no-scrollbar">
          {timeframes.map((tf) => (
            <button
              key={tf}
              type="button"
              onClick={() => setInterval(tf)}
              className={`px-3 h-full ${isCompact ? 'text-[10px]' : 'text-xs'} transition-colors hover:text-[color:var(--cf-text)] ${
                interval === tf ? 'bg-[color:var(--cf-surface-hover)] text-[color:var(--cf-text)] font-bold' : 'text-[color:var(--cf-muted)]'
              }`}
            >
              {getTimeframeLabel(tf)}
            </button>
          ))}
          <div className="h-4 w-[1px] bg-[color:var(--cf-border)] mx-1" />
          <button
            type="button"
            className={`px-3 h-full ${isCompact ? 'text-[10px]' : 'text-xs'} text-[color:var(--cf-muted)] flex items-center gap-1 hover:text-[color:var(--cf-text)]`}
            onClick={() => setIsIndicatorModalOpen(true)}
          >
            <span>{t('chart.toolbar.indicators')}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          <button
            type="button"
            className={`px-3 h-full ${isCompact ? 'text-[10px]' : 'text-xs'} text-[color:var(--cf-muted)] flex items-center gap-1 hover:text-[color:var(--cf-text)]`}
            onClick={() => setIsIndicatorModalOpen(true)}
          >
            <span>{t('chart.toolbar.dataIndicators')}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        <div className={`flex items-center gap-2 ${isCompact ? 'pr-1' : 'pr-2'} shrink-0`}>
          <div className={`flex items-center gap-2 ${isCompact ? 'text-[10px]' : 'text-xs'}`}>
            <button
              type="button"
              onClick={() => {
                setIsAggregated(!isAggregated);
                if (!isAggregated) {
                  setIsExchangeMenuOpen(false);
                }
              }}
              className={`relative inline-flex ${isCompact ? 'h-4 w-7' : 'h-5 w-9'} items-center rounded-full transition-colors ${
                isAggregated ? 'bg-gradient-to-r from-[#396bff] to-[#8b5cff]' : 'bg-[color:var(--cf-border)]'
              }`}
            >
              <span
                className={`inline-block ${isCompact ? 'h-3 w-3 translate-x-3.5' : 'h-4 w-4 translate-x-4'} transform rounded-full bg-white transition-transform ${
                  !isAggregated && (isCompact ? 'translate-x-0.5' : 'translate-x-0.5')
                }`}
                style={{ transform: !isAggregated ? 'translateX(2px)' : undefined }}
              />
            </button>
            
            {isAggregated ? (
              <span className="text-[color:var(--cf-text)] whitespace-nowrap">{t('chart.toolbar.aggregationOn')}</span>
            ) : (
              <div className="relative" ref={exchangeMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsExchangeMenuOpen(!isExchangeMenuOpen)}
                  className="bg-[color:var(--cf-surface-2)] px-2 py-0.5 rounded flex items-center gap-1 hover:bg-[color:var(--cf-surface-hover)] transition-colors whitespace-nowrap"
                >
                  <span className="text-[color:var(--cf-text)]">{t(`chart.toolbar.${selectedExchange}`)}</span>
                  <ChevronDown className="w-3 h-3 text-[color:var(--cf-muted)]" />
                </button>
                
                {isExchangeMenuOpen && (
                  <div className="absolute top-full right-0 mt-1 w-[120px] bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded shadow-lg z-50 py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedExchange('binance');
                        setIsExchangeMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-[color:var(--cf-surface-hover)] ${
                        selectedExchange === 'binance' ? 'bg-[color:var(--cf-surface-2)]' : 'text-[color:var(--cf-text)]'
                      }`}
                    >
                      <span className={selectedExchange === 'binance' ? 'bg-gradient-to-r from-[#396bff] to-[#8b5cff] bg-clip-text text-transparent font-bold' : ''}>
                        {t('chart.toolbar.binance')}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedExchange('okx');
                        setIsExchangeMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-[color:var(--cf-surface-hover)] ${
                        selectedExchange === 'okx' ? 'bg-[color:var(--cf-surface-2)]' : 'text-[color:var(--cf-text)]'
                      }`}
                    >
                      <span className={selectedExchange === 'okx' ? 'bg-gradient-to-r from-[#396bff] to-[#8b5cff] bg-clip-text text-transparent font-bold' : ''}>
                        {t('chart.toolbar.okx')}
                      </span>
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="h-4 w-[1px] bg-[color:var(--cf-border)]" />
          <button type="button" className="p-1.5 text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text)]">
            <BarChart2 className="w-4 h-4" />
          </button>
          <button type="button" className="p-1.5 text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text)]">
            <Eye className="w-4 h-4" />
          </button>
          <button type="button" className="p-1.5 text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text)]">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

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

      {/* Indicator Modal */}
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
            
            <div className="flex-1 flex overflow-hidden">
              {/* Sidebar */}
              <div className={`${isCompact ? 'w-[120px]' : 'w-[180px]'} border-r border-[color:var(--cf-border)] p-2 flex flex-col gap-1 bg-[color:var(--cf-bg)]`}>
                <div className="relative mb-2">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[color:var(--cf-muted)]" />
                  <input 
                    type="text" 
                    placeholder={t('chart.modal.search')}
                    value={indicatorSearch}
                    onChange={(e) => setIndicatorSearch(e.target.value)}
                    className="w-full bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded py-1 pl-7 pr-2 text-xs text-[color:var(--cf-text)] focus:outline-none focus:border-[#58a6ff]"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setIndicatorTab('featured')}
                  className={`text-left px-3 py-2 text-xs rounded transition-colors ${
                    indicatorTab === 'featured'
                      ? 'bg-[color:var(--cf-surface-hover)] text-[color:var(--cf-text)] font-bold'
                      : 'text-[color:var(--cf-muted)] hover:bg-[color:var(--cf-surface-hover)]'
                  }`}
                >
                  {t('chart.modal.featured')}
                </button>
                <button
                  type="button"
                  onClick={() => setIndicatorTab('options')}
                  className={`text-left px-3 py-2 text-xs rounded transition-colors ${
                    indicatorTab === 'options'
                      ? 'bg-[color:var(--cf-surface-hover)] text-[color:var(--cf-text)] font-bold'
                      : 'text-[color:var(--cf-muted)] hover:bg-[color:var(--cf-surface-hover)]'
                  }`}
                >
                  {t('chart.modal.options')}
                </button>
              </div>

              {/* Main List */}
              <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5 cf-scrollbar">
                {visibleIndicators.map((ind) => (
                  <button
                    key={ind.id}
                    type="button"
                    onClick={() => toggleIndicator(ind.id)}
                    className={`flex items-center justify-between ${isCompact ? 'px-2 py-1.5' : 'px-3 py-2.5'} rounded group transition-colors text-left ${
                      ind.isActive ? 'bg-[color:var(--cf-surface-2)]' : 'hover:bg-[color:var(--cf-surface-hover)]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Star className={`w-3.5 h-3.5 ${ind.starred ? 'text-yellow-500 fill-yellow-500' : 'text-[color:var(--cf-muted)] group-hover:text-[color:var(--cf-text)]'}`} />
                      <span className={`text-xs truncate ${ind.isActive ? 'text-[color:var(--cf-text)]' : 'text-[color:var(--cf-muted)] group-hover:text-[color:var(--cf-text)]'}`}>
                        {ind.name}
                      </span>
                    </div>
                    <div className={`text-xs ${ind.isActive ? 'text-primary' : 'text-[color:var(--cf-muted)]'}`}>
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
      )}
    </div>
  );
};
