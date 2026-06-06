import 'api_client.dart';

/// 鉴权后端资源（issue #2189 / #2260）。stateless：只持有 [ApiClient]。
///
/// 路径对齐 backend OpenAPI 真实契约（`packages/api-contracts-dart` `AuthApi`）：
/// login/register/email-code/me。响应为 `{data, message}` 信封，反序列化在
/// [ApiAuthRepository] 完成。登出无后端端点（JWT 无状态），纯本地清盘。
class AuthService {
  const AuthService(this._client);

  final ApiClient _client;

  Future<dynamic> login({required String email, required String password}) {
    return _client.post(
      '/auth/login',
      body: <String, dynamic>{'email': email, 'password': password},
    );
  }

  Future<dynamic> register({
    required String email,
    required String password,
    String? nickname,
    String? betaCode,
  }) {
    final Map<String, dynamic> body = <String, dynamic>{
      'email': email,
      'password': password,
    };
    if (nickname != null && nickname.isNotEmpty) body['nickname'] = nickname;
    if (betaCode != null && betaCode.isNotEmpty) body['betaCode'] = betaCode;
    return _client.post('/auth/register', body: body);
  }

  Future<dynamic> sendLoginCode({required String email}) {
    return _client.post(
      '/auth/email/send-code',
      body: <String, dynamic>{'email': email},
    );
  }

  Future<dynamic> loginWithCode({required String email, required String code}) {
    return _client.post(
      '/auth/email/verify-code',
      body: <String, dynamic>{'email': email, 'code': code},
    );
  }

  Future<dynamic> me() {
    return _client.get('/users/me');
  }
}
