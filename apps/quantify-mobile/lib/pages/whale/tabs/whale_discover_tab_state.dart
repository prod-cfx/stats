import 'package:flutter/foundation.dart';

import '../../../data/models/whale_leader_models.dart';

/// 发现 tab 的不可变页面态（issue #2183 三件套迁移）。
///
/// 仅承载排序态 [sort]（null = 不排序，保持数据源原序）。纯同步、无异步副作用、
/// 无 `BuildContext`，由 `WhaleDiscoverTabController` 通过 `copyWith` 推进。
@immutable
class WhaleDiscoverTabState {
  const WhaleDiscoverTabState({this.sort = _defaultSort});

  /// 默认按胜率降序（对齐原 `_WhaleDiscoverTabState` 初值）。
  static const WhaleLeaderSort _defaultSort = WhaleLeaderSort(
    key: WhaleLeaderSortKey.winRate,
    dir: WhaleLeaderSortDir.desc,
  );

  /// null 表示不排序。
  final WhaleLeaderSort? sort;

  /// `sort` 用 [_unset] 哨兵区分「不改动」与「显式置 null（不排序）」。
  WhaleDiscoverTabState copyWith({Object? sort = _unset}) {
    return WhaleDiscoverTabState(
      sort: identical(sort, _unset) ? this.sort : sort as WhaleLeaderSort?,
    );
  }

  static const Object _unset = Object();
}
