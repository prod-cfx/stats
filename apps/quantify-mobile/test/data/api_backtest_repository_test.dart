import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_backtest_repository.dart';
import 'package:quantify_mobile/data/models/backtest_models.dart';
import 'package:quantify_mobile/data/services/generated_backend_api.dart';

class _BacktestApiHarness {
  _BacktestApiHarness({required this.result});

  final Object? result;
  Map<String, dynamic>? lastRunRequest;
  Map<String, dynamic>? lastSupportRequest;
  final List<String> calls = <String>[];

  GeneratedBackendApi build() {
    final Dio dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
      ..interceptors.add(
        InterceptorsWrapper(
          onRequest: (RequestOptions options, RequestInterceptorHandler h) {
            calls.add(options.path);
            if (options.path == '/backtesting/jobs' &&
                options.method == 'POST') {
              lastRunRequest = _serializedListToMap(options.data);
              h.resolve(
                Response<Object?>(
                  requestOptions: options,
                  statusCode: 200,
                  data: result,
                ),
              );
              return;
            }

            if (options.path == '/backtesting/symbols/check' &&
                options.method == 'POST') {
              lastSupportRequest = _serializedListToMap(options.data);
              h.resolve(
                Response<Object?>(
                  requestOptions: options,
                  statusCode: 200,
                  data: result,
                ),
              );
              return;
            }

            if (options.path == '/backtesting/jobs/job-1' &&
                options.method == 'GET') {
              h.resolve(
                Response<Object?>(
                  requestOptions: options,
                  statusCode: 200,
                  data: <String, Object?>{
                    'data': _jobEnvelopeData(id: 'job-1'),
                  },
                ),
              );
              return;
            }

            if (options.path.startsWith('/backtesting/jobs/') &&
                options.path.endsWith('/result') &&
                options.method == 'GET') {
              h.resolve(
                Response<Object?>(
                  requestOptions: options,
                  statusCode: 200,
                  data: result,
                ),
              );
              return;
            }

            h.reject(
              DioException(
                requestOptions: options,
                error: 'unexpected ${options.method} ${options.path}',
              ),
            );
          },
        ),
      );
    return GeneratedBackendApi(dio: dio);
  }
}

Map<String, dynamic> _serializedListToMap(Object? raw) {
  if (raw is Map) {
    return raw.map(
      (Object? key, Object? value) =>
          MapEntry<String, dynamic>('$key', _serializedValue(value)),
    );
  }
  if (raw is Iterable) {
    final List<Object?> items = raw.toList();
    final Map<String, dynamic> map = <String, dynamic>{};
    for (int i = 0; i + 1 < items.length; i += 2) {
      map['${items[i]}'] = _serializedValue(items[i + 1]);
    }
    return map;
  }
  return <String, dynamic>{};
}

Object? _serializedValue(Object? value) {
  if (value is Iterable && value.length.isEven) {
    final List<Object?> items = value.toList();
    bool looksLikeMap = true;
    for (int i = 0; i < items.length; i += 2) {
      if (items[i] is! String) {
        looksLikeMap = false;
        break;
      }
    }
    if (looksLikeMap) return _serializedListToMap(items);
  }
  if (value is Iterable) return value.map(_serializedValue).toList();
  return value;
}

Map<String, Object?> _jobEnvelopeData({required String id}) {
  return <String, Object?>{
    'id': id,
    'status': 'succeeded',
    'createdAt': '2026-01-01T00:00:00Z',
    'inputSummary': _inputSummaryEnvelope(),
  };
}

Map<String, Object?> _createJobEnvelope({
  required String id,
  required String status,
}) {
  return <String, Object?>{
    'data': <String, Object?>{..._jobEnvelopeData(id: id), 'status': status},
  };
}

Map<String, Object?> _inputSummaryEnvelope() {
  return <String, Object?>{
    'symbols': <String>['BTCUSDT'],
    'baseTimeframe': '15m',
    'stateTimeframes': <String>['15m'],
    'initialCash': 10000,
    'marketType': 'perp',
    'dataRange': <String, Object?>{'fromTs': 0, 'toTs': 1},
    'requestedRange': <String, Object?>{'fromTs': 0, 'toTs': 1},
    'allowPartial': true,
    'isPartial': false,
    'strategyId': 'strategy-1',
  };
}

Map<String, Object?> _reportEnvelope({
  Map<String, Object?> summary = const <String, Object?>{},
  List<Map<String, Object?>> equityCurve = const <Map<String, Object?>>[],
  List<Map<String, Object?>> markers = const <Map<String, Object?>>[],
  List<Map<String, Object?>> trades = const <Map<String, Object?>>[],
}) {
  return <String, Object?>{
    'data': <String, Object?>{
      'summary': summary,
      'equityCurve': equityCurve,
      'trades': trades,
      'markers': markers,
      'bySymbol': <Object?>[],
    },
  };
}

void main() {
  group('ApiBacktestRepository deep result mapping', () {
    test('run 使用真实 backtesting job payload 并绑定 publishedSnapshotId', () async {
      final _BacktestApiHarness harness = _BacktestApiHarness(
        result: _createJobEnvelope(id: 'job-1', status: 'succeeded'),
      );
      final ApiBacktestRepository repo = ApiBacktestRepository(
        harness.build(),
        tokenSupplier: () => 'token',
      );

      await repo.run(
        BacktestRequest(
          strategyId: 'strategy-1',
          publishedSnapshotId: 'snapshot-1',
          conversationId: 'session-1',
          symbol: 'BTCUSDT',
          baseTimeframe: '15m',
          startTime: DateTime.utc(2026, 1, 1),
          endTime: DateTime.utc(2026, 1, 31),
          initialCash: 25000,
          marketType: 'perp',
          leverage: 5,
          slippageBps: 4,
          feeBps: 2,
          priceSource: 'mid',
          allowPartial: true,
          rangePreset: '30D',
          params: const <String, dynamic>{
            'fast_ma': '7',
            'codegenSessionId': 'codegen-1',
          },
        ),
      );

      expect(harness.calls, <String>['/backtesting/jobs']);
      final Map<String, dynamic> payload = harness.lastRunRequest!;
      expect(payload['symbols'], <String>['BTCUSDT']);
      expect(payload['baseTimeframe'], '15m');
      expect(payload['stateTimeframes'], <String>['15m']);
      expect(payload['initialCash'], 25000);
      expect(payload['leverage'], 5);
      expect(payload['conversationId'], 'session-1');
      expect(payload['execution'], <String, dynamic>{
        'slippageBps': 4,
        'feeBps': 2,
        'priceSource': 'mid',
      });
      expect(payload['strategy'], <String, dynamic>{
        'id': 'strategy-1',
        'protocolVersion': 'v1',
        'publishedSnapshotId': 'snapshot-1',
        'params': <String, dynamic>{'fast_ma': '7', 'marketType': 'perp'},
      });
      expect(payload['dataRange'], <String, dynamic>{
        'fromTs': DateTime.utc(2026, 1, 1).millisecondsSinceEpoch,
        'toTs': DateTime.utc(2026, 1, 31).millisecondsSinceEpoch,
      });
      expect(payload['requestedRangeInput'], <String, dynamic>{
        'preset': '30D',
      });
    });

    test('checkSymbolSupport 调用真实 generated symbols check contract', () async {
      final _BacktestApiHarness harness = _BacktestApiHarness(
        result: const <String, Object?>{'status': 'supported'},
      );
      final ApiBacktestRepository repo = ApiBacktestRepository(
        harness.build(),
        tokenSupplier: () => 'token',
      );

      final BacktestSymbolSupportResult result = await repo.checkSymbolSupport(
        const BacktestSymbolSupportRequest(
          exchange: 'binance',
          marketType: 'perp',
          symbol: 'btcusdt',
          baseTimeframe: '15m',
        ),
      );

      expect(result.supported, isTrue);
      expect(harness.calls, <String>['/backtesting/symbols/check']);
      expect(harness.lastSupportRequest, <String, dynamic>{
        'exchange': 'binance',
        'marketType': 'perp',
        'symbol': 'BTCUSDT',
        'baseTimeframe': '15m',
      });
    });

    test('checkSymbolSupport 映射 not_supported reasonCode', () async {
      final ApiBacktestRepository repo = ApiBacktestRepository(
        _BacktestApiHarness(
          result: const <String, Object?>{
            'status': 'not_supported',
            'reasonCode': 'symbol_not_supported',
            'args': <String, Object?>{'symbol': 'BTCUSDT'},
          },
        ).build(),
        tokenSupplier: () => 'token',
      );

      final BacktestSymbolSupportResult result = await repo.checkSymbolSupport(
        const BacktestSymbolSupportRequest(
          exchange: 'okx',
          marketType: 'spot',
          symbol: 'BTCUSDT',
          baseTimeframe: '1h',
        ),
      );

      expect(result.supported, isFalse);
      expect(result.reason, 'symbol_not_supported');
    });

    test('run 缺少 publishedSnapshotId 时本地拦截，不请求后端', () async {
      final _BacktestApiHarness harness = _BacktestApiHarness(
        result: _createJobEnvelope(id: 'job-1', status: 'succeeded'),
      );
      final ApiBacktestRepository repo = ApiBacktestRepository(
        harness.build(),
        tokenSupplier: () => 'token',
      );

      await expectLater(
        repo.run(
          BacktestRequest(
            strategyId: 'strategy-1',
            symbol: 'BTCUSDT',
            startTime: DateTime.utc(2026, 1, 1),
            endTime: DateTime.utc(2026, 1, 31),
            params: const <String, dynamic>{},
          ),
        ),
        throwsA(isA<FormatException>()),
      );
      expect(harness.lastRunRequest, isNull);
      expect(harness.calls, isEmpty);
    });

    test('非法 generated enum 映射值返回可理解错误且不请求后端', () async {
      final _BacktestApiHarness harness = _BacktestApiHarness(
        result: _createJobEnvelope(id: 'job-1', status: 'succeeded'),
      );
      final ApiBacktestRepository repo = ApiBacktestRepository(
        harness.build(),
        tokenSupplier: () => 'token',
      );

      Future<void> runWith({
        String baseTimeframe = '15m',
        String rangePreset = '30D',
        String priceSource = 'close',
      }) {
        return repo.run(
          BacktestRequest(
            strategyId: 'strategy-1',
            publishedSnapshotId: 'snapshot-1',
            symbol: 'BTCUSDT',
            baseTimeframe: baseTimeframe,
            startTime: DateTime.utc(2026, 1, 1),
            endTime: DateTime.utc(2026, 1, 31),
            rangePreset: rangePreset,
            priceSource: priceSource,
            params: const <String, dynamic>{},
          ),
        );
      }

      await expectLater(
        runWith(baseTimeframe: '2h'),
        throwsA(
          isA<FormatException>().having(
            (FormatException e) => e.message,
            'message',
            contains('unsupported backtest baseTimeframe: 2h'),
          ),
        ),
      );
      await expectLater(
        runWith(rangePreset: '14D'),
        throwsA(
          isA<FormatException>().having(
            (FormatException e) => e.message,
            'message',
            contains('unsupported backtest rangePreset: 14D'),
          ),
        ),
      );
      await expectLater(
        runWith(priceSource: 'last'),
        throwsA(
          isA<FormatException>().having(
            (FormatException e) => e.message,
            'message',
            contains('unsupported backtest priceSource: last'),
          ),
        ),
      );
      expect(harness.calls, isEmpty);
    });

    test(
      '完整响应映射 equity / drawdown / monthly / trades / risk / assessment',
      () async {
        final ApiBacktestRepository repo = ApiBacktestRepository(
          _BacktestApiHarness(
            result: _reportEnvelope(
              summary: <String, Object?>{
                'netProfitPct': 42.5,
                'cagrPct': 12.3,
                'maxDrawdownPct': -8.1,
                'sharpe': 1.7,
                'calmar': 1.5,
                'winRate': 61.2,
                'profitFactor': 1.9,
                'totalTrades': 3,
              },
              equityCurve: <Map<String, Object?>>[
                <String, Object?>{'equity': 1},
                <String, Object?>{'equity': 1.08},
                <String, Object?>{'equity': 1.21},
              ],
              markers: <Map<String, Object?>>[
                <String, Object?>{'index': 1},
                <String, Object?>{'index': 2},
              ],
              trades: <Map<String, Object?>>[
                <String, Object?>{
                  'time': '2026-01-10T08:30:00Z',
                  'side': '多',
                  'entry': 42000,
                  'exit': 43100,
                  'pnlPercent': 2.6,
                  'duration': '3h 20m',
                  'win': true,
                },
              ],
            ),
          ).build(),
          tokenSupplier: () => 'token',
        );

        final BacktestResult result = await repo.getResult('job-2329');

        expect(result.id, 'job-2329');
        expect(result.equityCurve, <double>[1, 1.08, 1.21]);
        expect(result.drawdownMarkers, <int>[1, 2]);
        expect(result.monthlyRows, isEmpty);
        expect(result.trades.single.side, '多');
        expect(result.trades.single.entry, 42000);
        expect(result.trades.single.exit, 43100);
        expect(result.trades.single.win, isTrue);
        expect(result.riskRows, isEmpty);
      },
    );

    test('缺少深层数组时仅该段为空，summary 标量仍正常显示', () async {
      final ApiBacktestRepository repo = ApiBacktestRepository(
        _BacktestApiHarness(
          result: _reportEnvelope(
            summary: <String, Object?>{'netProfitPct': 9.8, 'sharpe': 1.2},
          ),
        ).build(),
        tokenSupplier: () => 'token',
      );

      final BacktestResult result = await repo.getResult('partial-job');

      expect(result.id, 'partial-job');
      expect(result.totalReturnPercent, 9.8);
      expect(result.sharpe, 1.2);
      expect(result.equityCurve, isEmpty);
      expect(result.drawdownMarkers, isEmpty);
      expect(result.trades, isEmpty);
      expect(result.monthlyRows, isEmpty);
      expect(result.riskRows, isEmpty);
    });

    test('真实 backtesting result summary 字段映射到 mobile 核心指标', () async {
      final ApiBacktestRepository repo = ApiBacktestRepository(
        _BacktestApiHarness(
          result: _reportEnvelope(
            summary: <String, Object?>{
              'netProfitPct': -0.1125,
              'maxDrawdownPct': 0.1229,
              'winRate': 0,
              'profitFactor': 0,
              'totalTrades': 9,
            },
            equityCurve: <Map<String, Object?>>[
              <String, Object?>{'ts': 1778572800000, 'equity': 10000},
              <String, Object?>{'ts': 1778573700000, 'equity': 9999.97},
            ],
          ),
        ).build(),
        tokenSupplier: () => 'token',
      );

      final BacktestResult result = await repo.getResult('btjob-real');

      expect(result.id, 'btjob-real');
      expect(result.totalReturnPercent, -0.1125);
      expect(result.maxDrawdownPercent, 0.1229);
      expect(result.winRatePercent, 0);
      expect(result.profitLossRatio, 0);
      expect(result.totalTrades, 9);
      expect(result.equityCurve, <double>[10000, 9999.97]);
      expect(result.rangeStart, isA<DateTime>());
      expect(result.rangeEnd, isA<DateTime>());
    });
  });
}
