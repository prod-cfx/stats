import 'dart:math';

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

  /// 派生确定性 sparkline：基于 id.hashCode seed，30 点 0..1 区间。
  ///
  /// 同一 id 多次调用结果一致，便于 widget golden 与肉眼 debug。
  static List<double> _sparklineFor(String id) {
    final Random rng = Random(id.hashCode);
    return List<double>.generate(30, (int _) => rng.nextDouble());
  }

  @override
  Future<StrategyMarketPage> listMarket({
    int page = 1,
    int pageSize = 10,
    String? query,
    StrategyCategory? category,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));

    final String? q = (query == null || query.trim().isEmpty)
        ? null
        : query.trim().toLowerCase();

    Iterable<StrategyCard> filtered = mockFeaturedStrategies;
    if (category != null && category != StrategyCategory.all) {
      filtered = filtered.where((StrategyCard s) => s.category == category);
    }
    if (q != null) {
      filtered = filtered.where((StrategyCard s) {
        if (s.name.toLowerCase().contains(q)) return true;
        if (s.author.toLowerCase().contains(q)) return true;
        for (final String t in s.tags) {
          if (t.toLowerCase().contains(q)) return true;
        }
        return false;
      });
    }
    final List<StrategyCard> all = filtered.toList();
    final int start = (page - 1) * pageSize;
    final int end = (start + pageSize) > all.length ? all.length : start + pageSize;
    final List<StrategyCard> pageItems = start >= all.length
        ? const <StrategyCard>[]
        : all.sublist(start, end);
    final List<StrategyMarketItem> items = pageItems
        .map((StrategyCard c) =>
            StrategyMarketItem(card: c, sparkline: _sparklineFor(c.id)))
        .toList();
    return StrategyMarketPage(
      items: items,
      hasMore: end < all.length,
      page: page,
      pageSize: pageSize,
    );
  }
}
