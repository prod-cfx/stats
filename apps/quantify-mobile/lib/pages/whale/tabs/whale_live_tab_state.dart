import 'package:flutter/foundation.dart';

import '../../../core/network/domain_error.dart';
import '../../../data/models/whale_models.dart';

/// 实时 feed 单条目（issue #2183 三件套迁移：改为不可变 + `copyWith`）。
///
/// [highlight] 推流后 700ms 高亮再复位；为避免跨 state 快照共享可变引用，
/// 复位/插入均替换条目与列表引用。
@immutable
class WhaleLiveFeedItem {
  const WhaleLiveFeedItem(this.event, {required this.highlight});

  final WhaleEvent event;
  final bool highlight;

  WhaleLiveFeedItem copyWith({bool? highlight}) {
    return WhaleLiveFeedItem(event, highlight: highlight ?? this.highlight);
  }
}

/// 胜率排序状态（issue #1983）。循环：none → desc → asc → none，
/// 对齐设计稿 `m-screens-4.jsx:595` 的 winSort 行为。
enum WhaleLiveWinSort { none, desc, asc }

/// 实时 tab 的不可变页面态（issue #2183 三件套迁移）。
///
/// 承载历史 + 推流条目 [items]、异步态 [loading]/[error]、币种筛选
/// [symbolFilter]、倒计时 [tick] 与胜率排序 [winSort]。流订阅/倒计时由
/// controller 持有，`ref.onDispose` 取消；异常经 `ErrorRouter.normalize` 落
/// [error]。
@immutable
class WhaleLiveTabState {
  const WhaleLiveTabState({
    this.items = const <WhaleLiveFeedItem>[],
    this.loading = true,
    this.error,
    this.symbolFilter = 'BTC',
    this.tick = countdownStart,
    this.winSort = WhaleLiveWinSort.none,
  });

  /// issue #1986：倒计时起始秒数。
  static const int countdownStart = 15;

  final List<WhaleLiveFeedItem> items;
  final bool loading;
  final DomainError? error;

  /// issue #1604：默认与 hero `BTC 净流入 · 1H` 对齐。
  final String symbolFilter;
  final int tick;
  final WhaleLiveWinSort winSort;

  /// `error` 用 [_unset] 哨兵区分「不改动」与「显式置 null（清错）」。
  WhaleLiveTabState copyWith({
    List<WhaleLiveFeedItem>? items,
    bool? loading,
    Object? error = _unset,
    String? symbolFilter,
    int? tick,
    WhaleLiveWinSort? winSort,
  }) {
    return WhaleLiveTabState(
      items: items ?? this.items,
      loading: loading ?? this.loading,
      error: identical(error, _unset) ? this.error : error as DomainError?,
      symbolFilter: symbolFilter ?? this.symbolFilter,
      tick: tick ?? this.tick,
      winSort: winSort ?? this.winSort,
    );
  }

  static const Object _unset = Object();
}
