import 'package:quantify_mobile/data/models/trade_models.dart';
import 'package:quantify_mobile/data/repositories/trades_repository.dart';
import 'fixtures/trades.dart';

class MockTradesRepository implements TradesRepository {
  const MockTradesRepository();

  @override
  Future<List<Trade>> listTrades({
    required String symbol,
    required double mid,
  }) async {
    return buildMockTrades(symbol: symbol, mid: mid);
  }
}
