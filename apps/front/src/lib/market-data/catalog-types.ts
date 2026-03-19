export type MarketDataCatalogItemKind = 'chartSeries' | 'chartOverlay' | 'dashboardWidget' | 'nav'

export interface MarketDataCatalogItem {
  id: string
  kind: MarketDataCatalogItemKind
  /**
   * i18n key, e.g. `chart.indicators.liquidationMap`
   */
  labelKey: string
  group?: 'featured' | 'options'
  starred?: boolean
  href?: string
  ui?: {
    /**
     * Icon name from lucide-react (string so the backend can drive it)
     */
    icon?: string
    /**
     * Primary color hex for tiles/buttons
     */
    color?: string
  }
}


