import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:built_collection/built_collection.dart';
import 'package:built_value/json_object.dart';

import 'backtest_models.dart';
import 'deploy_models.dart';

class AiPublishedStrategyContext {
  const AiPublishedStrategyContext({
    required this.codegenSessionId,
    required this.status,
    required this.params,
    required this.snapshotParamValues,
    required this.strategyConfig,
    required this.backtestConfigDefaults,
    required this.deploymentExecutionDefaults,
    required this.deploymentExecutionConstraints,
    required this.compatibilityMetadata,
    this.conversationId,
    this.strategyInstanceId,
    this.publishedSnapshotId,
    this.scriptCode,
    this.rejectReason,
  });

  factory AiPublishedStrategyContext.fromCodegen(
    CodegenSessionResponseDto response,
  ) {
    final Map<String, Object?> snapshotParams = _builtJsonMap(
      response.publishedSnapshotParamValues ?? response.specDesc,
    );
    return AiPublishedStrategyContext(
      codegenSessionId: response.id,
      conversationId: _blankToNull(response.conversationId),
      strategyInstanceId: _blankToNull(response.strategyInstanceId),
      publishedSnapshotId: _blankToNull(response.publishedSnapshotId),
      status: response.status.name,
      scriptCode: _blankToNull(response.scriptCode),
      rejectReason: _blankToNull(response.rejectReason),
      params: _stringParams(snapshotParams),
      snapshotParamValues: snapshotParams,
      strategyConfig: _builtJsonMap(response.publishedSnapshotStrategyConfig),
      backtestConfigDefaults: _builtJsonMap(
        response.publishedSnapshotBacktestConfigDefaults,
      ),
      deploymentExecutionDefaults: _builtJsonMap(
        response.publishedSnapshotDeploymentExecutionDefaults,
      ),
      deploymentExecutionConstraints: _builtJsonMap(
        response.publishedSnapshotDeploymentExecutionConstraints,
      ),
      compatibilityMetadata: _builtJsonMap(
        response.publishedSnapshotCompatibilityMetadata,
      ),
    );
  }

  final String codegenSessionId;
  final String? conversationId;
  final String? strategyInstanceId;
  final String? publishedSnapshotId;
  final String status;
  final String? scriptCode;
  final String? rejectReason;
  final Map<String, String> params;
  final Map<String, Object?> snapshotParamValues;
  final Map<String, Object?> strategyConfig;
  final Map<String, Object?> backtestConfigDefaults;
  final Map<String, Object?> deploymentExecutionDefaults;
  final Map<String, Object?> deploymentExecutionConstraints;
  final Map<String, Object?> compatibilityMetadata;

  bool get hasPublishedSnapshot => publishedSnapshotId?.isNotEmpty == true;

  bool get hasScript => scriptCode?.trim().isNotEmpty == true;

  bool get requiresRepublishForBacktest =>
      _readBool(compatibilityMetadata, 'requiresRepublishForBacktest');

  bool get requiresRepublishForDeploy =>
      _readBool(compatibilityMetadata, 'requiresRepublishForDeploy');

  String? get exchange => _normalizeExchange(
    _findString(
      <String>['exchange', 'exchangeId', 'venue'],
      [strategyConfig, snapshotParamValues, deploymentExecutionDefaults],
    ),
  );

  String? get symbol => _findString(
    <String>['symbol', 'baseSymbol', 'instrument'],
    [strategyConfig, snapshotParamValues, backtestConfigDefaults],
  );

  String? get baseTimeframe => _findString(
    <String>['baseTimeframe', 'timeframe', 'period'],
    [strategyConfig, snapshotParamValues, backtestConfigDefaults],
  );

  String? get marketType {
    final String? raw = _findString(
      <String>['marketType', 'market'],
      [
        snapshotParamValues,
        strategyConfig,
        backtestConfigDefaults,
        deploymentExecutionDefaults,
      ],
    )?.toLowerCase();
    if (raw == null) return null;
    if (raw.contains('spot') || raw.contains('现货')) return 'spot';
    if (raw.contains('perp') || raw.contains('future') || raw.contains('永续')) {
      return 'perp';
    }
    return raw;
  }

  int? get leverage => _findInt(
    <String>['leverage'],
    [
      deploymentExecutionDefaults,
      backtestConfigDefaults,
      strategyConfig,
      snapshotParamValues,
    ],
  );

  String get displayTitle {
    final String? explicit = _findString(
      <String>['name', 'title', 'strategyName', 'displayName'],
      [strategyConfig, snapshotParamValues],
    );
    if (explicit != null) return explicit;
    final String? symbol = displaySymbol;
    return symbol == null ? 'AI 策略' : '$symbol AI 策略';
  }

  String? get displaySymbol {
    final String? raw = symbol;
    if (raw == null) return null;
    return raw.trim().toUpperCase().replaceAll('/', '');
  }

  String get displayMeta {
    return <String?>[displaySymbol, baseTimeframe]
        .where((String? value) => value?.trim().isNotEmpty == true)
        .cast<String>()
        .join(' · ');
  }

  String get displayHeaderSubtitle {
    final String meta = displayMeta;
    return meta.isEmpty ? 'AI 策略' : meta;
  }

  Map<String, String> toRouteParams() {
    final Map<String, String> routeParams = <String, String>{
      ...params,
      'codegenStatus': status,
      'codegenSessionId': codegenSessionId,
    };
    final String? conversationId = this.conversationId;
    if (conversationId != null) routeParams['conversationId'] = conversationId;
    final String? strategyInstanceId = this.strategyInstanceId;
    if (strategyInstanceId != null) {
      routeParams['strategyInstanceId'] = strategyInstanceId;
    }
    final String? publishedSnapshotId = this.publishedSnapshotId;
    if (publishedSnapshotId != null) {
      routeParams['publishedSnapshotId'] = publishedSnapshotId;
    }
    final String scriptCode = this.scriptCode?.trim() ?? '';
    if (scriptCode.isNotEmpty) routeParams['scriptCode'] = scriptCode;
    final String? exchange = this.exchange;
    if (exchange != null) routeParams['exchange'] = exchange;
    final String? symbol = this.symbol;
    if (symbol != null) routeParams['symbol'] = symbol;
    final String? displaySymbol = this.displaySymbol;
    if (displaySymbol != null) routeParams['displaySymbol'] = displaySymbol;
    final String? baseTimeframe = this.baseTimeframe;
    if (baseTimeframe != null) routeParams['baseTimeframe'] = baseTimeframe;
    if (baseTimeframe != null) routeParams['period'] = baseTimeframe;
    routeParams['strategyName'] = displayTitle;
    routeParams['category'] = displayTitle;
    final String? marketType = this.marketType;
    if (marketType != null) routeParams['marketType'] = marketType;
    final int? leverage = this.leverage;
    if (leverage != null) routeParams['leverage'] = '${leverage}x';
    return Map<String, String>.unmodifiable(routeParams);
  }

  DeploymentContext toDeploymentContext({BacktestResult? backtestResult}) {
    final double amount =
        _findDouble(
          <String>['amount', 'initialCash'],
          [deploymentExecutionDefaults, backtestConfigDefaults],
        ) ??
        5000;
    final int perTradePct =
        _findInt(
          <String>['perTradePct', 'positionPct'],
          [deploymentExecutionDefaults, snapshotParamValues],
        ) ??
        20;
    final int maxDailyLossPct =
        _findInt(<String>['maxDailyLossPct'], [deploymentExecutionDefaults]) ??
        10;
    return DeploymentContext(
      sessionId: conversationId ?? codegenSessionId,
      publishedSnapshotId: publishedSnapshotId ?? '',
      amount: amount,
      perTradePct: perTradePct,
      maxDailyLossPct: maxDailyLossPct,
      notifyOpen: _readBoolDefault(
        deploymentExecutionDefaults,
        'notifyOpen',
        true,
      ),
      notifyClose: _readBoolDefault(
        deploymentExecutionDefaults,
        'notifyClose',
        true,
      ),
      notifyStopLoss: _readBoolDefault(
        deploymentExecutionDefaults,
        'notifyStopLoss',
        true,
      ),
      symbol: _displaySymbol(),
      strategyName:
          _findString(
            <String>['name', 'title', 'strategyName'],
            [snapshotParamValues, strategyConfig],
          ) ??
          displayTitle,
      exchange: exchange,
      marketType: marketType,
      leverage: leverage,
      backtestReturn: backtestResult?.totalReturnPercent,
      backtestSharpe: backtestResult?.sharpe,
      backtestMaxDrawdown: backtestResult?.maxDrawdownPercent,
    );
  }

  String? _displaySymbol() {
    final String? s = displaySymbol;
    final String? tf = baseTimeframe;
    if (s == null) return null;
    if (tf == null) return s;
    return '$s · $tf';
  }
}

class AiBacktestRunArgs {
  const AiBacktestRunArgs({
    required this.strategyContext,
    required this.config,
    this.sessionId,
  });

  final AiPublishedStrategyContext strategyContext;
  final Map<String, String> config;
  final String? sessionId;

  Map<String, String> get params => <String, String>{
    ...strategyContext.toRouteParams(),
    ...config,
  };
}

class AiBacktestResultArgs {
  const AiBacktestResultArgs({
    required this.jobId,
    required this.strategyContext,
    this.result,
  });

  final String jobId;
  final AiPublishedStrategyContext strategyContext;
  final BacktestResult? result;
}

Map<String, Object?> _builtJsonMap(BuiltMap<String, JsonObject?>? source) {
  if (source == null) return const <String, Object?>{};
  return Map<String, Object?>.unmodifiable(
    Map<String, Object?>.fromEntries(
      source.entries.map(
        (MapEntry<String, JsonObject?> entry) => MapEntry<String, Object?>(
          entry.key,
          _normalizeJsonValue(entry.value?.value),
        ),
      ),
    ),
  );
}

Object? _normalizeJsonValue(Object? value) {
  if (value is BuiltMap) {
    return Map<String, Object?>.unmodifiable(
      Map<String, Object?>.fromEntries(
        value.entries.map(
          (MapEntry<dynamic, dynamic> entry) => MapEntry<String, Object?>(
            entry.key.toString(),
            entry.value is JsonObject
                ? _normalizeJsonValue((entry.value as JsonObject).value)
                : _normalizeJsonValue(entry.value),
          ),
        ),
      ),
    );
  }
  if (value is BuiltList) {
    return List<Object?>.unmodifiable(value.map(_normalizeJsonValue));
  }
  if (value is Map) {
    return Map<String, Object?>.unmodifiable(
      value.map(
        (dynamic key, dynamic entry) => MapEntry<String, Object?>(
          key.toString(),
          _normalizeJsonValue(entry),
        ),
      ),
    );
  }
  if (value is Iterable && value is! String) {
    return List<Object?>.unmodifiable(value.map(_normalizeJsonValue));
  }
  return value;
}

Map<String, String> _stringParams(Map<String, Object?> source) {
  final Map<String, String> params = source.map(
    (String key, Object? value) => MapEntry<String, String>(key, '$value'),
  );
  params.removeWhere((String _, String value) => value.trim().isEmpty);
  return Map<String, String>.unmodifiable(params);
}

String? _blankToNull(String? value) {
  final String trimmed = value?.trim() ?? '';
  return trimmed.isEmpty ? null : trimmed;
}

String? _normalizeExchange(String? value) {
  final String raw = value?.trim().toLowerCase() ?? '';
  if (raw.isEmpty) return null;
  if (raw.contains('okx')) return 'okx';
  if (raw.contains('hyper')) return 'hyperliquid';
  if (raw.contains('binance')) return 'binance';
  return raw;
}

String? _findString(List<String> keys, List<Map<String, Object?>> sources) {
  final Object? value = _findValue(keys, sources);
  final String s = value?.toString().trim() ?? '';
  return s.isEmpty ? null : s;
}

int? _findInt(List<String> keys, List<Map<String, Object?>> sources) {
  final Object? value = _findValue(keys, sources);
  if (value is num) return value.round();
  final String s =
      value?.toString().replaceAll('x', '').replaceAll('%', '').trim() ?? '';
  return int.tryParse(s);
}

double? _findDouble(List<String> keys, List<Map<String, Object?>> sources) {
  final Object? value = _findValue(keys, sources);
  if (value is num) return value.toDouble();
  final String s = value?.toString().replaceAll('%', '').trim() ?? '';
  return double.tryParse(s);
}

Object? _findValue(List<String> keys, List<Map<String, Object?>> sources) {
  for (final Map<String, Object?> source in sources) {
    final Object? direct = _findValueInMap(keys, source);
    if (direct != null) return direct;
  }
  return null;
}

Object? _findValueInMap(List<String> keys, Map<String, Object?> source) {
  for (final String key in keys) {
    for (final MapEntry<String, Object?> entry in source.entries) {
      if (entry.key.toLowerCase() == key.toLowerCase() && entry.value != null) {
        return entry.value;
      }
    }
  }
  for (final Object? value in source.values) {
    if (value is Map<String, Object?>) {
      final Object? nested = _findValueInMap(keys, value);
      if (nested != null) return nested;
    }
  }
  return null;
}

bool _readBool(Map<String, Object?> source, String key) =>
    _readBoolDefault(source, key, false);

bool _readBoolDefault(Map<String, Object?> source, String key, bool fallback) {
  final Object? value = _findValueInMap(<String>[key], source);
  if (value is bool) return value;
  final String s = value?.toString().toLowerCase() ?? '';
  if (s == 'true') return true;
  if (s == 'false') return false;
  return fallback;
}
