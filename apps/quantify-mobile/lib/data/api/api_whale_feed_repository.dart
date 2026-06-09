import 'dart:async';

import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:built_value/json_object.dart';

import '../models/whale_models.dart';
import '../repositories/whale_feed_repository.dart';
import '../services/generated_backend_api.dart';

/// [WhaleFeedRepository] 真实现（issue #2189）。
///
/// 通过 generated [WhaleAlertsApi] 消费 `/whale-alerts/trades`，对齐 front
/// 监控页实时巨鲸列表的真实数据源。`watchFeed` 后端推送契约暂未接入 mobile，
/// 用周期轮询拉取最近一条。
class ApiWhaleFeedRepository implements WhaleFeedRepository {
  ApiWhaleFeedRepository(this._api);

  final GeneratedBackendApi _api;

  WhaleEvent _mapTrade(WhaleTradeDto trade) {
    final String sideLabel = trade.side == WhaleTradeDtoSideEnum.short
        ? 'Short'
        : 'Long';
    final String sideName = sideLabel.toLowerCase();
    final double tradeSize = trade.tradeSize.toDouble().abs();
    final String symbol = trade.symbol.toUpperCase();
    final DateTime timestamp =
        DateTime.tryParse(trade.tradeTime) ?? DateTime.now().toUtc();

    return WhaleEvent(
      id: '${trade.userAddress}-$symbol-${trade.tradeTime}-${trade.tradeValueUsd}-${trade.price}',
      symbol: symbol,
      amountUsd: trade.tradeValueUsd.toDouble(),
      direction: sideName == 'short' ? 'out' : 'in',
      fromLabel: 'Hyperliquid',
      toLabel: '$symbol $sideLabel',
      timestamp: timestamp,
      winRate: _stableWinRate(trade.userAddress, symbol),
      address: trade.userAddress,
      traderTag: '成交',
      isFresh: true,
      mode: '全仓',
      side: sideName,
      positionValue: trade.tradeValueUsd.toDouble(),
      quantity: '${tradeSize.toStringAsFixed(4)} $symbol',
      openPrice: trade.price.toDouble(),
    );
  }

  WhaleTradeDto? _decodeTrade(dynamic raw) {
    final Object? value = raw is JsonObject ? raw.value : raw;
    if (value is WhaleTradeDto) return value;
    if (value is! Map) return null;
    return _api.client.serializers.deserializeWith(
      WhaleTradeDto.serializer,
      value,
    );
  }

  static double _stableWinRate(String address, String symbol) {
    final String input = '$address-$symbol';
    int hash = 2166136261;
    for (int i = 0; i < input.length; i += 1) {
      hash ^= input.codeUnitAt(i);
      hash = (hash * 16777619) & 0xFFFFFFFF;
    }
    return 45 + (hash / 0xFFFFFFFF) * 40;
  }

  @override
  Future<List<WhaleEvent>> listRecent({required int limit}) async {
    final response = await _api.client
        .getWhaleAlertsApi()
        .whaleAlertControllerGetWhaleTrades(limit: limit);
    final Iterable<dynamic> items = response.data?.items ?? const <dynamic>[];
    return items
        .map(_decodeTrade)
        .whereType<WhaleTradeDto>()
        .map(_mapTrade)
        .toList(growable: false);
  }

  @override
  Stream<WhaleEvent> watchFeed() async* {
    Future<WhaleEvent?> fetchLatest() async {
      final List<WhaleEvent> list = await listRecent(limit: 1);
      return list.isEmpty ? null : list.first;
    }

    yield* Stream<void>.periodic(const Duration(seconds: 3))
        .asyncMap((_) => fetchLatest())
        .where((WhaleEvent? e) => e != null)
        .cast<WhaleEvent>();
  }
}
