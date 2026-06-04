import 'dart:async';

import '../models/orderbook_models.dart';
import '../repositories/orderbook_repository.dart';
import '../services/json_codec.dart';
import '../services/market_services.dart';

/// [OrderbookRepository] 真实现（issue #2189）。
///
/// `watchOrderbook` 后端暂无 WS 契约，用周期轮询取最新快照。
class ApiOrderbookRepository implements OrderbookRepository {
  ApiOrderbookRepository(this._service);

  final OrderbookService _service;

  List<OrderbookLevel> _levels(Object? raw) {
    return asList(raw).map((Object? e) {
      // 兼容两种形态：`[price, qty]` 数组或 `{price, quantity}` 对象。
      if (e is List && e.length >= 2) {
        return OrderbookLevel(price: asDouble(e[0]), quantity: asDouble(e[1]));
      }
      final Map<String, dynamic> m = asMap(e);
      return OrderbookLevel(
        price: asDouble(pick(m, <String>['price', 'p'])),
        quantity: asDouble(pick(m, <String>['quantity', 'qty', 'q'])),
      );
    }).toList(growable: false);
  }

  OrderbookSnapshot _parse(String symbol, dynamic raw) {
    final Map<String, dynamic> map = asMap(raw);
    return OrderbookSnapshot(
      symbol: asString(pick(map, <String>['symbol']), fallback: symbol),
      bids: _levels(pick(map, <String>['bids'])),
      asks: _levels(pick(map, <String>['asks'])),
      timestamp: asDateTime(pick(map, <String>['timestamp', 'ts'])),
    );
  }

  @override
  Future<OrderbookSnapshot> getSnapshot(String symbol) async {
    final dynamic raw = await _service.getSnapshot(symbol);
    return _parse(symbol, raw);
  }

  @override
  Stream<OrderbookSnapshot> watchOrderbook(String symbol) async* {
    Future<OrderbookSnapshot> fetch() async =>
        _parse(symbol, await _service.getSnapshot(symbol));

    yield await fetch();
    yield* Stream<void>.periodic(const Duration(seconds: 2))
        .asyncMap((_) => fetch());
  }
}
