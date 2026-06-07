//
// AUTO-GENERATED FILE, DO NOT MODIFY!
//

import 'dart:async';

import 'package:built_value/json_object.dart';
import 'package:built_value/serializer.dart';
import 'package:dio/dio.dart';

import 'package:backend_api_contracts/src/api_util.dart';
import 'package:backend_api_contracts/src/model/aggregated_volume_snapshot_response_dto.dart';
import 'package:backend_api_contracts/src/model/market_trade_response_dto.dart';
import 'package:backend_api_contracts/src/model/markets_controller_get_aggregated_volumes200_response.dart';
import 'package:backend_api_contracts/src/model/markets_controller_get_exchange_long_short_ratio200_response.dart';
import 'package:backend_api_contracts/src/model/markets_controller_get_latest_trades200_response.dart';
import 'package:backend_api_contracts/src/model/markets_controller_get_long_short_ratio200_response.dart';
import 'package:backend_api_contracts/src/model/ticker_response_dto.dart';
import 'package:backend_api_contracts/src/model/trading_pair_config_response_dto.dart';
import 'package:built_collection/built_collection.dart';

class MarketsApi {

  final Dio _dio;

  final Serializers _serializers;

  const MarketsApi(this._dio, this._serializers);

  /// 查询聚合成交量快照
  /// 返回某币种各交易所成交量与总计，供移动端聚合盘口页 volume 表消费
  ///
  /// Parameters:
  /// * [symbol] - 币种符号
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [AggregatedVolumeSnapshotResponseDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<AggregatedVolumeSnapshotResponseDto>> marketsControllerGetAggregatedVolumeSnapshot({ 
    required String symbol,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/markets/volume/snapshot/{symbol}'.replaceAll('{' r'symbol' '}', encodeQueryParameter(_serializers, symbol, const FullType(String)).toString());
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

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    AggregatedVolumeSnapshotResponseDto? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(AggregatedVolumeSnapshotResponseDto),
      ) as AggregatedVolumeSnapshotResponseDto;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<AggregatedVolumeSnapshotResponseDto>(
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

  /// 查询聚合交易量（分页）
  /// 
  ///
  /// Parameters:
  /// * [symbol] - 币种符号
  /// * [page] - 页码（从 1 开始）
  /// * [limit] - 每页数量（最大 100）
  /// * [instrumentType] - 合约类型
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [MarketsControllerGetAggregatedVolumes200Response] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<MarketsControllerGetAggregatedVolumes200Response>> marketsControllerGetAggregatedVolumes({ 
    required String symbol,
    num? page = 1,
    num? limit = 20,
    String? instrumentType,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/markets/volume/aggregated';
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
      if (page != null) r'page': encodeQueryParameter(_serializers, page, const FullType(num)),
      if (limit != null) r'limit': encodeQueryParameter(_serializers, limit, const FullType(num)),
      r'symbol': encodeQueryParameter(_serializers, symbol, const FullType(String)),
      if (instrumentType != null) r'instrumentType': encodeQueryParameter(_serializers, instrumentType, const FullType(String)),
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    MarketsControllerGetAggregatedVolumes200Response? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(MarketsControllerGetAggregatedVolumes200Response),
      ) as MarketsControllerGetAggregatedVolumes200Response;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<MarketsControllerGetAggregatedVolumes200Response>(
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

  /// 按交易所维度获取指定标的的多空比快照
  /// 
  ///
  /// Parameters:
  /// * [symbol] - 基础资产符号，例如 BTC / ETH（会自动转为大写并去除空格）
  /// * [timeRange] - 统计时间范围，可选值：5m / 15m / 30m / 1h / 4h / 12h / 24h
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [MarketsControllerGetExchangeLongShortRatio200Response] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<MarketsControllerGetExchangeLongShortRatio200Response>> marketsControllerGetExchangeLongShortRatio({ 
    required String symbol,
    required String timeRange,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/markets/long-short-ratio/exchanges';
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
      r'timeRange': encodeQueryParameter(_serializers, timeRange, const FullType(String)),
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    MarketsControllerGetExchangeLongShortRatio200Response? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(MarketsControllerGetExchangeLongShortRatio200Response),
      ) as MarketsControllerGetExchangeLongShortRatio200Response;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<MarketsControllerGetExchangeLongShortRatio200Response>(
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

  /// 获取大额成交记录
  /// 
  ///
  /// Parameters:
  /// * [exchange] - 交易所代码
  /// * [instrumentType] - 合约类型
  /// * [symbol] - 交易对符号
  /// * [page] - 页码（从 1 开始）
  /// * [limit] - 返回记录数量
  /// * [minValue] - 最小成交金额（USDT）
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [BuiltList<MarketTradeResponseDto>] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<BuiltList<MarketTradeResponseDto>>> marketsControllerGetLargeTrades({ 
    required String exchange,
    required String instrumentType,
    required String symbol,
    num? page = 1,
    num? limit = 50,
    num? minValue = 100000,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/markets/trades/large';
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
      if (page != null) r'page': encodeQueryParameter(_serializers, page, const FullType(num)),
      if (limit != null) r'limit': encodeQueryParameter(_serializers, limit, const FullType(num)),
      r'exchange': encodeQueryParameter(_serializers, exchange, const FullType(String)),
      r'instrumentType': encodeQueryParameter(_serializers, instrumentType, const FullType(String)),
      r'symbol': encodeQueryParameter(_serializers, symbol, const FullType(String)),
      if (minValue != null) r'minValue': encodeQueryParameter(_serializers, minValue, const FullType(num)),
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    BuiltList<MarketTradeResponseDto>? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(BuiltList, [FullType(MarketTradeResponseDto)]),
      ) as BuiltList<MarketTradeResponseDto>;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<BuiltList<MarketTradeResponseDto>>(
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

  /// 获取最新成交记录
  /// 
  ///
  /// Parameters:
  /// * [exchange] - 交易所代码
  /// * [instrumentType] - 合约类型
  /// * [symbol] - 交易对符号
  /// * [page] - 页码（从 1 开始）
  /// * [limit] - 返回记录数量
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [MarketsControllerGetLatestTrades200Response] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<MarketsControllerGetLatestTrades200Response>> marketsControllerGetLatestTrades({ 
    required String exchange,
    required String instrumentType,
    required String symbol,
    num? page = 1,
    num? limit = 50,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/markets/trades/latest';
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
      if (page != null) r'page': encodeQueryParameter(_serializers, page, const FullType(num)),
      if (limit != null) r'limit': encodeQueryParameter(_serializers, limit, const FullType(num)),
      r'exchange': encodeQueryParameter(_serializers, exchange, const FullType(String)),
      r'instrumentType': encodeQueryParameter(_serializers, instrumentType, const FullType(String)),
      r'symbol': encodeQueryParameter(_serializers, symbol, const FullType(String)),
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    MarketsControllerGetLatestTrades200Response? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(MarketsControllerGetLatestTrades200Response),
      ) as MarketsControllerGetLatestTrades200Response;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<MarketsControllerGetLatestTrades200Response>(
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

  /// 获取交易对的多空比时间序列
  /// 
  ///
  /// Parameters:
  /// * [tradingPairId] - 交易对唯一 ID（TradingPairConfig.id），例如 BTCUSDT.BINANCE.PERP
  /// * [interval] - 时间粒度，可选值：1m / 5m / 15m / 1h / 4h / 1d（必填）
  /// * [page] - 页码（从 1 开始）
  /// * [limit] - 最多返回的数据点数量，默认 500，最大 2000
  /// * [from] - 开始时间（ISO 时间字符串，例如 2025-01-01T00:00:00Z）
  /// * [to] - 结束时间（ISO 时间字符串，例如 2025-01-01T23:59:59Z）
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [MarketsControllerGetLongShortRatio200Response] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<MarketsControllerGetLongShortRatio200Response>> marketsControllerGetLongShortRatio({ 
    required String tradingPairId,
    required String interval,
    num? page = 1,
    num? limit = 500,
    String? from,
    String? to,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/markets/long-short-ratio';
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
      if (page != null) r'page': encodeQueryParameter(_serializers, page, const FullType(num)),
      if (limit != null) r'limit': encodeQueryParameter(_serializers, limit, const FullType(num)),
      r'tradingPairId': encodeQueryParameter(_serializers, tradingPairId, const FullType(String)),
      r'interval': encodeQueryParameter(_serializers, interval, const FullType(String)),
      if (from != null) r'from': encodeQueryParameter(_serializers, from, const FullType(String)),
      if (to != null) r'to': encodeQueryParameter(_serializers, to, const FullType(String)),
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    MarketsControllerGetLongShortRatio200Response? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(MarketsControllerGetLongShortRatio200Response),
      ) as MarketsControllerGetLongShortRatio200Response;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<MarketsControllerGetLongShortRatio200Response>(
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

  /// 获取币种市场行情数据（Ticker）
  /// 
  ///
  /// Parameters:
  /// * [symbol] - 币种符号，如 BTC、ETH
  /// * [exchange] - 交易所名称，如 Binance、OKX。不传则返回聚合数据
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [TickerResponseDto] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<TickerResponseDto>> marketsControllerGetTicker({ 
    required String symbol,
    String? exchange,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/markets/ticker';
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

    TickerResponseDto? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(TickerResponseDto),
      ) as TickerResponseDto;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<TickerResponseDto>(
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

  /// 查询交易记录（分页）
  /// 
  ///
  /// Parameters:
  /// * [page] - 页码（从 1 开始）
  /// * [limit] - 每页数量（最大 100）
  /// * [exchange] - 交易所代码
  /// * [instrumentType] - 合约类型
  /// * [symbol] - 交易对符号
  /// * [baseAsset] - 基础资产
  /// * [quoteAsset] - 计价资产
  /// * [side] - 交易方向
  /// * [fromTimestamp] - 开始时间戳（毫秒）
  /// * [toTimestamp] - 结束时间戳（毫秒）
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [MarketsControllerGetLatestTrades200Response] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<MarketsControllerGetLatestTrades200Response>> marketsControllerGetTrades({ 
    num? page = 1,
    num? limit = 20,
    String? exchange,
    String? instrumentType,
    String? symbol,
    String? baseAsset,
    String? quoteAsset,
    String? side,
    num? fromTimestamp,
    num? toTimestamp,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/markets/trades';
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
      if (page != null) r'page': encodeQueryParameter(_serializers, page, const FullType(num)),
      if (limit != null) r'limit': encodeQueryParameter(_serializers, limit, const FullType(num)),
      if (exchange != null) r'exchange': encodeQueryParameter(_serializers, exchange, const FullType(String)),
      if (instrumentType != null) r'instrumentType': encodeQueryParameter(_serializers, instrumentType, const FullType(String)),
      if (symbol != null) r'symbol': encodeQueryParameter(_serializers, symbol, const FullType(String)),
      if (baseAsset != null) r'baseAsset': encodeQueryParameter(_serializers, baseAsset, const FullType(String)),
      if (quoteAsset != null) r'quoteAsset': encodeQueryParameter(_serializers, quoteAsset, const FullType(String)),
      if (side != null) r'side': encodeQueryParameter(_serializers, side, const FullType(String)),
      if (fromTimestamp != null) r'fromTimestamp': encodeQueryParameter(_serializers, fromTimestamp, const FullType(num)),
      if (toTimestamp != null) r'toTimestamp': encodeQueryParameter(_serializers, toTimestamp, const FullType(num)),
    };

    final _response = await _dio.request<Object>(
      _path,
      options: _options,
      queryParameters: _queryParameters,
      cancelToken: cancelToken,
      onSendProgress: onSendProgress,
      onReceiveProgress: onReceiveProgress,
    );

    MarketsControllerGetLatestTrades200Response? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(MarketsControllerGetLatestTrades200Response),
      ) as MarketsControllerGetLatestTrades200Response;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<MarketsControllerGetLatestTrades200Response>(
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

  /// 获取交易对配置列表
  /// 
  ///
  /// Parameters:
  /// * [venueType] - 交易 venue 类型
  /// * [instrumentType] - 交易品种类型
  /// * [exchange] - 交易所标识，仅对 CEX 生效
  /// * [cancelToken] - A [CancelToken] that can be used to cancel the operation
  /// * [headers] - Can be used to add additional headers to the request
  /// * [extras] - Can be used to add flags to the request
  /// * [validateStatus] - A [ValidateStatus] callback that can be used to determine request success based on the HTTP status of the response
  /// * [onSendProgress] - A [ProgressCallback] that can be used to get the send progress
  /// * [onReceiveProgress] - A [ProgressCallback] that can be used to get the receive progress
  ///
  /// Returns a [Future] containing a [Response] with a [BuiltList<TradingPairConfigResponseDto>] as data
  /// Throws [DioException] if API call or serialization fails
  Future<Response<BuiltList<TradingPairConfigResponseDto>>> marketsControllerGetTradingPairs({ 
    String? venueType,
    String? instrumentType,
    String? exchange,
    CancelToken? cancelToken,
    Map<String, dynamic>? headers,
    Map<String, dynamic>? extra,
    ValidateStatus? validateStatus,
    ProgressCallback? onSendProgress,
    ProgressCallback? onReceiveProgress,
  }) async {
    final _path = r'/markets/pairs';
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
      if (venueType != null) r'venueType': encodeQueryParameter(_serializers, venueType, const FullType(String)),
      if (instrumentType != null) r'instrumentType': encodeQueryParameter(_serializers, instrumentType, const FullType(String)),
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

    BuiltList<TradingPairConfigResponseDto>? _responseData;

    try {
      final rawResponse = _response.data;
      _responseData = rawResponse == null ? null : _serializers.deserialize(
        rawResponse,
        specifiedType: const FullType(BuiltList, [FullType(TradingPairConfigResponseDto)]),
      ) as BuiltList<TradingPairConfigResponseDto>;

    } catch (error, stackTrace) {
      throw DioException(
        requestOptions: _response.requestOptions,
        response: _response,
        type: DioExceptionType.unknown,
        error: error,
        stackTrace: stackTrace,
      );
    }

    return Response<BuiltList<TradingPairConfigResponseDto>>(
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
