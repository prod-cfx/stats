import '../models/pred_market_models.dart';

/// 预测市场 Repository 接口（issue #2216）。
abstract class PredMarketRepository {
  Future<List<PredMarket>> listPredMarkets({
    int limit = 48,
    bool onlyActive = true,
    String? locale,
  });
}
