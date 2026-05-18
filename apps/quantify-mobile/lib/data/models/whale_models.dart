/// 巨鲸事件。
class WhaleEvent {
  final String id;
  final String symbol;
  final double amountUsd;
  final String direction; // 'in' | 'out'
  final String fromLabel;
  final String toLabel;
  final DateTime timestamp;

  const WhaleEvent({
    required this.id,
    required this.symbol,
    required this.amountUsd,
    required this.direction,
    required this.fromLabel,
    required this.toLabel,
    required this.timestamp,
  });
}
