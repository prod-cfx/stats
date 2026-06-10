import '../models/agg_market_data.dart';

/// 聚合市场请求参数。
class AggMarketRequest {
  const AggMarketRequest({required this.base, required this.type});

  const AggMarketRequest.defaultMarket() : base = 'BTC', type = 'perp';

  final String base;
  final String type;

  String get normalizedBase => base.trim().toUpperCase();

  String get normalizedType => type.trim().toLowerCase();

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is AggMarketRequest &&
          runtimeType == other.runtimeType &&
          normalizedBase == other.normalizedBase &&
          normalizedType == other.normalizedType;

  @override
  int get hashCode => Object.hash(normalizedBase, normalizedType);
}

/// 聚合市场数据 Repository 接口（issue #2216）。
///
/// 单一入口提供「聚合挂单 / 持仓量 / 成交量」原始数据 bundle；4 个 `agg_*`
/// widget 经 `aggOrderbookProvider` 统一消费。本 Issue 仅提供原始 levels，
/// 派生留 widget（C4 #2218）。
abstract class AggOrderbookRepository {
  Future<AggMarketData> getMarketData({
    AggMarketRequest request = const AggMarketRequest.defaultMarket(),
  });
}
