import 'dart:async';

import '../models/whale_models.dart';
import '../repositories/whale_feed_repository.dart';
import '../services/json_codec.dart';
import '../services/whale_services.dart';

/// [WhaleFeedRepository] 真实现（issue #2189）。
///
/// `watchFeed` 后端暂无推送契约，用周期轮询拉取最近一条。
class ApiWhaleFeedRepository implements WhaleFeedRepository {
  ApiWhaleFeedRepository(this._service);

  final WhaleFeedService _service;

  WhaleEvent _parse(Map<String, dynamic> m) {
    return WhaleEvent(
      id: asString(pick(m, <String>['id'])),
      symbol: asString(pick(m, <String>['symbol'])),
      amountUsd: asDouble(pick(m, <String>['amountUsd', 'amount'])),
      direction: asString(pick(m, <String>['direction']), fallback: 'in'),
      fromLabel: asString(pick(m, <String>['fromLabel', 'from'])),
      toLabel: asString(pick(m, <String>['toLabel', 'to'])),
      timestamp: asDateTime(pick(m, <String>['timestamp', 'ts'])),
      winRate: asDouble(pick(m, <String>['winRate'])),
      address: asStringOrNull(pick(m, <String>['address'])),
      traderTag: asStringOrNull(pick(m, <String>['traderTag'])),
      isFresh: asBool(pick(m, <String>['isFresh'])),
      mode: asStringOrNull(pick(m, <String>['mode'])),
      side: asStringOrNull(pick(m, <String>['side'])),
      leverage: asIntOrNull(pick(m, <String>['leverage'])),
      positionValue: asDoubleOrNull(pick(m, <String>['positionValue'])),
      quantity: asStringOrNull(pick(m, <String>['quantity'])),
      openPrice: asDoubleOrNull(pick(m, <String>['openPrice'])),
    );
  }

  List<WhaleEvent> _parseList(dynamic raw) {
    final Object? list =
        raw is Map ? pick(asMap(raw), <String>['items', 'data']) : raw;
    return asMapList(list ?? raw).map(_parse).toList(growable: false);
  }

  @override
  Future<List<WhaleEvent>> listRecent({required int limit}) async {
    return _parseList(await _service.listRecent(limit: limit));
  }

  @override
  Stream<WhaleEvent> watchFeed() async* {
    Future<WhaleEvent?> fetchLatest() async {
      final List<WhaleEvent> list = _parseList(await _service.listRecent(limit: 1));
      return list.isEmpty ? null : list.first;
    }

    yield* Stream<void>.periodic(const Duration(seconds: 3))
        .asyncMap((_) => fetchLatest())
        .where((WhaleEvent? e) => e != null)
        .cast<WhaleEvent>();
  }
}
