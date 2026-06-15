import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/serializer.dart';
import 'package:built_value/json_object.dart';
import 'package:dio/dio.dart';

import '../models/backtest_models.dart';
import '../repositories/backtest_repository.dart';
import '../services/api_client.dart';
import '../services/json_codec.dart';
import '../services/generated_backend_api.dart';

/// [BacktestRepository] 真实现（issue #2189）。
///
/// 走真实 HTTP 发起/查询回测。真实响应缺少深层图表/交易/风险明细时返回空态，
/// 不回退 mock fixture。
class ApiBacktestRepository implements BacktestRepository {
  ApiBacktestRepository(this._api, {String Function()? tokenSupplier})
    : _tokenSupplier = tokenSupplier;

  final GeneratedBackendApi _api;
  final String Function()? _tokenSupplier;
  static const int _jobPollLimit = 120;
  static const Duration _jobPollInterval = Duration(milliseconds: 1500);

  BacktestingApi get _backtestingApi => _api.client.getBacktestingApi();

  @override
  Future<BacktestSymbolSupportResult> checkSymbolSupport(
    BacktestSymbolSupportRequest request,
  ) async {
    final BacktestingSymbolSupportRequestDto payload =
        BacktestingSymbolSupportRequestDto(
          (b) => b
            ..exchange = _symbolSupportExchange(request.exchange)
            ..marketType = _symbolSupportMarketType(request.marketType)
            ..symbol = request.symbol.trim().toUpperCase()
            ..baseTimeframe = _symbolSupportBaseTimeframe(
              request.baseTimeframe,
            ),
        );
    final Object body = _api.client.serializers.serialize(
      payload,
      specifiedType: const FullType(BacktestingSymbolSupportRequestDto),
    )!;
    final Response<Object?> response = await _api.dio.request<Object?>(
      '/backtesting/symbols/check',
      data: body,
      options: Options(
        method: 'POST',
        headers: <String, dynamic>{'authorization': _authorization()},
        contentType: 'application/json',
      ),
    );
    final Map<String, dynamic> envelope = asMap(response.data);
    final Map<String, dynamic> payloadData = asMap(envelope['data']);
    if (payloadData.isEmpty) {
      return const BacktestSymbolSupportResult(
        supported: false,
        reason: '当前交易对或周期暂不支持回测',
      );
    }
    switch (asString(payloadData['status'])) {
      case 'supported':
      case 'refreshed_then_supported':
        return const BacktestSymbolSupportResult(supported: true);
      case 'not_supported':
        return BacktestSymbolSupportResult(
          supported: false,
          reason: asString(
            payloadData['reasonCode'],
            fallback: '当前交易对或周期暂不支持回测',
          ),
        );
      default:
        return const BacktestSymbolSupportResult(
          supported: false,
          reason: '当前交易对或周期暂不支持回测',
        );
    }
  }

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
    final String marketType = _marketType(request.marketType);
    final Map<String, dynamic> strategyParams = _strategyParams(
      request.params,
      marketType,
    );
    final BacktestingCreateJobRequestDto payload =
        BacktestingCreateJobRequestDto((b) {
          b
            ..symbols.replace(<String>[request.symbol])
            ..baseTimeframe = _baseTimeframe(request.baseTimeframe)
            ..stateTimeframes.replace(
              <BacktestingCreateJobRequestDtoStateTimeframesEnum>[
                _stateTimeframe(request.baseTimeframe),
              ],
            )
            ..initialCash = request.initialCash
            ..allowPartial = request.allowPartial
            ..execution.replace(
              BacktestingCreateJobExecutionDto(
                (e) => e
                  ..slippageBps = request.slippageBps
                  ..feeBps = request.feeBps
                  ..priceSource = _priceSource(request.priceSource),
              ),
            )
            ..strategy.replace(
              BacktestingCreateJobStrategyDto(
                (s) => s
                  ..id = request.strategyId.trim().isNotEmpty
                      ? request.strategyId.trim()
                      : snapshotId
                  ..protocolVersion =
                      BacktestingCreateJobStrategyDtoProtocolVersionEnum.v1
                  ..publishedSnapshotId = snapshotId
                  ..params.replace(_builtJsonObjectMap(strategyParams)),
              ),
            )
            ..dataRange.replace(
              BacktestingCreateJobRangeDto(
                (r) => r
                  ..fromTs = request.startTime.millisecondsSinceEpoch
                  ..toTs = request.endTime.millisecondsSinceEpoch,
              ),
            )
            ..requestedRangeInput.replace(
              _requestedRangeInput(
                request.rangePreset,
                startTime: request.startTime,
                endTime: request.endTime,
              ),
            );
          if (marketType == 'perp') b.leverage = request.leverage ?? 1;
          if (request.conversationId?.trim().isNotEmpty == true) {
            b.conversationId = request.conversationId!.trim();
          }
        });
    final response = await _backtestingApi.backtestingProxyControllerCreateJob(
      authorization: _authorization(),
      backtestingCreateJobRequestDto: payload,
    );
    final Map<String, dynamic> created = _createJobResponseMap(response.data);
    final String jobId = asString(pick(created, <String>['id'])).trim();
    final String status = asString(pick(created, <String>['status'])).trim();
    if (jobId.isEmpty || status.isEmpty || _isSucceeded(status)) {
      return _merge(created, fallbackId: jobId.isEmpty ? null : jobId);
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
    final response = await _backtestingApi
        .backtestingProxyControllerGetJobResult(
          authorization: _authorization(),
          id: id,
        );
    return _merge(_reportResponseMap(response.data), fallbackId: id);
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
      final response = await _backtestingApi.backtestingProxyControllerGetJob(
        authorization: _authorization(),
        id: jobId,
      );
      final Map<String, dynamic> envelope = _jobResponseMap(response.data);
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

  String _authorization() {
    final String token = _tokenSupplier?.call().trim() ?? '';
    if (token.isEmpty) {
      throw const ApiException(message: 'login required', statusCode: 401);
    }
    return token.startsWith('Bearer ') ? token : 'Bearer $token';
  }

  String _marketType(String raw) {
    switch (raw.trim().toLowerCase()) {
      case 'spot':
        return 'spot';
      case 'perp':
      case 'futures':
      case 'future':
        return 'perp';
      default:
        throw FormatException('unsupported backtest marketType: $raw');
    }
  }

  BacktestingSymbolSupportRequestDtoExchangeEnum _symbolSupportExchange(
    String raw,
  ) {
    switch (raw.trim().toLowerCase()) {
      case 'binance':
        return BacktestingSymbolSupportRequestDtoExchangeEnum.binance;
      case 'okx':
        return BacktestingSymbolSupportRequestDtoExchangeEnum.okx;
      case 'hyperliquid':
        return BacktestingSymbolSupportRequestDtoExchangeEnum.hyperliquid;
      default:
        throw FormatException('unsupported backtest exchange: $raw');
    }
  }

  BacktestingSymbolSupportRequestDtoMarketTypeEnum _symbolSupportMarketType(
    String raw,
  ) {
    switch (raw.trim().toLowerCase()) {
      case 'spot':
        return BacktestingSymbolSupportRequestDtoMarketTypeEnum.spot;
      case 'perp':
      case 'futures':
      case 'future':
        return BacktestingSymbolSupportRequestDtoMarketTypeEnum.perp;
      default:
        throw FormatException('unsupported backtest marketType: $raw');
    }
  }

  BacktestingSymbolSupportRequestDtoBaseTimeframeEnum
  _symbolSupportBaseTimeframe(String raw) {
    switch (raw.trim()) {
      case '1m':
        return BacktestingSymbolSupportRequestDtoBaseTimeframeEnum.n1m;
      case '3m':
        return BacktestingSymbolSupportRequestDtoBaseTimeframeEnum.n3m;
      case '5m':
        return BacktestingSymbolSupportRequestDtoBaseTimeframeEnum.n5m;
      case '15m':
        return BacktestingSymbolSupportRequestDtoBaseTimeframeEnum.n15m;
      case '30m':
        return BacktestingSymbolSupportRequestDtoBaseTimeframeEnum.n30m;
      case '1h':
        return BacktestingSymbolSupportRequestDtoBaseTimeframeEnum.n1h;
      case '4h':
        return BacktestingSymbolSupportRequestDtoBaseTimeframeEnum.n4h;
      case '6h':
        return BacktestingSymbolSupportRequestDtoBaseTimeframeEnum.n6h;
      case '8h':
        return BacktestingSymbolSupportRequestDtoBaseTimeframeEnum.n8h;
      case '12h':
        return BacktestingSymbolSupportRequestDtoBaseTimeframeEnum.n12h;
      case '1d':
        return BacktestingSymbolSupportRequestDtoBaseTimeframeEnum.n1d;
      case '1w':
        return BacktestingSymbolSupportRequestDtoBaseTimeframeEnum.n1w;
      default:
        throw FormatException('unsupported backtest baseTimeframe: $raw');
    }
  }

  BacktestingCreateJobRequestDtoBaseTimeframeEnum _baseTimeframe(String raw) {
    switch (raw.trim()) {
      case '1m':
        return BacktestingCreateJobRequestDtoBaseTimeframeEnum.n1m;
      case '3m':
        return BacktestingCreateJobRequestDtoBaseTimeframeEnum.n3m;
      case '5m':
        return BacktestingCreateJobRequestDtoBaseTimeframeEnum.n5m;
      case '15m':
        return BacktestingCreateJobRequestDtoBaseTimeframeEnum.n15m;
      case '30m':
        return BacktestingCreateJobRequestDtoBaseTimeframeEnum.n30m;
      case '1h':
        return BacktestingCreateJobRequestDtoBaseTimeframeEnum.n1h;
      case '4h':
        return BacktestingCreateJobRequestDtoBaseTimeframeEnum.n4h;
      case '6h':
        return BacktestingCreateJobRequestDtoBaseTimeframeEnum.n6h;
      case '8h':
        return BacktestingCreateJobRequestDtoBaseTimeframeEnum.n8h;
      case '12h':
        return BacktestingCreateJobRequestDtoBaseTimeframeEnum.n12h;
      case '1d':
        return BacktestingCreateJobRequestDtoBaseTimeframeEnum.n1d;
      case '1w':
        return BacktestingCreateJobRequestDtoBaseTimeframeEnum.n1w;
      default:
        throw FormatException('unsupported backtest baseTimeframe: $raw');
    }
  }

  BacktestingCreateJobRequestDtoStateTimeframesEnum _stateTimeframe(
    String raw,
  ) {
    switch (raw.trim()) {
      case '1m':
        return BacktestingCreateJobRequestDtoStateTimeframesEnum.n1m;
      case '3m':
        return BacktestingCreateJobRequestDtoStateTimeframesEnum.n3m;
      case '5m':
        return BacktestingCreateJobRequestDtoStateTimeframesEnum.n5m;
      case '15m':
        return BacktestingCreateJobRequestDtoStateTimeframesEnum.n15m;
      case '30m':
        return BacktestingCreateJobRequestDtoStateTimeframesEnum.n30m;
      case '1h':
        return BacktestingCreateJobRequestDtoStateTimeframesEnum.n1h;
      case '4h':
        return BacktestingCreateJobRequestDtoStateTimeframesEnum.n4h;
      case '6h':
        return BacktestingCreateJobRequestDtoStateTimeframesEnum.n6h;
      case '8h':
        return BacktestingCreateJobRequestDtoStateTimeframesEnum.n8h;
      case '12h':
        return BacktestingCreateJobRequestDtoStateTimeframesEnum.n12h;
      case '1d':
        return BacktestingCreateJobRequestDtoStateTimeframesEnum.n1d;
      case '1w':
        return BacktestingCreateJobRequestDtoStateTimeframesEnum.n1w;
      default:
        throw FormatException('unsupported backtest baseTimeframe: $raw');
    }
  }

  BacktestingCreateJobExecutionDtoPriceSourceEnum _priceSource(String raw) {
    switch (raw.trim().toLowerCase()) {
      case 'open':
        return BacktestingCreateJobExecutionDtoPriceSourceEnum.open;
      case 'close':
        return BacktestingCreateJobExecutionDtoPriceSourceEnum.close;
      case 'mid':
        return BacktestingCreateJobExecutionDtoPriceSourceEnum.mid;
      default:
        throw FormatException('unsupported backtest priceSource: $raw');
    }
  }

  BacktestingCreateJobRequestedRangeInputDto _requestedRangeInput(
    String raw, {
    required DateTime startTime,
    required DateTime endTime,
  }) {
    final String preset = raw.trim().toUpperCase();
    return BacktestingCreateJobRequestedRangeInputDto((b) {
      switch (preset) {
        case '7D':
          b.preset = BacktestingCreateJobRequestedRangeInputDtoPresetEnum.n7d;
          break;
        case '30D':
          b.preset = BacktestingCreateJobRequestedRangeInputDtoPresetEnum.n30d;
          break;
        case '90D':
          b.preset = BacktestingCreateJobRequestedRangeInputDtoPresetEnum.n90d;
          break;
        case '1Y':
          b.preset = BacktestingCreateJobRequestedRangeInputDtoPresetEnum.n1y;
          break;
        case 'CUSTOM':
          b
            ..preset =
                BacktestingCreateJobRequestedRangeInputDtoPresetEnum.CUSTOM
            ..startAt = startTime.toIso8601String()
            ..endAt = endTime.toIso8601String();
          break;
        default:
          throw FormatException('unsupported backtest rangePreset: $raw');
      }
    });
  }

  BuiltMap<String, JsonObject?> _builtJsonObjectMap(
    Map<String, dynamic> source,
  ) {
    return BuiltMap<String, JsonObject?>(
      source.map(
        (String key, dynamic value) =>
            MapEntry<String, JsonObject?>(key, JsonObject(value)),
      ),
    );
  }

  Map<String, dynamic> _builtJsonMap(BuiltMap<String, JsonObject?>? source) {
    if (source == null) return <String, dynamic>{};
    return Map<String, dynamic>.fromEntries(
      source.entries.map(
        (MapEntry<String, JsonObject?> entry) =>
            MapEntry<String, dynamic>(entry.key, entry.value?.value),
      ),
    );
  }

  List<Map<String, dynamic>> _builtJsonMapList(
    BuiltList<BuiltMap<String, JsonObject?>> source,
  ) {
    return source.map(_builtJsonMap).toList(growable: false);
  }

  Map<String, dynamic> _createJobResponseMap(
    BacktestingProxyControllerCreateJob200Response? response,
  ) {
    final BacktestingCreateJobResponseDto? data = response?.data;
    if (data == null) return <String, dynamic>{};
    return <String, dynamic>{
      'data': <String, dynamic>{
        'id': data.id,
        'status': data.status.name,
        if (data.error != null) 'error': data.error,
        'inputSummary': _inputSummaryMap(data.inputSummary),
        if (data.resultSummary != null) 'summary': _resultSummaryMap(data),
      },
    };
  }

  Map<String, dynamic> _jobResponseMap(
    BacktestingProxyControllerGetJob200Response? response,
  ) {
    final BacktestingJobResponseDto? data = response?.data;
    if (data == null) return <String, dynamic>{};
    return <String, dynamic>{
      'data': <String, dynamic>{
        'id': data.id,
        'status': data.status.name,
        'createdAt': data.createdAt,
        if (data.startedAt != null) 'startedAt': data.startedAt,
        if (data.finishedAt != null) 'finishedAt': data.finishedAt,
        if (data.error != null) 'error': data.error,
        if (data.errorDetails != null)
          'errorDetails': _builtJsonMap(data.errorDetails),
        'inputSummary': _builtJsonMap(data.inputSummary),
        if (data.resultSummary != null)
          'summary': _builtJsonMap(data.resultSummary),
      },
    };
  }

  Map<String, dynamic> _reportResponseMap(
    BacktestingProxyControllerGetJobResult200Response? response,
  ) {
    final BacktestingReportResponseDto? data = response?.data;
    if (data == null) return <String, dynamic>{};
    return <String, dynamic>{
      'data': <String, dynamic>{
        'summary': _builtJsonMap(data.summary),
        'equityCurve': _builtJsonMapList(data.equityCurve),
        'trades': _builtJsonMapList(data.trades),
        'markers': _builtJsonMapList(data.markers),
        'bySymbol': _builtJsonMapList(data.bySymbol),
        if (data.openPositions != null)
          'openPositions': _builtJsonMapList(data.openPositions!),
        if (data.pendingSignals != null)
          'pendingSignals': _builtJsonMapList(data.pendingSignals!),
      },
    };
  }

  Map<String, dynamic> _resultSummaryMap(BacktestingCreateJobResponseDto data) {
    final BacktestingCreateJobSummaryDto? summary = data.resultSummary;
    if (summary == null) return <String, dynamic>{};
    return <String, dynamic>{
      'netProfitPct': summary.netProfitPct,
      'maxDrawdownPct': summary.maxDrawdownPct,
      'winRate': summary.winRate,
      if (summary.profitFactor != null) 'profitFactor': summary.profitFactor,
      'totalTrades': summary.totalTrades,
    };
  }

  Map<String, dynamic> _inputSummaryMap(
    BacktestingCreateJobInputSummaryDto input,
  ) {
    return <String, dynamic>{
      'symbols': input.symbols.toList(growable: false),
      'baseTimeframe': input.baseTimeframe,
      'stateTimeframes': input.stateTimeframes.toList(growable: false),
      'initialCash': input.initialCash,
      if (input.leverage != null) 'leverage': input.leverage,
      'marketType': input.marketType.name,
      'dataRange': _rangeMap(input.dataRange),
      'requestedRange': _rangeMap(input.requestedRange),
      if (input.appliedRange != null)
        'appliedRange': _rangeMap(input.appliedRange!),
      'allowPartial': input.allowPartial,
      'isPartial': input.isPartial,
      'strategyId': input.strategyId,
      if (input.strategyInstanceId != null)
        'strategyInstanceId': input.strategyInstanceId,
      if (input.strategyTemplateId != null)
        'strategyTemplateId': input.strategyTemplateId,
      if (input.snapshotId != null) 'snapshotId': input.snapshotId,
      if (input.snapshotHash != null) 'snapshotHash': input.snapshotHash,
      if (input.scriptHash != null) 'scriptHash': input.scriptHash,
      if (input.specHash != null) 'specHash': input.specHash,
    };
  }

  Map<String, dynamic> _rangeMap(BacktestingCreateJobRangeDto range) {
    return <String, dynamic>{'fromTs': range.fromTs, 'toTs': range.toTs};
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
      'markers',
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
