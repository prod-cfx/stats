'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';

export const LiquidationInfoBar = () => {
  const { t } = useTranslation();
  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-4 flex items-center">
      <p className="text-[#8b949e] text-sm">
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


