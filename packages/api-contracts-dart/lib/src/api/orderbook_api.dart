//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

import 'dart:async';

import 'package:built_value/json_object.dart';
import 'package:built_value/serializer.dart';
import 'package:dio/dio.dart';

import 'package:backend_api_contracts/src/api_util.dart';
import 'package:backend_api_contracts/src/model/aggregated_orderbook_controller_get_aggregated_orderbook200_response.dart';
import 'package:backend_api_contracts/src/model/aggregated_orderbook_controller_get_available_markets200_response.dart';

class OrderbookApi {

  final Dio _dio;

  final Serializers _serializers;

  const OrderbookApi(this._dio, this._serializers);

  /// 获取聚合订单簿
  /// 合并多个交易所的订单簿数据，USDT/USDC 计价会自动合并
  ///
  /// Parameters:
  /// * [base_] - 基础资产
  /// * [type] - 市场类型
  /// * [venues] - 交易所列表，逗号分隔
  /// * [depth] - 深度档数
  /// * [tickSize] - 价格聚合档位（美元），例如 1 表示按 $1 分组，10 表示按 $10 分组
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [AggregatedOrderbookControllerGetAggregatedOrderbook200Response] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<AggregatedOrderbookControllerGetAggregatedOrderbook200Response>> aggregatedOrderbookControllerGetAggregatedOrderbook({ 
    required String base_,
    required String type,
    String? venues,
    num? depth,
    num? tickSize,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/orderbook/aggregated';
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
      r'base': encodeQueryParameter(_serializers, base_, const FullType(String)),
      r'type': encodeQueryParameter(_serializers, type, const FullType(String)),
      if (venues != null) r'venues': encodeQueryParameter(_serializers, venues, const FullType(String)),
      if (depth != null) r'depth': encodeQueryParameter(_serializers, depth, const FullType(num)),
      if (tickSize != null) r'tickSize': encodeQueryParameter(_serializers, tickSize, const FullType(num)),
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    AggregatedOrderbookControllerGetAggregatedOrderbook200Response? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(AggregatedOrderbookControllerGetAggregatedOrderbook200Response),
      ) as AggregatedOrderbookControllerGetAggregatedOrderbook200Response;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<AggregatedOrderbookControllerGetAggregatedOrderbook200Response>(
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

  /// 获取聚合订单簿可用币对
  /// 基于启用的订单簿交易对配置返回可聚合的基础资产、市场类型和交易所列表
  ///
  /// Parameters:
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [AggregatedOrderbookControllerGetAvailableMarkets200Response] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<AggregatedOrderbookControllerGetAvailableMarkets200Response>> aggregatedOrderbookControllerGetAvailableMarkets({ 
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/orderbook/aggregated/symbols';
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

    AggregatedOrderbookControllerGetAvailableMarkets200Response? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(AggregatedOrderbookControllerGetAvailableMarkets200Response),
      ) as AggregatedOrderbookControllerGetAvailableMarkets200Response;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<AggregatedOrderbookControllerGetAvailableMarkets200Response>(
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

}
