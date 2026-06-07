import 'package:flutter/material.dart';

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
/// [MarketLongShortSnapshot] 含纯展示字段（交易所色标/glyph/渐变色）。真实响应
/// 缺字段时返回空态，不回退 mock fixture。
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
      longRatio: asDouble(
        pick(map, <String>['longRatio', 'long']),
        fallback: 0.5,
      ),
      shortRatio: asDouble(
        pick(map, <String>['shortRatio', 'short']),
        fallback: 0.5,
      ),
      timestamp: asDateTime(pick(map, <String>['timestamp', 'ts'])),
    );
  }

  @override
  Future<MarketLongShortSnapshot> getSnapshot({required String symbol}) async {
    final dynamic raw = await _service.getSnapshot(symbol: symbol);
    final Map<String, dynamic> map = asMap(raw);
    final MarketLongShortSnapshot base = _emptySnapshot(symbol);
    final double? longPct = asDoubleOrNull(
      pick(map, <String>['longPct', 'long']),
    );
    final double? shortPct = asDoubleOrNull(
      pick(map, <String>['shortPct', 'short']),
    );
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

MarketLongShortSnapshot _emptySnapshot(String symbol) {
  final String baseAsset = symbol.replaceAll('USDT', '');
  return MarketLongShortSnapshot(
    symbol: symbol,
    baseAsset: baseAsset.isEmpty ? symbol : baseAsset,
    assetGlyph: baseAsset.isEmpty ? '?' : baseAsset.substring(0, 1),
    assetGradientStart: const Color(0xFF6B7280),
    assetGradientEnd: const Color(0xFF374151),
    totalNotional: '\$0',
    longNotional: '\$0',
    shortNotional: '\$0',
    longPct: 0,
    shortPct: 0,
    exchanges: const <ExchangeLongShort>[],
    timestamp: DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
  );
}
