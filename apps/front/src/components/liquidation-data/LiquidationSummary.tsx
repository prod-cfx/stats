'use client';

import type { AggregatedLiquidationSummary } from '@/lib/api';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { SectionTitle } from '@/components/ui/Typography';
import { useMockData } from '@/hooks/use-mock-data';
import { fetchAggregatedLiquidationSummary } from '@/lib/api';

interface LiquidationCardProps {
  title: string;
  total: string;
  long: string;
  short: string;
}

const LiquidationCard = ({ title, total, long, short }: LiquidationCardProps) => {
  const { t } = useTranslation();
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-6 flex-1 min-w-[260px]">
      <div className="flex justify-between items-center mb-6">
        <span className="text-[#8b949e] text-base">{title}</span>
        <span className="text-white text-xl font-bold">{total}</span>
      </div>
      <div className="space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-[#8b949e]">{t('liquidationData.summary.long')}</span>
          <span className="text-[#4ade80] font-medium">{long}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-[#8b949e]">{t('liquidationData.summary.short')}</span>
          <span className="text-[#f87171] font-medium">{short}</span>
        </div>
      </div>
    </div>
  );
};

export const LiquidationSummary = () => {
  const { t, i18n } = useTranslation();

  const formatter = React.useMemo(() => {
    const locale = i18n.language === 'zh' ? 'zh-CN' : 'en-US'
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'USD',
      notation: 'compact',
      maximumFractionDigits: 2,
    });
  }, [i18n.language]);

  // 默认使用 BTC 作为汇总 symbol，后续如需支持切换可以从上层透传
  const { data } = useMockData<AggregatedLiquidationSummary | null>(
    async () => fetchAggregatedLiquidationSummary('BTC'),
    [],
  );

  const items = data?.items ?? [
    { timeframe: '1h', totalUsd: 2.82710e7, longUsd: 2.75548e7, shortUsd: 7.162e5 },
    { timeframe: '4h', totalUsd: 3.65974e7, longUsd: 3.07189e7, shortUsd: 5.8785e6 },
    { timeframe: '12h', totalUsd: 1.35e8, longUsd: 1.17e8, shortUsd: 1.80936e7 },
    { timeframe: '24h', totalUsd: 2.22e8, longUsd: 1.44e8, shortUsd: 7.84277e7 },
  ];

  const summaryData = items.map(item => {
    let titleKey: string;
    switch (item.timeframe) {
      case '1h':
        titleKey = 'liquidationData.summary.1h';
        break;
      case '4h':
        titleKey = 'liquidationData.summary.4h';
        break;
      case '12h':
        titleKey = 'liquidationData.summary.12h';
        break;
      case '24h':
      default:
        titleKey = 'liquidationData.summary.24h';
        break;
    }

    return {
      title: t(titleKey),
      total: formatter.format(item.totalUsd),
      long: formatter.format(item.longUsd),
      short: formatter.format(item.shortUsd),
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <SectionTitle>{t('liquidationData.summary.title')}</SectionTitle>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryData.map((data, index) => (
          <LiquidationCard key={index} {...data} />
        ))}
      </div>
    </div>
  );
};


