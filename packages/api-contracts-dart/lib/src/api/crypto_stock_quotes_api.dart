//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

import 'dart:async';

import 'package:built_value/json_object.dart';
import 'package:built_value/serializer.dart';
import 'package:dio/dio.dart';

import 'package:backend_api_contracts/src/api_util.dart';
import 'package:backend_api_contracts/src/model/crypto_stock_quotes_controller_get_latest200_response.dart';
import 'package:built_collection/built_collection.dart';

class CryptoStockQuotesApi {

  final Dio _dio;

  final Serializers _serializers;

  const CryptoStockQuotesApi(this._dio, this._serializers);

  /// 获取加密相关股票的最新报价列表
  /// 返回每个股票代码（symbol）的最新一条报价记录，可通过 symbols 过滤特定标的
  ///
  /// Parameters:
  /// * [symbols] - 股票代码列表，使用英文逗号分隔，例如：MSTR,COIN,MARA
  /// * [source_] - 数据源标识，例如：BBX；为空时使用默认数据源
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [CryptoStockQuotesControllerGetLatest200Response] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<CryptoStockQuotesControllerGetLatest200Response>> cryptoStockQuotesControllerGetLatest({ 
    BuiltList<String>? symbols,
    String? source_,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/crypto-stock-quotes/latest';
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
      if (symbols != null) r'symbols': encodeCollectionQueryParameter<String>(_serializers, symbols, const FullType(BuiltList, [FullType(String)]), format: ListFormat.multi,),
      if (source_ != null) r'source': encodeQueryParameter(_serializers, source_, const FullType(String)),
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    CryptoStockQuotesControllerGetLatest200Response? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(CryptoStockQuotesControllerGetLatest200Response),
      ) as CryptoStockQuotesControllerGetLatest200Response;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<CryptoStockQuotesControllerGetLatest200Response>(
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
