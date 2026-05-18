import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/auth/session_controller.dart';
import 'package:quantify_mobile/data/mock/mock_auth_repository.dart';
import 'package:quantify_mobile/data/models/auth_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/storage/secure_token_storage.dart';

ProviderContainer _container({
  InMemoryTokenStorage? storage,
}) {
  final InMemoryTokenStorage s = storage ?? InMemoryTokenStorage();
  return ProviderContainer(
    overrides: <Override>[
      tokenStorageProvider.overrideWithValue(s),
      authRepositoryProvider.overrideWithValue(MockAuthRepository()),
    ],
  );
}

void main() {
  group('SessionController', () {
    test('build() 在空 storage 下返回 null', () async {
      final ProviderContainer c = _container();
      addTearDown(c.dispose);
      final AuthSession? s =
          await c.read(sessionControllerProvider.future);
      expect(s, isNull);
    });

    test('build() 恢复已有 session', () async {
      final AuthSession seed = AuthSession(
        userId: 'u1',
        token: 't1',
        email: 'a@b.com',
      );
      final InMemoryTokenStorage storage =
          InMemoryTokenStorage(<String, String>{
        kSessionStorageKey: jsonEncode(seed.toMap()),
      });
      final ProviderContainer c = _container(storage: storage);
      addTearDown(c.dispose);

      final AuthSession? restored =
          await c.read(sessionControllerProvider.future);
      expect(restored, isNotNull);
      expect(restored!.userId, 'u1');
      expect(restored.email, 'a@b.com');
    });

    test('损坏的 session JSON 被清除并降级为 null', () async {
      final InMemoryTokenStorage storage =
          InMemoryTokenStorage(<String, String>{
        kSessionStorageKey: '{not valid json',
      });
      final ProviderContainer c = _container(storage: storage);
      addTearDown(c.dispose);

      final AuthSession? restored =
          await c.read(sessionControllerProvider.future);
      expect(restored, isNull);
      expect(storage.snapshot.containsKey(kSessionStorageKey), isFalse);
    });

    test('loginEmail 写盘并发出 session', () async {
      final InMemoryTokenStorage storage = InMemoryTokenStorage();
      final ProviderContainer c = _container(storage: storage);
      addTearDown(c.dispose);

      await c.read(sessionControllerProvider.future);
      await c
          .read(sessionControllerProvider.notifier)
          .loginEmail(email: 'x@y.com', password: 'pwpwpw');

      final AuthSession? cur =
          c.read(sessionControllerProvider).valueOrNull;
      expect(cur, isNotNull);
      expect(cur!.email, 'x@y.com');
      expect(storage.snapshot[kSessionStorageKey], isNotNull);
      final Map<String, dynamic> persisted =
          jsonDecode(storage.snapshot[kSessionStorageKey]!)
              as Map<String, dynamic>;
      expect(persisted['email'], 'x@y.com');
      expect(persisted['token'], 'mock-token');
    });

    test('loginTelegram 走 mock email 通道', () async {
      final InMemoryTokenStorage storage = InMemoryTokenStorage();
      final ProviderContainer c = _container(storage: storage);
      addTearDown(c.dispose);

      await c.read(sessionControllerProvider.future);
      await c.read(sessionControllerProvider.notifier).loginTelegram();

      final AuthSession? cur =
          c.read(sessionControllerProvider).valueOrNull;
      expect(cur, isNotNull);
      expect(cur!.email, kTelegramMockEmail);
    });

    test('logout 清盘并把 state 重置为 null', () async {
      final InMemoryTokenStorage storage = InMemoryTokenStorage();
      final ProviderContainer c = _container(storage: storage);
      addTearDown(c.dispose);

      await c.read(sessionControllerProvider.future);
      await c
          .read(sessionControllerProvider.notifier)
          .loginEmail(email: 'a@b.com', password: '123456');
      expect(storage.snapshot[kSessionStorageKey], isNotNull);

      await c.read(sessionControllerProvider.notifier).logout();
      expect(c.read(sessionControllerProvider).valueOrNull, isNull);
      expect(storage.snapshot.containsKey(kSessionStorageKey), isFalse);
    });
  });
}
