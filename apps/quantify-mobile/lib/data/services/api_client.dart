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
/// 构造一个已挂载鉴权 + 错误归一拦截器的 [Dio]，供手写 [ApiClient] 与
/// generated SDK 共享同一网络行为（baseUrl / Bearer token / [ApiException] 归一）。
Dio buildApiDio({
  required String baseUrl,
  String Function()? tokenSupplier,
  Duration connectTimeout = const Duration(seconds: 10),
  Duration receiveTimeout = const Duration(seconds: 30),
}) {
  final Dio dio = Dio(
    BaseOptions(
      baseUrl: baseUrl,
      connectTimeout: connectTimeout,
      receiveTimeout: receiveTimeout,
      headers: <String, dynamic>{'Accept': 'application/json'},
    ),
  );
  dio.interceptors.add(buildApiInterceptor(tokenSupplier: tokenSupplier));
  return dio;
}

/// 鉴权 + 错误归一拦截器。token 每次请求从 [tokenSupplier] 读取最新值。
InterceptorsWrapper buildApiInterceptor({String Function()? tokenSupplier}) {
  return InterceptorsWrapper(
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
    onResponse: (Response<dynamic> response, ResponseInterceptorHandler h) {
      if (response.requestOptions.extra['unwrapData'] == true) {
        final Object? body = response.data;
        if (body is Map && body.containsKey('data')) {
          response.data = body['data'];
        }
      }
      if (response.requestOptions.extra['normalizeWhalePerformance'] == true) {
        _normalizeWhalePerformance(response.data);
      }
      h.next(response);
    },
  );
}

void _normalizeWhalePerformance(Object? data) {
  if (data is! Map) return;
  final Object? trades = data['trades'];
  if (trades is! Iterable) return;
  for (final Object? trade in trades) {
    if (trade is Map) {
      final Object? action = trade['positionAction'];
      if (action is num) {
        trade['positionAction'] = action.round().toString();
      }
    }
  }
}

class ApiClient {
  ApiClient({
    required String baseUrl,
    String Function()? tokenSupplier,
    Duration connectTimeout = const Duration(seconds: 10),
    Duration receiveTimeout = const Duration(seconds: 30),
    Dio? dio,
  }) : _dio =
           dio ??
           buildApiDio(
             baseUrl: baseUrl,
             tokenSupplier: tokenSupplier,
             connectTimeout: connectTimeout,
             receiveTimeout: receiveTimeout,
           );

  final Dio _dio;

  /// 暴露底层 Dio，供少数需要细粒度控制的场景使用；常规走 [get]/[post]/[delete]。
  Dio get raw => _dio;

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async {
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
  const ApiException({required this.message, this.statusCode, this.code});

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
    bool hasResponseMessage = false;
    final Object? data = resp?.data;
    if (data is Map) {
      final Object? nested = data['error'];
      if (nested is Map) {
        final Object? nestedMessage = nested['message'];
        if (nestedMessage is String && nestedMessage.trim().isNotEmpty) {
          message = nestedMessage.trim();
          hasResponseMessage = true;
        }
        final Object? nestedCode = nested['code'];
        if (nestedCode != null) code = nestedCode.toString();
      } else if (nested is String &&
          nested.trim().isNotEmpty &&
          message == (e.message ?? 'network error')) {
        message = nested.trim();
        hasResponseMessage = true;
      }

      final Object? m = data['message'];
      if (m is String &&
          m.trim().isNotEmpty &&
          message == (e.message ?? 'network error')) {
        message = m.trim();
        hasResponseMessage = true;
      }
      final Object? c = data['code'];
      if (c != null && code == null) code = c.toString();
    } else if (data is String && data.trim().isNotEmpty) {
      final String text = data.trim();
      message = _looksLikeHtml(text)
          ? (status == null ? '请求失败，请稍后重试' : _httpFallbackMessage(status))
          : text;
      hasResponseMessage = !_looksLikeHtml(text);
    } else if (status != null) {
      message = _httpFallbackMessage(status);
    }
    if (!hasResponseMessage && status != null) {
      message = _httpFallbackMessage(status);
    }
    return ApiException(message: message, statusCode: status, code: code);
  }

  @override
  String toString() =>
      'ApiException(status=$statusCode, code=$code, message=$message)';
}

String _httpFallbackMessage(int status) {
  if (status == 409) {
    return '回测请求冲突，可能已有相同回测任务正在处理。请稍后重试。';
  }
  return '请求失败（HTTP $status）';
}

bool _looksLikeHtml(String text) {
  final String lower = text.toLowerCase();
  return lower.startsWith('<!doctype html') ||
      lower.startsWith('<html') ||
      lower.contains('<html') ||
      lower.contains('<body') ||
      lower.contains('<script');
}
