import 'dart:async';

import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart';

import '../mock/fixtures/agg_orders.dart';
import '../models/agg_market_data.dart';
import '../repositories/agg_orderbook_repository.dart';
import '../services/api_client.dart';
import '../services/generated_backend_api.dart';

/// [AggOrderbookRepository] 真实现（issue #2270，关联 #2269）。
///
/// 经 generated [OrderbookApi] 调真实 backend `/orderbook/aggregated`，把
/// [AggregatedOrderbookResponseDto] 的 asks/bids/venues 映射为盘口 levels 与
/// 交易所元数据。
///
/// OI/volume 元数据无匹配端点，复用 mock fixture 常量填充（OI/volume 待后端，
/// 跟踪 #2269）。
class ApiAggOrderbookRepository implements AggOrderbookRepository {
  ApiAggOrderbookRepository(this._api);

  static const String _defaultBase = 'BTC';
  static const String _defaultType = 'SPOT';

  /// venue → 调色板循环取色（契约无颜色元数据）。
  static const List<Color> _venuePalette = <Color>[
    Color(0xFFF59E0B),
    Color(0xFF3B82F6),
    Color(0xFF10B981),
    Color(0xFFA78BFA),
    Color(0xFFEC4899),
  ];

  final GeneratedBackendApi _api;

  @override
  Future<AggMarketData> getMarketData() async {
    final Response<AggregatedOrderbookControllerGetAggregatedOrderbook200Response>
        response = await _api.client
            .getOrderbookApi()
            .aggregatedOrderbookControllerGetAggregatedOrderbook(
              base_: _defaultBase,
              type: _defaultType,
            );
    final AggregatedOrderbookResponseDto? data = response.data?.data;
    if (data == null) {
      throw const ApiException(message: 'empty aggregated orderbook response');
    }
    return buildMarketData(data);
  }

  /// 契约 DTO → [AggMarketData]。盘口部分接真实；OI/volume 复用 mock 常量
  /// （待后端 #2269）。
  @visibleForTesting
  static AggMarketData buildMarketData(AggregatedOrderbookResponseDto data) {
    final List<AggExchange> exchanges = buildExchanges(data.venues);
    final Map<String, AggExchange> exchangeMap = <String, AggExchange>{
      for (final AggExchange e in exchanges) e.key: e,
    };
    return AggMarketData(
      exchanges: exchanges,
      exchangeMap: exchangeMap,
      precisions: kAggPrecisions,
      asks: data.asks.map(mapLevel).toList(growable: false),
      bids: data.bids.map(mapLevel).toList(growable: false),
      // OI/volume 待后端，跟踪 #2269 —— 暂复用 mock fixture 常量。
      oiCoins: kOiCoins,
      oiExchangeMap: kOiExchangeMap,
      oiData: kOiData,
      volCoins: kVolCoins,
      volExchangeName: kVolExchangeName,
      volColor: kVolColor,
      volData: kVolData,
      coinColor: kAggCoinColor,
    );
  }

  /// 单档 level：取首个 venue 作来源；hot/best/total 走默认。
  static AggBookLevel mapLevel(AggregatedLevelDto dto) {
    final String venue =
        dto.details.isNotEmpty ? dto.details.first.venueId : 'AGG';
    return AggBookLevel(
      price: dto.price.toDouble(),
      qty: dto.sizeTotal.toDouble(),
      exchange: venue,
    );
  }

  static List<AggExchange> buildExchanges(Iterable<String> venues) {
    final List<String> list = venues.toList(growable: false);
    final List<AggExchange> result = <AggExchange>[];
    for (int i = 0; i < list.length; i++) {
      final String v = list[i];
      result.add(
        AggExchange(
          key: v,
          name: v,
          letter: v.isEmpty ? '?' : v[0].toUpperCase(),
          color: _venuePalette[i % _venuePalette.length],
          fg: const Color(0xFF0B0E11),
        ),
      );
    }
    return result;
  }
}
