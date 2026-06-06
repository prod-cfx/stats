import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_auth_repository.dart';
import 'package:quantify_mobile/data/models/auth_models.dart';
import 'package:quantify_mobile/data/services/api_client.dart';
import 'package:quantify_mobile/data/services/auth_service.dart';

/// 用预置响应替身校验 [ApiAuthRepository] 对真实 backend 信封
/// `{data: {accessToken, user:{...}}}` 的解析；不发真实 HTTP。
class _StubAuthService extends AuthService {
  _StubAuthService(this.response)
      : super(ApiClient(baseUrl: 'http://localhost'));

  final Object? response;

  Future<dynamic> _reply() async => response;

  @override
  Future<dynamic> login({required String email, required String password}) =>
      _reply();
  @override
  Future<dynamic> register({
    required String email,
    required String password,
    String? nickname,
    String? betaCode,
  }) => _reply();
  @override
  Future<dynamic> loginWithCode({
    required String email,
    required String code,
  }) => _reply();
}

void main() {
  group('ApiAuthRepository envelope parsing', () {
    test('login 解析 {data:{accessToken,user}} 信封', () async {
      final ApiAuthRepository repo = ApiAuthRepository(
        _StubAuthService(<String, dynamic>{
          'data': <String, dynamic>{
            'accessToken': 'jwt-123',
            'user': <String, dynamic>{'id': 'u-9', 'email': 'real@x.com'},
          },
          'message': 'ok',
        }),
      );
      final AuthSession s =
          await repo.login(email: 'fallback@x.com', password: 'pw');
      expect(s.token, 'jwt-123');
      expect(s.userId, 'u-9');
      expect(s.email, 'real@x.com');
    });

    test('register 解析信封并取 user.email', () async {
      final ApiAuthRepository repo = ApiAuthRepository(
        _StubAuthService(<String, dynamic>{
          'data': <String, dynamic>{
            'accessToken': 'jwt-reg',
            'user': <String, dynamic>{'id': 'u-1', 'email': 'new@x.com'},
          },
        }),
      );
      final AuthSession s = await repo.register(
        email: 'fallback@x.com',
        password: 'pw12345678',
      );
      expect(s.token, 'jwt-reg');
      expect(s.email, 'new@x.com');
    });

    test('扁平响应回退：缺 data 时顶层取 accessToken', () async {
      final ApiAuthRepository repo = ApiAuthRepository(
        _StubAuthService(<String, dynamic>{
          'accessToken': 'flat-jwt',
          'user': <String, dynamic>{'id': 'u-flat', 'email': 'flat@x.com'},
        }),
      );
      final AuthSession s =
          await repo.login(email: 'fallback@x.com', password: 'pw');
      expect(s.token, 'flat-jwt');
      expect(s.userId, 'u-flat');
      expect(s.email, 'flat@x.com');
    });

    test('email 缺失时回退到入参 email', () async {
      final ApiAuthRepository repo = ApiAuthRepository(
        _StubAuthService(<String, dynamic>{
          'data': <String, dynamic>{
            'accessToken': 'jwt',
            'user': <String, dynamic>{'id': 'u-2'},
          },
        }),
      );
      final AuthSession s = await repo.loginWithCode(
        email: 'fallback@x.com',
        code: '123456',
      );
      expect(s.email, 'fallback@x.com');
    });

    test('token 缺失（4xx {message} 信封）抛 ApiException，不建空会话', () async {
      final ApiAuthRepository repo = ApiAuthRepository(
        _StubAuthService(<String, dynamic>{
          'message': 'invalid credentials',
        }),
      );
      await expectLater(
        repo.login(email: 'e@x.com', password: 'pw'),
        throwsA(isA<ApiException>()),
      );
    });

    test('data 不含鉴权字段时回退顶层（_hasAuthFields=false）', () async {
      final ApiAuthRepository repo = ApiAuthRepository(
        _StubAuthService(<String, dynamic>{
          'accessToken': 'top-jwt',
          'data': <String, dynamic>{'message': 'noise'},
          'user': <String, dynamic>{'id': 'u-top', 'email': 'top@x.com'},
        }),
      );
      final AuthSession s =
          await repo.login(email: 'fallback@x.com', password: 'pw');
      expect(s.token, 'top-jwt');
      expect(s.userId, 'u-top');
    });

    test('logout 纯本地 no-op：不调用 service，不抛错', () async {
      final ApiAuthRepository repo = ApiAuthRepository(
        _StubAuthService(<String, dynamic>{
          'data': <String, dynamic>{
            'accessToken': 'jwt',
            'user': <String, dynamic>{'id': 'u', 'email': 'e@x.com'},
          },
        }),
      );
      await repo.login(email: 'e@x.com', password: 'pw');
      await expectLater(repo.logout(), completes);
    });
  });
}
