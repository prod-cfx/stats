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
/// [LiveStrategy] 核心字段走真实 HTTP + JSON 反序列化；空响应保持空态或默认值，
/// 不回退 mock。摘要由 store 侧聚合，本 repo 仍提供 getSummary 真实端点解析。
class ApiLiveStrategyRepository implements LiveStrategyRepository {
  ApiLiveStrategyRepository(this._service);

  final LiveStrategyService _service;

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
      spark: asList(
        pick(m, <String>['spark']),
      ).map((Object? e) => asDouble(e)).toList(growable: false),
      statusNote: asStringOrNull(pick(m, <String>['statusNote'])),
    );
  }

  @override
  Future<List<LiveStrategy>> listStrategies() async {
    final dynamic raw = await _service.listStrategies();
    final Object? list = raw is Map
        ? pick(asMap(raw), <String>['items', 'data'])
        : raw;
    final List<Map<String, dynamic>> rows = asMapList(list ?? raw);
    return rows.map(_parse).toList(growable: false);
  }

  @override
  Future<LiveStrategy> getStrategy(String id) async {
    final Map<String, dynamic> m = _unwrap(await _service.getStrategy(id));
    return _parse(m);
  }

  @override
  Future<LiveStrategySummary> getSummary() async {
    final Map<String, dynamic> m = asMap(await _service.getSummary());
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
    final Map<String, dynamic> detail = _unwrap(await _service.getStrategy(id));
    final Map<String, dynamic> position = asMap(
      pick(detail, <String>['positionOverview', 'spotHoldingSummary']),
    );
    if (position.isEmpty) return null;
    final int openCount = asInt(
      pick(position, <String>['openPositionsCount']),
      fallback: 1,
    );
    final String state = asString(
      pick(position, <String>['positionState', 'side']),
    ).toLowerCase();
    if (openCount <= 0 || state == 'flat') return null;
    final String symbol = asString(pick(detail, <String>['symbol', 'pair']));
    final double stopPct = asDouble(
      pick(position, <String>['stopDistancePct', 'stopPct']),
    );
    return LiveStrategyPosition(
      side: _positionSide(state),
      pair: asString(
        pick(position, <String>['symbol', 'pair']),
        fallback: symbol,
      ),
      entryPrice: asDouble(
        pick(position, <String>['entryPrice', 'avgEntryPrice']),
      ),
      currentPrice: asDouble(
        pick(position, <String>['currentPrice', 'markPrice']),
      ),
      qty: asDouble(
        pick(position, <String>['quantity', 'qty', 'baseQuantity']),
      ),
      pnl: asDouble(
        pick(position, <String>['unrealizedPnl', 'totalUnrealizedPnl', 'pnl']),
      ),
      pct: asDouble(pick(position, <String>['pnlPct', 'pct'])),
      stopPrice: asDouble(pick(position, <String>['stopLoss', 'stopPrice'])),
      stopDistance: stopPct == 0 ? '' : '${stopPct.toStringAsFixed(1)}%',
      stopPct: stopPct,
      tpPct: asDouble(
        pick(position, <String>['takeProfitDistancePct', 'tpPct']),
      ),
      holdFor: asString(pick(position, <String>['holdFor', 'duration'])),
    );
  }

  @override
  Future<List<LiveStrategyTrade>> listTrades(String id, {int limit = 6}) async {
    final Map<String, dynamic> detail = _unwrap(await _service.getStrategy(id));
    final List<Map<String, dynamic>> rows = asMapList(
      pick(detail, <String>['latestOrders', 'orders']),
    );
    return rows.take(limit).map(_parseTrade).toList(growable: false);
  }

  @override
  Future<List<LiveStrategyParam>> listParams(String id) async {
    final Map<String, dynamic> detail = _unwrap(await _service.getStrategy(id));
    final Map<String, dynamic> values = asMap(
      pick(detail, <String>['paramValues']) ??
          pick(asMap(detail['snapshot']), <String>['paramValues']),
    );
    final Map<String, dynamic> schema = asMap(
      pick(detail, <String>['paramSchema']) ??
          pick(asMap(detail['snapshot']), <String>['paramSchema']),
    );
    return values.entries
        .map((MapEntry<String, dynamic> entry) {
          final Map<String, dynamic> meta = asMap(schema[entry.key]);
          return LiveStrategyParam(
            key: entry.key,
            value: asString(entry.value),
            note: asString(
              pick(meta, <String>['description', 'label', 'note']),
            ),
          );
        })
        .toList(growable: false);
  }

  @override
  Future<LiveStrategy> pause(String id) async {
    return _parse(_unwrap(await _service.performAction(id, 'pause')));
  }

  @override
  Future<LiveStrategy> resume(String id) async {
    return _parse(_unwrap(await _service.performAction(id, 'resume')));
  }

  @override
  Future<void> softDelete(String id) async {
    await _service.deleteStrategy(id);
  }

  @override
  Future<void> permanentDelete(String id) async {
    await _service.deleteStrategy(id, deleteStoppedStrategy: true);
  }

  PositionSide _positionSide(String raw) {
    final String s = raw.toLowerCase();
    if (s.contains('short') || s == 'sell') return PositionSide.short;
    return PositionSide.long;
  }

  LiveStrategyTrade _parseTrade(Map<String, dynamic> m) {
    final double price = asDouble(pick(m, <String>['price', 'entryPrice']));
    final double pct = asDouble(pick(m, <String>['pnlPct', 'pct']));
    return LiveStrategyTrade(
      time: _formatTime(pick(m, <String>['executedAt', 'time', 'createdAt'])),
      side: _positionSide(asString(pick(m, <String>['side', 'direction']))),
      entryPrice: asDouble(pick(m, <String>['entryPrice']), fallback: price),
      exitPrice: asDouble(pick(m, <String>['exitPrice']), fallback: price),
      pct: pct,
      win:
          asDouble(pick(m, <String>['realizedPnl', 'pnl']), fallback: pct) >= 0,
      holdFor: asString(pick(m, <String>['holdFor', 'duration'])),
    );
  }

  String _formatTime(Object? raw) {
    final String text = asString(raw);
    final DateTime? parsed = DateTime.tryParse(text);
    if (parsed == null) return text;
    String two(int n) => n.toString().padLeft(2, '0');
    return '${parsed.year}-${two(parsed.month)}-${two(parsed.day)} '
        '${two(parsed.hour)}:${two(parsed.minute)}';
  }
}
