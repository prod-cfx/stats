export type WidgetType =
  | "market.kline"
  | "market.prediction"
  | "market.crypto_stocks"
  | "derivatives.long_short_ratio"
  | "derivatives.orderbook_agg"
  | "derivatives.open_interest_agg"
  | "derivatives.volume_agg"
  | "liquidation.map"
  | "liquidation.feed";

export type WidgetGroupId = "market" | "derivatives" | "liquidation";

export interface WidgetCatalogItem {
  type: WidgetType;
  title: string;
  description: string;
  iconKey: string;
  defaultLayout: { w: number; h: number; minW: number; minH: number; maxW: number; maxH: number };
  defaultConfig: Record<string, any>;
  allowMultiple: boolean;
}

export interface WidgetCatalogGroup {
  id: WidgetGroupId;
  title: string;
  subtitle: string;
  items: WidgetCatalogItem[];
}

export const WIDGET_CATALOG: WidgetCatalogGroup[] = [
  {
    id: "market",
    title: "dashboard.widgets.categories.market_data",
    subtitle: "dashboard.widgets.candlestickChart・dashboard.widgets.predictionMarket・dashboard.widgets.publicCompanies",
    items: [
      {
        type: "market.kline",
        title: "dashboard.widgets.candlestickChart",
        description: "dashboard.widgets.descriptions.candlestickChart",
        iconKey: "kline",
        // Ultra compact; will be clamped to 3~6
        defaultLayout: { w: 6, h: 6, minW: 6, minH: 3, maxW: 12, maxH: 16 },
        defaultConfig: { symbol: "BTCUSDT", venue: "OKX", interval: "15m" },
        allowMultiple: true,
      },
      {
        type: "market.prediction",
        title: "dashboard.widgets.predictionMarket",
        description: "dashboard.widgets.descriptions.predictionMarket",
        iconKey: "prediction",
        defaultLayout: { w: 6, h: 6, minW: 6, minH: 3, maxW: 12, maxH: 16 },
        defaultConfig: { category: "BTC", sort: "hot", showLiveOnly: false },
        allowMultiple: true,
      },
      {
        type: "market.crypto_stocks",
        title: "dashboard.widgets.publicCompanies",
        description: "dashboard.widgets.descriptions.publicCompanies",
        iconKey: "stocks",
        defaultLayout: { w: 6, h: 6, minW: 6, minH: 3, maxW: 12, maxH: 16 },
        defaultConfig: { watchlist: "ALL", sort: "marketCap" },
        allowMultiple: true,
      },
    ],
  },
  {
    id: "derivatives",
    title: "dashboard.widgets.categories.derivatives",
    subtitle: "dashboard.widgets.lsRatio・dashboard.widgets.aggOrderbook・dashboard.widgets.aggOI・dashboard.widgets.aggVolume",
    items: [
      {
        type: "derivatives.long_short_ratio",
        title: "dashboard.widgets.lsRatio",
        description: "dashboard.widgets.descriptions.lsRatio",
        iconKey: "longshort",
        defaultLayout: { w: 6, h: 3, minW: 6, minH: 3, maxW: 12, maxH: 16 },
        defaultConfig: { symbol: "BTC", window: "4h" },
        allowMultiple: true,
      },
      {
        type: "derivatives.orderbook_agg",
        title: "dashboard.widgets.aggOrderbook",
        description: "dashboard.widgets.descriptions.aggOrderbook",
        iconKey: "orderbook",
        defaultLayout: { w: 6, h: 6, minW: 6, minH: 3, maxW: 12, maxH: 16 },
        defaultConfig: { symbol: "BTCUSDT", marketType: "swap", depth: 10 },
        allowMultiple: true,
      },
      {
        type: "derivatives.open_interest_agg",
        title: "dashboard.widgets.aggOI",
        description: "dashboard.widgets.descriptions.aggOI",
        iconKey: "oi",
        defaultLayout: { w: 6, h: 6, minW: 6, minH: 3, maxW: 12, maxH: 16 },
        defaultConfig: { symbol: "BTC", window: "24h" },
        allowMultiple: true,
      },
      {
        type: "derivatives.volume_agg",
        title: "dashboard.widgets.aggVolume",
        description: "dashboard.widgets.descriptions.aggVolume",
        iconKey: "volume",
        defaultLayout: { w: 6, h: 3, minW: 6, minH: 3, maxW: 12, maxH: 16 },
        defaultConfig: { symbol: "BTC", window: "24h" },
        allowMultiple: true,
      },
    ],
  },
  {
    id: "liquidation",
    title: "dashboard.widgets.categories.liquidation",
    subtitle: "dashboard.widgets.liquidationMap・dashboard.widgets.liquidationData",
    items: [
      {
        type: "liquidation.map",
        title: "dashboard.widgets.liquidationMap",
        description: "dashboard.widgets.descriptions.liquidationMap",
        iconKey: "liqmap",
        defaultLayout: { w: 6, h: 6, minW: 6, minH: 3, maxW: 12, maxH: 16 },
        defaultConfig: { symbol: "BTC", scope: "ALL", range: "1D" },
        allowMultiple: true,
      },
      {
        type: "liquidation.feed",
        title: "dashboard.widgets.liquidationData",
        description: "dashboard.widgets.descriptions.liquidationData",
        iconKey: "liqfeed",
        defaultLayout: { w: 6, h: 6, minW: 6, minH: 3, maxW: 12, maxH: 16 },
        defaultConfig: { symbol: "ALL", window: "4h" },
        allowMultiple: true,
      },
    ],
  },
];


