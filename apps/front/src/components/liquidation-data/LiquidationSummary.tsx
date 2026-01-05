'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { SectionTitle } from '@/components/ui/Typography';

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

  const summaryData = [
    { title: t('liquidationData.summary.1h'), total: 2.82710e7, long: 2.75548e7, short: 7.162e5 },
    { title: t('liquidationData.summary.4h'), total: 3.65974e7, long: 3.07189e7, short: 5.8785e6 },
    { title: t('liquidationData.summary.12h'), total: 1.35e8, long: 1.17e8, short: 1.80936e7 },
    { title: t('liquidationData.summary.24h'), total: 2.22e8, long: 1.44e8, short: 7.84277e7 },
  ].map(row => ({
    title: row.title,
    total: formatter.format(row.total),
    long: formatter.format(row.long),
    short: formatter.format(row.short),
  }));

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


