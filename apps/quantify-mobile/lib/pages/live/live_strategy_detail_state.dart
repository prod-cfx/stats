import 'package:flutter/foundation.dart';

/// 实盘策略详情页页面态（issue #2185 三件套）。
///
/// 仅承载当前选中的 tab key（`overview`/`positions`/`history`/`params`）。
/// 纯同步、无 `BuildContext`、无异步副作用。
@immutable
class LiveStrategyDetailState {
  const LiveStrategyDetailState({this.tab = 'overview'});

  final String tab;

  LiveStrategyDetailState copyWith({String? tab}) {
    return LiveStrategyDetailState(tab: tab ?? this.tab);
  }
}
