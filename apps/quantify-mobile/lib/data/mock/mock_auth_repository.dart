import 'dart:async';

import '../models/auth_models.dart';
import '../repositories/auth_repository.dart';

/// AuthRepository 的 Mock 闭环实现，作为模式示例。
/// - 任意凭据登录成功（200ms 延迟）
/// - 内存保存当前 session
/// - watchSession 通过 broadcast StreamController 推送
class MockAuthRepository implements AuthRepository {
  AuthSession? _session;
  final Set<String> _emailsWithLoginCode = <String>{};
  final StreamController<AuthSession?> _controller =
      StreamController<AuthSession?>.broadcast();

  @override
  Future<AuthSession> login({
    required String email,
    required String password,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    final AuthSession session = AuthSession(
      userId: 'mock-user',
      token: 'mock-token',
      email: email,
    );
    _session = session;
    _controller.add(session);
    return session;
  }

  @override
  Future<void> sendLoginCode({required String email}) async {
    await Future<void>.delayed(const Duration(milliseconds: 120));
    _emailsWithLoginCode.add(email.trim().toLowerCase());
  }

  @override
  Future<AuthSession> loginWithCode({
    required String email,
    required String code,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    if (code.trim().isEmpty) {
      throw ArgumentError.value(code, 'code', '验证码不能为空');
    }
    final String normalizedEmail = email.trim().toLowerCase();
    if (!_emailsWithLoginCode.contains(normalizedEmail)) {
      throw StateError('请先发送验证码');
    }
    final AuthSession session = AuthSession(
      userId: 'mock-user',
      token: 'mock-token',
      email: email,
    );
    _session = session;
    _controller.add(session);
    return session;
  }

  @override
  Future<void> logout() async {
    _session = null;
    _controller.add(null);
  }

  @override
  Stream<AuthSession?> watchSession() async* {
    yield _session;
    yield* _controller.stream;
  }
}
