import 'dart:math' as math;

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
    final List<_EquityPoint> equityPoints = _parseEquityPoints(m);
    final List<double> equityCurve = equityPoints.isEmpty
        ? _parseEquityCurve(m)
        : equityPoints
              .map((_EquityPoint point) => point.equity)
              .toList(growable: false);
    final double totalReturnPercent = asDouble(
      pick(m, <String>['totalReturnPercent']) ??
          pick(summary, <String>['netProfitPct', 'totalReturnPct']),
      fallback: base.totalReturnPercent,
    );
    final double maxDrawdownPercent = asDouble(
      pick(m, <String>['maxDrawdownPercent']) ??
          pick(summary, <String>['maxDrawdownPct']),
      fallback: base.maxDrawdownPercent,
    );
    final double cagrPercent = asDouble(
      pick(m, <String>['cagrPercent']) ?? pick(summary, <String>['cagrPct']),
      fallback: _deriveCagrPercent(equityPoints, totalReturnPercent),
    );
    final double calmar = asDouble(
      pick(m, <String>['calmar']),
      fallback: _deriveCalmar(cagrPercent, maxDrawdownPercent),
    );
    final List<BacktestTrade> trades = _parseTrades(m);
    final DateTime rangeStart = _resolveRangeBoundary(
      pick(m, <String>['rangeStart']) ??
          pick(asMap(inputSummary['appliedRange']), <String>['fromTs']) ??
          pick(asMap(inputSummary['dataRange']), <String>['fromTs']),
      fallback: base.rangeStart,
      candidates: <DateTime?>[
        if (equityPoints.isNotEmpty) equityPoints.first.time,
        if (trades.isNotEmpty) trades.first.time,
      ],
    );
    final DateTime rangeEnd = _resolveRangeBoundary(
      pick(m, <String>['rangeEnd']) ??
          pick(asMap(inputSummary['appliedRange']), <String>['toTs']) ??
          pick(asMap(inputSummary['dataRange']), <String>['toTs']),
      fallback: base.rangeEnd,
      candidates: <DateTime?>[
        if (equityPoints.isNotEmpty) equityPoints.last.time,
        if (trades.isNotEmpty) trades.last.time,
      ],
    );
    final double winRatePercent = _percentValue(
      pick(m, <String>['winRatePercent']) ?? pick(summary, <String>['winRate']),
      fallback: base.winRatePercent,
    );
    final double profitLossRatio = asDouble(
      pick(m, <String>['profitLossRatio']) ??
          pick(summary, <String>['profitFactor']),
      fallback: base.profitLossRatio,
    );
    final int totalTrades = asInt(
      pick(m, <String>['totalTrades']) ??
          pick(summary, <String>['totalTrades', 'tradeCount']),
      fallback: trades.isNotEmpty ? trades.length : base.totalTrades,
    );
    final List<BacktestOpenPosition> openPositions = _parseOpenPositions(m);
    final int openTrades = asInt(
      pick(m, <String>['openTrades', 'openTradeCount']) ??
          pick(summary, <String>['totalOpenTrades', 'openTradeCount']),
      fallback: openPositions.length,
    );
    final double openPnl = asDouble(
      pick(m, <String>['openPnl']) ?? pick(summary, <String>['openPnl']),
      fallback: _deriveOpenPnl(openPositions),
    );
    final String avgHoldDuration = asString(
      pick(m, <String>['avgHoldDuration']),
      fallback: _deriveAverageHoldDuration(trades),
    );
    final List<BacktestMonthlyRow> monthlyRows = _parseMonthlyRows(m);
    final List<BacktestRiskRow> riskRows = _parseRiskRows(m);
    return BacktestResult(
      id: asString(pick(m, <String>['id']), fallback: fallbackId ?? base.id),
      totalReturnPercent: totalReturnPercent,
      cagrPercent: cagrPercent,
      maxDrawdownPercent: maxDrawdownPercent,
      sharpe: asDouble(
        pick(m, <String>['sharpe']) ?? pick(summary, <String>['sharpe']),
        fallback: base.sharpe,
      ),
      calmar: calmar,
      winRatePercent: winRatePercent,
      profitLossRatio: profitLossRatio,
      avgHoldDuration: avgHoldDuration,
      totalTrades: totalTrades,
      closedReturnPercent: totalReturnPercent,
      closedWinRatePercent: winRatePercent,
      closedTrades: totalTrades,
      openTrades: openTrades,
      openPnl: openPnl,
      rangeStart: rangeStart,
      rangeEnd: rangeEnd,
      equityCurve: equityCurve,
      equityPoints: equityPoints
          .map(
            (_EquityPoint point) =>
                BacktestEquityPoint(time: point.time, equity: point.equity),
          )
          .toList(growable: false),
      drawdownMarkers: _parseDrawdownMarkers(m),
      monthlyRows: monthlyRows.isEmpty
          ? _deriveMonthlyRows(equityPoints)
          : monthlyRows,
      trades: trades,
      openPositions: openPositions,
      riskRows: riskRows.isEmpty
          ? _deriveRiskRows(
              equityPoints: equityPoints,
              maxDrawdownPercent: maxDrawdownPercent,
            )
          : riskRows,
      aiAssessment: asString(
        pick(m, <String>['aiAssessment']),
        fallback: _deriveAiAssessment(
          totalReturnPercent: totalReturnPercent,
          maxDrawdownPercent: maxDrawdownPercent,
          totalTrades: totalTrades,
        ),
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
    final Object body = _api.client.serializers.serialize(
      payload,
      specifiedType: const FullType(BacktestingCreateJobRequestDto),
    )!;
    final Response<Object?> response = await _api.dio.request<Object?>(
      '/backtesting/jobs',
      data: body,
      options: Options(
        method: 'POST',
        headers: <String, dynamic>{'authorization': _authorization()},
        contentType: 'application/json',
      ),
    );
    final Map<String, dynamic> createEnvelope = asMap(response.data);
    final Map<String, dynamic> createData = asMap(createEnvelope['data']);
    final Map<String, dynamic> created = createData.isEmpty
        ? createEnvelope
        : createData;
    final String jobId = asString(pick(created, <String>['id'])).trim();
    final String status = asString(pick(created, <String>['status'])).trim();
    if (jobId.isEmpty) {
      return _merge(created, fallbackId: jobId.isEmpty ? null : jobId);
    }

    if (status.isEmpty || _isSucceeded(status)) return getResult(jobId);

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
    final Response<Object?> response = await _api.dio.request<Object?>(
      '/backtesting/jobs/${Uri.encodeComponent(id)}/result',
      options: Options(
        method: 'GET',
        headers: <String, dynamic>{'authorization': _authorization()},
      ),
    );
    return _merge(response.data, fallbackId: id);
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
      final Response<Object?> response = await _api.dio.request<Object?>(
        '/backtesting/jobs/${Uri.encodeComponent(jobId)}',
        options: Options(
          method: 'GET',
          headers: <String, dynamic>{'authorization': _authorization()},
        ),
      );
      final Map<String, dynamic> envelope = asMap(response.data);
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

  List<_EquityPoint> _parseEquityPoints(Map<String, dynamic> m) {
    final Object? raw = pick(m, <String>['equityCurve', 'equity', 'curve']);
    return asList(raw)
        .map((Object? item) {
          final Map<String, dynamic> row = asMap(item);
          final double? equity = item is num || item is String
              ? asDoubleOrNull(item)
              : asDoubleOrNull(
                  pick(row, <String>['value', 'equity', 'balance', 'nav']),
                );
          if (equity == null) return null;
          return _EquityPoint(
            equity: equity,
            time: _tryDateTime(pick(row, <String>['ts', 'time', 'timestamp'])),
          );
        })
        .whereType<_EquityPoint>()
        .toList(growable: false);
  }

  List<BacktestOpenPosition> _parseOpenPositions(Map<String, dynamic> m) {
    final Object? raw = pick(m, <String>['openPositions', 'positions']);
    return asMapList(raw)
        .map((Map<String, dynamic> row) {
          return BacktestOpenPosition(
            symbol: asString(pick(row, <String>['symbol'])),
            qty: asDouble(pick(row, <String>['qty', 'quantity', 'size'])),
            avgEntryPrice: asDouble(
              pick(row, <String>['avgEntryPrice', 'entryPrice', 'entry']),
            ),
            unrealizedPnl: asDouble(
              pick(row, <String>['unrealizedPnl', 'openPnl', 'pnl']),
            ),
          );
        })
        .toList(growable: false);
  }

  double _deriveOpenPnl(List<BacktestOpenPosition> positions) {
    double total = 0;
    for (final BacktestOpenPosition position in positions) {
      total += position.unrealizedPnl;
    }
    return total;
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
          final DateTime? entryTime = _tryDateTime(
            pick(row, <String>['entryTs', 'entryTime', 'openedAt']),
          );
          final DateTime exitTime =
              _tryDateTime(
                pick(row, <String>['exitTs', 'exitTime', 'time', 'timestamp']),
              ) ??
              entryTime ??
              DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);
          final double pnlPercent = asDouble(
            pick(row, <String>['pnlPercent', 'pnlPct', 'returnPct']),
          );
          final String duration = asString(
            pick(row, <String>['duration', 'holdDuration']),
            fallback: _formatDuration(entryTime, exitTime),
          );
          return BacktestTrade(
            time: exitTime,
            side: _parseTradeSide(pick(row, <String>['side', 'direction'])),
            entry: asDouble(pick(row, <String>['entry', 'entryPrice'])),
            exit: asDouble(pick(row, <String>['exit', 'exitPrice'])),
            pnlPercent: pnlPercent,
            duration: duration,
            win: asBool(
              pick(row, <String>['win', 'isWin']),
              fallback: pnlPercent >= 0,
            ),
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

  DateTime _resolveRangeBoundary(
    Object? raw, {
    required DateTime fallback,
    required List<DateTime?> candidates,
  }) {
    final DateTime? direct = _tryDateTime(raw);
    if (direct != null) return direct;
    for (final DateTime? candidate in candidates) {
      if (candidate != null) return candidate;
    }
    return fallback;
  }

  DateTime? _tryDateTime(Object? raw) {
    if (raw is String) {
      final DateTime? parsed = DateTime.tryParse(raw);
      if (parsed != null) return parsed;
      final int? epoch = int.tryParse(raw);
      if (epoch != null) return _dateTimeFromEpochValue(epoch);
    }
    if (raw is num) return _dateTimeFromEpochValue(raw.toInt());
    return null;
  }

  DateTime _dateTimeFromEpochValue(int value) {
    return DateTime.fromMillisecondsSinceEpoch(
      value > 9999999999 ? value : value * 1000,
    );
  }

  double _percentValue(Object? raw, {required double fallback}) {
    final double value = asDouble(raw, fallback: fallback);
    if (value > 0 && value <= 1) return value * 100;
    return value;
  }

  double _deriveCagrPercent(
    List<_EquityPoint> equityPoints,
    double totalReturnPercent,
  ) {
    if (equityPoints.length < 2) return totalReturnPercent;
    final _EquityPoint first = equityPoints.first;
    final _EquityPoint last = equityPoints.last;
    if (first.equity <= 0 || first.time == null || last.time == null) {
      return totalReturnPercent;
    }
    final double days =
        last.time!.difference(first.time!).inMilliseconds.abs().toDouble() /
        Duration.millisecondsPerDay;
    if (days <= 0) return totalReturnPercent;
    final double growth = last.equity / first.equity;
    if (growth <= 0) return -100;
    return (math.pow(growth, 365 / days).toDouble() - 1) * 100;
  }

  double _deriveCalmar(double cagrPercent, double maxDrawdownPercent) {
    final double drawdown = maxDrawdownPercent.abs();
    if (drawdown <= 0) return 0;
    return cagrPercent / drawdown;
  }

  String _parseTradeSide(Object? raw) {
    switch (asString(raw).trim().toLowerCase()) {
      case 'long':
      case 'buy':
      case '多':
        return 'long';
      case 'short':
      case 'sell':
      case '空':
        return 'short';
      default:
        return 'long';
    }
  }

  String _formatDuration(DateTime? start, DateTime end) {
    if (start == null) return '';
    final Duration duration = end.difference(start).abs();
    if (duration.inMinutes < 60) return '${duration.inMinutes}m';
    final int hours = duration.inHours;
    final int minutes = duration.inMinutes.remainder(60);
    if (hours < 24) return minutes == 0 ? '${hours}h' : '${hours}h ${minutes}m';
    final int days = duration.inDays;
    final int restHours = duration.inHours.remainder(24);
    return restHours == 0 ? '${days}d' : '${days}d ${restHours}h';
  }

  String _deriveAverageHoldDuration(List<BacktestTrade> trades) {
    final List<int> minutes = trades
        .map((BacktestTrade trade) => _durationMinutes(trade.duration))
        .where((int value) => value > 0)
        .toList(growable: false);
    if (minutes.isEmpty) return '--';
    final int avg = minutes.reduce((int a, int b) => a + b) ~/ minutes.length;
    return _formatMinutes(avg);
  }

  int _durationMinutes(String raw) {
    int total = 0;
    final RegExp pattern = RegExp(r'(\d+)\s*([dhm])');
    for (final RegExpMatch match in pattern.allMatches(raw.toLowerCase())) {
      final int value = int.tryParse(match.group(1) ?? '') ?? 0;
      switch (match.group(2)) {
        case 'd':
          total += value * 24 * 60;
          break;
        case 'h':
          total += value * 60;
          break;
        case 'm':
          total += value;
          break;
      }
    }
    return total;
  }

  String _formatMinutes(int minutes) {
    if (minutes < 60) return '${minutes}m';
    final int hours = minutes ~/ 60;
    final int restMinutes = minutes % 60;
    if (hours < 24) {
      return restMinutes == 0 ? '${hours}h' : '${hours}h ${restMinutes}m';
    }
    final int days = hours ~/ 24;
    final int restHours = hours % 24;
    return restHours == 0 ? '${days}d' : '${days}d ${restHours}h';
  }

  List<BacktestMonthlyRow> _deriveMonthlyRows(List<_EquityPoint> points) {
    final List<_EquityPoint> dated = points
        .where((_EquityPoint point) => point.time != null)
        .toList(growable: false);
    if (dated.length < 2) return const <BacktestMonthlyRow>[];
    final Map<int, List<double?>> byYear = <int, List<double?>>{};
    _EquityPoint monthStart = dated.first;
    for (int i = 1; i < dated.length; i++) {
      final _EquityPoint current = dated[i];
      final DateTime previousTime = dated[i - 1].time!;
      final DateTime currentTime = current.time!;
      final bool monthChanged =
          previousTime.year != currentTime.year ||
          previousTime.month != currentTime.month;
      final bool lastPoint = i == dated.length - 1;
      if (!monthChanged && !lastPoint) continue;
      final _EquityPoint monthEnd = monthChanged ? dated[i - 1] : current;
      if (monthStart.equity > 0) {
        final DateTime month = monthStart.time!;
        final List<double?> values = byYear.putIfAbsent(
          month.year,
          () => List<double?>.filled(12, null, growable: false),
        );
        values[month.month - 1] =
            ((monthEnd.equity / monthStart.equity) - 1) * 100;
      }
      if (monthChanged) monthStart = current;
    }
    return byYear.entries
        .map(
          (MapEntry<int, List<double?>> entry) => BacktestMonthlyRow(
            year: entry.key,
            values: List<double?>.unmodifiable(entry.value),
          ),
        )
        .toList(growable: false)
      ..sort((BacktestMonthlyRow a, BacktestMonthlyRow b) => a.year - b.year);
  }

  List<BacktestRiskRow> _deriveRiskRows({
    required List<_EquityPoint> equityPoints,
    required double maxDrawdownPercent,
  }) {
    final _DrawdownAnalysis drawdown = _analyzeDrawdown(
      equityPoints,
      fallbackMaxDrawdownPercent: maxDrawdownPercent,
    );
    final _PerformanceAnalysis performance = _analyzePerformance(equityPoints);
    return <BacktestRiskRow>[
      BacktestRiskRow(
        label: '最大回撤幅度',
        value: '-${drawdown.maxDrawdownPct.toStringAsFixed(2)}%',
        barFraction: (drawdown.maxDrawdownPct / 30).clamp(0.0, 1.0),
        tone: drawdown.maxDrawdownPct >= 30
            ? BacktestRiskTone.danger
            : drawdown.maxDrawdownPct >= 15
            ? BacktestRiskTone.warn
            : BacktestRiskTone.neutral,
        note: drawdown.periodLabel,
      ),
      BacktestRiskRow(
        label: '回撤恢复天数',
        value: drawdown.recoveryDays == null
            ? '未恢复'
            : '${drawdown.recoveryDays} 天',
        barFraction: ((drawdown.recoveryDays ?? 30) / 30).clamp(0.0, 1.0),
        tone: drawdown.recoveryDays == null || drawdown.recoveryDays! > 30
            ? BacktestRiskTone.warn
            : BacktestRiskTone.neutral,
        note: drawdown.recoveryNote,
      ),
      BacktestRiskRow(
        label: '年化波动率',
        value: performance.annualizedVolatilityPct == null
            ? '--'
            : '${performance.annualizedVolatilityPct!.toStringAsFixed(2)}%',
        barFraction: ((performance.annualizedVolatilityPct ?? 0) / 80).clamp(
          0.0,
          1.0,
        ),
        tone: performance.annualizedVolatilityPct == null
            ? BacktestRiskTone.neutral
            : performance.annualizedVolatilityPct! >= 80
            ? BacktestRiskTone.danger
            : performance.annualizedVolatilityPct! >= 40
            ? BacktestRiskTone.warn
            : BacktestRiskTone.neutral,
        note: '基于净值曲线收益序列按时间间隔年化。',
      ),
      BacktestRiskRow(
        label: '夏普比率',
        value: performance.sharpeRatio == null
            ? '--'
            : performance.sharpeRatio!.toStringAsFixed(2),
        barFraction: ((performance.sharpeRatio ?? 0).clamp(0.0, 3.0) / 3)
            .toDouble(),
        tone: performance.sharpeRatio == null
            ? BacktestRiskTone.neutral
            : performance.sharpeRatio! < 0
            ? BacktestRiskTone.danger
            : performance.sharpeRatio! < 1
            ? BacktestRiskTone.warn
            : BacktestRiskTone.neutral,
        note: '按 front 口径由净值收益均值和标准差计算。',
      ),
    ];
  }

  _DrawdownAnalysis _analyzeDrawdown(
    List<_EquityPoint> points, {
    required double fallbackMaxDrawdownPercent,
  }) {
    final List<_EquityPoint> dated = points
        .where((_EquityPoint point) => point.time != null)
        .toList(growable: false);
    if (dated.isEmpty) {
      final double fallback = fallbackMaxDrawdownPercent.abs();
      return _DrawdownAnalysis(
        maxDrawdownPct: fallback,
        periodLabel: fallback == 0 ? '--' : '回撤区间暂无净值时间点',
        recoveryDays: fallback == 0 ? 0 : null,
        recoveryNote: fallback == 0 ? '净值未低于阶段高点。' : '缺少净值曲线，无法判断恢复时间。',
      );
    }

    int peakIndex = 0;
    double peakEquity = dated.first.equity;
    double maxDrawdownPct = 0;
    int drawdownStartIndex = 0;
    int troughIndex = 0;
    double drawdownPeakEquity = peakEquity;

    for (int index = 0; index < dated.length; index++) {
      final _EquityPoint point = dated[index];
      if (point.equity > peakEquity) {
        peakEquity = point.equity;
        peakIndex = index;
      }
      final double drawdownPct = peakEquity > 0
          ? ((peakEquity - point.equity) / peakEquity) * 100
          : 0;
      if (drawdownPct > maxDrawdownPct) {
        maxDrawdownPct = drawdownPct;
        drawdownStartIndex = peakIndex;
        troughIndex = index;
        drawdownPeakEquity = peakEquity;
      }
    }

    if (maxDrawdownPct == 0) {
      return const _DrawdownAnalysis(
        maxDrawdownPct: 0,
        periodLabel: '--',
        recoveryDays: 0,
        recoveryNote: '净值未低于阶段高点。',
      );
    }

    final _EquityPoint drawdownStart = dated[drawdownStartIndex];
    final _EquityPoint trough = dated[troughIndex];
    int? recoveryDays;
    for (final _EquityPoint point in dated.skip(troughIndex + 1)) {
      if (point.equity >= drawdownPeakEquity) {
        recoveryDays = math.max(
          0,
          (point.time!.difference(trough.time!).inHours / 24).round(),
        );
        break;
      }
    }

    return _DrawdownAnalysis(
      maxDrawdownPct: double.parse(maxDrawdownPct.toStringAsFixed(2)),
      periodLabel:
          '${_formatDateOnly(drawdownStart.time!)} ~ ${_formatDateOnly(trough.time!)}',
      recoveryDays: recoveryDays,
      recoveryNote: recoveryDays == null
          ? '最深回撤在回测结束前尚未完全恢复。'
          : '最深回撤恢复耗时 $recoveryDays 天。',
    );
  }

  _PerformanceAnalysis _analyzePerformance(List<_EquityPoint> points) {
    final List<_EquityPoint> dated =
        points
            .where((_EquityPoint point) => point.time != null)
            .toList(growable: false)
          ..sort(
            (_EquityPoint a, _EquityPoint b) => a.time!.compareTo(b.time!),
          );
    if (dated.length < 2) return const _PerformanceAnalysis();

    final List<double> returns = <double>[];
    final List<int> intervals = <int>[];
    for (int index = 1; index < dated.length; index++) {
      final _EquityPoint previous = dated[index - 1];
      final _EquityPoint current = dated[index];
      final int interval =
          current.time!.millisecondsSinceEpoch -
          previous.time!.millisecondsSinceEpoch;
      if (interval > 0) intervals.add(interval);
      if (previous.equity > 0) {
        returns.add((current.equity - previous.equity) / previous.equity);
      }
    }
    if (returns.isEmpty || intervals.isEmpty) {
      return const _PerformanceAnalysis();
    }

    intervals.sort();
    final int medianInterval = intervals[intervals.length ~/ 2];
    if (medianInterval <= 0) return const _PerformanceAnalysis();

    final double periodsPerYear =
        (365 * Duration.millisecondsPerDay) / medianInterval;
    final double meanReturn = _average(returns);
    final double variance = _average(
      returns.map((double value) => math.pow(value - meanReturn, 2).toDouble()),
    );
    final double stdDev = math.sqrt(variance);
    final double annualization = math.sqrt(periodsPerYear);

    return _PerformanceAnalysis(
      annualizedVolatilityPct: double.parse(
        (stdDev * annualization * 100).toStringAsFixed(2),
      ),
      sharpeRatio: stdDev > 0
          ? double.parse(
              ((meanReturn / stdDev) * annualization).toStringAsFixed(2),
            )
          : null,
    );
  }

  double _average(Iterable<double> values) {
    final List<double> list = values.toList(growable: false);
    if (list.isEmpty) return 0;
    return list.reduce((double a, double b) => a + b) / list.length;
  }

  String _formatDateOnly(DateTime date) {
    final DateTime utc = date.toUtc();
    return '${utc.year.toString().padLeft(4, '0')}-${utc.month.toString().padLeft(2, '0')}-${utc.day.toString().padLeft(2, '0')}';
  }

  String _deriveAiAssessment({
    required double totalReturnPercent,
    required double maxDrawdownPercent,
    required int totalTrades,
  }) {
    if (totalTrades == 0) return '本次回测未产生有效交易，建议扩大周期或检查入场条件。';
    if (totalReturnPercent > 0 && maxDrawdownPercent.abs() <= 10) {
      return '策略在当前区间取得正收益，回撤压力相对可控，可继续观察更多周期表现。';
    }
    if (totalReturnPercent > 0) return '策略取得正收益，但回撤偏高，建议继续检查止损和仓位参数。';
    return '策略在当前区间收益为负，建议先优化入场过滤、止损或仓位设置。';
  }
}

class _EquityPoint {
  const _EquityPoint({required this.equity, required this.time});

  final double equity;
  final DateTime? time;
}

class _DrawdownAnalysis {
  const _DrawdownAnalysis({
    required this.maxDrawdownPct,
    required this.periodLabel,
    required this.recoveryDays,
    required this.recoveryNote,
  });

  final double maxDrawdownPct;
  final String periodLabel;
  final int? recoveryDays;
  final String recoveryNote;
}

class _PerformanceAnalysis {
  const _PerformanceAnalysis({this.annualizedVolatilityPct, this.sharpeRatio});

  final double? annualizedVolatilityPct;
  final double? sharpeRatio;
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
    openPositions: const <BacktestOpenPosition>[],
    riskRows: const <BacktestRiskRow>[],
    aiAssessment: '',
  );
}
