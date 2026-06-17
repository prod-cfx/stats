import 'dart:async';

import 'package:backend_api_contracts/backend_api_contracts.dart' as contracts;
import 'package:url_launcher/url_launcher.dart';

import '../models/auth_models.dart';
import '../repositories/auth_repository.dart';
import '../services/api_client.dart';
import '../services/auth_service.dart';
import '../services/json_codec.dart';

const Duration _telegramPollInterval = Duration(seconds: 2);
const Duration _telegramPollTimeout = Duration(minutes: 3);

/// [AuthRepository] 真实现（issue #2189）。
///
/// 注入 [AuthService] 走真实 HTTP；把响应 JSON 反序列化为 [AuthSession]。
/// 纯 stateless HTTP 映射：不持有会话内存态。会话单一真相源是
/// [SessionController]（issue #2262）。
class ApiAuthRepository implements AuthRepository {
  ApiAuthRepository(this._service);

  final AuthService _service;

  /// 解析鉴权响应为 [AuthSession]。
  ///
  /// 真实 backend 契约为信封 `{data: AuthResponseDto{accessToken, user}, message}`，
  /// 故先剥一层 `data`；为兼容扁平结构（旧 mock / 单测桩）保留顶层回退。
  AuthSession _parse(Object? raw, {required String fallbackEmail}) {
    if (raw is contracts.AuthResponseDto ||
        raw is contracts.AuthControllerTelegramDesktopExchange200Response) {
      return _parseGenerated(raw as Object, fallbackEmail: fallbackEmail);
    }
    final Map<String, dynamic> root = asMap(raw);
    // 信封：仅当 data 是对象且承载鉴权字段时下钻，避免把扁平响应的
    // `data == user` 语义误判。
    final Map<String, dynamic> body =
        _hasAuthFields(pick(root, <String>['data']))
        ? asMap(pick(root, <String>['data']))
        : root;
    final Map<String, dynamic> user = asMap(pick(body, <String>['user']));
    final AuthSession session = AuthSession(
      userId: asString(
        pick(user, <String>['id', 'userId']) ??
            pick(body, <String>['userId', 'id']),
      ),
      token: asString(pick(body, <String>['accessToken', 'token'])),
      email: asString(
        pick(user, <String>['email']) ?? pick(body, <String>['email']),
        fallback: fallbackEmail,
      ),
      isGuest: asBool(
        pick(user, <String>['isGuest']) ?? pick(body, <String>['isGuest']),
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

  AuthSession _parseGenerated(Object raw, {required String fallbackEmail}) {
    if (raw is contracts.AuthResponseDto) {
      return _parseAuthResponseDto(raw, fallbackEmail: fallbackEmail);
    }
    if (raw is contracts.AuthControllerTelegramDesktopExchange200Response) {
      return _parseAuthResponseDto(raw.data, fallbackEmail: fallbackEmail);
    }
    throw StateError('unsupported generated auth response: ${raw.runtimeType}');
  }

  AuthSession _parseAuthResponseDto(
    contracts.AuthResponseDto dto, {
    required String fallbackEmail,
  }) {
    final AuthSession session = AuthSession(
      userId: dto.user.id,
      token: dto.accessToken,
      email: dto.user.email.isNotEmpty ? dto.user.email : fallbackEmail,
      isGuest: dto.user.isGuest,
    );
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

  @override
  Future<AuthSession> login({
    required String email,
    required String password,
  }) async {
    final dynamic raw = await _service.login(email: email, password: password);
    return _parse(raw, fallbackEmail: email);
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
    return _parse(raw, fallbackEmail: email);
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
    final dynamic raw = await _service.loginWithCode(email: email, code: code);
    return _parse(raw, fallbackEmail: email);
  }

  @override
  Future<AuthSession> loginTelegram({
    Map<String, dynamic> payload = const <String, dynamic>{},
  }) async {
    if (payload.isEmpty) {
      final String intentId = await _startTelegramDesktopIntent('login');
      await _waitTelegramConfirmation(intentId);
      final dynamic raw = await _service.exchangeTelegramDesktopIntent(
        intentId,
      );
      return _parse(raw, fallbackEmail: '');
    }

    final dynamic raw = await _service.loginTelegram(payload: payload);
    return _parse(raw, fallbackEmail: '');
  }

  @override
  Future<AuthSession> bindTelegram() async {
    final String intentId = await _startTelegramDesktopIntent('bind');
    await _waitTelegramConfirmation(intentId);
    final dynamic raw = await _service.bindTelegramDesktopIntent(intentId);
    return _parse(raw, fallbackEmail: '');
  }

  Future<String> _startTelegramDesktopIntent(String intent) async {
    final contracts.TelegramDesktopIntentResponseDto desktopIntent =
        await _service.createTelegramDesktopIntent(intent: intent, lng: 'zh');
    final bool opened =
        await _openTelegramLink(desktopIntent.deepLink) ||
        await _openTelegramLink(desktopIntent.webLink);
    if (!opened) {
      throw const ApiException(message: '无法打开 Telegram，请确认已安装 Telegram 或稍后重试');
    }
    return desktopIntent.intentId;
  }

  Future<bool> _openTelegramLink(String url) async {
    final Uri? uri = Uri.tryParse(url);
    if (uri == null) return false;
    return launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  Future<void> _waitTelegramConfirmation(String intentId) async {
    final DateTime deadline = DateTime.now().add(_telegramPollTimeout);
    while (DateTime.now().isBefore(deadline)) {
      final String status = await _service.getTelegramDesktopIntentStatus(
        intentId,
      );
      if (status == 'confirmed') return;
      if (status == 'expired') {
        throw const ApiException(message: 'Telegram 授权已过期，请重新发起');
      }
      await Future<void>.delayed(_telegramPollInterval);
    }
    throw const ApiException(message: '等待 Telegram 授权超时，请重试');
  }

  @override
  Future<AuthSession> loginGuest() async {
    final dynamic raw = await _service.loginGuest();
    final AuthSession session = _parse(raw, fallbackEmail: '');
    return AuthSession(
      userId: session.userId,
      token: session.token,
      email: session.email,
      isGuest: true,
    );
  }

  @override
  Future<void> logout() async {
    // 后端无 logout 端点（JWT 无状态）；repo 无状态可清，token 清盘由
    // SessionController.logout 删 kSessionStorageKey 完成。
  }
}
