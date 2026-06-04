import '../models/agg_market_data.dart';

/// 聚合市场数据 Repository 接口（issue #2216）。
///
/// 单一入口提供「聚合挂单 / 持仓量 / 成交量」原始数据 bundle；4 个 `agg_*`
/// widget 经 `aggOrderbookProvider` 统一消费。本 Issue 仅提供原始 levels，
/// 派生留 widget（C4 #2218）。
abstract class AggOrderbookRepository {
  Future<AggMarketData> getMarketData();
}
