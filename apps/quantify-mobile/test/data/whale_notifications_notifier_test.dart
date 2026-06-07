import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/models/whale_extra_models.dart';
import 'package:quantify_mobile/data/repositories/whale_extras_repository.dart';
import 'package:riverpod/misc.dart' show Override;

WhaleNotification _notif({required String id, required bool unread}) {
  return WhaleNotification(
    id: id,
    kind: WhaleNotificationKind.alert,
    tone: 'neutral',
    unread: unread,
    title: 't$id',
    body: 'b$id',
    meta: 'm$id',
  );
}

class _FakeExtrasRepo implements WhaleExtrasRepository {
  _FakeExtrasRepo(this.notifications);

  final List<WhaleNotification> notifications;

  @override
  Future<List<WhaleNotification>> listNotifications() async => notifications;
}

ProviderContainer _container(List<WhaleNotification> notifications) {
  final ProviderContainer container = ProviderContainer(
    overrides: <Override>[
      whaleExtrasRepositoryProvider.overrideWithValue(
        _FakeExtrasRepo(notifications),
      ),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  group('WhaleNotificationsNotifier（Notifier 收口后行为不变）', () {
    test('build 从 repository 加载，unreadCount 与未读条目数一致', () async {
      final container = _container(<WhaleNotification>[
        _notif(id: '1', unread: true),
        _notif(id: '2', unread: false),
      ]);

      container.read(whaleNotificationsProvider);
      await Future<void>.delayed(Duration.zero);

      final list = container.read(whaleNotificationsProvider);
      final notifier = container.read(whaleNotificationsProvider.notifier);
      expect(list, isNotEmpty);
      expect(
        notifier.unreadCount,
        list.where((WhaleNotification n) => n.unread).length,
      );
    });

    test('repository 空列表保持真实空态', () async {
      final container = _container(const <WhaleNotification>[]);
      container.read(whaleNotificationsProvider);
      await Future<void>.delayed(Duration.zero);
      expect(container.read(whaleNotificationsProvider), isEmpty);
    });

    test('markAllRead 后全部已读，列表广播更新', () {
      final container = _container(const <WhaleNotification>[]);
      container.read(whaleNotificationsProvider.notifier).replaceAll(
        <WhaleNotification>[_notif(id: '1', unread: true)],
      );

      final notifier = container.read(whaleNotificationsProvider.notifier);
      notifier.markAllRead();
      expect(notifier.unreadCount, 0);
      expect(
        container.read(whaleNotificationsProvider).every((n) => !n.unread),
        isTrue,
      );
    });

    test('markRead 仅标记单条', () {
      final container = _container(const <WhaleNotification>[]);
      container.read(whaleNotificationsProvider.notifier).replaceAll(
        <WhaleNotification>[
          _notif(id: '1', unread: true),
          _notif(id: '2', unread: true),
        ],
      );

      final notifier = container.read(whaleNotificationsProvider.notifier);
      final unreadBefore = notifier.unreadCount;
      final firstUnread = container
          .read(whaleNotificationsProvider)
          .firstWhere((WhaleNotification n) => n.unread);

      notifier.markRead(firstUnread.id);
      expect(notifier.unreadCount, unreadBefore - 1);
    });

    test('replaceAll 整表替换', () {
      final container = _container(const <WhaleNotification>[]);

      final notifier = container.read(whaleNotificationsProvider.notifier);
      notifier.replaceAll(const <WhaleNotification>[]);
      expect(container.read(whaleNotificationsProvider), isEmpty);
    });
  });
}
