'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';

export const LiquidationInfoBar = () => {
  const { t } = useTranslation();
  return (
    <div className="bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-xl p-4 flex items-center">
      <p className="text-[color:var(--cf-muted)] text-sm">
        {t('liquidationData.infoBar.text', {
          count: '80,090',
          total: '$2.22B',
          venue: 'Hyperliquid - BTC-USD',
          max: '$4.43M',
        })}
      </p>
    </div>
  );
};


