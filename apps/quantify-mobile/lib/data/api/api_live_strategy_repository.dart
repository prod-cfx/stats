import '../../domain/models/live_strategy_models.dart';
import '../repositories/live_strategy_repository.dart';
import '../services/json_codec.dart';
import '../services/strategy_services.dart';

LiveStrategyStatus _statusFromApi(Object? raw) {
  final String s = asString(raw).toLowerCase();
  if (s == 'draft') return LiveStrategyStatus.stopped;
  for (final LiveStrategyStatus v in LiveStrategyStatus.values) {
    if (v.name == s) return v;
  }
  return LiveStrategyStatus.stopped;
}

bool _isDraftStrategy(Map<String, dynamic> m) {
  return asString(pick(m, <String>['status'])).trim().toLowerCase() == 'draft';
}

String _exchangeGlyph(String exchange) {
  final String value = exchange.trim();
  return value.isEmpty ? '' : value[0].toUpperCase();
}

Map<String, dynamic> _metrics(Map<String, dynamic> m) =>
    asMap(pick(m, <String>['metrics']));

Object? _pickMetric(Map<String, dynamic> m, List<String> keys) {
  final Map<String, dynamic> metrics = _metrics(m);
  return pick(metrics, keys);
}

String _marketLabel(Map<String, dynamic> m) {
  final Map<String, dynamic> snapshot = asMap(m['snapshot']);
  final Map<String, dynamic> strategyConfig = asMap(snapshot['strategyConfig']);
  final String raw = asString(
    pick(strategyConfig, <String>['marketType']) ??
        _pickMetric(m, <String>['marketType', 'market', 'contractType']),
  ).trim();
  switch (raw.toLowerCase()) {
    case 'spot':
      return '现货';
    case 'perp':
    case 'perpetual':
    case 'swap':
      return '永续';
    case 'future':
    case 'futures':
      return '合约';
    default:
      return raw;
  }
}

DateTime? _dateTimeOrNull(Object? raw) {
  final String text = asString(raw).trim();
  if (text.isEmpty) return null;
  return DateTime.tryParse(text);
}

double? _positiveDoubleOrNull(Object? raw) {
  final double value = asDouble(raw);
  return value > 0 ? value : null;
}

List<double> _spark(Map<String, dynamic> m) {
  final Object? raw = _pickMetric(m, <String>['equitySeries', 'spark']);
  final List<Object?> values = asList(raw);
  return values
      .map((Object? value) {
        if (value is Map) {
          return asDouble(pick(asMap(value), <String>['value', 'equity']));
        }
        return asDouble(value);
      })
      .where((double value) => value != 0)
      .toList(growable: false);
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
    final String exchange = asString(pick(m, <String>['exchange']));
    final Map<String, dynamic> snapshot = asMap(m['snapshot']);
    final Map<String, dynamic> deployment = asMap(m['deployment']);
    final Map<String, dynamic> deploymentExecutionCurrent = asMap(
      snapshot['deploymentExecutionCurrent'],
    );
    final Map<String, dynamic> deploymentExecutionBaseline = asMap(
      snapshot['deploymentExecutionBaseline'],
    );
    final Map<String, dynamic> deploymentExecutionConfig = asMap(
      deployment['executionConfig'],
    );
    final Map<String, dynamic> accountOverview = asMap(m['accountOverview']);
    return LiveStrategy(
      id: asString(pick(m, <String>['id'])),
      name: asString(pick(m, <String>['name'])),
      pair: asString(pick(m, <String>['symbol'])),
      timeframe: asString(pick(m, <String>['timeframe'])),
      exchange: exchange,
      exchangeGlyph: _exchangeGlyph(exchange),
      market: _marketLabel(m),
      status: _statusFromApi(pick(m, <String>['status'])),
      runFor: asString(_pickMetric(m, <String>['runFor', 'duration'])),
      todayPct: asDouble(_pickMetric(m, <String>['todayPct', 'todayPnlPct'])),
      todayPnl: asDouble(
        pick(m, <String>['todayPnl']) ?? _pickMetric(m, <String>['todayPnl']),
      ),
      totalPct: asDouble(_pickMetric(m, <String>['totalPct', 'totalPnlPct'])),
      totalPnl: asDouble(
        pick(m, <String>['totalPnl']) ?? _pickMetric(m, <String>['totalPnl']),
      ),
      capital: asDouble(
        pick(accountOverview, <String>[
              'initialBalance',
              'totalEquity',
              'executionCapital',
            ]) ??
            _pickMetric(m, <String>['capital', 'totalCapital']),
      ),
      trades: asInt(_pickMetric(m, <String>['trades', 'tradeCount'])),
      winRate: asDouble(_pickMetric(m, <String>['winRate', 'winRatePct'])),
      maxDrawdown: asDouble(
        _pickMetric(m, <String>['maxDrawdown', 'maxDrawdownPct']),
      ),
      spark: _spark(m),
      statusNote: null,
      publishedSnapshotId: asStringOrNull(
        pick(snapshot, <String>['publishedSnapshotId']) ??
            pick(m, <String>['publishedSnapshotId']),
      ),
      deployedAt: _dateTimeOrNull(
        pick(snapshot, <String>['deployAt']) ??
            pick(m, <String>['deployAt', 'startedAt']),
      ),
      viewOnlyAt: _dateTimeOrNull(pick(m, <String>['viewOnlyAt'])),
      deployAccountName: asStringOrNull(
        pick(deployment, <String>['exchangeAccountName']) ??
            pick(snapshot, <String>['deployAccountName']),
      ),
      deploymentLeverage: _positiveDoubleOrNull(
        pick(deploymentExecutionConfig, <String>['leverage']) ??
            pick(deploymentExecutionCurrent, <String>['leverage']) ??
            pick(deploymentExecutionBaseline, <String>['leverage']),
      ),
    );
  }

  @override
  Future<List<LiveStrategy>> listStrategies() async {
    final dynamic raw = await _service.listStrategies();
    final Object? list = raw is Map
        ? pick(asMap(raw), <String>['items', 'data'])
        : raw;
    final List<Map<String, dynamic>> rows = asMapList(list ?? raw);
    return rows
        .where((Map<String, dynamic> row) => !_isDraftStrategy(row))
        .map(_parse)
        .toList(growable: false);
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
      averageReturnPct: asDouble(
        pick(m, <String>['averageReturnPct', 'avgReturnPct']),
      ),
      averageWinRatePct: asDouble(
        pick(m, <String>['averageWinRatePct', 'avgWinRatePct']),
      ),
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
  Future<LiveStrategy> pause(String id, {bool liquidate = false}) async {
    final String action = liquidate ? 'liquidate_and_stop' : 'stop';
    return _parse(_unwrap(await _service.performAction(id, action)));
  }

  @override
  Future<LiveStrategy> resume(String id) async {
    return _parse(_unwrap(await _service.performAction(id, 'run')));
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
