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
    <div className="flex flex-col w-full h-full p-4 md:p-8">
      <div className="flex border-b border-[color:var(--cf-border)] w-full md:w-fit overflow-x-auto no-scrollbar">
        {[
          { id: 'aggregated-orderbook', name: t('aggregatedOrderbook.tabs.orderbook') },
          { id: 'aggregated-oi', name: t('aggregatedOrderbook.tabs.openInterest') },
          { id: 'aggregated-volume', name: t('aggregatedOrderbook.tabs.volume') },
        ].map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 md:flex-none whitespace-nowrap px-4 md:px-8 py-3 text-sm font-semibold transition-all relative ${activeTab === tab.id
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

      <div className="relative min-h-[750px] mt-6">
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
