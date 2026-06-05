//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

import 'dart:async';

import 'package:built_value/json_object.dart';
import 'package:built_value/serializer.dart';
import 'package:dio/dio.dart';

import 'package:backend_api_contracts/src/api_util.dart';
import 'package:backend_api_contracts/src/model/kline_bar_dto.dart';
import 'package:built_collection/built_collection.dart';

class KlineApi {

  final Dio _dio;

  final Serializers _serializers;

  const KlineApi(this._dio, this._serializers);

  /// 获取 K 线数据
  /// 查询期货价格历史 OHLC 数据，支持单交易所或聚合模式
  ///
  /// Parameters:
  /// * [symbol] - 币种符号
  /// * [interval] - 时间粒度
  /// * [from] - 起始时间（秒）
  /// * [to] - 结束时间（秒）
  /// * [exchange] - 交易所代码（可选，不传则聚合所有交易所）
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [BuiltList<KlineBarDto>] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<BuiltList<KlineBarDto>>> klineControllerGetKlineBars({ 
    required String symbol,
    required String interval,
    required num from,
    required num to,
    String? exchange,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/kline';
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
      r'symbol': encodeQueryParameter(_serializers, symbol, const FullType(String)),
      r'interval': encodeQueryParameter(_serializers, interval, const FullType(String)),
      r'from': encodeQueryParameter(_serializers, from, const FullType(num)),
      r'to': encodeQueryParameter(_serializers, to, const FullType(num)),
      if (exchange != null) r'exchange': encodeQueryParameter(_serializers, exchange, const FullType(String)),
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    BuiltList<KlineBarDto>? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(BuiltList, [FullType(KlineBarDto)]),
      ) as BuiltList<KlineBarDto>;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<BuiltList<KlineBarDto>>(
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
