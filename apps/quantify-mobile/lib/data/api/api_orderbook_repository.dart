import 'dart:async';

import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:flutter/foundation.dart';

import '../models/orderbook_models.dart';
import '../repositories/orderbook_repository.dart';
import '../services/api_client.dart';
import '../services/generated_backend_api.dart';

/// [OrderbookRepository] 真实现（issue #2189）。
///
/// `watchOrderbook` 后端暂无 WS 契约，用周期轮询取最新快照。
class ApiOrderbookRepository implements OrderbookRepository {
  ApiOrderbookRepository(this._api);

  static const String _defaultType = 'perp';
  static const int _defaultDepth = 100;

  final GeneratedBackendApi _api;

  @visibleForTesting
  static String orderbookBaseFromSymbol(String symbol) {
    final String normalized = symbol
        .trim()
        .toUpperCase()
        .replaceAll('-', '')
        .replaceAll('/', '')
        .replaceAll('_', '');
    for (final String quote in <String>['USDT', 'USDC', 'USD']) {
      if (normalized.endsWith(quote) && normalized.length > quote.length) {
        return normalized.substring(0, normalized.length - quote.length);
      }
    }
    return normalized;
  }

  @visibleForTesting
  static OrderbookSnapshot buildSnapshot(
    String symbol,
    AggregatedOrderbookResponseDto data,
  ) {
    return OrderbookSnapshot(
      symbol: symbol,
      bids: data.bids.map(mapLevel).toList(growable: false),
      asks: data.asks.map(mapLevel).toList(growable: false),
      midPrice: data.midPrice.toDouble(),
      timestamp: DateTime.fromMillisecondsSinceEpoch(
        data.updatedAt.toInt(),
        isUtc: true,
      ),
    );
  }

  @visibleForTesting
  static OrderbookLevel mapLevel(AggregatedLevelDto dto) => OrderbookLevel(
    price: dto.price.toDouble(),
    quantity: dto.sizeTotal.toDouble(),
  );

  Future<OrderbookSnapshot> _fetch(String symbol) async {
    final Response<
      AggregatedOrderbookControllerGetAggregatedOrderbook200Response
    >
    response = await _api.client
        .getOrderbookApi()
        .aggregatedOrderbookControllerGetAggregatedOrderbook(
          base_: orderbookBaseFromSymbol(symbol),
          type: _defaultType,
          depth: _defaultDepth,
        );
    final AggregatedOrderbookResponseDto? data = response.data?.data;
    if (data == null) {
      throw const ApiException(message: 'empty orderbook response');
    }
    return buildSnapshot(symbol, data);
  }

  @override
  Future<OrderbookSnapshot> getSnapshot(String symbol) => _fetch(symbol);

  @override
  Stream<OrderbookSnapshot> watchOrderbook(String symbol) async* {
    yield await _fetch(symbol);
    yield* Stream<void>.periodic(
      const Duration(seconds: 2),
    ).asyncMap((_) => _fetch(symbol));
  }
}
