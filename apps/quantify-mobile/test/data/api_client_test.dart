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

    test('409 response without readable body uses conflict message', () {
      final RequestOptions options = RequestOptions(path: '/ai/backtests');
      final ApiException error = ApiException.fromDio(
        DioException(
          requestOptions: options,
          message:
              'This exception was thrown because the response has a status code of 409',
          response: Response<Map<String, dynamic>>(
            requestOptions: options,
            statusCode: 409,
            data: const <String, dynamic>{},
          ),
        ),
      );

      expect(error.message, '回测请求冲突，可能已有相同回测任务正在处理。请稍后重试。');
    });

    test('server message is preserved for 409 response', () {
      final RequestOptions options = RequestOptions(path: '/ai/backtests');
      final ApiException error = ApiException.fromDio(
        DioException(
          requestOptions: options,
          response: Response<Map<String, dynamic>>(
            requestOptions: options,
            statusCode: 409,
            data: const <String, dynamic>{'message': '已有回测任务，请等待完成'},
          ),
        ),
      );

      expect(error.message, '已有回测任务，请等待完成');
    });
  });
}
