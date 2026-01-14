'use client';

import ReactECharts from 'echarts-for-react';
import { Info } from 'lucide-react';
import React from 'react';
import { useTranslation } from 'react-i18next';

interface SummaryCardProps {
  label: string;
  value?: string;
  subText?: React.ReactNode;
  isPerformance?: boolean;
  chartData?: any[];
  stats?: { label: string; value: string; sub: string; subVal: string }[];
}

const SummaryCard = ({ label, value, subText, isPerformance, chartData }: SummaryCardProps) => {
  const { t } = useTranslation();
  const chartOption = {
    backgroundColor: 'transparent',
    series: [
      {
        type: 'pie',
        radius: ['60%', '85%'],
        center: ['50%', '50%'],
        avoidLabelOverlap: false,
        label: { show: false },
        emphasis: { scale: false },
        labelLine: { show: false },
        data: chartData || []
      }
    ]
  };

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 md:p-5 flex flex-col gap-3 md:gap-4 relative min-h-[140px] md:min-h-[160px]">
      <div className="text-[#8b949e] text-xs md:text-label font-medium">{label}</div>
      {isPerformance ? (
        <div className="flex flex-col gap-3 md:gap-4 mt-auto">
          <div className="grid grid-cols-2 gap-4 md:gap-6">
            <div className="flex flex-col gap-0.5">
              <span className="text-[#8b949e] text-[10px] md:text-caption font-medium">{t('whaleTracking.profile.summary.winRate')}</span>
              <span className="text-white text-xl md:text-h2 font-bold">28.57 %</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[#8b949e] text-[10px] md:text-caption font-medium">{t('whaleTracking.profile.summary.maxDrawdown')}</span>
              <span className="text-white text-xl md:text-h2 font-bold">59.03 %</span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 md:gap-6">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#fac858]" />
              <span className="text-[#8b949e] text-[10px] md:text-caption font-medium">{t('whaleTracking.profile.summary.filledOrders')}</span>
              <span className="text-white text-sm md:text-body font-bold ml-auto">77</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#fac858]" />
              <span className="text-[#8b949e] text-[10px] md:text-caption font-medium">{t('whaleTracking.profile.summary.closes')}</span>
              <span className="text-white text-sm md:text-body font-bold ml-auto">7</span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between mt-auto">
          <div className="flex flex-col gap-2 md:gap-2.5 flex-1 min-w-0">
            <div className="text-white text-xl md:text-h2 font-bold tracking-tight truncate">{value}</div>
            <div className="w-full">{subText}</div>
          </div>
          <div className="w-12 h-12 md:w-16 md:h-16 flex-none ml-2 md:ml-4">
            <ReactECharts option={chartOption} style={{ height: '100%', width: '100%' }} />
          </div>
        </div>
      )}
    </div>
  );
};

export const ProfileSummary = () => {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <SummaryCard 
        label={t('whaleTracking.profile.summary.accountValue')} 
        value="$ 792,013.10" 
        chartData={[
          { value: 792013.09, name: t('whaleTracking.profile.summary.perpetual'), itemStyle: { color: '#5470c6' } },
          { value: 0.01, name: t('whaleTracking.profile.summary.spot'), itemStyle: { color: '#91cc75' } }
        ]}
        subText={
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-[10px] md:text-caption text-[#8b949e]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#5470c6]" />
              <span className="truncate">{t('whaleTracking.profile.summary.perpetual')}</span>
              <span className="text-[#e5e5e5] ml-auto">$ 792K</span>
            </div>
            <div className="flex items-center gap-2 text-[10px] md:text-caption text-[#8b949e]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#91cc75]" />
              <span className="truncate">{t('whaleTracking.profile.summary.spot')}</span>
              <span className="text-[#e5e5e5] ml-auto">$ 0.01</span>
            </div>
          </div>
        }
      />
      <SummaryCard 
        label={t('whaleTracking.profile.summary.availableMargin')} 
        value="$ 73,015.45" 
        chartData={[
          { value: 9.22, name: t('whaleTracking.profile.summary.used'), itemStyle: { color: '#fac858' } },
          { value: 90.78, name: t('whaleTracking.profile.summary.available'), itemStyle: { color: '#3a3a3a' } }
        ]}
        subText={
          <div className="flex items-center gap-2 text-[10px] md:text-caption text-[#8b949e]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#fac858]" />
            <span className="truncate">{t('whaleTracking.profile.summary.withdrawable')}</span>
            <span className="text-[#e5e5e5] ml-auto">9.22 %</span>
          </div>
        }
      />
      <SummaryCard 
        label={t('whaleTracking.profile.summary.totalPositionValue')} 
        value="$ 31,034,500" 
        chartData={[
          { value: 100, name: t('whaleTracking.profile.summary.shortExposure'), itemStyle: { color: '#fac858' } }
        ]}
        subText={
          <div className="flex items-center gap-2 text-[10px] md:text-caption text-[#8b949e]">
            <div className="w-1.5 h-1.5 rounded-full bg-[#fac858]" />
            <span className="truncate">{t('whaleTracking.profile.summary.leverageRatio')}</span>
            <Info className="w-2.5 h-2.5 md:w-3 md:h-3 text-[#8b949e]" />
            <span className="text-[#e5e5e5] ml-auto">39.18x</span>
          </div>
        }
      />
      <SummaryCard 
        label={t('whaleTracking.profile.summary.performanceWeek')} 
        isPerformance
      />
    </div>
  );
};

