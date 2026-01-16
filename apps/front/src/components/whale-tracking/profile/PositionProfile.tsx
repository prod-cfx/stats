'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';

export const PositionProfile = () => {
  const { t } = useTranslation();
  return (
    <div className="bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-xl p-5 flex flex-col gap-5 h-full">
      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <div className="flex justify-between items-center">
          <span className="text-[color:var(--cf-muted)] text-sm font-medium">{t('whaleTracking.profile.positionProfile.perpetualTotalValue')}</span>
          <span className="px-2 py-0.5 bg-[color:var(--cf-surface-2)] text-[color:var(--cf-muted)] text-[10px] font-bold rounded uppercase">{t('whaleTracking.profile.positionProfile.currentPositions')}</span>
        </div>
        <div className="text-[color:var(--cf-text-strong)] text-h2 font-bold tracking-tight">$ 31,034,500</div>
      </div>

      {/* Margin Usage Bar */}
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <span className="text-[color:var(--cf-muted)] text-sm">{t('whaleTracking.profile.positionProfile.avgMarginUsage')}</span>
          <span className="text-[color:var(--cf-text-strong)] text-sm font-bold">90.78 %</span>
        </div>
        <div className="h-1.5 w-full bg-[color:var(--cf-bg)] rounded-full overflow-hidden">
          <div className="h-full bg-cyan-400 rounded-full shadow-[0_0_10px_rgba(34,211,238,0.5)]" style={{ width: '90.78%' }} />
        </div>
      </div>

      {/* Direction Bias */}
      <div className="flex flex-col gap-3">
        <div className="flex justify-between items-center border-b border-[color:var(--cf-border)] pb-2">
          <span className="text-[color:var(--cf-muted)] text-sm font-medium">{t('whaleTracking.profile.positionProfile.directionBias')}</span>
          <span className="text-[color:var(--cf-muted)] text-sm font-medium">{t('whaleTracking.profile.positionProfile.neutral')}</span>
        </div>
        
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[color:var(--cf-muted)] font-medium">{t('whaleTracking.profile.positionProfile.longExposure')}</span>
              <span className="text-green-500 font-bold">0 %</span>
            </div>
            <div className="h-1 w-full bg-[color:var(--cf-bg)] rounded-full overflow-hidden">
              <div className="h-full bg-green-500 rounded-full" style={{ width: '0%' }} />
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex justify-between items-center text-xs">
              <span className="text-[color:var(--cf-muted)] font-medium">{t('whaleTracking.profile.positionProfile.shortExposure')}</span>
              <span className="text-red-500 font-bold">100 %</span>
            </div>
            <div className="h-1 w-full bg-[color:var(--cf-bg)] rounded-full overflow-hidden">
              <div className="h-full bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.4)]" style={{ width: '100%' }} />
            </div>
          </div>
        </div>
      </div>

      {/* Value Distribution */}
      <div className="flex flex-col gap-3">
        <div className="text-[color:var(--cf-muted)] text-sm font-medium border-b border-[color:var(--cf-border)] pb-2">{t('whaleTracking.profile.positionProfile.distribution')}</div>
        <div className="flex justify-between items-end">
          <div className="flex flex-col gap-0.5">
            <span className="text-[color:var(--cf-muted)] text-[10px] font-medium uppercase">{t('whaleTracking.profile.positionProfile.longValue')}</span>
            <span className="text-[color:var(--cf-text-strong)] text-base font-bold">$ 0</span>
          </div>
          <div className="flex flex-col items-end gap-0.5">
            <span className="text-[color:var(--cf-muted)] text-[10px] font-medium uppercase">{t('whaleTracking.profile.positionProfile.shortValue')}</span>
            <span className="text-[color:var(--cf-text-strong)] text-base font-bold">$ 31,034,500</span>
          </div>
        </div>
        <div className="h-1 w-full bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.4)]" />
      </div>

      {/* ROI & PnL */}
      <div className="flex flex-col gap-2 pt-3 mt-auto border-t border-[color:var(--cf-border)]">
        <div className="flex justify-between items-center">
          <span className="text-[color:var(--cf-muted)] text-sm">{t('whaleTracking.profile.positionProfile.roi')}</span>
          <span className="text-red-500 text-base font-bold">-7.63 %</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-[color:var(--cf-muted)] text-sm">{t('whaleTracking.profile.positionProfile.unrealizedPnl')}</span>
          <span className="text-red-500 text-base font-bold">$ -54,885.83</span>
        </div>
      </div>
    </div>
  );
};
