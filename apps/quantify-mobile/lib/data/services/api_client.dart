import 'package:dio/dio.dart';

/// 统一后端 HTTP 客户端（issue #2189）。
///
/// 单一 [Dio] 实例 + 两个拦截器：
/// - 鉴权：每次请求从 [tokenSupplier] 读取最新 bearer token（可热刷新，
///   不需重建 client），非空时注入 `Authorization: Bearer <token>`。
/// - 错误归一：所有 [DioException] 统一转 [ApiException]，业务侧只 catch
///   一种异常类型。
///
/// **契约说明**：后端为 mobile 提供的 OpenAPI 契约尚未定稿（issue #2189
/// blocked-on）。各 Service 使用的 path 为 RESTful 占位约定，后端契约就绪后
/// 按真实 endpoint 校正；client 本身与 path 无耦合，故契约变更不影响本类。
class ApiClient {
  ApiClient({
    required String baseUrl,
    String Function()? tokenSupplier,
    Duration connectTimeout = const Duration(seconds: 10),
    Duration receiveTimeout = const Duration(seconds: 30),
    Dio? dio,
  }) : _dio = dio ??
            Dio(
              BaseOptions(
                baseUrl: baseUrl,
                connectTimeout: connectTimeout,
                receiveTimeout: receiveTimeout,
                headers: <String, dynamic>{'Accept': 'application/json'},
              ),
            ) {
    _dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (RequestOptions options, RequestInterceptorHandler handler) {
          final String token = tokenSupplier?.call() ?? '';
          if (token.isNotEmpty) {
            options.headers['Authorization'] = 'Bearer $token';
          }
          handler.next(options);
        },
        onError: (DioException e, ErrorInterceptorHandler handler) {
          handler.reject(
            DioException(
              requestOptions: e.requestOptions,
              error: ApiException.fromDio(e),
              type: e.type,
              response: e.response,
            ),
          );
        },
      ),
    );
  }

  final Dio _dio;

  /// 暴露底层 Dio，供少数需要细粒度控制的场景使用；常规走 [get]/[post]/[delete]。
  Dio get raw => _dio;

  Future<dynamic> get(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    return _unwrap(() => _dio.get<dynamic>(path, queryParameters: query));
  }

  Future<dynamic> post(
    String path, {
    Object? body,
    Map<String, dynamic>? query,
  }) async {
    return _unwrap(
      () => _dio.post<dynamic>(path, data: body, queryParameters: query),
    );
  }

  Future<dynamic> delete(
    String path, {
    Object? body,
    Map<String, dynamic>? query,
  }) async {
    return _unwrap(
      () => _dio.delete<dynamic>(path, data: body, queryParameters: query),
    );
  }

  /// 执行请求并把任何 [DioException] 归一为 [ApiException]。
  Future<dynamic> _unwrap(Future<Response<dynamic>> Function() run) async {
    try {
      final Response<dynamic> resp = await run();
      return resp.data;
    } on DioException catch (e) {
      final Object? inner = e.error;
      throw inner is ApiException ? inner : ApiException.fromDio(e);
    }
  }
}

/// 归一化后端错误。所有 Service / Repository 只对外抛此类型。
class ApiException implements Exception {
  const ApiException({
    required this.message,
    this.statusCode,
    this.code,
  });

  /// 人类可读错误信息。
  final String message;

  /// HTTP 状态码（无响应时 null，如网络中断/超时）。
  final int? statusCode;

  /// 后端业务错误码（响应体含 `code` 时填充）。
  final String? code;

  factory ApiException.fromDio(DioException e) {
    final Response<dynamic>? resp = e.response;
    final int? status = resp?.statusCode;
    String message = e.message ?? 'network error';
    String? code;
    final Object? data = resp?.data;
    if (data is Map) {
      final Object? m = data['message'] ?? data['error'];
      if (m is String && m.isNotEmpty) message = m;
      final Object? c = data['code'];
      if (c != null) code = c.toString();
    }
    return ApiException(message: message, statusCode: status, code: code);
  }

  @override
  String toString() =>
      'ApiException(status=$statusCode, code=$code, message=$message)';
}
