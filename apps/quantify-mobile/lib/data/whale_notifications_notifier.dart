import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'mock/fixtures/whale_extras.dart';
import 'models/whale_extra_models.dart';

/// 巨鲸通知中心单一数据源（issue #1769）。
///
/// 顶部铃铛 panel 与监控 Tab 内「通知中心」子 Tab 共享同一份列表与
/// 已读状态，避免两套独立 state 漂移。mock 阶段种子来自
/// [mockWhaleNotifications]，真实推送（#1683）接入后替换 seed 来源即可。
class WhaleNotificationsNotifier
    extends Notifier<List<WhaleNotification>> {
  @override
  List<WhaleNotification> build() =>
      List<WhaleNotification>.of(mockWhaleNotifications);

  int get unreadCount =>
      state.where((WhaleNotification n) => n.unread).length;

  /// 标记单条已读（点击通知行时调用）。
  void markRead(String id) {
    state = <WhaleNotification>[
      for (final WhaleNotification n in state)
        if (n.id == id) n.copyWith(unread: false) else n,
    ];
  }

  /// 全部标记已读。
  void markAllRead() {
    state = <WhaleNotification>[
      for (final WhaleNotification n in state) n.copyWith(unread: false),
    ];
  }

  /// 整表替换（铃铛 panel 关闭后回写其内部副本）。
  void replaceAll(List<WhaleNotification> next) {
    state = List<WhaleNotification>.of(next);
  }
}

/// 通知中心共享 provider（issue #1769）。
final NotifierProvider<WhaleNotificationsNotifier, List<WhaleNotification>>
    whaleNotificationsProvider =
    NotifierProvider<WhaleNotificationsNotifier, List<WhaleNotification>>(
  WhaleNotificationsNotifier.new,
);

/// 未读通知计数派生 provider（#2192）。
///
/// 各 View（顶部铃铛角标 / 监控 Tab）原先在 `build()` 内 `where(unread).length`
/// 内联聚合；上移为派生 provider，View 仅 `ref.watch`，计数随列表响应式更新。
final Provider<int> whaleUnreadCountProvider = Provider<int>((Ref ref) {
  return ref
      .watch(whaleNotificationsProvider)
      .where((WhaleNotification n) => n.unread)
      .length;
});
