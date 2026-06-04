import 'package:flutter/foundation.dart';

import '../../domain/models/live_strategy_models.dart';
import '../../domain/use_cases/live_strategy_use_cases.dart';
import 'widgets/live_sort_sheet.dart';

/// filter chip 与状态的映射。[LiveFilter.all] = 全部（排除 stopped）。
///
/// 原为页面私有 `_LiveFilter`，迁三件套后由 [LiveStrategiesState] 承载，
/// 提升为 public 供 controller / widget 共享。
enum LiveFilter { all, running, paused, stopped }

/// 实盘策略列表页页面态（issue #2185 三件套）。
///
/// 承载筛选 [filter] 与排序（[sortMetric]/[sortDir]）。纯同步、无
/// `BuildContext`、无异步副作用。
@immutable
class LiveStrategiesState {
  const LiveStrategiesState({
    this.filter = LiveFilter.all,
    this.sortMetric,
    this.sortDir = LiveSortDirection.none,
  });

  final LiveFilter filter;

  /// null = 不按指标排序。
  final LiveSortMetric? sortMetric;
  final LiveSortDirection sortDir;

  /// `sortMetric` 用 [_unset] 哨兵区分「不改动」与「显式置 null（不排序）」。
  LiveStrategiesState copyWith({
    LiveFilter? filter,
    Object? sortMetric = _unset,
    LiveSortDirection? sortDir,
  }) {
    return LiveStrategiesState(
      filter: filter ?? this.filter,
      sortMetric: identical(sortMetric, _unset)
          ? this.sortMetric
          : sortMetric as LiveSortMetric?,
      sortDir: sortDir ?? this.sortDir,
    );
  }

  static const Object _unset = Object();
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

/// 按 [state] 的 filter + 排序派生可见列表（#2192：从 `_content` 上移）。
List<LiveStrategy> liveVisibleStrategies(
  List<LiveStrategy> all,
  LiveStrategiesState state,
) {
  final List<LiveStrategy> filtered = all
      .where((LiveStrategy s) => liveMatchesFilter(s, state.filter))
      .toList(growable: false);
  return sortStrategies(filtered, state.sortMetric, state.sortDir);
}
