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

  @override
  Future<StrategyDetail> getStrategyDetail(String id) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    final StrategyCard card = await getDetail(id);
    final Random rng = Random(card.id.hashCode);
    // 派生 6 项指标。范围参考人类阅读直觉：
    //   收益率 -10%..+60%（短期可负 / 全期偏多头）
    //   maxDrawdown -50%..-2%（始终负值）
    //   sharpe 0.3..2.8
    //   winRate 0.35..0.85
    double pickReturn(double lo, double hi) =>
        lo + rng.nextDouble() * (hi - lo);
    final List<double> curve =
        List<double>.generate(60, (int _) => rng.nextDouble());
    return StrategyDetail(
      card: card,
      return7d: pickReturn(-10, 25),
      return30d: pickReturn(-5, 40),
      returnAll: pickReturn(-2, 60),
      maxDrawdown: -pickReturn(2, 50),
      sharpe: 0.3 + rng.nextDouble() * 2.5,
      winRate: 0.35 + rng.nextDouble() * 0.5,
      equityCurve: curve,
    );
  }

  @override
  Future<List<StrategySignal>> listStrategySignals(
    String id, {
    int limit = 20,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    final Random rng = Random(id.hashCode ^ 0x515);
    // 基准价：按 id 派生一个 100..50000 区间的"中枢价"，信号在中枢 ±5% 浮动。
    final double base = 100 + rng.nextDouble() * 49900;
    final DateTime now = DateTime.now();
    return List<StrategySignal>.generate(limit, (int i) {
      final bool buy = rng.nextBool();
      final double drift = (rng.nextDouble() - 0.5) * 0.10; // ±5%
      final double price = base * (1 + drift);
      final double pnl = (rng.nextDouble() - 0.4) * 12; // 偏正
      return StrategySignal(
        time: now.subtract(Duration(minutes: 15 * (i + 1))),
        side: buy ? StrategySignalSide.buy : StrategySignalSide.sell,
        price: price,
        pnlPercent: pnl,
      );
    });
  }
}
