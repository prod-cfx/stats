import type { MarketDataCatalogItem } from './catalog-types'

export const FALLBACK_MARKET_DATA_CATALOG: MarketDataCatalogItem[] = [
  // Charts
  {
    id: 'candlestick-chart',
    kind: 'dashboardWidget',
    labelKey: 'dashboard.widgets.candlestickChart',
    group: 'featured',
    starred: true,
    ui: {
      icon: 'CandlestickChart',
      color: '#F7931A',
    },
  },
  {
    id: 'liquidation-map',
    kind: 'chartOverlay',
    labelKey: 'chart.indicators.liquidationMap',
    group: 'featured',
    starred: true,
    href: '/liquidation-map',
    ui: {
      icon: 'Map',
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
    id: 'aggregated-orderbook',
    kind: 'dashboardWidget',
    labelKey: 'chart.indicators.aggregatedOrderbook',
    group: 'featured',
    starred: true,
    href: '/aggregated-orderbook',
    ui: {
      icon: 'Layers',
      color: '#3b82f6',
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
  {
    id: 'prediction-market',
    kind: 'dashboardWidget',
    labelKey: 'nav.prediction_market',
    group: 'featured',
    ui: {
      icon: 'Vote',
      color: '#F5AC37',
    },
  },
  {
    id: 'public-companies',
    kind: 'dashboardWidget',
    labelKey: 'nav.public_companies',
    group: 'featured',
    ui: {
      icon: 'Building2',
      color: '#10B981',
    },
  },

  // Navigation Items (ensure IDs match Navbar.tsx dataNavOrder)
  {
    id: 'nav-liquidation-map',
    kind: 'nav',
    labelKey: 'nav.liquidation_map',
    href: '/liquidation-map',
  },
  {
    id: 'nav-long-short-ratio',
    kind: 'nav',
    labelKey: 'nav.long_short_ratio',
    href: '/long-short-ratio',
  },
  {
    id: 'nav-aggregated-orderbook',
    kind: 'nav',
    labelKey: 'nav.aggregated_orderbook',
    href: '/aggregated-orderbook',
  },
  {
    id: 'nav-liquidation-data',
    kind: 'nav',
    labelKey: 'nav.liquidation_data',
    href: '/liquidation-data',
  },
  {
    id: 'nav-prediction-market',
    kind: 'nav',
    labelKey: 'nav.prediction_market',
    href: '/prediction-market',
  },
  {
    id: 'nav-public-companies',
    kind: 'nav',
    labelKey: 'nav.public_companies',
    href: '/public-companies',
  },
]
