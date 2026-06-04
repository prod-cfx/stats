import '../models/pred_market_models.dart';
import '../repositories/pred_market_repository.dart';
import 'fixtures/pred_markets.dart';

class MockPredMarketRepository implements PredMarketRepository {
  const MockPredMarketRepository();

  @override
  Future<List<PredMarket>> listPredMarkets() async => kPredMarkets;
}
