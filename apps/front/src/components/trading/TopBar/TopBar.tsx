'use client';

import { ChevronDown, Info } from 'lucide-react';
import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

export const TopBar = () => {
  const { t, i18n } = useTranslation();

  // Mock raw values (keep as numbers so locale switching works)
  const lastPrice = 87010.0
  const changeAbs = -389.9
  const changePct = -0.45
  const indexPrice = 87055.0
  const markPrice = 87003.3
  const fundingRatePct = 0.004
  const low24h = 86532.7
  const high24h = 88333.0
  const openInterestBtc = 24000
  const volume24hBtc = 68200

  const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US'
  const priceFormatter = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }), [locale])
  const priceFormatter2 = useMemo(() => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }), [locale])
  const compactFormatter = useMemo(() => new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 2 }), [locale])
  const formatUsd = (n: number) => `$${priceFormatter.format(n)}`
  const formatUsd2 = (n: number) => `$${priceFormatter2.format(n)}`
  const formatPct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`

  return (
    <div className="h-[61px] bg-[#161b22] border-b border-[#30363d] flex items-center text-[#c9d1d9] w-full">
      {/* Left Area: Navigation - Matches LeftTradePanel container width limits */}
      <div className="flex-none w-[20%] max-w-[340px] min-w-[240px] flex items-center px-4 gap-4 border-r border-[#30363d] h-full">
        <span className="text-lg font-bold">{t('trade.title')}</span>
        <div className="flex items-center gap-1 text-[#8b949e] text-sm cursor-pointer hover:text-[#c9d1d9] transition-colors">
          <span>{t('trade.tools')}</span>
        </div>
      </div>
      
      {/* Center & Right Area: Aligned with the Chart area */}
      <div className="flex-1 flex items-center gap-6 px-4 overflow-hidden h-full">
        {/* Symbol and Main Price */}
        <div className="flex items-center gap-4 flex-none">
          <div className="flex items-center gap-2 cursor-pointer group">
            <div className="w-6 h-6 bg-orange-500 rounded-full flex items-center justify-center text-[10px] font-bold text-black">
              ₿
            </div>
            <div className="flex items-center gap-1">
              <span className="font-bold text-base whitespace-nowrap">
                {t('trade.symbolWithType', { symbol: 'BTCUSDT', type: t('trade.perpetual') })}
              </span>
              <ChevronDown className="w-4 h-4 text-[#8b949e] group-hover:text-[#c9d1d9]" />
            </div>
          </div>

          <div className="flex flex-col">
            <span className="text-[#ef4444] font-semibold text-lg leading-tight">{priceFormatter.format(lastPrice)}</span>
            <div className="flex items-center gap-2 text-[10px] leading-tight text-[#ef4444]">
              <span>{changeAbs >= 0 ? `+${priceFormatter.format(changeAbs)}` : priceFormatter.format(changeAbs)}</span>
              <span>{formatPct(changePct)}</span>
            </div>
          </div>
        </div>

        {/* Market Stats - Flexible list with reduced gap for small screens */}
        <div className="flex-1 flex items-center gap-6 text-[11px] overflow-x-auto no-scrollbar">
          <div className="flex flex-col min-w-fit">
            <span className="text-[#8b949e] whitespace-nowrap">{t('trade.index_price')}</span>
            <span className="whitespace-nowrap text-[#c9d1d9]">{formatUsd(indexPrice)}</span>
          </div>
          <div className="flex flex-col min-w-fit">
            <span className="text-[#8b949e] whitespace-nowrap">{t('trade.mark_price')}</span>
            <span className="whitespace-nowrap text-[#c9d1d9]">{formatUsd(markPrice)}</span>
          </div>
          <div className="flex flex-col min-w-fit">
            <div className="flex items-center gap-1">
              <span className="text-[#8b949e] whitespace-nowrap">{t('trade.funding_rate')}</span>
              <Info className="w-3 h-3 text-[#8b949e]" />
            </div>
            <span className="text-orange-400 whitespace-nowrap">{formatPct(fundingRatePct)}</span>
          </div>
          <div className="flex flex-col min-w-fit">
            <span className="text-[#8b949e] whitespace-nowrap">{t('trade.24h_low')}</span>
            <span className="whitespace-nowrap text-[#c9d1d9]">{formatUsd2(low24h)}</span>
          </div>
          <div className="flex flex-col min-w-fit">
            <span className="text-[#8b949e] whitespace-nowrap">{t('trade.24h_high')}</span>
            <span className="whitespace-nowrap text-[#c9d1d9]">{formatUsd(high24h)}</span>
          </div>
          <div className="flex flex-col min-w-fit">
            <span className="text-[#8b949e] whitespace-nowrap">{t('trade.open_interest')}</span>
            <span className="whitespace-nowrap text-[#c9d1d9]">{compactFormatter.format(openInterestBtc)} BTC</span>
          </div>
          <div className="flex flex-col min-w-fit">
            <span className="text-[#8b949e] whitespace-nowrap">{t('trade.24h_volume')}</span>
            <span className="whitespace-nowrap text-[#c9d1d9]">{compactFormatter.format(volume24hBtc)} BTC</span>
          </div>
        </div>
      </div>
    </div>
  );
};
