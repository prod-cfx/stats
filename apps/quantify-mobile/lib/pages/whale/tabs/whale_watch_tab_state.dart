import 'package:flutter/foundation.dart';

import '../../../core/network/domain_error.dart';
import '../../../data/models/whale_watch_models.dart';

/// 监控 tab 的子 Tab 标识（issue #1769）：实时 / 监控地址 / 通知中心。
enum WhaleWatchSubTab { live, addresses, notifications }

/// 监控 tab 的不可变页面态（issue #2183 三件套迁移）。
///
/// 承载子 Tab 选择 [subTab] 与监控规则异步态（[rules]/[loading]/[error]）。
/// CRUD 后由 controller 以纯态方法替换 [rules]；异步加载异常经
/// `ErrorRouter.normalize` 落 [error]。
@immutable
class WhaleWatchTabState {
  const WhaleWatchTabState({
    this.subTab = WhaleWatchSubTab.live,
    this.rules,
    this.loading = true,
    this.error,
  });

  final WhaleWatchSubTab subTab;

  /// null = 尚未加载完成；非 null = 当前规则列表（单一数据源）。
  final List<WatchRule>? rules;
  final bool loading;
  final DomainError? error;

  /// `rules`/`error` 用 [_unset] 哨兵区分「不改动」与「显式置 null」。
  WhaleWatchTabState copyWith({
    WhaleWatchSubTab? subTab,
    Object? rules = _unset,
    bool? loading,
    Object? error = _unset,
  }) {
    return WhaleWatchTabState(
      subTab: subTab ?? this.subTab,
      rules: identical(rules, _unset)
          ? this.rules
          : rules as List<WatchRule>?,
      loading: loading ?? this.loading,
      error: identical(error, _unset) ? this.error : error as DomainError?,
    );
  }

  static const Object _unset = Object();
}
