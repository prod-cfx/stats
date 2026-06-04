import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/providers/notifier_lifecycle.dart';
import '../../../data/models/whale_leader_models.dart';
import 'whale_discover_tab_state.dart';

/// 发现 tab 控制器（issue #2183 三件套迁移）。
///
/// 纯同步排序态：[setSort] 切换排序键/方向。无异步、无 `BuildContext`。挂
/// [NotifierLifecycle] 对齐范式（本控制器无异步回调，登记仅为统一约定）。
class WhaleDiscoverTabController extends Notifier<WhaleDiscoverTabState> {
  final NotifierLifecycle _life = NotifierLifecycle();

  bool get mounted => _life.mounted;

  @override
  WhaleDiscoverTabState build() {
    _life.attach(ref);
    return const WhaleDiscoverTabState();
  }

  /// 设排序。null = 不排序，经 State 的 `_unset` 哨兵区分于「不改动」。
  void setSort(WhaleLeaderSort? sort) {
    state = state.copyWith(sort: sort);
  }
}

final whaleDiscoverTabControllerProvider =
    NotifierProvider.autoDispose<
      WhaleDiscoverTabController,
      WhaleDiscoverTabState
    >(WhaleDiscoverTabController.new);
