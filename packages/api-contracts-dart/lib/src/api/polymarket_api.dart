//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

import 'dart:async';

import 'package:built_value/json_object.dart';
import 'package:built_value/serializer.dart';
import 'package:dio/dio.dart';

import 'package:backend_api_contracts/src/api_util.dart';
import 'package:backend_api_contracts/src/model/prediction_market_card_dto.dart';
import 'package:built_collection/built_collection.dart';

class PolymarketApi {

  final Dio _dio;

  final Serializers _serializers;

  const PolymarketApi(this._dio, this._serializers);

  /// 获取 Polymarket 预测市场列表
  /// 
  ///
  /// Parameters:
  /// * [page] - 页码（从 1 开始）
  /// * [limit] - 每页数量（最大 100）
  /// * [category] - 市场分类（如 crypto）
  /// * [onlyActive] - 是否只返回活跃市场
  /// * [locale] - 语言（如 zh、zh-CN），不传时返回英文
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [BuiltList<PredictionMarketCardDto>] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<BuiltList<PredictionMarketCardDto>>> polymarketControllerListMarkets({ 
    num? page = 1,
    num? limit = 20,
    String? category,
    bool? onlyActive = true,
    String? locale,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/polymarket/markets';
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
      if (category != null) r'category': encodeQueryParameter(_serializers, category, const FullType(String)),
      if (onlyActive != null) r'onlyActive': encodeQueryParameter(_serializers, onlyActive, const FullType(bool)),
      if (locale != null) r'locale': encodeQueryParameter(_serializers, locale, const FullType(String)),
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    BuiltList<PredictionMarketCardDto>? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(BuiltList, [FullType(PredictionMarketCardDto)]),
      ) as BuiltList<PredictionMarketCardDto>;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<BuiltList<PredictionMarketCardDto>>(
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
