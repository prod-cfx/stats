import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/whale_notifications_notifier.dart';
import 'package:quantify_mobile/data/models/whale_extra_models.dart';

void main() {
  group('WhaleNotificationsNotifier（Notifier 收口后行为不变）', () {
    test('build 种子非空，unreadCount 与未读条目数一致', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final list = container.read(whaleNotificationsProvider);
      final notifier = container.read(whaleNotificationsProvider.notifier);
      expect(list, isNotEmpty);
      expect(
        notifier.unreadCount,
        list.where((WhaleNotification n) => n.unread).length,
      );
    });

    test('markAllRead 后全部已读，列表广播更新', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final notifier = container.read(whaleNotificationsProvider.notifier);
      notifier.markAllRead();
      expect(notifier.unreadCount, 0);
      expect(
        container.read(whaleNotificationsProvider).every((n) => !n.unread),
        isTrue,
      );
    });

    test('markRead 仅标记单条', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final notifier = container.read(whaleNotificationsProvider.notifier);
      final unreadBefore = notifier.unreadCount;
      final firstUnread = container
          .read(whaleNotificationsProvider)
          .firstWhere((WhaleNotification n) => n.unread);

      notifier.markRead(firstUnread.id);
      expect(notifier.unreadCount, unreadBefore - 1);
    });

    test('replaceAll 整表替换', () {
      final container = ProviderContainer();
      addTearDown(container.dispose);

      final notifier = container.read(whaleNotificationsProvider.notifier);
      notifier.replaceAll(const <WhaleNotification>[]);
      expect(container.read(whaleNotificationsProvider), isEmpty);
    });
  });
}
