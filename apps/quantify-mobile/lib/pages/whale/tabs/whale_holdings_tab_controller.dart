import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/notifier_lifecycle.dart';
import '../../../data/models/whale_holding_models.dart';
import 'whale_holdings_tab_state.dart';

/// 持仓 tab 控制器（issue #2182 三件套范式标杆）。
///
/// 纯同步状态机：每个动作均 `state = state.copyWith(...)`，无异步、无
/// `BuildContext`、无外部副作用——导航/复制/弹窗等 context 副作用留在 widget。
/// 挂 [NotifierLifecycle] 对齐范式（本控制器当前无异步回调，登记仅为统一约定）。
class WhaleHoldingsTabController extends Notifier<WhaleHoldingsTabState> {
  final NotifierLifecycle _life = NotifierLifecycle();

  bool get mounted => _life.mounted;

  @override
  WhaleHoldingsTabState build() {
    _life.attach(ref);
    return const WhaleHoldingsTabState();
  }

  /// 选币种。null = 「全部币种」，经 `WhaleHoldingFilter.copyWith` 的 `_noCoin`
  /// 哨兵正确置空。
  void selectCoin(String? coin) {
    state = state.copyWith(filter: state.filter.copyWith(coin: coin));
  }

  void setDir(WhaleHoldingDirFilter dir) {
    state = state.copyWith(filter: state.filter.copyWith(dir: dir));
  }

  void setPnl(WhaleHoldingPnlFilter pnl) {
    state = state.copyWith(filter: state.filter.copyWith(pnl: pnl));
  }

  /// 设排序。null = 不排序，经 State 的 `_unset` 哨兵区分于「不改动」。
  void setSort(WhaleHoldingSort? sort) {
    state = state.copyWith(sort: sort);
  }
}

final whaleHoldingsTabControllerProvider =
    NotifierProvider.autoDispose<
      WhaleHoldingsTabController,
      WhaleHoldingsTabState
    >(WhaleHoldingsTabController.new);
