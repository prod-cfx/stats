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

  /// 派生 4 格指标：cagr / sharpe / 最大回撤 / 胜率 / 使用人数。
  ///
  /// 与 [getStrategyDetail] 的指标语义保持一致，但范围适配卡片列表更紧凑
  /// 的显示：cagr 跟随 [StrategyCard.pnlPercent] 量级，winRate 用 0..1。
  static StrategyMarketStats _statsFor(StrategyCard c) {
    final Random rng = Random(c.id.hashCode ^ 0x1A2B);
    final double sharpe = 0.6 + rng.nextDouble() * 2.6; // 0.6..3.2
    // 套利 / 对冲类策略回撤偏小，其他类（趋势 / 网格 / 反转 / 高频）回撤偏大。
    final bool lowVol = c.category == StrategyCategory.arbitrage ||
        c.category == StrategyCategory.hedge;
    final double mddBase = lowVol ? 3 : 10;
    final double mddSpan = lowVol ? 6 : 20;
    final double winRate = 0.42 + rng.nextDouble() * 0.45; // 0.42..0.87
    return StrategyMarketStats(
      cagr: c.pnlPercent,
      sharpe: sharpe,
      maxDrawdown: -(mddBase + rng.nextDouble() * mddSpan),
      winRate: winRate,
      users: c.subscribers,
    );
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
        .map((StrategyCard c) => StrategyMarketItem(
              card: c,
              sparkline: _sparklineFor(c.id),
              stats: _statsFor(c),
            ))
        .toList();
    return StrategyMarketPage(
      items: items,
      hasMore: end < all.length,
      page: page,
      pageSize: pageSize,
    );
  }

  @override
  Future<StrategyMarketItem> getFeaturedHero() async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    // 优先取 official 标记的策略，否则 fallback 第一条
    final StrategyCard hero = mockFeaturedStrategies.firstWhere(
      (StrategyCard s) => s.status == StrategyStatusBadge.official,
      orElse: () => mockFeaturedStrategies.first,
    );
    return StrategyMarketItem(
      card: hero,
      sparkline: _sparklineFor(hero.id),
      stats: _statsFor(hero),
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

  @override
  Future<List<double>> getEquityCurve(
    String id,
    EquityTimeframe timeframe,
  ) async {
    await Future<void>.delayed(const Duration(milliseconds: 120));
    // 不同 timeframe 用不同 salt，确保切换 tab 时曲线形状真的会变。
    final int salt = switch (timeframe) {
      EquityTimeframe.d7 => 0x07,
      EquityTimeframe.d30 => 0x1E,
      EquityTimeframe.d90 => 0x5A,
      EquityTimeframe.y1 => 0x365,
    };
    final Random rng = Random(id.hashCode ^ salt);
    // 模拟一段累积收益曲线：从 1.0 起步，每步 ±1.5% 漂移，保留趋势性。
    final List<double> points = <double>[];
    double v = 1.0;
    for (int i = 0; i < 60; i++) {
      final double step = (rng.nextDouble() - 0.45) * 0.03;
      v = (v + step).clamp(0.6, 1.8);
      points.add(v);
    }
    return points;
  }
}
