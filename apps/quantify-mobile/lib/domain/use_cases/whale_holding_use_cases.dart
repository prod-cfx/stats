/// 巨鲸持仓业务派生 UseCase（#2190）。
///
/// 从 `data/models/whale_holding_models.dart` 迁出：筛选 / 排序 / 币种聚合 /
/// 交易统计派生。模型文件只留数据结构。
///
/// 依赖说明：[whaleHoldingTradeStats] 派生 `WhaleTradeStats`（暂留 data 层，被
/// 全站 whale-profile 域消费，移动超出 #2190 范围）。此处单向 domain→data 依赖
/// 仅限 use_case 层，#2189 接通真实现后由 service 转换替代。
library;

import '../../data/models/whale_profile_models.dart';
import '../models/whale_holding_models.dart';

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

/// 由持仓条目派生交易统计入参（issue #1977 持仓卡「趋势/交易统计」入口）。
///
/// [WhaleTradeStats] 已与 WhaleProfile 解耦，统计弹窗只需 address + stats。持仓
/// 卡仅持有单仓展示串（盈亏/未实现盈亏），无逐资产/逐仓位明细，故派生一个轻量
/// stats：复用已有展示串，明细列表留空（mock 阶段）。真实读路径接通后改为按
/// 地址拉取完整 stats。
WhaleTradeStats whaleHoldingTradeStats(WhaleHoldingPosition e) {
  return WhaleTradeStats(
    pnlDisplay: e.pnlDisplay,
    pnlTone: e.isProfit ? 'up' : 'dn',
    winRatePct: 50,
    realizedDisplay: '—',
    unrealizedDisplay: e.pnlDisplay,
    longPct: e.isLong ? 100 : 0,
    shortPct: e.isLong ? 0 : 100,
    assetPerf: const <WhaleAssetPerf>[],
  );
}
