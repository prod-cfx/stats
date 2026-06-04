import 'dart:async';

import '../models/ticker_models.dart';
import '../repositories/ticker_repository.dart';
import '../services/json_codec.dart';
import '../services/market_services.dart';

/// [TickerRepository] 真实现（issue #2189）。
///
/// `watchTicker` 后端暂无 WS 契约，用 [Stream.periodic] 周期轮询 Service 拉取
/// 最新快照（真实 HTTP，非 mock 抖动），订阅取消时 timer 自动释放。
class ApiTickerRepository implements TickerRepository {
  ApiTickerRepository(this._service);

  final TickerService _service;

  Ticker _parse(Map<String, dynamic> map) => Ticker.fromMap(map);

  @override
  Future<List<Ticker>> listTickers() async {
    final dynamic raw = await _service.listTickers();
    final Object? list = raw is Map ? pick(asMap(raw), <String>['items', 'data']) : raw;
    return asMapList(list ?? raw).map(_parse).toList(growable: false);
  }

  @override
  Stream<Ticker> watchTicker(String symbol) async* {
    Future<Ticker> fetchOne() async {
      final dynamic raw = await _service.getTicker(symbol);
      return _parse(asMap(raw));
    }

    yield await fetchOne();
    yield* Stream<void>.periodic(const Duration(seconds: 2))
        .asyncMap((_) => fetchOne());
  }
}
