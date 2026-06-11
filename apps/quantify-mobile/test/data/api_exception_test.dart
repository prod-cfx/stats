import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/services/api_client.dart';

void main() {
  group('ApiException.fromDio', () {
    test('prefers nested backend error message and code', () {
      final RequestOptions options = RequestOptions(path: '/auth/login');
      final DioException error = DioException(
        requestOptions: options,
        response: Response<Map<String, Object?>>(
          requestOptions: options,
          statusCode: 401,
          data: <String, Object?>{
            'error': <String, Object?>{
              'code': 'AUTH_INVALID_CREDENTIALS',
              'message': '邮箱或密码错误',
            },
          },
        ),
      );

      final ApiException result = ApiException.fromDio(error);

      expect(result.statusCode, 401);
      expect(result.code, 'AUTH_INVALID_CREDENTIALS');
      expect(result.message, '邮箱或密码错误');
    });

    test('keeps top-level backend error fallback', () {
      final RequestOptions options = RequestOptions(
        path: '/auth/email/verify-code',
      );
      final DioException error = DioException(
        requestOptions: options,
        response: Response<Map<String, Object?>>(
          requestOptions: options,
          statusCode: 400,
          data: <String, Object?>{
            'code': 'AUTH_EMAIL_CODE_INVALID',
            'message': '验证码无效',
          },
        ),
      );

      final ApiException result = ApiException.fromDio(error);

      expect(result.statusCode, 400);
      expect(result.code, 'AUTH_EMAIL_CODE_INVALID');
      expect(result.message, '验证码无效');
    });

    test('keeps legacy string error fallback', () {
      final RequestOptions options = RequestOptions(path: '/auth/login');
      final DioException error = DioException(
        requestOptions: options,
        response: Response<Map<String, Object?>>(
          requestOptions: options,
          statusCode: 400,
          data: <String, Object?>{'error': 'invalid credentials'},
        ),
      );

      final ApiException result = ApiException.fromDio(error);

      expect(result.statusCode, 400);
      expect(result.message, 'invalid credentials');
    });
  });
}
