import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/services/api_client.dart';
import 'package:quantify_mobile/data/services/generated_backend_api.dart';

void main() {
  test('GeneratedBackendApi uses provided Dio baseUrl', () {
    final Dio dio = buildApiDio(baseUrl: 'https://api.example.test');
    final GeneratedBackendApi api = GeneratedBackendApi(dio: dio);

    expect(api.dio.options.baseUrl, 'https://api.example.test');
  });

  test('buildApiInterceptor injects bearer token from latest supplier value',
      () {
    String token = 'first-token';
    final InterceptorsWrapper interceptor = buildApiInterceptor(
      tokenSupplier: () => token,
    );
    final RequestOptions options = RequestOptions(path: '/x');

    interceptor.onRequest(options, RequestInterceptorHandler());

    expect(options.headers['Authorization'], 'Bearer first-token');

    token = 'second-token';
    final RequestOptions next = RequestOptions(path: '/y');
    interceptor.onRequest(next, RequestInterceptorHandler());

    expect(next.headers['Authorization'], 'Bearer second-token');
  });
}
