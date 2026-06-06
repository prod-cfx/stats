import 'dart:async';

import '../models/auth_models.dart';
import '../repositories/auth_repository.dart';
import '../services/api_client.dart';
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

  /// 解析鉴权响应为 [AuthSession]。
  ///
  /// 真实 backend 契约为信封 `{data: AuthResponseDto{accessToken, user}, message}`，
  /// 故先剥一层 `data`；为兼容扁平结构（旧 mock / 单测桩）保留顶层回退。
  AuthSession _parse(Object? raw, {required String fallbackEmail}) {
    final Map<String, dynamic> root = asMap(raw);
    // 信封：仅当 data 是对象且承载鉴权字段时下钻，避免把扁平响应的
    // `data == user` 语义误判。
    final Map<String, dynamic> body = _hasAuthFields(pick(root, <String>['data']))
        ? asMap(pick(root, <String>['data']))
        : root;
    final Map<String, dynamic> user = asMap(pick(body, <String>['user']));
    final AuthSession session = AuthSession(
      userId: asString(pick(user, <String>['id', 'userId']) ??
          pick(body, <String>['userId', 'id'])),
      token: asString(pick(body, <String>['accessToken', 'token'])),
      email: asString(
        pick(user, <String>['email']) ?? pick(body, <String>['email']),
        fallback: fallbackEmail,
      ),
    );
    // token 缺失（如 4xx 信封 {message} 无 accessToken）不能静默建空会话——
    // 否则 UI 显示已登录但后续请求全匿名。抛 ApiException 让控制器走
    // session.hasError 落错误前缀。
    if (session.token.isEmpty) {
      throw const ApiException(message: 'auth response missing access token');
    }
    return session;
  }

  bool _hasAuthFields(Object? raw) {
    if (raw is! Map) return false;
    return raw.containsKey('accessToken') ||
        raw.containsKey('token') ||
        raw.containsKey('user');
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
  Future<AuthSession> register({
    required String email,
    required String password,
    String? nickname,
    String? betaCode,
  }) async {
    final dynamic raw = await _service.register(
      email: email,
      password: password,
      nickname: nickname,
      betaCode: betaCode,
    );
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
    // 后端无 logout 端点（JWT 无状态）；纯本地清内存 session。token 清盘由
    // SessionController.logout 删 kSessionStorageKey 完成。
    _session = null;
    _controller.add(null);
  }

  @override
  Stream<AuthSession?> watchSession() async* {
    yield _session;
    yield* _controller.stream;
  }
}
