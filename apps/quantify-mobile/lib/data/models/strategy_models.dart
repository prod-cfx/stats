/// 策略分类（页面顶部 chip 切换用）。
enum StrategyCategory { all, highReturn, lowDrawdown, newListing }

/// 策略卡片元数据。
///
/// 保持 const 构造以便 fixtures 维持 `const List` 字面量。sparkline 数据**不**
/// 挂在此 model 上，由 [MockStrategyRepository] 在返回 [StrategyMarketItem] 时
/// 基于 `Random(id.hashCode)` 派生，避免破坏 const 约束。
class StrategyCard {
  final String id;
  final String name;
  final String description;
  final String author;
  final double pnlPercent;
  final int subscribers;
  final List<String> tags;
  final StrategyCategory category;

  const StrategyCard({
    required this.id,
    required this.name,
    required this.description,
    required this.author,
    required this.pnlPercent,
    required this.subscribers,
    required this.tags,
    required this.category,
  });
}

/// 策略广场列表项：卡片 + 运行时派生的 sparkline 序列。
///
/// 把 sparkline 拆出来是为了让 [StrategyCard] 仍是 const-friendly model（fixture
/// 字面量保持紧凑），同时让 mock 层有自由度按 id 生成确定性折线数据。
class StrategyMarketItem {
  final StrategyCard card;
  final List<double> sparkline;

  const StrategyMarketItem({required this.card, required this.sparkline});
}

/// 分页结果。
class StrategyMarketPage {
  final List<StrategyMarketItem> items;
  final bool hasMore;
  final int page;
  final int pageSize;

  const StrategyMarketPage({
    required this.items,
    required this.hasMore,
    required this.page,
    required this.pageSize,
  });
}
