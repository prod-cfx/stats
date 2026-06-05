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

/// filter chip 与状态的映射。[LiveFilter.all] = 全部（排除 stopped）。
///
/// 原为页面私有 `_LiveFilter`，迁三件套后由 `LiveStrategiesState` 承载，
/// #2229 随过滤族函数归位 domain。
enum LiveFilter { all, running, paused, stopped }

/// 排序 sheet 的状态枚举（#2229：随 [LiveSortStatusCounts] 归位 domain）。
enum LiveSortStatus { all, running, paused, stopped }

/// 各状态计数聚合（#2229：从 `live_sort_sheet.dart` 归位 domain）。
class LiveSortStatusCounts {
  const LiveSortStatusCounts({
    required this.all,
    required this.running,
    required this.paused,
    required this.stopped,
  });

  final int all;
  final int running;
  final int paused;
  final int stopped;

  int countOf(LiveSortStatus status) {
    switch (status) {
      case LiveSortStatus.all:
        return all;
      case LiveSortStatus.running:
        return running;
      case LiveSortStatus.paused:
        return paused;
      case LiveSortStatus.stopped:
        return stopped;
    }
  }
}

/// [filter] 是否命中策略 [s]（#2192：从 View 上移的纯谓词）。
/// `all` 语义 = 排除 stopped。
bool liveMatchesFilter(LiveStrategy s, LiveFilter filter) {
  switch (filter) {
    case LiveFilter.all:
      return s.status != LiveStrategyStatus.stopped;
    case LiveFilter.running:
      return s.status == LiveStrategyStatus.running;
    case LiveFilter.paused:
      return s.status == LiveStrategyStatus.paused;
    case LiveFilter.stopped:
      return s.status == LiveStrategyStatus.stopped;
  }
}

/// 单个 [filter] 下的命中数（#2192：filter pill 计数，从 View 上移）。
int liveFilterCount(List<LiveStrategy> all, LiveFilter filter) {
  return all.where((LiveStrategy s) => liveMatchesFilter(s, filter)).length;
}

/// filter pill 标签计数（#2192：从 `_FilterPills` 上移）。
///
/// 注意语义与 [liveFilterCount] 不同：pill 的 `all` 显示**总数**（含 stopped），
/// 其余状态按精确状态计数。保持迁移前 `_FilterPills._count` 行为不变。
int liveFilterPillCount(List<LiveStrategy> all, LiveFilter filter) {
  if (filter == LiveFilter.all) return all.length;
  return liveFilterCount(all, filter);
}

/// 各状态计数聚合（#2192：排序 sheet 的状态计数，从 View 上移）。
LiveSortStatusCounts liveStatusCounts(List<LiveStrategy> all) {
  return LiveSortStatusCounts(
    all: liveFilterCount(all, LiveFilter.all),
    running: liveFilterCount(all, LiveFilter.running),
    paused: liveFilterCount(all, LiveFilter.paused),
    stopped: liveFilterCount(all, LiveFilter.stopped),
  );
}
