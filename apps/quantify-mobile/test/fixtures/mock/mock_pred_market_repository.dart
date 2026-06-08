import 'package:quantify_mobile/data/models/pred_market_models.dart';
import 'package:quantify_mobile/data/repositories/pred_market_repository.dart';
import 'fixtures/pred_markets.dart';

class MockPredMarketRepository implements PredMarketRepository {
  const MockPredMarketRepository();

  @override
  Future<List<PredMarket>> listPredMarkets({
    int limit = 48,
    bool onlyActive = true,
    String? locale,
  }) async => kPredMarkets;
}
