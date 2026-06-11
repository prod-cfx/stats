import 'dart:async';
import 'dart:math';

import 'package:quantify_mobile/data/models/ticker_models.dart';
import 'package:quantify_mobile/data/repositories/ticker_repository.dart';
import 'fixtures/tickers.dart';

class MockTickerRepository implements TickerRepository {
  @override
  Future<List<Ticker>> listTickers() async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    return mockTickers;
  }

  @override
  Future<Ticker?> getTicker({
    required String symbol,
    MarketKind kind = MarketKind.perp,
    String? exchange,
  }) async {
    final List<Ticker> tickers = await listTickers();
    for (final Ticker ticker in tickers) {
      if (ticker.symbol == symbol || ticker.symbol.startsWith(symbol)) {
        return ticker;
      }
    }
    return null;
  }

  @override
  Stream<Ticker> watchTicker(
    String symbol, {
    MarketKind kind = MarketKind.perp,
    String? exchange,
  }) {
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
