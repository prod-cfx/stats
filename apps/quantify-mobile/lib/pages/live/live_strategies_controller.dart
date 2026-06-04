import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/notifier_lifecycle.dart';
import '../../data/models/live_strategy_sort.dart';
import 'live_strategies_state.dart';

/// 实盘策略列表页控制器（issue #2185 三件套）。
///
/// 纯同步状态机：`setFilter` 切 filter chip；`applySortSelection` 一次性写入
/// 排序 sheet 返回的 filter+metric+dir。挂 [NotifierLifecycle] 对齐范式。
class LiveStrategiesController extends Notifier<LiveStrategiesState> {
  final NotifierLifecycle _life = NotifierLifecycle();

  bool get mounted => _life.mounted;

  @override
  LiveStrategiesState build() {
    _life.attach(ref);
    return const LiveStrategiesState();
  }

  void setFilter(LiveFilter filter) {
    state = state.copyWith(filter: filter);
  }

  /// 应用排序 sheet 的选择：filter / metric（null = 不排序）/ dir 一次性写入。
  void applySortSelection({
    required LiveFilter filter,
    required LiveSortMetric? metric,
    required LiveSortDirection dir,
  }) {
    state = state.copyWith(filter: filter, sortMetric: metric, sortDir: dir);
  }
}

final liveStrategiesControllerProvider =
    NotifierProvider.autoDispose<
      LiveStrategiesController,
      LiveStrategiesState
    >(LiveStrategiesController.new);
