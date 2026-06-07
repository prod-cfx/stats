import '../models/backtest_models.dart';
import '../repositories/backtest_repository.dart';
import '../services/json_codec.dart';
import '../services/strategy_services.dart';

/// [BacktestRepository] 真实现（issue #2189）。
///
/// 走真实 HTTP 发起/查询回测。真实响应缺少深层图表/交易/风险明细时返回空态，
/// 不回退 mock fixture。
class ApiBacktestRepository implements BacktestRepository {
  ApiBacktestRepository(this._service);

  final BacktestService _service;

  BacktestResult _merge(dynamic raw) {
    final Map<String, dynamic> envelope = asMap(raw);
    final Map<String, dynamic> m = asMap(envelope['data']);
    if (m.isEmpty) m.addAll(envelope);
    final BacktestResult base = _emptyBacktestResult();
    if (m.isEmpty) return base;
    return BacktestResult(
      id: asString(pick(m, <String>['id']), fallback: base.id),
      totalReturnPercent: asDouble(
        pick(m, <String>['totalReturnPercent']),
        fallback: base.totalReturnPercent,
      ),
      cagrPercent: asDouble(
        pick(m, <String>['cagrPercent']),
        fallback: base.cagrPercent,
      ),
      maxDrawdownPercent: asDouble(
        pick(m, <String>['maxDrawdownPercent']),
        fallback: base.maxDrawdownPercent,
      ),
      sharpe: asDouble(pick(m, <String>['sharpe']), fallback: base.sharpe),
      calmar: asDouble(pick(m, <String>['calmar']), fallback: base.calmar),
      winRatePercent: asDouble(
        pick(m, <String>['winRatePercent']),
        fallback: base.winRatePercent,
      ),
      profitLossRatio: asDouble(
        pick(m, <String>['profitLossRatio']),
        fallback: base.profitLossRatio,
      ),
      avgHoldDuration: asString(
        pick(m, <String>['avgHoldDuration']),
        fallback: base.avgHoldDuration,
      ),
      totalTrades: asInt(
        pick(m, <String>['totalTrades']),
        fallback: base.totalTrades,
      ),
      rangeStart: asDateTime(
        pick(m, <String>['rangeStart']),
        fallback: base.rangeStart,
      ),
      rangeEnd: asDateTime(
        pick(m, <String>['rangeEnd']),
        fallback: base.rangeEnd,
      ),
      equityCurve: _parseEquityCurve(m),
      drawdownMarkers: _parseDrawdownMarkers(m),
      monthlyRows: _parseMonthlyRows(m),
      trades: _parseTrades(m),
      riskRows: _parseRiskRows(m),
      aiAssessment: asString(
        pick(m, <String>['aiAssessment']),
        fallback: base.aiAssessment,
      ),
    );
  }

  @override
  Future<BacktestResult> run(BacktestRequest request) async {
    final dynamic raw = await _service.run(<String, dynamic>{
      'strategyId': request.strategyId,
      'symbol': request.symbol,
      'startTime': request.startTime.toIso8601String(),
      'endTime': request.endTime.toIso8601String(),
      'params': request.params,
    });
    return _merge(raw);
  }

  @override
  Future<BacktestResult> getResult(String id) async {
    return _merge(await _service.getResult(id));
  }

  List<double> _parseEquityCurve(Map<String, dynamic> m) {
    final Object? raw = pick(m, <String>['equityCurve', 'equity', 'curve']);
    return asList(raw)
        .map((Object? item) {
          if (item is num || item is String) return asDoubleOrNull(item);
          final Map<String, dynamic> row = asMap(item);
          return asDoubleOrNull(
            pick(row, <String>['value', 'equity', 'balance', 'nav']),
          );
        })
        .whereType<double>()
        .toList(growable: false);
  }

  List<int> _parseDrawdownMarkers(Map<String, dynamic> m) {
    final Object? raw = pick(m, <String>[
      'drawdownMarkers',
      'drawdowns',
      'drawdownPoints',
    ]);
    return asList(raw)
        .map((Object? item) {
          if (item is num || item is String) return asIntOrNull(item);
          final Map<String, dynamic> row = asMap(item);
          return asIntOrNull(pick(row, <String>['index', 'pointIndex', 'x']));
        })
        .whereType<int>()
        .toList(growable: false);
  }

  List<BacktestMonthlyRow> _parseMonthlyRows(Map<String, dynamic> m) {
    final Object? raw = pick(m, <String>[
      'monthlyRows',
      'monthlyReturns',
      'monthlyReturnRows',
    ]);
    return asMapList(raw)
        .map((Map<String, dynamic> row) {
          final List<double?> values = asList(
            pick(row, <String>['values', 'months']),
          ).map(asDoubleOrNull).take(12).toList(growable: true);
          while (values.length < 12) {
            values.add(null);
          }
          return BacktestMonthlyRow(
            year: asInt(pick(row, <String>['year'])),
            values: List<double?>.unmodifiable(values),
          );
        })
        .toList(growable: false);
  }

  List<BacktestTrade> _parseTrades(Map<String, dynamic> m) {
    final Object? raw = pick(m, <String>['trades', 'tradeRows', 'orders']);
    return asMapList(raw)
        .map((Map<String, dynamic> row) {
          return BacktestTrade(
            time: asDateTime(
              pick(row, <String>['time', 'timestamp', 'openedAt']),
            ),
            side: asString(pick(row, <String>['side', 'direction'])),
            entry: asDouble(pick(row, <String>['entry', 'entryPrice'])),
            exit: asDouble(pick(row, <String>['exit', 'exitPrice'])),
            pnlPercent: asDouble(pick(row, <String>['pnlPercent', 'pnlPct'])),
            duration: asString(pick(row, <String>['duration', 'holdDuration'])),
            win: asBool(pick(row, <String>['win', 'isWin'])),
          );
        })
        .toList(growable: false);
  }

  List<BacktestRiskRow> _parseRiskRows(Map<String, dynamic> m) {
    final Object? raw = pick(m, <String>['riskRows', 'risks', 'riskMetrics']);
    return asMapList(raw)
        .map((Map<String, dynamic> row) {
          return BacktestRiskRow(
            label: asString(pick(row, <String>['label', 'name'])),
            value: asString(pick(row, <String>['value', 'displayValue'])),
            barFraction: asDouble(
              pick(row, <String>['barFraction', 'fraction']),
            ),
            tone: _parseRiskTone(pick(row, <String>['tone', 'level'])),
            note: asString(pick(row, <String>['note', 'description'])),
          );
        })
        .toList(growable: false);
  }

  BacktestRiskTone _parseRiskTone(Object? raw) {
    switch (asString(raw).toLowerCase()) {
      case 'danger':
      case 'red':
      case 'high':
        return BacktestRiskTone.danger;
      case 'warn':
      case 'warning':
      case 'yellow':
      case 'medium':
        return BacktestRiskTone.warn;
      default:
        return BacktestRiskTone.neutral;
    }
  }
}

BacktestResult _emptyBacktestResult() {
  final DateTime epoch = DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);
  return BacktestResult(
    id: '',
    totalReturnPercent: 0,
    cagrPercent: 0,
    maxDrawdownPercent: 0,
    sharpe: 0,
    calmar: 0,
    winRatePercent: 0,
    profitLossRatio: 0,
    avgHoldDuration: '',
    totalTrades: 0,
    rangeStart: epoch,
    rangeEnd: epoch,
    equityCurve: const <double>[],
    drawdownMarkers: const <int>[],
    monthlyRows: const <BacktestMonthlyRow>[],
    trades: const <BacktestTrade>[],
    riskRows: const <BacktestRiskRow>[],
    aiAssessment: '',
  );
}
