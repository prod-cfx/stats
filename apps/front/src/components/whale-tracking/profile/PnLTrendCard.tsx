'use client';

import type { UserPortfolioResponse } from '@/lib/api';
import { ChevronDown } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { PnLTrendChart } from './PnLTrendChart';

interface PnLTrendCardProps {
  portfolio: UserPortfolioResponse;
}

export const PnLTrendCard = ({ portfolio }: PnLTrendCardProps) => {
  const { t } = useTranslation();
  const [timeRange, setTimeRange] = useState<'1d' | '1w' | '1m' | 'all'>('1w');
  const [contractType, setContractType] = useState<'all' | 'perpOnly'>('perpOnly');
  const [pnlType, setPnlType] = useState<'accountValue' | 'totalPnl'>('totalPnl');
  
  const [dropdownOpen, setDropdownOpen] = useState<string | null>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handleDocClick = () => setDropdownOpen(null);
    document.addEventListener('click', handleDocClick);
    return () => document.removeEventListener('click', handleDocClick);
  }, [dropdownOpen]);

  const chartData = useMemo(() => {
    const periodData = (() => {
      if (contractType === 'perpOnly') {
        if (timeRange === '1d') return portfolio.perpDay;
        if (timeRange === '1w') return portfolio.perpWeek;
        if (timeRange === '1m') return portfolio.perpMonth;
        return portfolio.perpAllTime;
      }
      if (timeRange === '1d') return portfolio.day;
      if (timeRange === '1w') return portfolio.week;
      if (timeRange === '1m') return portfolio.month;
      return portfolio.allTime;
    })();

    const history = pnlType === 'accountValue'
      ? periodData.accountValueHistory
      : periodData.pnlHistory;

    return history.map(({ timestamp, value }) => ({
      date: new Date(timestamp).toLocaleDateString(),
      value,
    }));
  }, [contractType, pnlType, portfolio, timeRange]);

  // 计算头部显示的总值（根据选择的时间范围和类型动态计算）
  const headerValue = useMemo(() => {
    if (chartData.length === 0) return '--';
    const lastValue = chartData[chartData.length - 1]?.value ?? 0;
    const prefix = lastValue >= 0 ? '+' : '';
    if (Math.abs(lastValue) >= 1_000_000) {
      return `$ ${prefix}${(lastValue / 1_000_000).toFixed(2)}M`;
    }
    if (Math.abs(lastValue) >= 1_000) {
      return `$ ${prefix}${(lastValue / 1_000).toFixed(2)}K`;
    }
    return `$ ${prefix}${lastValue.toFixed(2)}`;
  }, [chartData]);

  const headerColor = useMemo(() => {
    if (chartData.length === 0) return 'text-[color:var(--cf-muted)]';
    const lastValue = chartData[chartData.length - 1]?.value ?? 0;
    return lastValue >= 0 ? 'text-[#4ade80]' : 'text-[#f87171]';
  }, [chartData]);

  return (
    <div className="bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-xl p-6 flex flex-col gap-6 h-full">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <div className="text-[color:var(--cf-muted)] text-sm font-medium">
            {t('whaleTracking.profile.pnlTrend.header', {
              timeRange: t(`whaleTracking.profile.pnlTrend.timeRange.${timeRange}`),
              pnlType: t(`whaleTracking.profile.pnlTrend.pnlType.${pnlType}`),
              contractType: t(`whaleTracking.profile.pnlTrend.contractType.${contractType}`),
            })}
          </div>
          <div className={`${headerColor} text-h2 font-bold tracking-tight`}>{headerValue}</div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Time Range Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setDropdownOpen(dropdownOpen === 'time' ? null : 'time'); }}
              className={`flex items-center gap-2 px-3 py-1.5 bg-[color:var(--cf-bg)] border border-[color:var(--cf-border)] rounded-lg text-[color:var(--cf-text)] text-caption font-medium hover:border-transparent hover:bg-gradient-to-r hover:from-primary hover:to-secondary active:scale-95 transition-all group ${dropdownOpen === 'time' ? 'border-transparent bg-gradient-to-r from-primary to-secondary' : ''}`}
            >
              <span>{t(`whaleTracking.profile.pnlTrend.timeRange.${timeRange}`)}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-[color:var(--cf-muted)] group-hover:text-white transition-all ${dropdownOpen === 'time' ? 'rotate-180 text-white' : ''}`} />
            </button>
            {dropdownOpen === 'time' && (
              <div className="absolute right-0 mt-2 w-24 bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-lg shadow-2xl z-30 overflow-hidden">
                {(['1d', '1w', '1m', 'all'] as const).map(opt => (
                  <button
                    type="button"
                    key={opt}
                    onClick={() => { setTimeRange(opt); setDropdownOpen(null); }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-[color:var(--cf-surface-hover)] transition-colors ${timeRange === opt ? 'text-primary' : 'text-[color:var(--cf-text)]'}`}
                  >
                    {t(`whaleTracking.profile.pnlTrend.timeRange.${opt}`)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Contract Type Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setDropdownOpen(dropdownOpen === 'contract' ? null : 'contract'); }}
              className={`flex items-center gap-2 px-3 py-1.5 bg-[color:var(--cf-bg)] border border-[color:var(--cf-border)] rounded-lg text-[color:var(--cf-text)] text-caption font-medium hover:border-transparent hover:bg-gradient-to-r hover:from-primary hover:to-secondary active:scale-95 transition-all group ${dropdownOpen === 'contract' ? 'border-transparent bg-gradient-to-r from-primary to-secondary' : ''}`}
            >
              <span>{t(`whaleTracking.profile.pnlTrend.contractType.${contractType}`)}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-[color:var(--cf-muted)] group-hover:text-white transition-all ${dropdownOpen === 'contract' ? 'rotate-180 text-white' : ''}`} />
            </button>
            {dropdownOpen === 'contract' && (
              <div className="absolute right-0 mt-2 w-36 bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-lg shadow-2xl z-30 overflow-hidden">
                {(['all', 'perpOnly'] as const).map(opt => (
                  <button
                    type="button"
                    key={opt}
                    onClick={() => { setContractType(opt); setDropdownOpen(null); }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-[color:var(--cf-surface-hover)] transition-colors ${contractType === opt ? 'text-primary' : 'text-[color:var(--cf-text)]'}`}
                  >
                    {t(`whaleTracking.profile.pnlTrend.contractType.${opt}`)}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* PnL Type Dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setDropdownOpen(dropdownOpen === 'pnl' ? null : 'pnl'); }}
              className={`flex items-center gap-2 px-3 py-1.5 bg-[color:var(--cf-bg)] border border-[color:var(--cf-border)] rounded-lg text-[color:var(--cf-text)] text-caption font-medium hover:border-transparent hover:bg-gradient-to-r hover:from-primary hover:to-secondary active:scale-95 transition-all group ${dropdownOpen === 'pnl' ? 'border-transparent bg-gradient-to-r from-primary to-secondary' : ''}`}
            >
              <span>{t(`whaleTracking.profile.pnlTrend.pnlType.${pnlType}`)}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-[color:var(--cf-muted)] group-hover:text-white transition-all ${dropdownOpen === 'pnl' ? 'rotate-180 text-white' : ''}`} />
            </button>
            {dropdownOpen === 'pnl' && (
              <div className="absolute right-0 mt-2 w-28 bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-lg shadow-2xl z-30 overflow-hidden">
                {(['accountValue', 'totalPnl'] as const).map(opt => (
                  <button
                    type="button"
                    key={opt}
                    onClick={() => { setPnlType(opt); setDropdownOpen(null); }}
                    className={`w-full text-left px-3 py-2 text-xs hover:bg-[color:var(--cf-surface-hover)] transition-colors ${pnlType === opt ? 'text-primary' : 'text-[color:var(--cf-text)]'}`}
                  >
                    {t(`whaleTracking.profile.pnlTrend.pnlType.${opt}`)}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Chart Container */}
      <div className="flex-1 min-h-[300px] w-full">
        <PnLTrendChart data={chartData.map(({ date, value }) => ({ ts: date, value }))} />
      </div>
    </div>
  );
};

