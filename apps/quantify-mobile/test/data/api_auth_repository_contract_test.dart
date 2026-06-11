import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_auth_repository.dart';
import 'package:quantify_mobile/data/services/api_client.dart';
import 'package:quantify_mobile/data/services/auth_service.dart';
import 'package:quantify_mobile/data/services/generated_backend_api.dart';

Dio _dioWithRecorder(List<(String, Object?)> calls) {
  return buildApiDio(baseUrl: 'https://api.example.test')
    ..interceptors.insert(
      0,
      InterceptorsWrapper(
        onRequest: (RequestOptions options, RequestInterceptorHandler handler) {
          calls.add((options.path, options.data));
          if (options.path == '/auth/email/send-code') {
            handler.resolve(
              Response<Object?>(requestOptions: options, statusCode: 200),
            );
            return;
          }
          handler.resolve(
            Response<Map<String, Object?>>(
              requestOptions: options,
              statusCode: 200,
              data: <String, Object?>{
                'data': <String, Object?>{
                  'accessToken': 'token-1',
                  'user': <String, Object?>{
                    'id': 'user-1',
                    'email': 'me@example.com',
                    'nickname': 'Me',
                    'emailVerified': true,
                    'isGuest': false,
                    'roles': <String>['user'],
                    'createdAt': '2026-06-11T00:00:00.000Z',
                    'updatedAt': '2026-06-11T00:00:00.000Z',
                  },
                },
                'message': 'ok',
              },
            ),
          );
        },
      ),
    );
}

void main() {
  group('ApiAuthRepository generated contract', () {
    test(
      'sendLoginCode uses generated email-code endpoint and DTO body',
      () async {
        final List<(String, Object?)> calls = <(String, Object?)>[];
        final AuthService service = AuthService(
          GeneratedBackendApi(dio: _dioWithRecorder(calls)),
        );

        await service.sendLoginCode(email: 'me@example.com');

        expect(calls.single.$1, '/auth/email/send-code');
        expect(calls.single.$2, <String, Object?>{'email': 'me@example.com'});
      },
    );

    test(
      'loginWithCode maps generated auth response into AuthSession',
      () async {
        final List<(String, Object?)> calls = <(String, Object?)>[];
        final ApiAuthRepository repo = ApiAuthRepository(
          AuthService(GeneratedBackendApi(dio: _dioWithRecorder(calls))),
        );

        final session = await repo.loginWithCode(
          email: 'me@example.com',
          code: '123456',
        );

        expect(calls.single.$1, '/auth/email/verify-code');
        expect(session.userId, 'user-1');
        expect(session.token, 'token-1');
        expect(session.email, 'me@example.com');
        expect(session.isGuest, isFalse);
      },
    );
  });
}
