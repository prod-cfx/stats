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

    test('register 返回 mock session 并保留输入 email', () async {
      final MockAuthRepository repo = MockAuthRepository();
      final AuthSession session = await repo.register(
        email: 'new@example.com',
        password: 'pw12345678',
        betaCode: 'BETA',
      );
      expect(session.userId, 'mock-user');
      expect(session.token, 'mock-token');
      expect(session.email, 'new@example.com');
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
    });

    test('loginWithCode 空验证码失败且不推送 session', () async {
      final MockAuthRepository repo = MockAuthRepository();
      await repo.sendLoginCode(email: 'tester@example.com');

      expect(
        () => repo.loginWithCode(email: 'tester@example.com', code: ''),
        throwsA(isA<ArgumentError>()),
      );
    });

    test('logout 纯本地 no-op：不抛错', () async {
      final MockAuthRepository repo = MockAuthRepository();
      await repo.login(email: 'a@b.com', password: 'x');
      await expectLater(repo.logout(), completes);
    });
  });
}
