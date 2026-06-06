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

  /// 解封 `{data: ...}` wrapper；无 `data` 键时回退原 map（仿 [ApiAuthRepository] 扁平兜底）。
  Map<String, dynamic> _unwrap(Object? raw) {
    final Map<String, dynamic> m = asMap(raw);
    final Object? inner = m['data'];
    return inner is Map ? asMap(inner) : m;
  }

  LiveStrategy _parse(Map<String, dynamic> m) {
    return LiveStrategy(
      id: asString(pick(m, <String>['id'])),
      name: asString(pick(m, <String>['name'])),
      // 契约 symbol 优先，保留 mock 键 pair 兜底
      pair: asString(pick(m, <String>['symbol', 'pair'])),
      timeframe: asString(pick(m, <String>['timeframe'])),
      exchange: asString(pick(m, <String>['exchange'])),
      // exchangeGlyph/market: 契约无 typed 源，保留现有 pick 键待富契约
      exchangeGlyph: asString(pick(m, <String>['exchangeGlyph'])),
      market: asString(pick(m, <String>['market'])),
      status: _statusFromApi(pick(m, <String>['status'])),
      // runFor: 契约无 typed 源，保留现有 pick 键待富契约
      runFor: asString(pick(m, <String>['runFor'])),
      // todayPct/totalPct: 契约无 typed 字段，真实后端为 0 by design
      todayPct: asDouble(pick(m, <String>['todayPct'])),
      todayPnl: asDouble(pick(m, <String>['todayPnl'])),
      totalPct: asDouble(pick(m, <String>['totalPct'])),
      totalPnl: asDouble(pick(m, <String>['totalPnl'])),
      // capital/trades/winRate/spark/statusNote: 契约无 typed 源，保留现有 pick 键待富契约
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
    final Map<String, dynamic> m = _unwrap(await _service.getStrategy(id));
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
    // positionOverview 无内层 schema → mock（仅接已定型字段）
    return _fallback.getPosition(id);
  }

  @override
  Future<List<LiveStrategyTrade>> listTrades(String id, {int limit = 6}) async {
    // latestOrders: array<object> 无内层 schema → mock
    return _fallback.listTrades(id, limit: limit);
  }

  @override
  Future<List<LiveStrategyParam>> listParams(String id) async {
    // paramValues/paramSchema 无内层 schema → mock
    return _fallback.listParams(id);
  }
}
