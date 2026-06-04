import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/whale_extra_models.dart';
import 'package:quantify_mobile/data/whale_notifications_notifier.dart';

/// #2192：`whaleUnreadCountProvider` 派生计数（从各 View build 上移）单测。
WhaleNotification _notif({required String id, required bool unread}) {
  return WhaleNotification(
    id: id,
    kind: WhaleNotificationKind.alert,
    tone: 'neutral',
    unread: unread,
    title: 't',
    body: 'b',
    meta: 'm',
  );
}

void main() {
  ProviderContainer makeContainer() {
    final ProviderContainer c = ProviderContainer();
    addTearDown(c.dispose);
    return c;
  }

  test('初始 mock 种子的未读计数与 notifier.unreadCount 一致', () {
    final ProviderContainer c = makeContainer();
    final int viaProvider = c.read(whaleUnreadCountProvider);
    final int viaNotifier =
        c.read(whaleNotificationsProvider.notifier).unreadCount;
    expect(viaProvider, viaNotifier);
  });

  test('markAllRead 后计数归零（派生随列表响应式更新）', () {
    final ProviderContainer c = makeContainer();
    c.read(whaleNotificationsProvider.notifier).markAllRead();
    expect(c.read(whaleUnreadCountProvider), 0);
  });

  test('replaceAll 自定义列表：仅统计 unread', () {
    final ProviderContainer c = makeContainer();
    c.read(whaleNotificationsProvider.notifier).replaceAll(<WhaleNotification>[
      _notif(id: '1', unread: true),
      _notif(id: '2', unread: false),
      _notif(id: '3', unread: true),
    ]);
    expect(c.read(whaleUnreadCountProvider), 2);
  });
}
