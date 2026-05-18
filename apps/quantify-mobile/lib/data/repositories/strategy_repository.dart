import '../models/strategy_models.dart';

/// 策略 Repository 接口。
abstract class StrategyRepository {
  Future<List<StrategyCard>> listFeatured();
  Future<List<StrategyCard>> listMine();
  Future<StrategyCard> getDetail(String id);
}
