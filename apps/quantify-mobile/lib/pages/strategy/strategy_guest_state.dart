import 'package:flutter/foundation.dart';

import '../../data/models/strategy_models.dart';

/// 访客策略页页面态（issue #2185 三件套）。
///
/// 承载首屏 3 条热门策略列表与加载标志。无 `BuildContext`、无副作用。
@immutable
class StrategyGuestState {
  const StrategyGuestState({
    this.items = const <StrategyMarketItem>[],
    this.loading = true,
  });

  final List<StrategyMarketItem> items;
  final bool loading;

  StrategyGuestState copyWith({
    List<StrategyMarketItem>? items,
    bool? loading,
  }) {
    return StrategyGuestState(
      items: items ?? this.items,
      loading: loading ?? this.loading,
    );
  }
}
