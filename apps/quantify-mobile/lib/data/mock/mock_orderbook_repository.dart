import 'dart:async';

import '../models/orderbook_models.dart';
import '../models/ticker_models.dart';
import '../repositories/orderbook_repository.dart';
import 'fixtures/orderbook.dart';
import 'fixtures/tickers.dart';

class MockOrderbookRepository implements OrderbookRepository {
  double _midOf(String symbol) {
    final Ticker base = mockTickers.firstWhere(
      (Ticker t) => t.symbol == symbol,
      orElse: () => mockTickers.first,
    );
    return base.price;
  }

  @override
  Future<OrderbookSnapshot> getSnapshot(String symbol) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    return buildMockOrderbook(
      symbol: symbol,
      mid: _midOf(symbol),
      timestamp: DateTime.fromMillisecondsSinceEpoch(1_716_000_000_000),
    );
  }

  /// 每秒推一份新快照（mid 不变，仅数量与时间戳更新）。
  @override
  Stream<OrderbookSnapshot> watchOrderbook(String symbol) {
    final double mid = _midOf(symbol);
    return Stream<OrderbookSnapshot>.periodic(
      const Duration(seconds: 1),
      (int tick) => buildMockOrderbook(
        symbol: symbol,
        mid: mid,
        quantityOffset: (tick % 10) * 0.01,
        timestamp:
            DateTime.fromMillisecondsSinceEpoch(1_716_000_000_000 + tick * 1000),
      ),
    );
  }
}
