import 'package:flutter/painting.dart';

import 'agg_orders_models.dart';

export 'agg_orders_models.dart';

/// 聚合市场数据 bundle（issue #2216）。
///
/// 单一领域聚合模型，承载「聚合挂单 / 持仓量 / 成交量」三块原始 mock 数据，
/// 由 `aggOrderbookProvider` 暴露给 4 个 `agg_*` widget 统一消费。本 Issue 仅
/// 提供**原始/未派生**的盘口 levels 与各表静态数据；过滤/聚合派生留 widget
/// 层（C4 #2218 由 Controller 收口上移）。
class AggMarketData {
  const AggMarketData({
    required this.exchanges,
    required this.exchangeMap,
    required this.precisions,
    required this.asks,
    required this.bids,
    required this.oiCoins,
    required this.oiExchangeMap,
    required this.oiData,
    required this.volCoins,
    required this.volExchangeName,
    required this.volColor,
    required this.volData,
    required this.coinColor,
  });

  /// 订单簿来源交易所（默认全选）。
  final List<AggExchange> exchanges;

  /// 订单簿交易所映射（按 key 索引，book 行头像查询）。
  final Map<String, AggExchange> exchangeMap;

  /// 订单簿价格精度档位。
  final List<int> precisions;

  /// 原始卖盘 levels（未过滤/未聚合）。
  final List<AggBookLevel> asks;

  /// 原始买盘 levels（未过滤/未聚合）。
  final List<AggBookLevel> bids;

  /// 持仓量币种 chips。
  final List<String> oiCoins;

  /// 持仓量表交易所元数据。
  final Map<String, AggExchange> oiExchangeMap;

  /// 持仓量数据（按币种）。
  final Map<String, OiSnapshot> oiData;

  /// 成交量币种 chips。
  final List<String> volCoins;

  /// 成交量交易所名称映射。
  final Map<String, String> volExchangeName;

  /// 成交量横条配色。
  final Map<String, Color> volColor;

  /// 成交量数据（按币种）。
  final Map<String, VolSnapshot> volData;

  /// 币种 chip 配色（搜索结果头像）。
  final Map<String, Color> coinColor;
}
