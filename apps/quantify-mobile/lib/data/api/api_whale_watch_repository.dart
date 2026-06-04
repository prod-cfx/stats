import '../mock/fixtures/whale_watch.dart';
import '../models/whale_watch_models.dart';
import '../repositories/whale_watch_repository.dart';
import '../services/json_codec.dart';
import '../services/whale_services.dart';

/// [WhaleWatchRepository] 真实现（issue #2189）。
///
/// 走真实 HTTP 拉监控规则与搜索结果。规则含展示串/告警渠道枚举，空响应回退
/// [mockWatchRules] 展示骨架；搜索空 query 直接返回空列表（与 mock 同语义）。
class ApiWhaleWatchRepository implements WhaleWatchRepository {
  ApiWhaleWatchRepository(this._service);

  final WhaleWatchService _service;

  Set<WatchRuleChannel> _channels(Object? raw) {
    return asList(raw)
        .map(asString)
        .map((String s) {
          switch (s.toLowerCase()) {
            case 'email':
              return WatchRuleChannel.email;
            case 'telegram':
              return WatchRuleChannel.telegram;
            default:
              return WatchRuleChannel.push;
          }
        })
        .toSet();
  }

  WatchRule _parseRule(Map<String, dynamic> m) {
    return WatchRule(
      id: asString(pick(m, <String>['id'])),
      name: asString(pick(m, <String>['name'])),
      address: asString(pick(m, <String>['address'])),
      lastEventDisplay: asString(pick(m, <String>['lastEventDisplay'])),
      tone: asString(pick(m, <String>['tone']), fallback: 'up'),
      pnlDisplay: asString(pick(m, <String>['pnlDisplay'])),
      live: asBool(pick(m, <String>['live'])),
      thresholdUsd: asDouble(pick(m, <String>['thresholdUsd'])),
      channels: _channels(pick(m, <String>['channels'])),
      muted: asBool(pick(m, <String>['muted'])),
      alias: asStringOrNull(pick(m, <String>['alias'])),
      perpValueUsd: asDoubleOrNull(pick(m, <String>['perpValueUsd'])),
      unrealizedPnlUsd: asDoubleOrNull(pick(m, <String>['unrealizedPnlUsd'])),
      availMarginUsd: asDoubleOrNull(pick(m, <String>['availMarginUsd'])),
      marginUsagePct: asIntOrNull(pick(m, <String>['marginUsagePct'])),
      positions: asIntOrNull(pick(m, <String>['positions'])),
    );
  }

  WhaleSearchResultKind _kind(Object? raw) {
    switch (asString(raw).toLowerCase()) {
      case 'label':
        return WhaleSearchResultKind.label;
      case 'asset':
        return WhaleSearchResultKind.asset;
      case 'exchange':
        return WhaleSearchResultKind.exchange;
      case 'eventtype':
        return WhaleSearchResultKind.eventType;
      default:
        return WhaleSearchResultKind.address;
    }
  }

  @override
  Future<List<WatchRule>> listRules() async {
    final dynamic raw = await _service.listRules();
    final Object? list =
        raw is Map ? pick(asMap(raw), <String>['items', 'data']) : raw;
    final List<Map<String, dynamic>> rows = asMapList(list ?? raw);
    if (rows.isEmpty) return List<WatchRule>.of(mockWatchRules);
    return rows.map(_parseRule).toList(growable: false);
  }

  @override
  Future<List<WhaleSearchResult>> search(String query) async {
    if (query.trim().isEmpty) return const <WhaleSearchResult>[];
    final dynamic raw = await _service.search(query);
    final Object? list =
        raw is Map ? pick(asMap(raw), <String>['items', 'data']) : raw;
    return asMapList(list ?? raw).map((Map<String, dynamic> m) {
      return WhaleSearchResult(
        kind: _kind(pick(m, <String>['kind'])),
        title: asString(pick(m, <String>['title'])),
        subtitle: asString(pick(m, <String>['subtitle'])),
        address: asStringOrNull(pick(m, <String>['address'])),
      );
    }).toList(growable: false);
  }
}
