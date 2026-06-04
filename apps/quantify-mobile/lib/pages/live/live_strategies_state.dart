import 'package:flutter/foundation.dart';

import '../../data/models/live_strategy_sort.dart';

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
