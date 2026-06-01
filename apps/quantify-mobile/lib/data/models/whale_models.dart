/// 巨鲸事件。
///
/// issue #1985：在原「资金流 in/out 事件」字段之上，叠加「逐笔持仓推送卡」所需的
/// 持仓维度字段。除 `winRate`（issue #1983 已设为必填）外，其余持仓字段均为可选
/// （nullable / 带默认值），保证旧调用方与旧测试零改动通过——`amountUsd` 仍用于
/// 阈值过滤、`symbol` 仍用于分组、`winRate` 仍用于行卡胜率列与排序。
class WhaleEvent {
  final String id;
  final String symbol;
  final double amountUsd;
  final String direction; // 'in' | 'out'
  final String fromLabel;
  final String toLabel;
  final DateTime timestamp;

  /// 该地址历史胜率，单位百分比（0–100）。实时 feed 行卡胜率列展示并支持排序，
  /// 阈值着色：绿 ≥70 / 橙 ≥50 / 红 <50（issue #1983 / #1985）。
  final double winRate;

  // ── 逐笔持仓推送卡字段（issue #1985，除 winRate 外全部可选）──────────────
  /// 交易地址（脱敏展示，如 `0x95…c60a`）。
  final String? address;

  /// 商人 / 交易风格标签（如 `波段交易者`、`趋势跟踪`）。
  final String? traderTag;

  /// 新单标记：true 时行内渲染脉冲圆点。
  final bool isFresh;

  /// 仓位模式（`全仓` / `逐仓`）。
  final String? mode;

  /// 方向（`long` / `short`）。
  final String? side;

  /// 杠杆倍数；null 时 UI 显示 `--`。
  final int? leverage;

  /// 持仓价值（USD）。
  final double? positionValue;

  /// 数量展示串（如 `0.3000 BTC`）。
  final String? quantity;

  /// 开盘价格。
  final double? openPrice;

  const WhaleEvent({
    required this.id,
    required this.symbol,
    required this.amountUsd,
    required this.direction,
    required this.fromLabel,
    required this.toLabel,
    required this.timestamp,
    required this.winRate,
    this.address,
    this.traderTag,
    this.isFresh = false,
    this.mode,
    this.side,
    this.leverage,
    this.positionValue,
    this.quantity,
    this.openPrice,
  });
}
