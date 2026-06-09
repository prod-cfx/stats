import 'dart:async';

import 'package:backend_api_contracts/backend_api_contracts.dart';

import '../models/whale_models.dart';
import '../repositories/whale_feed_repository.dart';
import '../services/generated_backend_api.dart';

/// [WhaleFeedRepository] 真实现（issue #2189）。
///
/// 通过 generated [WhaleAlertsApi] 消费 `/whale-alerts/realtime`。`watchFeed`
/// 后端推送契约暂未接入 mobile，用周期轮询拉取最近一条。
class ApiWhaleFeedRepository implements WhaleFeedRepository {
  ApiWhaleFeedRepository(this._api);

  static const num _minPositionValueUsd = 10000;

  final GeneratedBackendApi _api;

  WhaleEvent _mapAlert(Map<String, dynamic> alert) {
    final String sideLabel = _readString(alert['side']);
    final String sideName = sideLabel.toLowerCase();
    final double positionSize = _readDouble(alert['position_size']);
    final double absSize = positionSize.abs();
    final String symbol = _readString(alert['symbol']).toUpperCase();
    final String createTime = _readString(alert['create_time']);
    final num positionAction = _readDouble(alert['position_action']);
    final String address = _readString(alert['user_address']);

    return WhaleEvent(
      id: '$address-$symbol-$createTime',
      symbol: symbol,
      amountUsd: _readDouble(alert['position_value_usd']),
      direction: sideName == 'short' ? 'out' : 'in',
      fromLabel: 'Hyperliquid',
      toLabel: '$symbol $sideLabel',
      timestamp: DateTime.parse(createTime),
      winRate: 0,
      address: address,
      traderTag: positionAction.toInt() == 1 ? '开仓' : '平仓',
      isFresh: positionAction.toInt() == 1,
      mode: '全仓',
      side: sideName,
      positionValue: _readDouble(alert['position_value_usd']),
      quantity: '${absSize.toStringAsFixed(4)} $symbol',
      openPrice: _readDouble(alert['entry_price']),
    );
  }

  Map<String, dynamic> _decodeItem(dynamic raw) {
    final Object? value = raw.value;
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return Map<String, dynamic>.from(value);
    return const <String, dynamic>{};
  }

  static String _readString(Object? value) => value?.toString() ?? '';

  static double _readDouble(Object? value) {
    if (value is num) return value.toDouble();
    if (value is String) return double.tryParse(value) ?? 0;
    return 0;
  }

  @override
  Future<List<WhaleEvent>> listRecent({required int limit}) async {
    final response = await _api.client
        .getWhaleAlertsApi()
        .whaleAlertControllerGetRealtime(
          limit: limit,
          minPositionValueUsd: _minPositionValueUsd,
        );
    final Iterable<dynamic> items = response.data?.items ?? const <dynamic>[];
    return items.map(_decodeItem).map(_mapAlert).toList(growable: false);
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
