import '../models/ticker_models.dart';

/// 行情 Repository 接口。
abstract class TickerRepository {
  Future<List<Ticker>> listTickers();

  Future<Ticker?> getTicker({
    required String symbol,
    MarketKind kind = MarketKind.perp,
    String? exchange,
  });

  Stream<Ticker> watchTicker(
    String symbol, {
    MarketKind kind = MarketKind.perp,
    String? exchange,
  });
}
