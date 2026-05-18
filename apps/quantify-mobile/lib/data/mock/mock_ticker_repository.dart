import 'dart:async';
import 'dart:math';

import '../models/ticker_models.dart';
import '../repositories/ticker_repository.dart';
import 'fixtures/tickers.dart';

class MockTickerRepository implements TickerRepository {
  @override
  Future<List<Ticker>> listTickers() async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    return mockTickers;
  }

  @override
  Stream<Ticker> watchTicker(String symbol) {
    final Ticker base = mockTickers.firstWhere(
      (Ticker t) => t.symbol == symbol,
      orElse: () => mockTickers.first,
    );
    final Random rng = Random(42);
    return Stream<Ticker>.periodic(const Duration(seconds: 1), (int _) {
      final double drift = (rng.nextDouble() - 0.5) * 0.004;
      return Ticker(
        symbol: base.symbol,
        price: base.price * (1 + drift),
        changePercent: base.changePercent + drift * 100,
        volume24h: base.volume24h,
      );
    });
  }
}
