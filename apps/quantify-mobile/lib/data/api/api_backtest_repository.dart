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
  static const int _jobPollLimit = 120;
  static const Duration _jobPollInterval = Duration(milliseconds: 1500);

  BacktestResult _merge(dynamic raw, {String? fallbackId}) {
    final Map<String, dynamic> envelope = asMap(raw);
    final Map<String, dynamic> m = asMap(envelope['data']);
    if (m.isEmpty) m.addAll(envelope);
    final Map<String, dynamic> summary = asMap(m['summary']);
    final Map<String, dynamic> inputSummary = asMap(m['inputSummary']);
    final BacktestResult base = _emptyBacktestResult();
    if (m.isEmpty) return base;
    return BacktestResult(
      id: asString(pick(m, <String>['id']), fallback: fallbackId ?? base.id),
      totalReturnPercent: asDouble(
        pick(m, <String>['totalReturnPercent']) ??
            pick(summary, <String>['netProfitPct', 'totalReturnPct']),
        fallback: base.totalReturnPercent,
      ),
      cagrPercent: asDouble(
        pick(m, <String>['cagrPercent']) ?? pick(summary, <String>['cagrPct']),
        fallback: base.cagrPercent,
      ),
      maxDrawdownPercent: asDouble(
        pick(m, <String>['maxDrawdownPercent']) ??
            pick(summary, <String>['maxDrawdownPct']),
        fallback: base.maxDrawdownPercent,
      ),
      sharpe: asDouble(
        pick(m, <String>['sharpe']) ?? pick(summary, <String>['sharpe']),
        fallback: base.sharpe,
      ),
      calmar: asDouble(pick(m, <String>['calmar']), fallback: base.calmar),
      winRatePercent: asDouble(
        pick(m, <String>['winRatePercent']) ??
            pick(summary, <String>['winRate']),
        fallback: base.winRatePercent,
      ),
      profitLossRatio: asDouble(
        pick(m, <String>['profitLossRatio']) ??
            pick(summary, <String>['profitFactor']),
        fallback: base.profitLossRatio,
      ),
      avgHoldDuration: asString(
        pick(m, <String>['avgHoldDuration']),
        fallback: base.avgHoldDuration,
      ),
      totalTrades: asInt(
        pick(m, <String>['totalTrades']) ??
            pick(summary, <String>['totalTrades', 'tradeCount']),
        fallback: base.totalTrades,
      ),
      rangeStart: asDateTime(
        pick(m, <String>['rangeStart']) ??
            pick(asMap(inputSummary['appliedRange']), <String>['fromTs']) ??
            pick(asMap(inputSummary['dataRange']), <String>['fromTs']),
        fallback: base.rangeStart,
      ),
      rangeEnd: asDateTime(
        pick(m, <String>['rangeEnd']) ??
            pick(asMap(inputSummary['appliedRange']), <String>['toTs']) ??
            pick(asMap(inputSummary['dataRange']), <String>['toTs']),
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
    final String snapshotId = request.publishedSnapshotId?.trim() ?? '';
    if (snapshotId.isEmpty) {
      throw const FormatException('missing publishedSnapshotId for backtest');
    }
    final String marketType = request.marketType == 'spot' ? 'spot' : 'perp';
    final Map<String, dynamic> strategyParams = _strategyParams(
      request.params,
      marketType,
    );
    final dynamic raw = await _service.run(<String, dynamic>{
      'symbols': <String>[request.symbol],
      'baseTimeframe': request.baseTimeframe,
      'stateTimeframes': <String>[request.baseTimeframe],
      'initialCash': request.initialCash,
      if (marketType == 'perp') 'leverage': request.leverage ?? 1,
      if (request.allowPartial) 'allowPartial': true,
      if (request.conversationId?.trim().isNotEmpty == true)
        'conversationId': request.conversationId!.trim(),
      if (asString(request.params['codegenSessionId']).trim().isNotEmpty)
        'sessionId': asString(request.params['codegenSessionId']).trim(),
      'execution': <String, dynamic>{
        'slippageBps': request.slippageBps,
        'feeBps': request.feeBps,
        'priceSource': request.priceSource,
      },
      'strategy': <String, dynamic>{
        'id': request.strategyId.trim().isNotEmpty
            ? request.strategyId.trim()
            : snapshotId,
        'protocolVersion': 'v1',
        'publishedSnapshotId': snapshotId,
        'params': strategyParams,
      },
      'dataRange': <String, dynamic>{
        'fromTs': request.startTime.millisecondsSinceEpoch,
        'toTs': request.endTime.millisecondsSinceEpoch,
      },
      'requestedRangeInput': <String, dynamic>{
        'preset': request.rangePreset == 'custom'
            ? 'CUSTOM'
            : request.rangePreset.toUpperCase(),
        if (request.rangePreset == 'custom')
          'startAt': request.startTime.toIso8601String(),
        if (request.rangePreset == 'custom')
          'endAt': request.endTime.toIso8601String(),
      },
    });
    final Map<String, dynamic> created = asMap(asMap(raw)['data']);
    if (created.isEmpty) created.addAll(asMap(raw));
    final String jobId = asString(pick(created, <String>['id'])).trim();
    final String status = asString(pick(created, <String>['status'])).trim();
    if (jobId.isEmpty || status.isEmpty || _isSucceeded(status)) {
      return _merge(raw, fallbackId: jobId.isEmpty ? null : jobId);
    }

    await _waitForJob(jobId, status);
    return getResult(jobId);
  }

  Map<String, dynamic> _strategyParams(
    Map<String, dynamic> source,
    String marketType,
  ) {
    final Map<String, dynamic> params = <String, dynamic>{...source};
    params.removeWhere((String key, dynamic _) {
      final String k = key.toLowerCase();
      return k == 'codegensessionid' ||
          k == 'conversationid' ||
          k == 'publishedsnapshotid' ||
          k == 'strategyinstanceid' ||
          k == 'scriptcode' ||
          k.startsWith('backtest');
    });
    params['marketType'] = marketType;
    return params;
  }

  @override
  Future<BacktestResult> getResult(String id) async {
    return _merge(await _service.getResult(id), fallbackId: id);
  }

  Future<void> _waitForJob(String jobId, String initialStatus) async {
    String status = initialStatus;
    for (int i = 0; i <= _jobPollLimit; i++) {
      if (_isSucceeded(status)) return;
      if (_isFailed(status)) {
        throw FormatException('backtest job failed: $status');
      }
      if (i == _jobPollLimit) break;
      await Future<void>.delayed(_jobPollInterval);
      final Map<String, dynamic> envelope = asMap(await _service.getJob(jobId));
      final Map<String, dynamic> data = asMap(envelope['data']);
      status = asString(
        pick(data.isEmpty ? envelope : data, <String>['status']),
        fallback: status,
      );
    }
    throw FormatException('backtest job timeout: $jobId');
  }

  bool _isSucceeded(String status) => status.toLowerCase() == 'succeeded';

  bool _isFailed(String status) {
    switch (status.toLowerCase()) {
      case 'failed':
      case 'canceled':
      case 'cancelled':
      case 'timeout':
      case 'timed_out':
        return true;
      default:
        return false;
    }
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
