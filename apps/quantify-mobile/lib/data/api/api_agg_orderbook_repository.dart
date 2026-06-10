import 'dart:async';

import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/serializer.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/painting.dart';

import '../models/agg_market_data.dart';
import '../repositories/agg_orderbook_repository.dart';
import '../services/api_client.dart';
import '../services/generated_backend_api.dart';

/// [AggOrderbookRepository] 真实现（issue #2270，关联 #2269）。
///
/// 经 generated [OrderbookApi] 调真实 backend `/orderbook/aggregated`，把
/// [AggregatedOrderbookResponseDto] 的 asks/bids/venues 映射为盘口 levels 与
/// 交易所元数据；同时用 generated DefaultApi / MarketsApi 接入
/// `/open-interest/aggregate/{symbol}` 与 `/markets/volume/snapshot/{symbol}`。
class ApiAggOrderbookRepository implements AggOrderbookRepository {
  ApiAggOrderbookRepository(this._api);

  static const List<int> _defaultPrecisions = <int>[1, 10, 100];
  static const List<String> _defaultMetricCoins = <String>[
    'BTC',
    'ETH',
    'SOL',
    'XRP',
    'DOGE',
    'HYPE',
    'BNB',
    'ZEC',
    'BCH',
    'SUI',
    'ADA',
    'LINK',
    'AVAX',
  ];

  /// venue → 调色板循环取色（契约无颜色元数据）。
  static const List<Color> _venuePalette = <Color>[
    Color(0xFFF59E0B),
    Color(0xFF3B82F6),
    Color(0xFF10B981),
    Color(0xFFA78BFA),
    Color(0xFFEC4899),
  ];

  static const Map<String, String> _exchangeLogoUrls = <String, String>{
    'aster': 'https://cfx-www-staging.devbase.cloud/images/exchanges/aster.png',
    'binance':
        'https://cfx-www-staging.devbase.cloud/images/exchanges/binance.png',
    'bingx': 'https://cfx-www-staging.devbase.cloud/images/exchanges/bingx.png',
    'bitfinex':
        'https://cfx-www-staging.devbase.cloud/images/exchanges/bitfinex.png',
    'bitget':
        'https://cfx-www-staging.devbase.cloud/images/exchanges/bitget.png',
    'bitmex': 'https://icons.llamao.fi/icons/protocols/bitmex?w=64&h=64',
    'bitmax':
        'https://coin-images.coingecko.com/markets/images/277/small/%E5%8E%9F%E8%89%B2.png?1706864357',
    'bitunix':
        'https://cfx-www-staging.devbase.cloud/images/exchanges/bitunix.png',
    'bybit': 'https://cfx-www-staging.devbase.cloud/images/exchanges/bybit.png',
    'cme': 'https://cfx-www-staging.devbase.cloud/images/exchanges/cme.png',
    'coinbase':
        'https://cfx-www-staging.devbase.cloud/images/exchanges/coinbase.png',
    'coinex': 'https://icons.llamao.fi/icons/protocols/coinex?w=64&h=64',
    'crypto.com':
        'https://icons.llamao.fi/icons/protocols/crypto.com?w=64&h=64',
    'deribit':
        'https://cfx-www-staging.devbase.cloud/images/exchanges/deribit.png',
    'dydx': 'https://cfx-www-staging.devbase.cloud/images/exchanges/dydx.png',
    'gate': 'https://cfx-www-staging.devbase.cloud/images/exchanges/gate.png',
    'htx': 'https://cfx-www-staging.devbase.cloud/images/exchanges/htx.png',
    'hyperliquid':
        'https://cfx-www-staging.devbase.cloud/images/exchanges/hyperliquid.png',
    'kraken':
        'https://cfx-www-staging.devbase.cloud/images/exchanges/kraken.png',
    'kucoin':
        'https://cfx-www-staging.devbase.cloud/images/exchanges/kucoin.png',
    'lbank': 'https://icons.llamao.fi/icons/protocols/lbank?w=64&h=64',
    'lighter': 'https://icons.llamao.fi/icons/protocols/lighter?w=64&h=64',
    'mexc': 'https://cfx-www-staging.devbase.cloud/images/exchanges/mexc.png',
    'okx': 'https://cfx-www-staging.devbase.cloud/images/exchanges/okx.png',
    'whitebit': 'https://icons.llamao.fi/icons/protocols/whitebit?w=64&h=64',
  };

  final GeneratedBackendApi _api;

  @override
  Future<AggMarketData> getMarketData({
    AggMarketRequest request = const AggMarketRequest.defaultMarket(),
  }) async {
    final String base = request.normalizedBase;
    final String type = request.normalizedType;
    final List<String> metricCoins = _metricCoinsFor(base);
    final (
      AggregatedOrderbookResponseDto? orderbook,
      Map<String, OiSnapshot> oiData,
      Map<String, VolSnapshot> volData,
    ) = await (
      _fetchOrderbook(base: base, type: type),
      _fetchOiSnapshots(metricCoins),
      _fetchVolumeSnapshots(metricCoins),
    ).wait;

    if (orderbook == null) {
      throw const ApiException(message: 'empty aggregated orderbook response');
    }
    return buildMarketData(
      orderbook,
      oiData: oiData,
      volData: volData,
      metricCoins: metricCoins,
    );
  }

  Future<AggregatedOrderbookResponseDto?> _fetchOrderbook({
    required String base,
    required String type,
  }) async {
    final Response<
      AggregatedOrderbookControllerGetAggregatedOrderbook200Response
    >
    response = await _api.client
        .getOrderbookApi()
        .aggregatedOrderbookControllerGetAggregatedOrderbook(
          base_: base,
          type: type,
        );
    return response.data?.data;
  }

  Future<Map<String, OiSnapshot>> _fetchOiSnapshots(
    List<String> symbols,
  ) async {
    final List<(String, OiSnapshot)?> entries = await Future.wait(
      symbols.map((String symbol) async {
        try {
          final Response<OpenInterestControllerGetAggregateSnapshot200Response>
          response = await _api.client
              .getDefaultApi()
              .openInterestControllerGetAggregateSnapshot(symbol: symbol);
          return (symbol, mapOiSnapshot(_decodeOiSnapshot(response.data)));
        } catch (_) {
          return null;
        }
      }),
    );
    return <String, OiSnapshot>{
      for (final e in entries)
        if (e != null) e.$1: e.$2,
    };
  }

  Future<Map<String, VolSnapshot>> _fetchVolumeSnapshots(
    List<String> symbols,
  ) async {
    final List<(String, VolSnapshot)?> entries = await Future.wait(
      symbols.map((String symbol) async {
        try {
          final Response<AggregatedVolumeSnapshotResponseDto> response =
              await _api.client
                  .getMarketsApi()
                  .marketsControllerGetAggregatedVolumeSnapshot(symbol: symbol);
          final AggregatedVolumeSnapshotResponseDto? data = response.data;
          if (data == null) return null;
          return (symbol, mapVolSnapshot(data));
        } on DioException catch (error) {
          final AggregatedVolumeSnapshotResponseDto? data =
              decodeVolumeSnapshot(
                error.response?.data,
                serializers: _api.client.serializers,
              );
          if (data == null) return null;
          return (symbol, mapVolSnapshot(data));
        } catch (_) {
          return null;
        }
      }),
    );
    return <String, VolSnapshot>{
      for (final e in entries)
        if (e != null) e.$1: e.$2,
    };
  }

  OiAggregateSnapshotDto _decodeOiSnapshot(
    OpenInterestControllerGetAggregateSnapshot200Response? response,
  ) {
    final JsonObject? raw = response?.data;
    final Object? value = raw?.value;
    if (value == null) {
      throw const ApiException(
        message: 'empty aggregate open interest response',
      );
    }
    return _api.client.serializers.deserialize(
          value,
          specifiedType: const FullType(OiAggregateSnapshotDto),
        )
        as OiAggregateSnapshotDto;
  }

  /// 契约 DTO → [AggMarketData]。
  @visibleForTesting
  static AggMarketData buildMarketData(
    AggregatedOrderbookResponseDto data, {
    Map<String, OiSnapshot> oiData = const <String, OiSnapshot>{},
    Map<String, VolSnapshot> volData = const <String, VolSnapshot>{},
    List<String> metricCoins = _defaultMetricCoins,
  }) {
    final List<AggExchange> exchanges = buildExchanges(data.venues);
    final Map<String, AggExchange> exchangeMap = <String, AggExchange>{
      for (final AggExchange e in exchanges) e.key: e,
    };
    final List<String> oiCoins = _coinsWithData(oiData, metricCoins);
    final List<String> volCoins = _coinsWithData(volData, metricCoins);
    final List<String> oiExchanges = _uniqueSorted(
      oiData.values.expand(
        (OiSnapshot s) => s.rows.map((OiRow r) => r.exchange),
      ),
    );
    final List<String> volExchanges = _uniqueSorted(
      volData.values.expand(
        (VolSnapshot s) => s.rows.map((VolRow r) => r.exchange),
      ),
    );
    final Map<String, AggExchange> oiExchangeMap = <String, AggExchange>{
      for (final AggExchange e in buildExchanges(oiExchanges)) e.key: e,
    };
    final Map<String, Color> volColor = buildColorMap(volExchanges);
    return AggMarketData(
      exchanges: exchanges,
      exchangeMap: exchangeMap,
      precisions: _defaultPrecisions,
      asks: data.asks.map(mapLevel).toList(growable: false),
      bids: data.bids.map(mapLevel).toList(growable: false),
      oiCoins: oiCoins,
      oiExchangeMap: oiExchangeMap,
      oiData: oiData,
      volCoins: volCoins,
      volExchangeName: <String, String>{
        for (final String e in volExchanges) e: e,
      },
      volColor: volColor,
      volData: volData,
      coinColor: buildColorMap(
        _uniqueSorted(<String>{...oiCoins, ...volCoins}),
      ),
    );
  }

  /// 单档 level：取首个 venue 作来源；hot/best/total 走默认。
  static AggBookLevel mapLevel(AggregatedLevelDto dto) {
    final String venue = dto.details.isNotEmpty
        ? normalizeVenueId(dto.details.first.venueId)
        : 'AGG';
    return AggBookLevel(
      price: dto.price.toDouble(),
      qty: dto.sizeTotal.toDouble(),
      exchange: venue,
    );
  }

  static String normalizeVenueId(String venueId) {
    return venueId
        .replaceFirst(RegExp(r'-(perp|spot)$', caseSensitive: false), '')
        .trim();
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
          logoUrl: _exchangeLogoUrls[v.toLowerCase()],
        ),
      );
    }
    return result;
  }

  static OiSnapshot mapOiSnapshot(OiAggregateSnapshotDto dto) {
    return OiSnapshot(
      total: OiTotal(
        qty: dto.total.qty.toDouble(),
        usd: dto.total.usd.toDouble(),
        h24: dto.total.h24.toDouble(),
      ),
      rows: dto.rows
          .map(
            (OiAggregateRowDto row) => OiRow(
              exchange: row.exchange,
              qty: row.qty.toDouble(),
              usd: row.usd.toDouble(),
              pct: row.pct.toDouble(),
              h1: row.h1.toDouble(),
              h4: row.h4.toDouble(),
              h24: row.h24.toDouble(),
              oiVol: row.oiVol.toDouble(),
            ),
          )
          .toList(growable: false),
    );
  }

  static VolSnapshot mapVolSnapshot(AggregatedVolumeSnapshotResponseDto dto) {
    return VolSnapshot(
      total: dto.total.toDouble(),
      rows: dto.rows
          .map(
            (AggregatedVolumeRowDto row) =>
                VolRow(exchange: row.exchange, value: row.value.toDouble()),
          )
          .toList(growable: false),
    );
  }

  @visibleForTesting
  static AggregatedVolumeSnapshotResponseDto? decodeVolumeSnapshot(
    Object? raw, {
    required Serializers serializers,
  }) {
    final Object? payload = unwrapEnvelopeData(raw);
    if (payload == null) return null;
    return serializers.deserialize(
          payload,
          specifiedType: const FullType(AggregatedVolumeSnapshotResponseDto),
        )
        as AggregatedVolumeSnapshotResponseDto;
  }

  @visibleForTesting
  static Object? unwrapEnvelopeData(Object? raw) {
    if (raw is JsonObject) return raw.value;
    if (raw is Map) {
      if (raw.containsKey('data')) return raw['data'];
      if (raw.containsKey('symbol')) return raw;
      return null;
    }
    return raw;
  }

  static Map<String, Color> buildColorMap(Iterable<String> keys) {
    final List<String> list = keys.toList(growable: false);
    return <String, Color>{
      'TOTAL': _venuePalette.first,
      for (int i = 0; i < list.length; i++)
        list[i]: _venuePalette[i % _venuePalette.length],
    };
  }

  static List<String> _coinsWithData(
    Map<String, Object> data,
    List<String> metricCoins,
  ) {
    return metricCoins
        .where((String coin) => data.containsKey(coin))
        .toList(growable: false);
  }

  static List<String> _metricCoinsFor(String base) {
    final List<String> coins = <String>[base];
    for (final String coin in _defaultMetricCoins) {
      if (coin != base) coins.add(coin);
    }
    return coins;
  }

  static List<String> _uniqueSorted(Iterable<String> values) {
    final List<String> result = values
        .where((String v) => v.trim().isNotEmpty)
        .toSet()
        .toList(growable: false);
    result.sort();
    return result;
  }
}
