import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/whale_extra_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/whale_extras_repository.dart';
import 'package:riverpod/misc.dart' show Override;

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

class _FakeExtrasRepo implements WhaleExtrasRepository {
  const _FakeExtrasRepo();

  @override
  Future<List<WhaleNotification>> listNotifications() async =>
      const <WhaleNotification>[];
}

void main() {
  ProviderContainer makeContainer() {
    final ProviderContainer c = ProviderContainer(
      overrides: <Override>[
        whaleExtrasRepositoryProvider.overrideWithValue(
          const _FakeExtrasRepo(),
        ),
      ],
    );
    addTearDown(c.dispose);
    return c;
  }

  test('初始 repository 空列表的未读计数为 0', () {
    final ProviderContainer c = makeContainer();
    expect(c.read(whaleUnreadCountProvider), 0);
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
