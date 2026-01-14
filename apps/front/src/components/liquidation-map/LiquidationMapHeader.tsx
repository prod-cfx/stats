'use client';

import { RefreshCcw } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { FilterButton } from '@/components/ui/FilterButton';
import { BodyText, PageTitle } from '@/components/ui/Typography';

interface LiquidationMapHeaderProps {
  symbol: string;
  setSymbol: (s: string) => void;
  range: '1d' | '7d' | '30d';
  setRange: (r: '1d' | '7d' | '30d') => void;
  exchangeType: string;
  setExchangeType: (e: string) => void;
  onRefresh: () => void;
}

export const LiquidationMapHeader = ({ 
  symbol, 
  setSymbol, 
  range, 
  setRange, 
  exchangeType,
  setExchangeType,
  onRefresh 
}: LiquidationMapHeaderProps) => {
  const { t } = useTranslation();
  const symbolName = t(`symbols.${symbol}`, { defaultValue: symbol });

  return (
    <div className="flex flex-col gap-4 md:gap-8 mb-6 md:mb-10">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-2 md:gap-3">
          <PageTitle className="text-xl md:text-2xl">{t('liquidationMap.title', { symbol: symbolName })}</PageTitle>
          <BodyText className="text-xs md:text-sm">{t('liquidationMap.subtitle')}</BodyText>
        </div>
        <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <div className="flex gap-2">
            <FilterButton 
              value={exchangeType} 
              options={[
                { value: 'All', label: t('liquidationMap.exchangeType.all') },
                { value: 'CEX', label: t('liquidationMap.exchangeType.cex') },
                { value: 'DEX', label: t('liquidationMap.exchangeType.dex') },
              ]} 
              onChange={setExchangeType} 
              size="sm"
            />
            <FilterButton 
              value={symbol} 
              options={['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'BNB', 'HYPE', 'LINK', 'AVAX', 'ADA']} 
              onChange={setSymbol} 
              size="sm"
            />
          </div>
          <div className="flex gap-2">
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
              className="p-2 bg-[#21262d] border border-[#30363d] rounded-md text-[#e6edf3] hover:bg-[#30363d] hover:border-[#8b949e] transition-all active:scale-95 group shadow-sm"
            >
              <RefreshCcw className="w-4 h-4 md:w-5 md:h-5 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
