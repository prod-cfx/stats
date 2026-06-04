import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/notifier_lifecycle.dart';
import '../../data/models/strategy_models.dart';
import 'strategy_detail_state.dart';

/// 策略详情页控制器（issue #2185 三件套）。
///
/// 持有 toast / 导航 timer，`ref.onDispose` 统一取消，杜绝 dispose 后触达
/// `state =`。导航本身（`context.go`）留 widget：到点仅写
/// [StrategyDetailState.pendingNav]，由 widget `ref.listen` 消费后调 [consumeNav]。
/// toast 文案（依赖 l10n）由 widget 解析后传入，controller 不持 BuildContext。
class StrategyDetailController extends Notifier<StrategyDetailState> {
  final NotifierLifecycle _life = NotifierLifecycle();

  Timer? _toastTimer;
  Timer? _navTimer;

  static const Duration kNavDelay = Duration(milliseconds: 700);
  static const Duration kToastDuration = Duration(milliseconds: 2400);

  bool get mounted => _life.mounted;

  @override
  StrategyDetailState build() {
    _life.attach(ref);
    ref.onDispose(() {
      _toastTimer?.cancel();
      _navTimer?.cancel();
    });
    return const StrategyDetailState();
  }

  void setTf(EquityTimeframe tf) {
    state = state.copyWith(tf: tf);
  }

  /// 显示 [message] toast + 700ms 后请求跳转 [route]。
  /// 重复触发取消上一次 timer，避免叠加跳转。「载入对话」与「运行」共用。
  void fireToastAndNav({required String message, required String route}) {
    _toastTimer?.cancel();
    _navTimer?.cancel();
    state = state.copyWith(toast: message);
    _toastTimer = Timer(kToastDuration, () {
      if (!mounted) return;
      state = state.copyWith(toast: null);
    });
    _navTimer = Timer(kNavDelay, () {
      if (!mounted) return;
      state = state.copyWith(pendingNav: route);
    });
  }

  /// widget 消费 pendingNav 后回调清空，避免重复跳转。
  void consumeNav() {
    state = state.copyWith(pendingNav: null);
  }
}

final strategyDetailControllerProvider =
    NotifierProvider.autoDispose<
      StrategyDetailController,
      StrategyDetailState
    >(StrategyDetailController.new);
