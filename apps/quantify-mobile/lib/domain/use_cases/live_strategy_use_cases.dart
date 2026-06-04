/// 实盘策略列表排序 UseCase（#2190，源自 #1773）。
///
/// 从 `data/models/live_strategy_sort.dart` 迁出。模型文件只留数据结构。
/// 对齐设计稿 `m-screens-livestrats.jsx` `LS_SORTS`（6 指标）。
library;

import '../models/live_strategy_models.dart';

/// 实盘策略列表排序指标。
enum LiveSortMetric { todayPnl, totalPnl, totalPct, winRate, capital, runForDays }

/// 排序方向。[none] = 不排序，保持列表原序。
enum LiveSortDirection { asc, desc, none }

/// 取指标对应的可比较数值。`runForDays` 从 `runFor` 串解析前导数字。
double _metricValue(LiveStrategy s, LiveSortMetric metric) {
  switch (metric) {
    case LiveSortMetric.todayPnl:
      return s.todayPnl;
    case LiveSortMetric.totalPnl:
      return s.totalPnl;
    case LiveSortMetric.totalPct:
      return s.totalPct;
    case LiveSortMetric.winRate:
      return s.winRate;
    case LiveSortMetric.capital:
      return s.capital;
    case LiveSortMetric.runForDays:
      return _leadingNumber(s.runFor);
  }
}

/// 解析 `'14 天'` -> 14；无前导数字返回 0。
double _leadingNumber(String text) {
  final RegExpMatch? m = RegExp(r'^\s*(\d+(?:\.\d+)?)').firstMatch(text);
  if (m == null) return 0;
  return double.tryParse(m.group(1)!) ?? 0;
}

/// 按 [metric] + [dir] 排序，返回新列表（不修改入参）。
///
/// [metric] 为 null 或 [dir] 为 [LiveSortDirection.none] 时原序返回。
List<LiveStrategy> sortStrategies(
  List<LiveStrategy> list,
  LiveSortMetric? metric,
  LiveSortDirection dir,
) {
  if (metric == null || dir == LiveSortDirection.none) {
    return List<LiveStrategy>.of(list);
  }
  final List<LiveStrategy> sorted = List<LiveStrategy>.of(list);
  sorted.sort((LiveStrategy a, LiveStrategy b) {
    final int cmp = _metricValue(a, metric).compareTo(_metricValue(b, metric));
    return dir == LiveSortDirection.asc ? cmp : -cmp;
  });
  return sorted;
}

/// 实盘策略概览的状态明细（#2192：从 `_LiveStatusBreakdown.build` 上移）。
///
/// 仅保留计数 > 0 的状态项，保持 running → warning → paused → stopped 顺序，
/// 供「我的」页 hero 卡状态 chip 渲染。View 仅取用，不在 build 内 `.where`。
List<(LiveStrategyStatus, int)> liveStatusBreakdown(LiveStrategySummary s) {
  return <(LiveStrategyStatus, int)>[
    (LiveStrategyStatus.running, s.runningCount),
    (LiveStrategyStatus.warning, s.warningCount),
    (LiveStrategyStatus.paused, s.pausedCount),
    (LiveStrategyStatus.stopped, s.stoppedCount),
  ].where(((LiveStrategyStatus, int) e) => e.$2 > 0).toList();
}
