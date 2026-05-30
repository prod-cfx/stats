/// 巨鲸「持仓」tab 持仓明细模型（issue #1790）。
///
/// 对齐设计稿 `WhaleHoldings`（`WHALE_HOLDINGS`）：展示串与排序数值并存——
/// 展示字段保持已格式化字符串（沿用 mock fixture 约定，如 `valueDisplay:
/// '$1.55亿'`），额外携带数值字段（[value]/[pnl]/[margin]/[hoursAgo]）供
/// 筛选与排序在 tab 本地态即时完成。
library;

/// 持仓方向。
enum WhaleHoldingSide { long, short }

/// 单条巨鲸持仓明细卡。
class WhaleHoldingPosition {
  const WhaleHoldingPosition({
    required this.address,
    required this.symbol,
    required this.symbolColorHex,
    required this.mode,
    required this.side,
    required this.leverage,
    required this.value,
    required this.valueDisplay,
    required this.qtyDisplay,
    required this.pnl,
    required this.pnlDisplay,
    required this.pnlPctDisplay,
    required this.margin,
    required this.marginDisplay,
    required this.openDisplay,
    required this.liqDisplay,
    required this.liqBreached,
    required this.hoursAgo,
    required this.timeDisplay,
  });

  final String address; // 缩写地址，如 '0xa5b0…1d41'
  final String symbol; // BTC / ETH / HYPE ...
  final int symbolColorHex; // 币种圆点色
  final String mode; // 全仓 / 逐仓
  final WhaleHoldingSide side;
  final int leverage; // 杠杆倍数
  final double value; // 持仓价值（排序用数值）
  final String valueDisplay; // 如 '$1.55亿'
  final String qtyDisplay; // 如 '70000.67 ETH'
  final double pnl; // 未实现盈亏（排序用数值，可负）
  final String pnlDisplay; // 如 '+$439.57万'
  final String pnlPctDisplay; // 如 '+42.59%'
  final double margin; // 保证金（排序用数值）
  final String marginDisplay; // 如 '$1548.06万'
  final String openDisplay; // 开盘价，如 '2148.70'
  final String liqDisplay; // 清算价，如 '1631.15'
  final bool liqBreached; // 清算价是否处于危险侧（红色高亮）
  final int hoursAgo; // 创建时间数值（排序用）
  final String timeDisplay; // 如 '1120 小时前'

  bool get isLong => side == WhaleHoldingSide.long;
  bool get isProfit => pnl >= 0;
}

/// 方向筛选。[all] 表示不过滤方向。
enum WhaleHoldingDirFilter { all, long, short }

/// 盈亏筛选。[all] 表示不过滤盈亏。
enum WhaleHoldingPnlFilter { all, profit, loss }

/// 排序字段。
enum WhaleHoldingSortKey { value, margin, time }

/// 排序方向。
enum WhaleHoldingSortDir { desc, asc }

/// 排序态值对象。null（调用方持有）表示不排序、保持原序。
class WhaleHoldingSort {
  const WhaleHoldingSort({required this.key, required this.dir});

  final WhaleHoldingSortKey key;
  final WhaleHoldingSortDir dir;

  @override
  bool operator ==(Object other) =>
      other is WhaleHoldingSort && other.key == key && other.dir == dir;

  @override
  int get hashCode => Object.hash(key, dir);
}

/// 持仓筛选态。[coin] 为 null 表示全部币种。
class WhaleHoldingFilter {
  const WhaleHoldingFilter({
    this.coin,
    this.dir = WhaleHoldingDirFilter.all,
    this.pnl = WhaleHoldingPnlFilter.all,
  });

  final String? coin; // null = 全部
  final WhaleHoldingDirFilter dir;
  final WhaleHoldingPnlFilter pnl;

  WhaleHoldingFilter copyWith({
    Object? coin = _noCoin,
    WhaleHoldingDirFilter? dir,
    WhaleHoldingPnlFilter? pnl,
  }) {
    return WhaleHoldingFilter(
      coin: identical(coin, _noCoin) ? this.coin : coin as String?,
      dir: dir ?? this.dir,
      pnl: pnl ?? this.pnl,
    );
  }

  static const Object _noCoin = Object();
}

/// 筛选纯函数：依次按币种 / 方向 / 盈亏过滤，不修改入参。
List<WhaleHoldingPosition> filterWhaleHoldings(
  List<WhaleHoldingPosition> entries,
  WhaleHoldingFilter filter,
) {
  return entries.where((WhaleHoldingPosition e) {
    if (filter.coin != null && e.symbol != filter.coin) return false;
    switch (filter.dir) {
      case WhaleHoldingDirFilter.long:
        if (!e.isLong) return false;
      case WhaleHoldingDirFilter.short:
        if (e.isLong) return false;
      case WhaleHoldingDirFilter.all:
        break;
    }
    switch (filter.pnl) {
      case WhaleHoldingPnlFilter.profit:
        if (!e.isProfit) return false;
      case WhaleHoldingPnlFilter.loss:
        if (e.isProfit) return false;
      case WhaleHoldingPnlFilter.all:
        break;
    }
    return true;
  }).toList(growable: false);
}

/// 排序纯函数。[sort] 为 null 返回原序副本；否则按字段数值与方向重排，
/// 不修改入参。
List<WhaleHoldingPosition> sortWhaleHoldings(
  List<WhaleHoldingPosition> entries,
  WhaleHoldingSort? sort,
) {
  final List<WhaleHoldingPosition> result = List<WhaleHoldingPosition>.of(entries);
  if (sort == null) return result;
  final int mul = sort.dir == WhaleHoldingSortDir.asc ? 1 : -1;
  double value(WhaleHoldingPosition e) {
    switch (sort.key) {
      case WhaleHoldingSortKey.value:
        return e.value;
      case WhaleHoldingSortKey.margin:
        return e.margin;
      case WhaleHoldingSortKey.time:
        return e.hoursAgo.toDouble();
    }
  }

  result.sort((WhaleHoldingPosition a, WhaleHoldingPosition b) =>
      mul * value(a).compareTo(value(b)));
  return result;
}

/// 当前持仓集合中出现过的币种（保持首次出现顺序），供币种筛选 chip 渲染。
List<String> whaleHoldingCoins(List<WhaleHoldingPosition> entries) {
  final List<String> coins = <String>[];
  for (final WhaleHoldingPosition e in entries) {
    if (!coins.contains(e.symbol)) coins.add(e.symbol);
  }
  return coins;
}
