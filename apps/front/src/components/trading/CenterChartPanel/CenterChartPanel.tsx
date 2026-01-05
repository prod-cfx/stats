'use client';

import type { DataSource } from '@/app/page';
import { BarChart2, ChevronDown, Eye, Search, Settings, Star, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TradingViewChart } from './TradingViewChart';

interface CenterChartPanelProps {
  isAggregated: boolean;
  setIsAggregated: (v: boolean) => void;
  selectedExchange: DataSource;
  setSelectedExchange: (v: DataSource) => void;
  symbol: string;
}

export const CenterChartPanel = ({ 
  isAggregated, 
  setIsAggregated, 
  selectedExchange, 
  setSelectedExchange,
  symbol
}: CenterChartPanelProps) => {
  const { t } = useTranslation();
  const [interval, setInterval] = useState('15m');
  const [isIndicatorModalOpen, setIsIndicatorModalOpen] = useState(false);
  // Removed local state: isAggregated, selectedExchange
  const [isExchangeMenuOpen, setIsExchangeMenuOpen] = useState(false);
  const exchangeMenuRef = useRef<HTMLDivElement>(null);
  const timeframes = ['1s', '1m', '5m', '15m', '1h', '4h', '1d'];

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

  const indicators = [
    { id: 'liq', name: t('chart.indicators.liquidationMap'), star: true },
    { id: 'ls', name: t('chart.indicators.longShortRatio'), star: false },
    { id: 'order', name: t('chart.indicators.aggregatedOrderbook'), star: false },
    { id: 'oi', name: t('chart.indicators.aggregatedOpenInterest'), star: false },
    { id: 'vol', name: t('chart.indicators.aggregatedVolume'), star: false },
    { id: 'liq_data', name: t('chart.indicators.liquidationData'), star: false },
  ];

  const getTimeframeLabel = (tf: string) => {
    // Keep English compact codes; Chinese uses localized units.
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
    <div className="flex-1 flex flex-col bg-[#0d1117] overflow-hidden min-h-0 relative w-full">
      {/* Chart Toolbar */}
      <div className="h-[48px] bg-[#161b22] border-b border-[#30363d] px-2 flex items-center justify-between z-20 flex-shrink-0">
        <div className="flex items-center gap-1 h-full overflow-x-auto no-scrollbar">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => setInterval(tf)}
              className={`px-3 h-full text-xs transition-colors hover:text-[#c9d1d9] ${
                interval === tf ? 'bg-[#374151] text-[#c9d1d9] font-bold' : 'text-[#8b949e]'
              }`}
            >
              {getTimeframeLabel(tf)}
            </button>
          ))}
          <div className="h-4 w-[1px] bg-[#30363d] mx-1" />
          <button 
            className="px-3 h-full text-xs text-[#8b949e] flex items-center gap-1 hover:text-[#c9d1d9]"
            onClick={() => setIsIndicatorModalOpen(true)}
          >
            <span>{t('chart.toolbar.indicators')}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
          <button 
            className="px-3 h-full text-xs text-[#8b949e] flex items-center gap-1 hover:text-[#c9d1d9]"
            onClick={() => setIsIndicatorModalOpen(true)}
          >
            <span>{t('chart.toolbar.dataIndicators')}</span>
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>

        <div className="flex items-center gap-2 pr-2 shrink-0">
          <div className="flex items-center gap-2 text-xs">
            {/* Toggle Switch */}
            <button
              onClick={() => {
                setIsAggregated(!isAggregated);
                if (!isAggregated) {
                  setIsExchangeMenuOpen(false);
                }
              }}
              className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                isAggregated ? 'bg-gradient-to-r from-[#396bff] to-[#8b5cff]' : 'bg-[#30363d]'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  isAggregated ? 'translate-x-4' : 'translate-x-0.5'
                }`}
              />
            </button>
            
            {/* Aggregated Label or Exchange Selector */}
            {isAggregated ? (
              <span className="text-[#c9d1d9] whitespace-nowrap">{t('chart.toolbar.aggregationOn')}</span>
            ) : (
              <div className="relative" ref={exchangeMenuRef}>
                <button
                  onClick={() => setIsExchangeMenuOpen(!isExchangeMenuOpen)}
                  className="bg-[#1f2937] px-2 py-0.5 rounded flex items-center gap-1 hover:bg-[#374151] transition-colors whitespace-nowrap"
                >
                  <span className="text-[#c9d1d9]">{t(`chart.toolbar.${selectedExchange}`)}</span>
                  <ChevronDown className="w-3 h-3 text-[#8b949e]" />
                </button>
                
                {/* Exchange Dropdown Menu */}
                {isExchangeMenuOpen && (
                  <div className="absolute top-full right-0 mt-1 w-[120px] bg-[#161b22] border border-[#30363d] rounded shadow-lg z-50 py-1">
                    <button
                      onClick={() => {
                        setSelectedExchange('binance');
                        setIsExchangeMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-[#30363d] ${
                        selectedExchange === 'binance' ? 'bg-[#1f2937]' : 'text-[#c9d1d9]'
                      }`}
                    >
                      <span className={selectedExchange === 'binance' ? 'bg-gradient-to-r from-[#396bff] to-[#8b5cff] bg-clip-text text-transparent font-bold' : ''}>
                        {t('chart.toolbar.binance')}
                      </span>
                    </button>
                    <button
                      onClick={() => {
                        setSelectedExchange('okx');
                        setIsExchangeMenuOpen(false);
                      }}
                      className={`w-full text-left px-3 py-2 text-xs transition-colors hover:bg-[#30363d] ${
                        selectedExchange === 'okx' ? 'bg-[#1f2937]' : 'text-[#c9d1d9]'
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
          <div className="h-4 w-[1px] bg-[#30363d]" />
          <button className="p-1.5 text-[#8b949e] hover:text-[#c9d1d9]">
            <BarChart2 className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-[#8b949e] hover:text-[#c9d1d9]">
            <Eye className="w-4 h-4" />
          </button>
          <button className="p-1.5 text-[#8b949e] hover:text-[#c9d1d9]">
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Chart Area */}
      <div className="flex-1 relative overflow-hidden w-full">
        <TradingViewChart symbol={symbol} interval={interval} />
      </div>

      {/* Indicator Modal */}
      {isIndicatorModalOpen && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[600px] h-[400px] bg-[#161b22] border border-[#30363d] rounded-lg shadow-2xl flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-[#30363d]">
              <span className="text-[#c9d1d9] font-bold">{t('chart.modal.featured')}</span>
              <button onClick={() => setIsIndicatorModalOpen(false)} className="text-[#8b949e] hover:text-[#c9d1d9]">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 flex overflow-hidden">
              {/* Sidebar */}
              <div className="w-[180px] border-r border-[#30363d] p-2 flex flex-col gap-1 bg-[#0d1117]">
                <div className="relative mb-2">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#8b949e]" />
                  <input 
                    type="text" 
                    placeholder={t('chart.modal.search')}
                    className="w-full bg-[#161b22] border border-[#30363d] rounded py-1 pl-7 pr-2 text-xs text-[#c9d1d9] focus:outline-none focus:border-[#58a6ff]"
                  />
                </div>
                {[t('chart.modal.featured'), t('chart.modal.options')].map((cat, i) => (
                  <button key={i} className={`text-left px-3 py-2 text-xs rounded transition-colors ${i === 0 ? 'bg-[#374151] text-[#c9d1d9] font-bold' : 'text-[#8b949e] hover:bg-[#30363d]'}`}>
                    {cat}
                  </button>
                ))}
              </div>

              {/* Main List */}
              <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
                {indicators.map((ind) => (
                  <button 
                    key={ind.id} 
                    className="flex items-center justify-between px-3 py-2.5 rounded hover:bg-[#30363d] group transition-colors text-left"
                  >
                    <div className="flex items-center gap-3">
                      <Star className={`w-3.5 h-3.5 ${ind.star ? 'text-yellow-500 fill-yellow-500' : 'text-[#8b949e] group-hover:text-[#c9d1d9]'}`} />
                      <span className="text-xs text-[#8b949e] group-hover:text-[#c9d1d9]">{ind.name}</span>
                    </div>
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
