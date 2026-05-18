/// 策略卡片。
class StrategyCard {
  final String id;
  final String name;
  final String description;
  final double pnlPercent;
  final int subscribers;
  final List<String> tags;

  const StrategyCard({
    required this.id,
    required this.name,
    required this.description,
    required this.pnlPercent,
    required this.subscribers,
    required this.tags,
  });
}
