import '../mock/mock_live_strategy_repository.dart';
import '../../domain/models/live_strategy_models.dart';
import '../repositories/live_strategy_repository.dart';
import '../services/json_codec.dart';
import '../services/strategy_services.dart';

LiveStrategyStatus _statusFromApi(Object? raw) {
  final String s = asString(raw).toLowerCase();
  for (final LiveStrategyStatus v in LiveStrategyStatus.values) {
    if (v.name == s) return v;
  }
  return LiveStrategyStatus.running;
}

PositionSide _sideFromApi(Object? raw) {
  return asString(raw).toLowerCase() == 'short'
      ? PositionSide.short
      : PositionSide.long;
}

/// [LiveStrategyRepository] 真实现（issue #2189）。
///
/// [LiveStrategy] 核心字段走真实 HTTP + JSON 反序列化；空响应回退
/// [MockLiveStrategyRepository] 展示骨架。摘要由 store 侧聚合，本 repo 仍提供
/// getSummary 真实端点 + mock 兜底。
class ApiLiveStrategyRepository implements LiveStrategyRepository {
  ApiLiveStrategyRepository(this._service)
      : _fallback = MockLiveStrategyRepository();

  final LiveStrategyService _service;
  final MockLiveStrategyRepository _fallback;

  LiveStrategy _parse(Map<String, dynamic> m) {
    return LiveStrategy(
      id: asString(pick(m, <String>['id'])),
      name: asString(pick(m, <String>['name'])),
      pair: asString(pick(m, <String>['pair'])),
      timeframe: asString(pick(m, <String>['timeframe'])),
      exchange: asString(pick(m, <String>['exchange'])),
      exchangeGlyph: asString(pick(m, <String>['exchangeGlyph'])),
      market: asString(pick(m, <String>['market'])),
      status: _statusFromApi(pick(m, <String>['status'])),
      runFor: asString(pick(m, <String>['runFor'])),
      todayPct: asDouble(pick(m, <String>['todayPct'])),
      todayPnl: asDouble(pick(m, <String>['todayPnl'])),
      totalPct: asDouble(pick(m, <String>['totalPct'])),
      totalPnl: asDouble(pick(m, <String>['totalPnl'])),
      capital: asDouble(pick(m, <String>['capital'])),
      trades: asInt(pick(m, <String>['trades'])),
      winRate: asDouble(pick(m, <String>['winRate'])),
      spark: asList(pick(m, <String>['spark']))
          .map((Object? e) => asDouble(e))
          .toList(growable: false),
      statusNote: asStringOrNull(pick(m, <String>['statusNote'])),
    );
  }

  @override
  Future<List<LiveStrategy>> listStrategies() async {
    final dynamic raw = await _service.listStrategies();
    final Object? list =
        raw is Map ? pick(asMap(raw), <String>['items', 'data']) : raw;
    final List<Map<String, dynamic>> rows = asMapList(list ?? raw);
    return rows.isEmpty
        ? _fallback.listStrategies()
        : rows.map(_parse).toList(growable: false);
  }

  @override
  Future<LiveStrategy> getStrategy(String id) async {
    final Map<String, dynamic> m = asMap(await _service.getStrategy(id));
    return m.isEmpty ? _fallback.getStrategy(id) : _parse(m);
  }

  @override
  Future<LiveStrategySummary> getSummary() async {
    final Map<String, dynamic> m = asMap(await _service.getSummary());
    if (m.isEmpty) return _fallback.getSummary();
    return LiveStrategySummary(
      totalAssets: asDouble(pick(m, <String>['totalAssets'])),
      totalCapital: asDouble(pick(m, <String>['totalCapital'])),
      todayPnl: asDouble(pick(m, <String>['todayPnl'])),
      totalPnl: asDouble(pick(m, <String>['totalPnl'])),
      runningCount: asInt(pick(m, <String>['runningCount'])),
      warningCount: asInt(pick(m, <String>['warningCount'])),
      pausedCount: asInt(pick(m, <String>['pausedCount'])),
      stoppedCount: asInt(pick(m, <String>['stoppedCount'])),
      winRate: asDouble(pick(m, <String>['winRate'])),
    );
  }

  @override
  Future<LiveStrategyPosition?> getPosition(String id) async {
    final Map<String, dynamic> m = asMap(await _service.getPosition(id));
    if (m.isEmpty) return _fallback.getPosition(id);
    return LiveStrategyPosition(
      side: _sideFromApi(pick(m, <String>['side'])),
      pair: asString(pick(m, <String>['pair'])),
      entryPrice: asDouble(pick(m, <String>['entryPrice'])),
      currentPrice: asDouble(pick(m, <String>['currentPrice'])),
      qty: asDouble(pick(m, <String>['qty'])),
      pnl: asDouble(pick(m, <String>['pnl'])),
      pct: asDouble(pick(m, <String>['pct'])),
      stopPrice: asDouble(pick(m, <String>['stopPrice'])),
      stopDistance: asString(pick(m, <String>['stopDistance'])),
      stopPct: asDouble(pick(m, <String>['stopPct'])),
      tpPct: asDouble(pick(m, <String>['tpPct'])),
      holdFor: asString(pick(m, <String>['holdFor'])),
    );
  }

  @override
  Future<List<LiveStrategyTrade>> listTrades(String id, {int limit = 6}) async {
    final dynamic raw = await _service.listTrades(id, limit: limit);
    final Object? list =
        raw is Map ? pick(asMap(raw), <String>['items', 'data']) : raw;
    final List<Map<String, dynamic>> rows = asMapList(list ?? raw);
    if (rows.isEmpty) return _fallback.listTrades(id, limit: limit);
    return rows.map((Map<String, dynamic> m) {
      return LiveStrategyTrade(
        time: asString(pick(m, <String>['time'])),
        side: _sideFromApi(pick(m, <String>['side'])),
        entryPrice: asDouble(pick(m, <String>['entryPrice'])),
        exitPrice: asDouble(pick(m, <String>['exitPrice'])),
        pct: asDouble(pick(m, <String>['pct'])),
        win: asBool(pick(m, <String>['win'])),
        holdFor: asString(pick(m, <String>['holdFor'])),
      );
    }).toList(growable: false);
  }

  @override
  Future<List<LiveStrategyParam>> listParams(String id) async {
    final dynamic raw = await _service.listParams(id);
    final Object? list =
        raw is Map ? pick(asMap(raw), <String>['items', 'data']) : raw;
    final List<Map<String, dynamic>> rows = asMapList(list ?? raw);
    if (rows.isEmpty) return _fallback.listParams(id);
    return rows.map((Map<String, dynamic> m) {
      return LiveStrategyParam(
        key: asString(pick(m, <String>['key'])),
        value: asString(pick(m, <String>['value'])),
        note: asString(pick(m, <String>['note'])),
      );
    }).toList(growable: false);
  }
}
