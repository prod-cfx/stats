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
    title: "市场数据",
    subtitle: "K线图表・预测市场・币股",
    items: [
      {
        type: "market.kline",
        title: "K线图表",
        description: "专业的 TradingView K线图表",
        iconKey: "kline",
        // Ultra compact; will be clamped to 3~6
        defaultLayout: { w: 6, h: 6, minW: 6, minH: 3, maxW: 12, maxH: 16 },
        defaultConfig: { symbol: "BTCUSDT", venue: "OKX", interval: "15m" },
        allowMultiple: true,
      },
      {
        type: "market.prediction",
        title: "预测市场",
        description: "基于链上数据的未来趋势预测",
        iconKey: "prediction",
        defaultLayout: { w: 6, h: 6, minW: 6, minH: 3, maxW: 12, maxH: 16 },
        defaultConfig: { category: "BTC", sort: "hot", showLiveOnly: false },
        allowMultiple: true,
      },
      {
        type: "market.crypto_stocks",
        title: "币股",
        description: "持有加密资产的上市公司概览",
        iconKey: "stocks",
        defaultLayout: { w: 6, h: 6, minW: 6, minH: 3, maxW: 12, maxH: 16 },
        defaultConfig: { watchlist: "ALL", sort: "marketCap" },
        allowMultiple: true,
      },
    ],
  },
  {
    id: "derivatives",
    title: "衍生品数据",
    subtitle: "聚合多空比・聚合挂单・聚合持仓量・聚合成交量",
    items: [
      {
        type: "derivatives.long_short_ratio",
        title: "聚合多空比",
        description: "全网多空持仓人数及持仓量比",
        iconKey: "longshort",
        defaultLayout: { w: 6, h: 3, minW: 6, minH: 3, maxW: 12, maxH: 16 },
        defaultConfig: { symbol: "BTC", window: "4h" },
        allowMultiple: true,
      },
      {
        type: "derivatives.orderbook_agg",
        title: "聚合挂单",
        description: "全网深度及订单流聚合分析",
        iconKey: "orderbook",
        defaultLayout: { w: 6, h: 6, minW: 6, minH: 3, maxW: 12, maxH: 16 },
        defaultConfig: { symbol: "BTCUSDT", marketType: "swap", depth: 10 },
        allowMultiple: true,
      },
      {
        type: "derivatives.open_interest_agg",
        title: "聚合持仓量",
        description: "全网合约总持仓量聚合",
        iconKey: "oi",
        defaultLayout: { w: 6, h: 6, minW: 6, minH: 3, maxW: 12, maxH: 16 },
        defaultConfig: { symbol: "BTC", window: "24h" },
        allowMultiple: true,
      },
      {
        type: "derivatives.volume_agg",
        title: "聚合成交量",
        description: "全网合约总成交量聚合",
        iconKey: "volume",
        defaultLayout: { w: 6, h: 3, minW: 6, minH: 3, maxW: 12, maxH: 16 },
        defaultConfig: { symbol: "BTC", window: "24h" },
        allowMultiple: true,
      },
    ],
  },
  {
    id: "liquidation",
    title: "爆仓数据",
    subtitle: "清算地图・聚合爆仓",
    items: [
      {
        type: "liquidation.map",
        title: "清算地图",
        description: "各交易所实时爆仓热力图数据",
        iconKey: "liqmap",
        defaultLayout: { w: 6, h: 6, minW: 6, minH: 3, maxW: 12, maxH: 16 },
        defaultConfig: { symbol: "BTC", scope: "ALL", range: "1D" },
        allowMultiple: true,
      },
      {
        type: "liquidation.feed",
        title: "聚合爆仓",
        description: "实时爆仓订单流推送",
        iconKey: "liqfeed",
        defaultLayout: { w: 6, h: 6, minW: 6, minH: 3, maxW: 12, maxH: 16 },
        defaultConfig: { symbol: "ALL", window: "4h" },
        allowMultiple: true,
      },
    ],
  },
];


