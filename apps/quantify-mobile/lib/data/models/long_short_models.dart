/// 多空比。
class LongShortRatio {
  final String symbol;
  final double longRatio;
  final double shortRatio;
  final DateTime timestamp;

  const LongShortRatio({
    required this.symbol,
    required this.longRatio,
    required this.shortRatio,
    required this.timestamp,
  });
}
