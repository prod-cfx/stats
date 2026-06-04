import 'api_client.dart';

/// 鉴权后端资源（issue #2189）。stateless：只持有 [ApiClient]。
///
/// path 为占位 RESTful 约定，后端契约就绪后校正。
class AuthService {
  const AuthService(this._client);

  final ApiClient _client;

  Future<dynamic> login({required String email, required String password}) {
    return _client.post(
      '/api/auth/login',
      body: <String, dynamic>{'email': email, 'password': password},
    );
  }

  Future<dynamic> sendLoginCode({required String email}) {
    return _client.post(
      '/api/auth/login-code',
      body: <String, dynamic>{'email': email},
    );
  }

  Future<dynamic> loginWithCode({required String email, required String code}) {
    return _client.post(
      '/api/auth/login-code/verify',
      body: <String, dynamic>{'email': email, 'code': code},
    );
  }

  Future<void> logout() async {
    await _client.post('/api/auth/logout');
  }

  Future<dynamic> me() {
    return _client.get('/api/auth/me');
  }
}
