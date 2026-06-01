/// 巨鲸事件。
class WhaleEvent {
  final String id;
  final String symbol;
  final double amountUsd;
  final String direction; // 'in' | 'out'
  final String fromLabel;
  final String toLabel;
  final DateTime timestamp;

  /// 该地址历史胜率，单位百分比（0–100）。实时 feed 行卡第 3 列展示并支持排序，
  /// 阈值着色：绿 ≥70 / 橙 ≥50 / 红 <50（issue #1983）。
  final double winRate;

  const WhaleEvent({
    required this.id,
    required this.symbol,
    required this.amountUsd,
    required this.direction,
    required this.fromLabel,
    required this.toLabel,
    required this.timestamp,
    required this.winRate,
  });
}
