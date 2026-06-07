//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

import 'dart:async';

import 'package:built_value/json_object.dart';
import 'package:built_value/serializer.dart';
import 'package:dio/dio.dart';

import 'package:backend_api_contracts/src/api_util.dart';
import 'package:backend_api_contracts/src/model/liquidation_heatmap_response_dto.dart';

class LiquidationHeatmapApi {

  final Dio _dio;

  final Serializers _serializers;

  const LiquidationHeatmapApi(this._dio, this._serializers);

  /// 获取最新的清算热力图快照（单交易对）
  /// 
  ///
  /// Parameters:
  /// * [symbol] - 基础交易标的，例如 BTC
  /// * [exchangeCode] - 交易所代码，例如 BINANCE、OKX
  /// * [contractType] - 合约类型，例如 PERPETUAL
  /// * [timeInterval] - 时间区间/粒度，例如 15m、1h（默认 15m）
  /// * [modelType] - Coinglass 热力图模型类型
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [LiquidationHeatmapResponseDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<LiquidationHeatmapResponseDto>> liquidationHeatmapControllerGetLatest({ 
    required String symbol,
    String? exchangeCode,
    String? contractType,
    String? timeInterval = '15m',
    String? modelType,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/liquidation-heatmap/latest';
    final _options = Options(
      method: r'GET',
      headers: <String, dynamic>{
        ...?headers,
      },
      extra: <String, dynamic>{
        'secure': <Map<String, String>>[
          {
            'type': 'http',
            'scheme': 'bearer',
            'name': 'bearer',
          },
        ],
        ...?extra,
      },
      validateStatus: validateStatus,
    );

    final _queryParameters = <String, dynamic>{
      r'symbol': encodeQueryParameter(_serializers, symbol, const FullType(String)),
      if (exchangeCode != null) r'exchangeCode': encodeQueryParameter(_serializers, exchangeCode, const FullType(String)),
      if (contractType != null) r'contractType': encodeQueryParameter(_serializers, contractType, const FullType(String)),
      if (timeInterval != null) r'timeInterval': encodeQueryParameter(_serializers, timeInterval, const FullType(String)),
      if (modelType != null) r'modelType': encodeQueryParameter(_serializers, modelType, const FullType(String)),
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    LiquidationHeatmapResponseDto? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(LiquidationHeatmapResponseDto),
      ) as LiquidationHeatmapResponseDto;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<LiquidationHeatmapResponseDto>(
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
