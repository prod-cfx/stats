import 'package:flutter/foundation.dart';

import '../../data/models/strategy_models.dart';

/// 策略详情页页面态（issue #2185 三件套）。
///
/// - [tf]：equity 曲线时间窗，null = 尚未手动切换（widget 按策略 period 推默认）
/// - [toast]：「载入对话 / 运行」toast 文案，null = 不显示
/// - [pendingNav]：到点待跳转的路由，null = 无。由 widget `ref.listen` 消费后清空，
///   把 `context.go` 副作用留在 widget 侧。
@immutable
class StrategyDetailState {
  const StrategyDetailState({this.tf, this.toast, this.pendingNav});

  final EquityTimeframe? tf;
  final String? toast;
  final String? pendingNav;

  /// 三个可空字段均用 [_unset] 哨兵区分「不改动」与「显式置 null」。
  StrategyDetailState copyWith({
    Object? tf = _unset,
    Object? toast = _unset,
    Object? pendingNav = _unset,
  }) {
    return StrategyDetailState(
      tf: identical(tf, _unset) ? this.tf : tf as EquityTimeframe?,
      toast: identical(toast, _unset) ? this.toast : toast as String?,
      pendingNav: identical(pendingNav, _unset)
          ? this.pendingNav
          : pendingNav as String?,
    );
  }

  static const Object _unset = Object();
}
