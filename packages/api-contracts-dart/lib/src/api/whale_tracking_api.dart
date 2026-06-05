//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

import 'dart:async';

import 'package:built_value/json_object.dart';
import 'package:built_value/serializer.dart';
import 'package:dio/dio.dart';

import 'package:backend_api_contracts/src/api_util.dart';
import 'package:backend_api_contracts/src/model/trader_discover_tags_response_dto.dart';
import 'package:backend_api_contracts/src/model/trader_open_orders_response_dto.dart';
import 'package:backend_api_contracts/src/model/trader_positions_response_dto.dart';
import 'package:backend_api_contracts/src/model/trader_snapshot_response_dto.dart';
import 'package:backend_api_contracts/src/model/whale_address_performance_response_dto.dart';
import 'package:backend_api_contracts/src/model/whale_discover_response_dto.dart';

class WhaleTrackingApi {

  final Dio _dio;

  final Serializers _serializers;

  const WhaleTrackingApi(this._dio, this._serializers);

  /// 鲸鱼发现页 - 获取推荐鲸鱼与详情列表
  /// 基于 Hyperliquid 鲸鱼预警数据，按最近一段时间的持仓价值与活跃度聚合出一批代表性鲸鱼地址，用于 discover 页面渲染。
  ///
  /// Parameters:
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [WhaleDiscoverResponseDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<WhaleDiscoverResponseDto>> whaleTrackingControllerGetDiscover({ 
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/whale-tracking/discover';
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

    WhaleDiscoverResponseDto? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(WhaleDiscoverResponseDto),
      ) as WhaleDiscoverResponseDto;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<WhaleDiscoverResponseDto>(
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

  /// 获取鲸鱼交易者 Discover 视角标签
  /// 基于 Hyperliquid Whale Alert 近 lookbackDays（当前 7 天）的聚合统计，复用 Discover 的 AI 打标逻辑，为 Profile Header 提供 Discover 视角的标签。
  ///
  /// Parameters:
  /// * [address] 
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [TraderDiscoverTagsResponseDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<TraderDiscoverTagsResponseDto>> whaleTrackingControllerGetTraderDiscoverTags({ 
    required String address,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/whale-tracking/traders/{address}/discover-tags'.replaceAll('{' r'address' '}', encodeQueryParameter(_serializers, address, const FullType(String)).toString());
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

    TraderDiscoverTagsResponseDto? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(TraderDiscoverTagsResponseDto),
      ) as TraderDiscoverTagsResponseDto;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<TraderDiscoverTagsResponseDto>(
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

  /// 获取鲸鱼交易者挂单列表
  /// 通过 Hyperliquid API 实时查询指定地址的当前挂单列表，包括订单 ID、币种、方向、类型、限价、数量、订单价值、创建时间等信息。支持按币种筛选，默认缓存 5 秒。
  ///
  /// Parameters:
  /// * [address] 
  /// * [coin] - 币种符号筛选（可选）
  /// * [skipCache] - 是否跳过缓存，强制实时查询
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [TraderOpenOrdersResponseDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<TraderOpenOrdersResponseDto>> whaleTrackingControllerGetTraderOpenOrders({ 
    required String address,
    String? coin,
    bool? skipCache,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/whale-tracking/traders/{address}/open-orders'.replaceAll('{' r'address' '}', encodeQueryParameter(_serializers, address, const FullType(String)).toString());
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
      if (coin != null) r'coin': encodeQueryParameter(_serializers, coin, const FullType(String)),
      if (skipCache != null) r'skipCache': encodeQueryParameter(_serializers, skipCache, const FullType(bool)),
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    TraderOpenOrdersResponseDto? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(TraderOpenOrdersResponseDto),
      ) as TraderOpenOrdersResponseDto;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<TraderOpenOrdersResponseDto>(
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

  /// 鲸鱼地址维度的历史交易与绩效统计
  /// 基于 Hyperliquid Whale Alert 数据，对指定鲸鱼地址在给定时间窗口内的名义价值、方向分布等信息做聚合统计，并返回按币种与时间排序的预警明细。当前返回的 PnL 与胜率字段为占位统计值，仅用于可视化与排序，不代表真实历史盈亏/胜率。
  ///
  /// Parameters:
  /// * [address] 
  /// * [page] - 页码（从 1 开始）
  /// * [limit] - 返回的最大明细记录数，默认 200，最大 500
  /// * [timeRangeDays] - 回溯时间范围（天），默认 30 天，最大 365 天
  /// * [symbol] - 币种符号过滤，例如 BTC / ETH；留空表示所有币种
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [WhaleAddressPerformanceResponseDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<WhaleAddressPerformanceResponseDto>> whaleTrackingControllerGetTraderPerformance({ 
    required String address,
    num? page = 1,
    num? limit = 200,
    num? timeRangeDays,
    String? symbol,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/whale-tracking/traders/{address}/performance'.replaceAll('{' r'address' '}', encodeQueryParameter(_serializers, address, const FullType(String)).toString());
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
      if (timeRangeDays != null) r'timeRangeDays': encodeQueryParameter(_serializers, timeRangeDays, const FullType(num)),
      if (symbol != null) r'symbol': encodeQueryParameter(_serializers, symbol, const FullType(String)),
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    WhaleAddressPerformanceResponseDto? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(WhaleAddressPerformanceResponseDto),
      ) as WhaleAddressPerformanceResponseDto;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<WhaleAddressPerformanceResponseDto>(
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

  /// 获取鲸鱼交易者持仓详情
  /// 通过 Hyperliquid API 实时查询指定地址的持仓详情，包括永续合约持仓（币种、方向、数量、入场价、标记价、清算价、未实现盈亏、杠杆信息）与现货余额（币种、总量、锁定量、可用量、价值）。支持按类型筛选（perp/spot/all），默认缓存 5 秒。
  ///
  /// Parameters:
  /// * [address] 
  /// * [type] - 持仓类型筛选
  /// * [skipCache] - 是否跳过缓存，强制实时查询
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [TraderPositionsResponseDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<TraderPositionsResponseDto>> whaleTrackingControllerGetTraderPositions({ 
    required String address,
    String? type,
    bool? skipCache,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/whale-tracking/traders/{address}/positions'.replaceAll('{' r'address' '}', encodeQueryParameter(_serializers, address, const FullType(String)).toString());
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
      if (type != null) r'type': encodeQueryParameter(_serializers, type, const FullType(String)),
      if (skipCache != null) r'skipCache': encodeQueryParameter(_serializers, skipCache, const FullType(bool)),
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    TraderPositionsResponseDto? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(TraderPositionsResponseDto),
      ) as TraderPositionsResponseDto;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<TraderPositionsResponseDto>(
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

  /// 获取鲸鱼交易者账户快照
  /// 通过 Hyperliquid API 实时查询指定地址的账户快照数据，包括永续合约账户状态（账户价值、保证金使用率、杠杆倍数、未实现盈亏）与现货余额汇总。数据直接来源于 Hyperliquid 清算所状态，默认缓存 5 秒。
  ///
  /// Parameters:
  /// * [address] 
  /// * [skipCache] - 是否跳过缓存，强制实时查询
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [TraderSnapshotResponseDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<TraderSnapshotResponseDto>> whaleTrackingControllerGetTraderSnapshot({ 
    required String address,
    bool? skipCache,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/whale-tracking/traders/{address}/snapshot'.replaceAll('{' r'address' '}', encodeQueryParameter(_serializers, address, const FullType(String)).toString());
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
      if (skipCache != null) r'skipCache': encodeQueryParameter(_serializers, skipCache, const FullType(bool)),
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    TraderSnapshotResponseDto? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(TraderSnapshotResponseDto),
      ) as TraderSnapshotResponseDto;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<TraderSnapshotResponseDto>(
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
