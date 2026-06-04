import 'dart:async';

import '../models/kline_models.dart';
import '../repositories/kline_repository.dart';
import '../services/json_codec.dart';
import '../services/market_services.dart';

/// [KlineInterval] -> 后端 interval 串（占位约定）。
String klineIntervalToApi(KlineInterval interval) {
  switch (interval) {
    case KlineInterval.m1:
      return '1m';
    case KlineInterval.m5:
      return '5m';
    case KlineInterval.m15:
      return '15m';
    case KlineInterval.h1:
      return '1h';
    case KlineInterval.h4:
      return '4h';
    case KlineInterval.d1:
      return '1d';
  }
}

/// [KlineRepository] 真实现（issue #2189）。
///
/// `watchCandles` 后端暂无 WS 契约，用周期轮询取最后一根。
class ApiKlineRepository implements KlineRepository {
  ApiKlineRepository(this._service);

  final KlineService _service;

  List<Candle> _parseList(dynamic raw) {
    final Object? list =
        raw is Map ? pick(asMap(raw), <String>['items', 'data', 'candles']) : raw;
    return asMapList(list ?? raw).map(Candle.fromMap).toList(growable: false);
  }

  @override
  Future<List<Candle>> listCandles({
    required String symbol,
    required KlineInterval interval,
    required int limit,
  }) async {
    final dynamic raw = await _service.listCandles(
      symbol: symbol,
      interval: klineIntervalToApi(interval),
      limit: limit,
    );
    return _parseList(raw);
  }

  @override
  Stream<Candle> watchCandles({
    required String symbol,
    required KlineInterval interval,
  }) async* {
    Future<Candle?> fetchLast() async {
      final dynamic raw = await _service.listCandles(
        symbol: symbol,
        interval: klineIntervalToApi(interval),
        limit: 1,
      );
      final List<Candle> list = _parseList(raw);
      return list.isEmpty ? null : list.last;
    }

    final Candle? first = await fetchLast();
    if (first != null) yield first;
    yield* Stream<void>.periodic(const Duration(seconds: 2))
        .asyncMap((_) => fetchLast())
        .where((Candle? c) => c != null)
        .cast<Candle>();
  }
}
