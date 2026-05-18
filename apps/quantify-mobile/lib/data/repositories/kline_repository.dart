import '../models/kline_models.dart';

/// K 线 Repository 接口。
abstract class KlineRepository {
  Future<List<Candle>> listCandles({
    required String symbol,
    required KlineInterval interval,
    required int limit,
  });

  Stream<Candle> watchCandles({
    required String symbol,
    required KlineInterval interval,
  });
}
