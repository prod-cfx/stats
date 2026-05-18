import 'dart:async';

import '../models/auth_models.dart';
import '../repositories/auth_repository.dart';

/// AuthRepository 的 Mock 闭环实现，作为模式示例。
/// - 任意凭据登录成功（200ms 延迟）
/// - 内存保存当前 session
/// - watchSession 通过 broadcast StreamController 推送
class MockAuthRepository implements AuthRepository {
  AuthSession? _session;
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
