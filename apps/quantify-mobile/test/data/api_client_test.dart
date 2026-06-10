import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/services/api_client.dart';

void main() {
  group('ApiException.fromDio', () {
    test('HTML error response is collapsed to HTTP status message', () {
      final RequestOptions options = RequestOptions(path: '/users/me');
      final ApiException error = ApiException.fromDio(
        DioException(
          requestOptions: options,
          response: Response<String>(
            requestOptions: options,
            statusCode: 403,
            data: '<!DOCTYPE html><html><body>blocked</body></html>',
          ),
        ),
      );

      expect(error.message, '请求失败（HTTP 403）');
    });
  });
}
