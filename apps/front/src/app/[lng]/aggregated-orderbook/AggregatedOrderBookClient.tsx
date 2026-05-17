'use client'

import { LayoutGrid } from 'lucide-react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AggregatedOI } from '@/components/aggregated-orderbook/AggregatedOI'
import { AggregatedOrderbookView } from '@/components/aggregated-orderbook/AggregatedOrderbookView'
import { AggregatedVolume } from '@/components/aggregated-orderbook/AggregatedVolume'

export function AggregatedOrderBookClient() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('aggregated-orderbook')

  return (
    <div className="flex h-full w-full flex-col px-0 py-0">
      <div className="relative">
        <div className="flex w-full overflow-x-auto border-b border-[color:var(--cf-border)] no-scrollbar md:w-fit">
        {[
          { id: 'aggregated-orderbook', name: t('aggregatedOrderbook.tabs.orderbook') },
          { id: 'aggregated-oi', name: t('aggregatedOrderbook.tabs.openInterest') },
          { id: 'aggregated-volume', name: t('aggregatedOrderbook.tabs.volume') },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`relative flex-1 whitespace-nowrap px-3.5 py-2.5 !text-xs !font-semibold !leading-5 transition-colors md:flex-none md:px-5 ${activeTab === tab.id
              ? 'text-[color:var(--cf-text-strong)]'
              : 'text-[color:var(--cf-muted)] border-transparent hover:text-[color:var(--cf-text-strong)]'}`}
          >
            {tab.name}
            {activeTab === tab.id && (
              <>
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-primary to-secondary" />
                <div className="absolute inset-0 bg-gradient-to-b from-primary/10 to-transparent pointer-events-none" />
              </>
            )}
          </button>
        ))}
        </div>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-0 h-full w-8 bg-gradient-to-l from-[color:var(--cf-bg)] to-transparent md:hidden"
        />
      </div>

      <div className="relative mt-5 min-h-[560px] md:min-h-[750px]">
        {activeTab === 'aggregated-orderbook' ? (
          <AggregatedOrderbookView />
          ) : activeTab === 'aggregated-oi' ? (
            <AggregatedOI />
          ) : activeTab === 'aggregated-volume' ? (
            <AggregatedVolume />
          ) : (
            <div className="flex-1 flex items-center justify-center bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-xl min-h-[600px]">
              <div className="flex flex-col items-center gap-4 text-[color:var(--cf-muted)]">
                <LayoutGrid className="w-12 h-12 opacity-20" />
                <p>{t('common.featureInProgress')}</p>
              </div>
            </div>
          )}
      </div>
    </div>
  )
}
