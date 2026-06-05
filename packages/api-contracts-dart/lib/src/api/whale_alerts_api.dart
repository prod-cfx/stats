//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

import 'dart:async';

import 'package:built_value/json_object.dart';
import 'package:built_value/serializer.dart';
import 'package:dio/dio.dart';

import 'package:backend_api_contracts/src/api_util.dart';
import 'package:backend_api_contracts/src/model/whale_alert_controller_get_realtime200_response.dart';
import 'package:backend_api_contracts/src/model/whale_alert_controller_get_whale_trades200_response.dart';

class WhaleAlertsApi {

  final Dio _dio;

  final Serializers _serializers;

  const WhaleAlertsApi(this._dio, this._serializers);

  /// 获取 Hyperliquid 鲸鱼持仓预警实时列表
  /// 
  ///
  /// Parameters:
  /// * [page] - 页码（从 1 开始）
  /// * [limit] - 返回记录上限，默认 50，最大 200
  /// * [symbol] - 币种符号，例如 BTC / ETH
  /// * [minPositionValueUsd] - 最小持仓名义价值（USD），默认 1_000
  /// * [since] - 仅返回该时间之后的记录（ISO 时间字符串），默认过去 24 小时
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [WhaleAlertControllerGetRealtime200Response] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<WhaleAlertControllerGetRealtime200Response>> whaleAlertControllerGetRealtime({ 
    num? page = 1,
    num? limit = 50,
    String? symbol,
    num? minPositionValueUsd,
    String? since,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/whale-alerts/realtime';
    final _options = Options(
      method: r'GET',
      headers: <String, dynamic>{
        ...?headers,
      },
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[],
        ...?extra,
      },
      validateStatus: validateStatus,
    );

    final _queryParameters = <String, dynamic>{
      if (page != null) r'page': encodeQueryParameter(_serializers, page, const FullType(num)),
      if (limit != null) r'limit': encodeQueryParameter(_serializers, limit, const FullType(num)),
      if (symbol != null) r'symbol': encodeQueryParameter(_serializers, symbol, const FullType(String)),
      if (minPositionValueUsd != null) r'min_position_value_usd': encodeQueryParameter(_serializers, minPositionValueUsd, const FullType(num)),
      if (since != null) r'since': encodeQueryParameter(_serializers, since, const FullType(String)),
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    WhaleAlertControllerGetRealtime200Response? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(WhaleAlertControllerGetRealtime200Response),
      ) as WhaleAlertControllerGetRealtime200Response;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<WhaleAlertControllerGetRealtime200Response>(
      data: _responseData,
      headers: _response.headers,
      isRedirect: _response.isRedirect,
      requestOptions: _response.requestOptions,
      redirects: _response.redirects,
      statusCode: _response.statusCode,
      statusMessage: _response.statusMessage,
      extra: _response.extra,
    );
  }

  /// 获取 Hyperliquid 鲸鱼交易实时列表
  /// 
  ///
  /// Parameters:
  /// * [page] - 页码（从 1 开始）
  /// * [limit] - 返回记录上限，默认 50，最大 200
  /// * [symbol] - 币种符号，例如 BTC / ETH
  /// * [minTradeValueUsd] - 最小交易价值（USD），默认 1_000
  /// * [since] - 仅返回该时间之后的记录（ISO 时间字符串），默认过去 24 小时
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [WhaleAlertControllerGetWhaleTrades200Response] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<WhaleAlertControllerGetWhaleTrades200Response>> whaleAlertControllerGetWhaleTrades({ 
    num? page = 1,
    num? limit = 50,
    String? symbol,
    num? minTradeValueUsd,
    String? since,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/whale-alerts/trades';
    final _options = Options(
      method: r'GET',
      headers: <String, dynamic>{
        ...?headers,
      },
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[],
        ...?extra,
      },
      validateStatus: validateStatus,
    );

    final _queryParameters = <String, dynamic>{
      if (page != null) r'page': encodeQueryParameter(_serializers, page, const FullType(num)),
      if (limit != null) r'limit': encodeQueryParameter(_serializers, limit, const FullType(num)),
      if (symbol != null) r'symbol': encodeQueryParameter(_serializers, symbol, const FullType(String)),
      if (minTradeValueUsd != null) r'min_trade_value_usd': encodeQueryParameter(_serializers, minTradeValueUsd, const FullType(num)),
      if (since != null) r'since': encodeQueryParameter(_serializers, since, const FullType(String)),
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    WhaleAlertControllerGetWhaleTrades200Response? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(WhaleAlertControllerGetWhaleTrades200Response),
      ) as WhaleAlertControllerGetWhaleTrades200Response;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<WhaleAlertControllerGetWhaleTrades200Response>(
      data: _responseData,
      headers: _response.headers,
      isRedirect: _response.isRedirect,
      requestOptions: _response.requestOptions,
      redirects: _response.redirects,
      statusCode: _response.statusCode,
      statusMessage: _response.statusMessage,
      extra: _response.extra,
    );
  }

  /// 订阅 Hyperliquid 鲸鱼成交实时推送
  /// 
  ///
  /// Parameters:
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future]
  /// Throws [DioException] if API call or serialization fails
  Future<Response<void>> whaleAlertStreamControllerGetRealtimeStream({ 
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/whale-alerts/realtime-stream';
    final _options = Options(
      method: r'GET',
      headers: <String, dynamic>{
        ...?headers,
      },
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[],
        ...?extra,
      },
      validateStatus: validateStatus,
    );

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    return _response;
  }

}
