import 'package:flutter/foundation.dart';

import '../../../domain/models/whale_holding_models.dart';

/// 持仓 tab 的不可变页面态（issue #2182 三件套范式标杆）。
///
/// 仅承载页面级筛选/排序态：[filter]（币种 + 方向 + 盈亏）与 [sort]（排序键/
/// 方向，null = 不排序）。无异步副作用、无 `BuildContext`，由
/// `WhaleHoldingsTabController` 通过纯 `copyWith` 推进。
@immutable
class WhaleHoldingsTabState {
  const WhaleHoldingsTabState({
    this.filter = const WhaleHoldingFilter(),
    this.sort,
  });

  final WhaleHoldingFilter filter;

  /// null 表示不排序，保持数据源原序。
  final WhaleHoldingSort? sort;

  /// `sort` 用 [_unset] 哨兵区分「不改动」与「显式置 null（不排序）」；
  /// `filter` 自身的 `coin` 置空由 `WhaleHoldingFilter.copyWith` 的内置哨兵处理。
  WhaleHoldingsTabState copyWith({
    WhaleHoldingFilter? filter,
    Object? sort = _unset,
  }) {
    return WhaleHoldingsTabState(
      filter: filter ?? this.filter,
      sort: identical(sort, _unset) ? this.sort : sort as WhaleHoldingSort?,
    );
  }

  static const Object _unset = Object();
}
