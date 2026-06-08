import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:flutter/material.dart';

import '../models/exchange_long_short_models.dart';
import '../models/kline_models.dart';
import '../models/long_short_models.dart';
import '../repositories/long_short_repository.dart';
import '../services/generated_backend_api.dart';
import '../services/json_codec.dart';
import 'api_kline_repository.dart';

/// [LongShortRepository] 真实现。
///
/// 对齐 front 交易所多空比：调用 generated backend SDK 的
/// `/markets/long-short-ratio/exchanges`，请求 `symbol` + `timeRange`，客户端
/// 汇总各交易所 long/short amount 得到 hero 卡总览。
class ApiLongShortRepository implements LongShortRepository {
  ApiLongShortRepository(this._api);

  static const String _defaultTimeRange = '4h';

  final GeneratedBackendApi _api;

  @override
  Future<LongShortRatio> getRatio({
    required String symbol,
    required KlineInterval interval,
  }) async {
    final Response<MarketsControllerGetLongShortRatio200Response> response =
        await _api.client.getMarketsApi().marketsControllerGetLongShortRatio(
          tradingPairId: _tradingPairIdFromSymbol(symbol),
          interval: klineIntervalToApi(interval),
          limit: 1,
        );
    final Object? raw = response.data?.items.isNotEmpty == true
        ? response.data!.items.first.value
        : null;
    final Map<String, dynamic> map = asMap(raw);
    final double ratio = asDouble(
      pick(map, <String>['longShortRatio']),
      fallback: 1,
    );
    final double longRatio = ratio.isFinite && ratio > 0
        ? ratio / (1 + ratio)
        : 0.5;
    return LongShortRatio(
      symbol: symbol,
      longRatio: longRatio,
      shortRatio: 1 - longRatio,
      timestamp: asDateTime(pick(map, <String>['timestamp'])),
    );
  }

  @override
  Future<MarketLongShortSnapshot> getSnapshot({required String symbol}) async {
    final String baseAsset = _baseAssetFromSymbol(symbol);
    final Response<MarketsControllerGetExchangeLongShortRatio200Response>
    response = await _api.client
        .getMarketsApi()
        .marketsControllerGetExchangeLongShortRatio(
          symbol: baseAsset,
          timeRange: _defaultTimeRange,
        );

    final List<Map<String, dynamic>> rows = asMapList(
      response.data?.data.value,
    );
    final List<ExchangeLongShort> exchanges = rows
        .map(_exchangeFromJson)
        .whereType<ExchangeLongShort>()
        .toList(growable: false);
    if (exchanges.isEmpty) return _emptySnapshot(symbol);

    final double longUsd = rows.fold<double>(
      0,
      (double sum, Map<String, dynamic> row) =>
          sum + asDouble(pick(row, <String>['longAmountUsd'])),
    );
    final double shortUsd = rows.fold<double>(
      0,
      (double sum, Map<String, dynamic> row) =>
          sum + asDouble(pick(row, <String>['shortAmountUsd'])),
    );
    final double totalUsd = longUsd + shortUsd;
    final double longPct = totalUsd > 0 ? longUsd / totalUsd * 100 : 0;
    final double shortPct = totalUsd > 0 ? 100 - longPct : 0;

    return MarketLongShortSnapshot(
      symbol: symbol,
      baseAsset: baseAsset,
      assetGlyph: _assetGlyph(baseAsset),
      assetGradientStart: const Color(0xFFF59E0B),
      assetGradientEnd: const Color(0xFFF97316),
      totalNotional: _formatUsdCompact(totalUsd),
      longNotional: _formatUsdCompact(longUsd),
      shortNotional: _formatUsdCompact(shortUsd),
      longPct: longPct,
      shortPct: shortPct,
      exchanges: exchanges,
      timestamp: DateTime.now().toUtc(),
    );
  }
}

ExchangeLongShort? _exchangeFromJson(Map<String, dynamic> row) {
  final String name = asString(pick(row, <String>['name'])).trim();
  if (name.isEmpty) return null;
  return ExchangeLongShort(
    exchange: name,
    color: _exchangeColor(name),
    glyph: _exchangeGlyph(name),
    longAmount: _formatUsdCompact(
      asDouble(pick(row, <String>['longAmountUsd'])),
    ),
    shortAmount: _formatUsdCompact(
      asDouble(pick(row, <String>['shortAmountUsd'])),
    ),
    longPct: asDouble(pick(row, <String>['longPercent'])),
    shortPct: asDouble(pick(row, <String>['shortPercent'])),
  );
}

String _tradingPairIdFromSymbol(String symbol) =>
    '${_baseAssetFromSymbol(symbol)}USDT.BINANCE.PERP';

String _baseAssetFromSymbol(String symbol) {
  final String normalized = symbol
      .trim()
      .toUpperCase()
      .replaceAll('/', '')
      .replaceAll('-', '')
      .replaceAll('_', '');
  for (final String quote in <String>['USDT', 'USDC', 'USD']) {
    if (normalized.endsWith(quote) && normalized.length > quote.length) {
      return normalized.substring(0, normalized.length - quote.length);
    }
  }
  return normalized;
}

String _assetGlyph(String baseAsset) =>
    baseAsset.isEmpty ? '?' : baseAsset.substring(0, 1);

String _exchangeGlyph(String name) {
  final String trimmed = name.trim();
  return trimmed.isEmpty ? '?' : trimmed.substring(0, 1).toUpperCase();
}

Color _exchangeColor(String name) {
  switch (name.trim().toUpperCase()) {
    case 'BINANCE':
      return const Color(0xFFF0B90B);
    case 'OKX':
      return const Color(0xFF111827);
    case 'BYBIT':
      return const Color(0xFFF7A600);
    case 'BITGET':
      return const Color(0xFF00F0FF);
    case 'DERIBIT':
      return const Color(0xFF22C55E);
    default:
      return const Color(0xFF64748B);
  }
}

String _formatUsdCompact(double value) {
  final double abs = value.abs();
  if (abs >= 1000000000) {
    return '\$${(value / 1000000000).toStringAsFixed(2)}B';
  }
  if (abs >= 1000000) {
    return '\$${(value / 1000000).toStringAsFixed(2)}M';
  }
  if (abs >= 1000) return '\$${(value / 1000).toStringAsFixed(2)}K';
  return '\$${value.toStringAsFixed(0)}';
}

MarketLongShortSnapshot _emptySnapshot(String symbol) {
  final String baseAsset = _baseAssetFromSymbol(symbol);
  return MarketLongShortSnapshot(
    symbol: symbol,
    baseAsset: baseAsset.isEmpty ? symbol : baseAsset,
    assetGlyph: _assetGlyph(baseAsset),
    assetGradientStart: const Color(0xFF6B7280),
    assetGradientEnd: const Color(0xFF374151),
    totalNotional: '\$0',
    longNotional: '\$0',
    shortNotional: '\$0',
    longPct: 0,
    shortPct: 0,
    exchanges: const <ExchangeLongShort>[],
    timestamp: DateTime.fromMillisecondsSinceEpoch(0, isUtc: true),
  );
}
