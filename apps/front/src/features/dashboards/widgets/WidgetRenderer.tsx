import type { DashboardWidgetInstance } from '../store/dashboardStore'
import React from 'react'
import { useWidgetMockData } from '../mock/useWidgetMockData'
import { WIDGET_CATALOG } from '../widgets/widgets.catalog'
import { CryptoStocksWidget } from './contents/CryptoStocksWidget'
import { KlineWidget } from './contents/KlineWidget'
import { LiquidationFeedWidget } from './contents/LiquidationFeedWidget'
import { LiquidationMapWidget } from './contents/LiquidationMapWidget'
import { LongShortRatioWidget } from './contents/LongShortRatioWidget'
import { OpenInterestAggWidget } from './contents/OpenInterestAggWidget'
import { OrderbookAggWidget } from './contents/OrderbookAggWidget'
import { PredictionMarketWidget } from './contents/PredictionMarketWidget'
import { VolumeAggWidget } from './contents/VolumeAggWidget'
import { WidgetShell } from './WidgetShell'

function normalizeWidgetType(raw: string) {
  const t = raw.trim()
  // Back-compat with older dashboard widget IDs (pre WIDGET_CATALOG WidgetType).
  const legacy: Record<string, string> = {
    'prediction-market': 'market.prediction',
    'public-companies': 'market.crypto_stocks',
    'long-short-ratio': 'derivatives.long_short_ratio',
    'candlestick-chart': 'market.kline',
  }
  return legacy[t] ?? t
}

function findMeta(type: string) {
  for (const g of WIDGET_CATALOG) {
    const hit = g.items.find((x) => x.type === type)
    if (hit) return hit
  }
  return null
}

export function WidgetRenderer(props: { widget: DashboardWidgetInstance; onRemove?: () => void }) {
  const normalizedType = normalizeWidgetType(String((props.widget as any).type))
  const meta = findMeta(normalizedType)
  const { loading, data, error } = useWidgetMockData(normalizedType as any, props.widget.config)

  return (
    <WidgetShell
      title={meta?.title ?? props.widget.type}
      description={meta?.description}
      onRemove={props.onRemove}
      contentStyle={normalizedType === 'market.kline' ? { height: '500px' } : undefined}
    >
      {loading ? (
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-1/3 rounded bg-white/10" />
          <div className="h-3 w-full rounded bg-white/10" />
          <div className="h-3 w-5/6 rounded bg-white/10" />
          <div className="h-3 w-4/6 rounded bg-white/10" />
          <div className="h-24 w-full rounded bg-white/5 border border-white/10" />
        </div>
      ) : null}

      {error ? <div className="text-sm text-red-400">{error}</div> : null}

      {!loading && !error ? (
        <>
          {(() => {
            // `data` is intentionally unused here (phase1 mock validates the chain) — do not render JSON.
            void data
            switch (normalizedType) {
              case 'market.kline':
                return <KlineWidget config={props.widget.config} />
              case 'market.prediction':
                return <PredictionMarketWidget config={props.widget.config} />
              case 'market.crypto_stocks':
                return <CryptoStocksWidget config={props.widget.config} />
              case 'derivatives.long_short_ratio':
                return <LongShortRatioWidget config={props.widget.config} />
              case 'derivatives.orderbook_agg':
                return <OrderbookAggWidget config={props.widget.config} />
              case 'derivatives.open_interest_agg':
                return <OpenInterestAggWidget config={props.widget.config} />
              case 'derivatives.volume_agg':
                return <VolumeAggWidget config={props.widget.config} />
              case 'liquidation.map':
                return <LiquidationMapWidget config={props.widget.config} />
              case 'liquidation.feed':
                return <LiquidationFeedWidget config={props.widget.config} />
              default:
                return (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <div className="text-white/80 text-sm font-semibold">组件开发中</div>
                    <div className="text-white/60 text-xs mt-1">
                      {meta?.title ?? normalizedType}
                    </div>
                  </div>
                )
            }
          })()}
        </>
      ) : null}
    </WidgetShell>
  )
}

