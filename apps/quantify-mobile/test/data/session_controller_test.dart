import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/auth/session_controller.dart';
import 'package:quantify_mobile/data/mock/mock_auth_repository.dart';
import 'package:quantify_mobile/data/models/auth_models.dart';
import 'package:quantify_mobile/data/providers.dart';
import 'package:quantify_mobile/data/repositories/auth_repository.dart';
import 'package:quantify_mobile/data/storage/secure_token_storage.dart';

class _RecordingAuthRepository extends MockAuthRepository {
  _RecordingAuthRepository({this.telegramError, this.guestError});

  Object? telegramError;
  Object? guestError;
  int emailLoginCalls = 0;
  int telegramCalls = 0;
  int guestCalls = 0;

  @override
  Future<AuthSession> login({
    required String email,
    required String password,
  }) async {
    emailLoginCalls++;
    return super.login(email: email, password: password);
  }

  @override
  Future<AuthSession> loginTelegram({
    Map<String, dynamic> payload = const <String, dynamic>{},
  }) async {
    telegramCalls++;
    if (telegramError != null) throw telegramError!;
    return const AuthSession(
      userId: 'tg-real-user',
      token: 'tg-real-token',
      email: 'tg-real@example.com',
    );
  }

  @override
  Future<AuthSession> loginGuest() async {
    guestCalls++;
    if (guestError != null) throw guestError!;
    return const AuthSession(
      userId: 'guest-real-user',
      token: 'guest-real-token',
      email: 'guest-real@example.com',
      isGuest: true,
    );
  }
}

ProviderContainer _container({
  InMemoryTokenStorage? storage,
  AuthRepository? repo,
}) {
  final InMemoryTokenStorage s = storage ?? InMemoryTokenStorage();
  return ProviderContainer(
    overrides: <Override>[
      tokenStorageProvider.overrideWithValue(s),
      authRepositoryProvider.overrideWithValue(repo ?? MockAuthRepository()),
    ],
  );
}

void main() {
  group('SessionController', () {
    test('build() 在空 storage 下返回 null', () async {
      final ProviderContainer c = _container();
      addTearDown(c.dispose);
      final AuthSession? s = await c.read(sessionControllerProvider.future);
      expect(s, isNull);
    });

    test('build() 恢复已有 session', () async {
      final AuthSession seed = AuthSession(
        userId: 'u1',
        token: 't1',
        email: 'a@b.com',
      );
      final InMemoryTokenStorage storage = InMemoryTokenStorage(
        <String, String>{kSessionStorageKey: jsonEncode(seed.toMap())},
      );
      final ProviderContainer c = _container(storage: storage);
      addTearDown(c.dispose);

      final AuthSession? restored = await c.read(
        sessionControllerProvider.future,
      );
      expect(restored, isNotNull);
      expect(restored!.userId, 'u1');
      expect(restored.email, 'a@b.com');
    });

    test('损坏的 session JSON 被清除并降级为 null', () async {
      final InMemoryTokenStorage storage = InMemoryTokenStorage(
        <String, String>{kSessionStorageKey: '{not valid json'},
      );
      final ProviderContainer c = _container(storage: storage);
      addTearDown(c.dispose);

      final AuthSession? restored = await c.read(
        sessionControllerProvider.future,
      );
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

      final AuthSession? cur = c.read(sessionControllerProvider).value;
      expect(cur, isNotNull);
      expect(cur!.email, 'x@y.com');
      expect(storage.snapshot[kSessionStorageKey], isNotNull);
      final Map<String, dynamic> persisted =
          jsonDecode(storage.snapshot[kSessionStorageKey]!)
              as Map<String, dynamic>;
      expect(persisted['email'], 'x@y.com');
      expect(persisted['token'], 'mock-token');
    });

    test('loginEmailCode 使用验证码登录写盘并发出 session', () async {
      final InMemoryTokenStorage storage = InMemoryTokenStorage();
      final ProviderContainer c = _container(storage: storage);
      addTearDown(c.dispose);

      await c.read(sessionControllerProvider.future);
      final SessionController controller = c.read(
        sessionControllerProvider.notifier,
      );
      await controller.sendLoginCode(email: 'code@y.com');
      await controller.loginEmailCode(email: 'code@y.com', code: '123456');

      final AuthSession? cur = c.read(sessionControllerProvider).value;
      expect(cur, isNotNull);
      expect(cur!.email, 'code@y.com');
      expect(storage.snapshot[kSessionStorageKey], isNotNull);
      final Map<String, dynamic> persisted =
          jsonDecode(storage.snapshot[kSessionStorageKey]!)
              as Map<String, dynamic>;
      expect(persisted['email'], 'code@y.com');
      expect(persisted['token'], 'mock-token');
    });

    test('register 写盘并发出 session', () async {
      final InMemoryTokenStorage storage = InMemoryTokenStorage();
      final ProviderContainer c = _container(storage: storage);
      addTearDown(c.dispose);

      await c.read(sessionControllerProvider.future);
      await c
          .read(sessionControllerProvider.notifier)
          .register(email: 'reg@y.com', password: 'pwpwpwpw', betaCode: 'BETA');

      final AuthSession? cur = c.read(sessionControllerProvider).value;
      expect(cur, isNotNull);
      expect(cur!.email, 'reg@y.com');
      expect(storage.snapshot[kSessionStorageKey], isNotNull);
      final Map<String, dynamic> persisted =
          jsonDecode(storage.snapshot[kSessionStorageKey]!)
              as Map<String, dynamic>;
      expect(persisted['email'], 'reg@y.com');
      expect(persisted['token'], 'mock-token');
    });

    test('loginTelegram 调 repository，不走 mock email 空密码通道', () async {
      final InMemoryTokenStorage storage = InMemoryTokenStorage();
      final _RecordingAuthRepository repo = _RecordingAuthRepository();
      final ProviderContainer c = _container(storage: storage, repo: repo);
      addTearDown(c.dispose);

      await c.read(sessionControllerProvider.future);
      await c.read(sessionControllerProvider.notifier).loginTelegram();

      final AuthSession? cur = c.read(sessionControllerProvider).value;
      expect(cur, isNotNull);
      expect(cur!.email, 'tg-real@example.com');
      expect(cur.token, 'tg-real-token');
      expect(repo.telegramCalls, 1);
      expect(repo.emailLoginCalls, 0);
      expect(storage.snapshot[kSessionStorageKey], isNotNull);
    });

    test('loginGuest 调 repository，不构造 guest-local token', () async {
      final InMemoryTokenStorage storage = InMemoryTokenStorage();
      final _RecordingAuthRepository repo = _RecordingAuthRepository();
      final ProviderContainer c = _container(storage: storage, repo: repo);
      addTearDown(c.dispose);

      await c.read(sessionControllerProvider.future);
      await c.read(sessionControllerProvider.notifier).loginGuest();

      final AuthSession? cur = c.read(sessionControllerProvider).value;
      expect(cur, isNotNull);
      expect(cur!.isGuest, isTrue);
      expect(cur.token, 'guest-real-token');
      expect(cur.token, isNot('guest-local'));
      expect(repo.guestCalls, 1);
      expect(storage.snapshot[kSessionStorageKey], isNotNull);
    });

    test('loginTelegram 失败不写入 storage，保持未登录错误态', () async {
      final InMemoryTokenStorage storage = InMemoryTokenStorage();
      final _RecordingAuthRepository repo = _RecordingAuthRepository(
        telegramError: StateError('telegram unavailable'),
      );
      final ProviderContainer c = _container(storage: storage, repo: repo);
      addTearDown(c.dispose);

      await c.read(sessionControllerProvider.future);
      await c.read(sessionControllerProvider.notifier).loginTelegram();

      expect(c.read(sessionControllerProvider).hasError, isTrue);
      expect(storage.snapshot.containsKey(kSessionStorageKey), isFalse);
    });

    test('loginGuest 失败不写入 storage，保持未登录错误态', () async {
      final InMemoryTokenStorage storage = InMemoryTokenStorage();
      final _RecordingAuthRepository repo = _RecordingAuthRepository(
        guestError: StateError('guest unavailable'),
      );
      final ProviderContainer c = _container(storage: storage, repo: repo);
      addTearDown(c.dispose);

      await c.read(sessionControllerProvider.future);
      await c.read(sessionControllerProvider.notifier).loginGuest();

      expect(c.read(sessionControllerProvider).hasError, isTrue);
      expect(storage.snapshot.containsKey(kSessionStorageKey), isFalse);
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
      expect(c.read(sessionControllerProvider).value, isNull);
      expect(storage.snapshot.containsKey(kSessionStorageKey), isFalse);
    });
  });
}
