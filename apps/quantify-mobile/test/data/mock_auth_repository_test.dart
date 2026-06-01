import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/mock_auth_repository.dart';
import 'package:quantify_mobile/data/models/auth_models.dart';

void main() {
  group('MockAuthRepository', () {
    test('login 返回固定 mock-user/mock-token 并保留输入 email', () async {
      final MockAuthRepository repo = MockAuthRepository();
      final AuthSession session = await repo.login(
        email: 'tester@example.com',
        password: 'pw',
      );
      expect(session.userId, 'mock-user');
      expect(session.token, 'mock-token');
      expect(session.email, 'tester@example.com');
    });

    test('sendLoginCode 标记邮箱可验证码登录', () async {
      final MockAuthRepository repo = MockAuthRepository();
      await repo.sendLoginCode(email: 'tester@example.com');

      final AuthSession session = await repo.loginWithCode(
        email: 'tester@example.com',
        code: '123456',
      );

      expect(session.userId, 'mock-user');
      expect(session.token, 'mock-token');
      expect(session.email, 'tester@example.com');
    });

    test('loginWithCode 未发码邮箱失败且不推送 session', () async {
      final MockAuthRepository repo = MockAuthRepository();

      expect(
        () => repo.loginWithCode(email: 'missing@example.com', code: '123456'),
        throwsA(isA<StateError>()),
      );
      expect(await repo.watchSession().first, isNull);
    });

    test('loginWithCode 空验证码失败且不推送 session', () async {
      final MockAuthRepository repo = MockAuthRepository();
      await repo.sendLoginCode(email: 'tester@example.com');

      expect(
        () => repo.loginWithCode(email: 'tester@example.com', code: ''),
        throwsA(isA<ArgumentError>()),
      );
      expect(await repo.watchSession().first, isNull);
    });

    test('login 后 watchSession 推送当前 session', () async {
      final MockAuthRepository repo = MockAuthRepository();
      await repo.login(email: 'a@b.com', password: 'x');
      final AuthSession? first = await repo.watchSession().first;
      expect(first, isNotNull);
      expect(first!.email, 'a@b.com');
    });

    test('logout 后 watchSession 推送 null', () async {
      final MockAuthRepository repo = MockAuthRepository();
      await repo.login(email: 'a@b.com', password: 'x');

      final List<AuthSession?> events = <AuthSession?>[];
      final Stream<AuthSession?> stream = repo.watchSession();
      // 用 listen 而不是 take(2).toList()，避免 broadcast stream
      // 在 `yield _session` 与 `yield* controller.stream` 之间错失事件。
      final subscription = stream.listen(events.add);
      // 让首帧 yield 完成。
      await Future<void>.delayed(Duration.zero);
      await repo.logout();
      // 让 controller.add 经微任务派发到监听者。
      await Future<void>.delayed(Duration.zero);
      await subscription.cancel();

      expect(events.first, isNotNull);
      expect(events.first!.email, 'a@b.com');
      expect(events.last, isNull);
    });
  });
}
