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
    <div className="bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-xl p-6 flex-1 min-w-[260px]">
      <div className="flex justify-between items-center mb-6">
        <span className="text-[color:var(--cf-muted)] text-base">{title}</span>
        <span className="text-[color:var(--cf-text-strong)] text-xl font-bold">{total}</span>
      </div>
      <div className="space-y-3">
        <div className="flex justify-between items-center text-sm">
          <span className="text-[color:var(--cf-muted)]">{t('liquidationData.summary.long')}</span>
          <span className="text-[#4ade80] font-medium">{long}</span>
        </div>
        <div className="flex justify-between items-center text-sm">
          <span className="text-[color:var(--cf-muted)]">{t('liquidationData.summary.short')}</span>
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
  const { data, loading, error, reload } = useMockData<AggregatedLiquidationSummary | null>(
    async () => fetchAggregatedLiquidationSummary('BTC'),
    [],
    {
      delay: 0,
      ignoreQueryOverrides: true,
    },
  );

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <SectionTitle>{t('liquidationData.summary.title')}</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div
              key={index}
              className="bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-xl p-6 animate-pulse h-[120px]"
            />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <SectionTitle>{t('liquidationData.summary.title')}</SectionTitle>
        <div className="bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-xl p-4 flex items-center justify-between">
          <p className="text-[#f97373] text-sm">
            {t('common.error') || '爆仓汇总数据加载失败，请稍后重试。'}
          </p>
          <button
            type="button"
            className="px-3 py-1 text-xs rounded-md border border-[color:var(--cf-border)] text-[color:var(--cf-text)] hover:bg-[color:var(--cf-surface-hover)] transition-colors"
            onClick={() => reload()}
          >
            {t('common.retry') || '重试'}
          </button>
        </div>
      </div>
    );
  }

  const items = data?.items ?? [];

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


