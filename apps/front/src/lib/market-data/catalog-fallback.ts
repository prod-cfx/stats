import type { MarketDataCatalogItem } from './catalog-types'

export const FALLBACK_MARKET_DATA_CATALOG: MarketDataCatalogItem[] = [
  {
    id: 'liquidation-map',
    kind: 'chartOverlay',
    labelKey: 'chart.indicators.liquidationMap',
    group: 'featured',
    starred: true,
    href: '/liquidation-map',
    ui: {
      icon: 'Activity',
      color: '#F0B90B',
    },
  },
  {
    id: 'long-short-ratio',
    kind: 'chartSeries',
    labelKey: 'chart.indicators.longShortRatio',
    group: 'featured',
    starred: true,
    href: '/long-short-ratio',
    ui: {
      icon: 'BarChart2',
      color: '#0ECB81',
    },
  },
  {
    id: 'aggregated-open-interest',
    kind: 'chartSeries',
    labelKey: 'chart.indicators.aggregatedOpenInterest',
    group: 'featured',
    starred: true,
    href: '/aggregated-orderbook',
    ui: {
      icon: 'LineChart',
      color: '#8b5cf6',
    },
  },
  {
    id: 'aggregated-volume',
    kind: 'chartSeries',
    labelKey: 'chart.indicators.aggregatedVolume',
    group: 'featured',
    starred: true,
    href: '/aggregated-orderbook',
    ui: {
      icon: 'Activity',
      color: '#ec4899',
    },
  },
  {
    id: 'liquidation-data',
    kind: 'chartSeries',
    labelKey: 'chart.indicators.liquidationData',
    group: 'featured',
    starred: true,
    href: '/liquidation-data',
    ui: {
      icon: 'Zap',
      color: '#ef4444',
    },
  },
]
