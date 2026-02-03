'use client'

import React from 'react'
import { useTranslation } from 'react-i18next'

export const LiquidationInfoBar = () => {
  const { t } = useTranslation()
  return (
    <div className="flex items-center rounded-xl border border-[color:var(--cf-border)] bg-[color:var(--cf-surface)] p-4">
      <p className="text-sm text-[color:var(--cf-muted)]">
        {t('liquidationData.infoBar.text', {
          count: 80090,
          total: '$2.22B',
          venue: 'Hyperliquid - BTC-USD',
          max: '$4.43M',
        })}
      </p>
    </div>
  )
}
