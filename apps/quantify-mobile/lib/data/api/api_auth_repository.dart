import 'dart:async';

import '../models/auth_models.dart';
import '../repositories/auth_repository.dart';
import '../services/auth_service.dart';
import '../services/json_codec.dart';

/// [AuthRepository] 真实现（issue #2189）。
///
/// 注入 [AuthService] 走真实 HTTP；把响应 JSON 反序列化为 [AuthSession]。
/// `watchSession` 后端暂无推送契约，用内存 [StreamController] 广播本地登录态
/// 变化（与 mock 同语义），登录/登出时推一帧。
class ApiAuthRepository implements AuthRepository {
  ApiAuthRepository(this._service);

  final AuthService _service;
  AuthSession? _session;
  final StreamController<AuthSession?> _controller =
      StreamController<AuthSession?>.broadcast();

  AuthSession _parse(Object? raw, {required String fallbackEmail}) {
    final Map<String, dynamic> map = asMap(raw);
    final Map<String, dynamic> user = asMap(pick(map, <String>['user', 'data']));
    final AuthSession session = AuthSession(
      userId: asString(pick(map, <String>['userId', 'id']) ??
          pick(user, <String>['id', 'userId'])),
      token: asString(pick(map, <String>['token', 'accessToken'])),
      email: asString(
        pick(map, <String>['email']) ?? pick(user, <String>['email']),
        fallback: fallbackEmail,
      ),
    );
    return session;
  }

  void _emit(AuthSession session) {
    _session = session;
    _controller.add(session);
  }

  @override
  Future<AuthSession> login({
    required String email,
    required String password,
  }) async {
    final dynamic raw = await _service.login(email: email, password: password);
    final AuthSession s = _parse(raw, fallbackEmail: email);
    _emit(s);
    return s;
  }

  @override
  Future<void> sendLoginCode({required String email}) async {
    await _service.sendLoginCode(email: email);
  }

  @override
  Future<AuthSession> loginWithCode({
    required String email,
    required String code,
  }) async {
    final dynamic raw =
        await _service.loginWithCode(email: email, code: code);
    final AuthSession s = _parse(raw, fallbackEmail: email);
    _emit(s);
    return s;
  }

  @override
  Future<void> logout() async {
    await _service.logout();
    _session = null;
    _controller.add(null);
  }

  @override
  Stream<AuthSession?> watchSession() async* {
    yield _session;
    yield* _controller.stream;
  }
}
