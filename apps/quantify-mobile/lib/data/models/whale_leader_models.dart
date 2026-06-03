/// 巨鲸「发现」tab 排行榜模型（issue #1789）。
///
/// 对齐设计稿 `WhaleDiscoverNew`（`WHALE_PROFILES`）：展示串与排序数值并存——
/// 展示字段保持已格式化字符串（沿用 mock fixture 约定），额外携带数值字段
/// （[aumValue]/[pnlValue]/[winRate]）供排序条即时重排。
library;

import 'whale_profile_models.dart';

/// 排行榜单条。top3（带 [avatarText]）渲染为轮播 hero 卡，其余为列表卡。
class WhaleLeaderEntry {
  const WhaleLeaderEntry({
    required this.id,
    required this.aumDisplay,
    required this.aumValue,
    required this.pnlDisplay,
    required this.pnlValue,
    required this.pnlPositive,
    required this.trades,
    required this.positions,
    required this.winRate,
    required this.tags,
    this.avatarText,
    this.avatarBgHex,
    this.avatarTextHex,
    this.tier,
  });

  final String id; // 缩写地址，如 '0x8ba1...ba72'
  final String? avatarText; // 头像徽章文字（仅 top3），null 表示非 top3
  final int? avatarBgHex; // 头像背景色（仅 top3）
  final int? avatarTextHex; // 头像文字色（仅 top3）
  final String? tier; // 如 '$100M+ HYPERUNIT WHALE'
  final String aumDisplay; // 如 '$1.29亿'
  final double aumValue; // 排序用数值
  final String pnlDisplay; // 如 '+$1028万'
  final double pnlValue; // 排序用数值（可负）
  final bool pnlPositive;
  final int trades;
  final int positions;
  final double winRate; // 如 73.81
  final List<String> tags; // AI 标签
}

/// 排序字段。
enum WhaleLeaderSortKey { winRate, aum, pnl }

/// 排序方向。
enum WhaleLeaderSortDir { desc, asc }

/// 排序态值对象。null（调用方持有）表示不排序、保持原序。
class WhaleLeaderSort {
  const WhaleLeaderSort({required this.key, required this.dir});

  final WhaleLeaderSortKey key;
  final WhaleLeaderSortDir dir;

  @override
  bool operator ==(Object other) =>
      other is WhaleLeaderSort && other.key == key && other.dir == dir;

  @override
  int get hashCode => Object.hash(key, dir);
}

/// 排序纯函数。[sort] 为 null 返回原序副本；否则按字段数值与方向重排，
/// 不修改入参。
List<WhaleLeaderEntry> sortWhaleLeaders(
  List<WhaleLeaderEntry> entries,
  WhaleLeaderSort? sort,
) {
  final List<WhaleLeaderEntry> result = List<WhaleLeaderEntry>.of(entries);
  if (sort == null) return result;
  final int mul = sort.dir == WhaleLeaderSortDir.asc ? 1 : -1;
  double value(WhaleLeaderEntry e) {
    switch (sort.key) {
      case WhaleLeaderSortKey.winRate:
        return e.winRate;
      case WhaleLeaderSortKey.aum:
        return e.aumValue;
      case WhaleLeaderSortKey.pnl:
        return e.pnlValue;
    }
  }

  result.sort(
    (WhaleLeaderEntry a, WhaleLeaderEntry b) =>
        mul * value(a).compareTo(value(b)),
  );
  return result;
}

/// 由排行榜条目派生交易统计入参（issue #1860 卡片「交易统计」入口）。
///
/// [WhaleTradeStatsSheet] 已与 `WhaleProfile` 解耦，只需 address + stats。发现卡
/// 仅持有排行榜聚合指标（盈亏/胜率/交易数），无逐资产/逐仓位明细，故派生一个
/// 轻量 stats：复用已有展示串，明细列表留空（mock 阶段）。真实读路径（#1682）
/// 接通后改为按地址拉取完整 stats。
WhaleTradeStats whaleLeaderTradeStats(WhaleLeaderEntry e) {
  final int wins = (e.trades * (e.winRate / 100)).round();
  return WhaleTradeStats(
    pnlDisplay: e.pnlDisplay,
    pnlTone: e.pnlPositive ? 'up' : 'dn',
    winRatePct: e.winRate,
    realizedDisplay: e.pnlDisplay,
    unrealizedDisplay: '—',
    longPct: 50,
    shortPct: 50,
    assetPerf: _designAssetPerf,
    positionPerf: _designPositionPerf,
    closedPnlDisplay: e.pnlDisplay,
    feeAdjustedPnlDisplay: _feeAdjustedDisplay(e.pnlDisplay),
    tradesTotal: e.trades,
    wins: wins,
    losses: e.trades - wins,
  );
}

String _feeAdjustedDisplay(String pnlDisplay) {
  final RegExpMatch? m = RegExp(
    r'^([+-]?\$)([0-9]+(?:\.[0-9]+)?)(万)$',
  ).firstMatch(pnlDisplay);
  if (m == null) return pnlDisplay;
  final double raw = double.parse(m.group(2)!);
  final double adjusted = raw * 0.96;
  final String fixed = adjusted.toStringAsFixed(2);
  return '${m.group(1)}$fixed${m.group(3)}';
}

const List<WhaleAssetPerf> _designAssetPerf = <WhaleAssetPerf>[
  WhaleAssetPerf(
    symbol: 'ZEC',
    pctDisplay: '+\$181,101.72',
    tone: 'up',
    glyph: 'Z',
    colorHex: 0xFFECB244,
    tradeCount: 2,
    positive: true,
    pnlDisplay: '181,101.72',
    feeDisplay: '3,710.62',
  ),
  WhaleAssetPerf(
    symbol: 'LIT',
    pctDisplay: '+\$127,982.60',
    tone: 'up',
    glyph: 'L',
    colorHex: 0xFFA855F7,
    tradeCount: 2,
    positive: true,
    pnlDisplay: '127,982.60',
    feeDisplay: '935.49',
  ),
  WhaleAssetPerf(
    symbol: 'ONDO',
    pctDisplay: '+\$46,312.41',
    tone: 'up',
    glyph: 'O',
    colorHex: 0xFFE0537B,
    tradeCount: 1,
    positive: true,
    pnlDisplay: '46,312.41',
    feeDisplay: '309.18',
  ),
  WhaleAssetPerf(
    symbol: 'LTC',
    pctDisplay: '+\$5,335.46',
    tone: 'up',
    glyph: 'L',
    colorHex: 0xFFB6B6BE,
    tradeCount: 1,
    positive: true,
    pnlDisplay: '5,335.46',
    feeDisplay: '311.53',
  ),
  WhaleAssetPerf(
    symbol: 'BRENTOIL',
    pctDisplay: '-\$496.25',
    tone: 'dn',
    glyph: 'X',
    colorHex: 0xFF7C5CFF,
    tradeCount: 1,
    positive: false,
    pnlDisplay: '496.25',
    feeDisplay: '24.13',
  ),
  WhaleAssetPerf(
    symbol: 'XMR',
    pctDisplay: '-\$1,707.61',
    tone: 'dn',
    glyph: 'M',
    colorHex: 0xFFFF6600,
    tradeCount: 1,
    positive: false,
    pnlDisplay: '1,707.61',
    feeDisplay: '142.80',
  ),
];

const List<WhalePositionPerf> _designPositionPerf = <WhalePositionPerf>[
  WhalePositionPerf(
    sym: 'XMR',
    glyph: 'M',
    colorHex: 0xFFFF6600,
    side: '做空',
    timeDisplay: '8 小时前',
    positive: true,
    pnlDisplay: '5,005.31',
    sizeDisplay: '0.41 XMR',
    feeDisplay: '25.03',
  ),
  WhalePositionPerf(
    sym: 'TSLA',
    label: 'xyz:TSLA',
    glyph: 'X',
    colorHex: 0xFF7C5CFF,
    side: '做空',
    timeDisplay: '约 1 天前',
    positive: false,
    pnlDisplay: '63,798.34',
    sizeDisplay: '1.00 xyz:TSLA',
    feeDisplay: '230.10',
  ),
  WhalePositionPerf(
    sym: 'BTC',
    glyph: 'B',
    colorHex: 0xFFF7931A,
    side: '做空',
    timeDisplay: '约 1 天前',
    positive: true,
    pnlDisplay: '580,461.17',
    sizeDisplay: '0.04 BTC',
    feeDisplay: '6,237.42',
  ),
  WhalePositionPerf(
    sym: 'CL',
    label: 'xyz:CL',
    glyph: 'X',
    colorHex: 0xFFE0537B,
    side: '做空',
    timeDisplay: '约 2 天前',
    positive: true,
    pnlDisplay: '945,883.29',
    sizeDisplay: '0.10 xyz:CL',
    feeDisplay: '1,262.61',
  ),
  WhalePositionPerf(
    sym: 'GOLD',
    label: 'xyz:GOLD',
    glyph: 'X',
    colorHex: 0xFF22D3EE,
    side: '做空',
    timeDisplay: '约 4 天前',
    positive: true,
    pnlDisplay: '185,428.79',
    sizeDisplay: '0.01 xyz:GOLD',
    feeDisplay: '7,283.66',
  ),
];

/// top3：带 [WhaleLeaderEntry.avatarText] 的条目，渲染为轮播 hero 卡。
List<WhaleLeaderEntry> topWhaleLeaders(List<WhaleLeaderEntry> entries) {
  return entries
      .where((WhaleLeaderEntry e) => e.avatarText != null)
      .toList(growable: false);
}
