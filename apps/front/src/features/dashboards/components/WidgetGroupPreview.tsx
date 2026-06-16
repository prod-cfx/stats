'use client'

import type { WidgetCatalogGroup, WidgetCatalogItem } from '../widgets/widgets-catalog'
import { ChevronLeft } from 'lucide-react'
import React from 'react'
import { useTranslation } from 'react-i18next'

interface WidgetGroupPreviewProps {
  group: WidgetCatalogGroup
  onBack: () => void
  onSelectWidget: (item: WidgetCatalogItem) => void
}

const klinePreviewBars = [
  { key: 'open', height: 40 },
  { key: 'breakout', height: 60 },
  { key: 'pullback', height: 45 },
  { key: 'rally', height: 70 },
  { key: 'base', height: 55 },
  { key: 'extension', height: 80 },
  { key: 'range', height: 65 },
  { key: 'close', height: 50 },
] as const

const orderbookPreviewRows = [
  { key: 'top', width: 85 },
  { key: 'near', width: 70 },
  { key: 'mid', width: 55 },
  { key: 'far', width: 40 },
] as const

const liquidationHeatPreviewBars = [
  { key: 'deep-short', height: 30, side: 'short' },
  { key: 'short', height: 50, side: 'short' },
  { key: 'near-short', height: 70, side: 'short' },
  { key: 'risk-short', height: 90, side: 'short' },
  { key: 'near-long', height: 60, side: 'long' },
  { key: 'long', height: 40, side: 'long' },
  { key: 'deep-long', height: 55, side: 'long' },
  { key: 'range-long', height: 75, side: 'long' },
  { key: 'tail-long', height: 45, side: 'long' },
] as const

const volumePreviewBars = [
  { key: 'asia-open', height: 40 },
  { key: 'asia-mid', height: 55 },
  { key: 'asia-close', height: 48 },
  { key: 'eu-open', height: 62 },
  { key: 'eu-mid', height: 70 },
  { key: 'us-open', height: 58 },
  { key: 'us-mid', height: 75 },
  { key: 'us-close', height: 65 },
] as const

export function WidgetGroupPreview({ group, onBack, onSelectWidget }: WidgetGroupPreviewProps) {
  const { t } = useTranslation()
  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-2 text-[color:var(--cf-muted)] hover:text-[color:var(--cf-text-strong)] transition-colors"
      >
        <ChevronLeft className="size-4" />
        <span className="text-sm">{t('widget.config.back')}</span>
      </button>

      <div>
        <h2 className="text-[color:var(--cf-text-strong)] font-bold text-2xl mb-2">{t(group.title)}</h2>
        <p className="text-[color:var(--cf-muted)] text-sm mb-1">{t(group.subtitle)}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {group.items.map((item) => (
          <button
            type="button"
            key={item.type}
            onClick={() => onSelectWidget(item)}
            className="bg-[color:var(--cf-surface)] border border-[color:var(--cf-border)] rounded-xl p-4 hover:bg-[color:var(--cf-surface-hover)] hover:border-primary/50 transition-all group text-left overflow-hidden"
          >
            <div className="flex items-start justify-between mb-3">
              <h3 className="text-[color:var(--cf-text-strong)] font-bold text-base group-hover:text-primary transition-colors">
                {t(item.title)}
              </h3>
              <span className="text-[color:var(--cf-muted)] text-xs bg-[color:var(--cf-surface-2)] px-2 py-1 rounded">
                {item.defaultLayout.w}×{item.defaultLayout.h}
              </span>
            </div>
            
            <p className="text-[color:var(--cf-muted)] text-xs mb-4 line-clamp-2">
              {t(item.description)}
            </p>

            {/* Mock Preview Thumbnail */}
            <div className="bg-[color:var(--cf-bg)] border border-[color:var(--cf-border)] rounded-lg h-32 flex items-center justify-center relative overflow-hidden">
              {/* Simplified visual preview based on type */}
              {item.type.includes('kline') && (
                <div className="size-full flex items-end justify-around px-4 pb-4">
                  {klinePreviewBars.map(bar => (
                    <div
                      key={bar.key}
                      className="w-1.5 bg-gradient-to-t from-primary/60 to-primary/20 rounded-t"
                      style={{ height: `${bar.height}%` }}
                    />
                  ))}
                </div>
              )}
              {item.type.includes('prediction') && (
                <div className="w-full p-4 space-y-2">
                  {['yes', 'no', 'other'].map(item => (
                    <div key={item} className="flex items-center gap-2">
                      <div className="size-2 rounded-full bg-primary/60" />
                      <div className="flex-1 h-2 bg-[color:var(--cf-surface-2)] rounded" />
                      <div className="w-8 h-2 bg-[color:var(--cf-surface-2)] rounded" />
                    </div>
                  ))}
                </div>
              )}
              {item.type.includes('stocks') && (
                <div className="w-full p-4 space-y-1.5">
                  {['asset', 'company', 'holding', 'change'].map(item => (
                    <div key={item} className="flex items-center gap-2">
                      <div className="size-4 rounded bg-primary/20" />
                      <div className="flex-1 h-2 bg-[color:var(--cf-surface-2)] rounded" />
                      <div className="w-10 h-2 bg-primary/40 rounded" />
                    </div>
                  ))}
                </div>
              )}
              {item.type.includes('long_short') && (
                <div className="w-full p-4">
                  <div className="flex gap-1 mb-2">
                    <div className="flex-1 h-1.5 bg-green-500/40 rounded" />
                    <div className="flex-1 h-1.5 bg-red-500/40 rounded" />
                  </div>
                  <div className="space-y-1.5">
                    {['top', 'mid', 'bottom'].map(item => (
                      <div key={item} className="flex gap-2">
                        <div className="w-12 h-2 bg-[color:var(--cf-surface-2)] rounded" />
                        <div className="flex-1 h-2 bg-green-500/20 rounded" />
                        <div className="flex-1 h-2 bg-red-500/20 rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {item.type.includes('orderbook') && (
                <div className="w-full p-4 flex gap-2">
                  <div className="flex-1 space-y-1">
                    {orderbookPreviewRows.map(row => (
                      <div key={`bid-${row.key}`} className="h-2 bg-green-500/30 rounded" style={{ width: `${row.width}%` }} />
                    ))}
                  </div>
                  <div className="flex-1 space-y-1">
                    {orderbookPreviewRows.map(row => (
                      <div key={`ask-${row.key}`} className="h-2 bg-red-500/30 rounded ml-auto" style={{ width: `${row.width}%` }} />
                    ))}
                  </div>
                </div>
              )}
              {item.type.includes('liquidation.map') && (
                <div className="size-full p-4">
                  <div className="h-full flex items-end justify-around">
                    {liquidationHeatPreviewBars.map(bar => (
                      <div
                        key={bar.key}
                        className={`w-1 rounded-t ${bar.side === 'short' ? 'bg-red-500/40' : 'bg-green-500/40'}`}
                        style={{ height: `${bar.height}%` }}
                      />
                    ))}
                  </div>
                </div>
              )}
              {(item.type.includes('open_interest') || item.type.includes('volume')) && (
                <div className="size-full p-4 flex items-end justify-around">
                  {volumePreviewBars.map(bar => (
                    <div
                      key={bar.key}
                      className="w-2 bg-primary/40 rounded-t"
                      style={{ height: `${bar.height}%` }}
                    />
                  ))}
                </div>
              )}
              {item.type.includes('liquidation.feed') && (
                <div className="w-full p-4 space-y-1.5">
                  {['one', 'two', 'three', 'four'].map(item => (
                    <div key={item} className="flex items-center gap-2">
                      <div className="size-3 rounded-full bg-red-500/40" />
                      <div className="flex-1 h-2 bg-[color:var(--cf-surface-2)] rounded" />
                      <div className="w-12 h-2 bg-red-500/30 rounded" />
                    </div>
                  ))}
                </div>
              )}
              
              {/* Fallback */}
              {!item.type.includes('kline') && 
               !item.type.includes('prediction') &&
               !item.type.includes('stocks') &&
               !item.type.includes('long_short') &&
               !item.type.includes('orderbook') &&
               !item.type.includes('liquidation') &&
               !item.type.includes('open_interest') &&
               !item.type.includes('volume') && (
                <div className="text-[color:var(--cf-muted)] text-xs">
                  {t(item.title)}
                </div>
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
