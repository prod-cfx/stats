import '../mock/fixtures/exchange_long_short.dart';
import '../models/exchange_long_short_models.dart';
import '../models/kline_models.dart';
import '../models/long_short_models.dart';
import '../repositories/long_short_repository.dart';
import '../services/json_codec.dart';
import '../services/market_services.dart';
import 'api_kline_repository.dart';

/// [LongShortRepository] 真实现（issue #2189）。
///
/// [LongShortRatio] 字段简单，直接 JSON 反序列化。
/// [MarketLongShortSnapshot] 含纯展示字段（交易所色标/glyph/渐变色），后端
/// 不提供这些 UI 资产——故以 [fallbackSnapshot] 提供展示骨架，再用 JSON 中的
/// long/short 占比覆盖 hero 数值。真实交易所明细的展示映射属子 issue B。
class ApiLongShortRepository implements LongShortRepository {
  ApiLongShortRepository(this._service);

  final LongShortService _service;

  @override
  Future<LongShortRatio> getRatio({
    required String symbol,
    required KlineInterval interval,
  }) async {
    final dynamic raw = await _service.getRatio(
      symbol: symbol,
      interval: klineIntervalToApi(interval),
    );
    final Map<String, dynamic> map = asMap(raw);
    return LongShortRatio(
      symbol: asString(pick(map, <String>['symbol']), fallback: symbol),
      longRatio: asDouble(pick(map, <String>['longRatio', 'long']), fallback: 0.5),
      shortRatio:
          asDouble(pick(map, <String>['shortRatio', 'short']), fallback: 0.5),
      timestamp: asDateTime(pick(map, <String>['timestamp', 'ts'])),
    );
  }

  @override
  Future<MarketLongShortSnapshot> getSnapshot({required String symbol}) async {
    final dynamic raw = await _service.getSnapshot(symbol: symbol);
    final Map<String, dynamic> map = asMap(raw);
    final MarketLongShortSnapshot base = fallbackSnapshot(symbol);
    final double? longPct = asDoubleOrNull(pick(map, <String>['longPct', 'long']));
    final double? shortPct =
        asDoubleOrNull(pick(map, <String>['shortPct', 'short']));
    if (longPct == null && shortPct == null) return base;
    final double l = longPct ?? (100 - (shortPct ?? 0));
    return MarketLongShortSnapshot(
      symbol: base.symbol,
      baseAsset: base.baseAsset,
      assetGlyph: base.assetGlyph,
      assetGradientStart: base.assetGradientStart,
      assetGradientEnd: base.assetGradientEnd,
      totalNotional: base.totalNotional,
      longNotional: base.longNotional,
      shortNotional: base.shortNotional,
      longPct: l,
      shortPct: 100 - l,
      exchanges: base.exchanges,
      timestamp: asDateTime(
        pick(map, <String>['timestamp', 'ts']),
        fallback: base.timestamp,
      ),
    );
  }
}
