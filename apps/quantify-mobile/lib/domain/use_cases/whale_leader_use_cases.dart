/// 巨鲸排行榜业务派生 UseCase（#2190）。
///
/// 从 `data/models/whale_leader_models.dart` 迁出：排序 / top 过滤 / 交易统计
/// 派生。模型文件只留数据结构。
///
/// 依赖说明：[whaleLeaderTradeStats] 派生 `WhaleTradeStats`（暂留 data 层，被
/// 全站 whale-profile 域消费）。单向 domain→data 依赖仅限 use_case 层，#2189
/// 接通真实现后由 service 转换替代。
library;

import '../../data/models/whale_profile_models.dart';
import '../models/whale_leader_models.dart';

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

/// 由排行榜条目派生交易统计摘要（issue #1860 卡片「交易统计」入口）。
///
/// 真实模式不再填充设计稿 mock 明细；后端缺逐资产/逐仓位统计时保持空态。
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
    assetPerf: const <WhaleAssetPerf>[],
    positionPerf: const <WhalePositionPerf>[],
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

/// top3：带 [WhaleLeaderEntry.avatarText] 的条目，渲染为轮播 hero 卡。
List<WhaleLeaderEntry> topWhaleLeaders(List<WhaleLeaderEntry> entries) {
  return entries
      .where((WhaleLeaderEntry e) => e.avatarText != null)
      .toList(growable: false);
}
