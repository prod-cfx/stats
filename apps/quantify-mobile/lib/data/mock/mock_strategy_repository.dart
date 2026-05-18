import '../models/strategy_models.dart';
import '../repositories/strategy_repository.dart';
import 'fixtures/strategies.dart';

class MockStrategyRepository implements StrategyRepository {
  @override
  Future<List<StrategyCard>> listFeatured() async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    return mockFeaturedStrategies;
  }

  @override
  Future<List<StrategyCard>> listMine() async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    return mockMyStrategies;
  }

  @override
  Future<StrategyCard> getDetail(String id) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    return <StrategyCard>[...mockFeaturedStrategies, ...mockMyStrategies]
        .firstWhere(
      (StrategyCard s) => s.id == id,
      orElse: () => mockFeaturedStrategies.first,
    );
  }
}
