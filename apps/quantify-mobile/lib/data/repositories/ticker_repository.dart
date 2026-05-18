import '../models/ticker_models.dart';

/// 行情 Repository 接口。
abstract class TickerRepository {
  Future<List<Ticker>> listTickers();
  Stream<Ticker> watchTicker(String symbol);
}
