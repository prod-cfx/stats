import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/notifier_lifecycle.dart';
import 'live_strategy_detail_state.dart';

/// 实盘策略详情页控制器（issue #2185 三件套）。
///
/// 纯同步状态机：`setTab` 切换当前 tab。挂 [NotifierLifecycle] 对齐范式。
class LiveStrategyDetailController extends Notifier<LiveStrategyDetailState> {
  final NotifierLifecycle _life = NotifierLifecycle();

  bool get mounted => _life.mounted;

  @override
  LiveStrategyDetailState build() {
    _life.attach(ref);
    return const LiveStrategyDetailState();
  }

  void setTab(String tab) {
    state = state.copyWith(tab: tab);
  }
}

final liveStrategyDetailControllerProvider =
    NotifierProvider.autoDispose<
      LiveStrategyDetailController,
      LiveStrategyDetailState
    >(LiveStrategyDetailController.new);
