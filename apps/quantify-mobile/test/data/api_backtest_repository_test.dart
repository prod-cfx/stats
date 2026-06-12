import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_backtest_repository.dart';
import 'package:quantify_mobile/data/models/backtest_models.dart';
import 'package:quantify_mobile/data/services/api_client.dart';
import 'package:quantify_mobile/data/services/strategy_services.dart';

class _StubBacktestService extends BacktestService {
  _StubBacktestService({required this.result})
    : super(ApiClient(baseUrl: 'http://localhost'));

  final Object? result;
  Map<String, dynamic>? lastRunRequest;

  @override
  Future<dynamic> run(Map<String, dynamic> request) async {
    lastRunRequest = request;
    return result;
  }

  @override
  Future<dynamic> getResult(String id) async => result;
}

void main() {
  group('ApiBacktestRepository deep result mapping', () {
    test('run 使用真实 backtesting job payload 并绑定 publishedSnapshotId', () async {
      final _StubBacktestService service = _StubBacktestService(
        result: <String, dynamic>{'id': 'job-1'},
      );
      final ApiBacktestRepository repo = ApiBacktestRepository(service);

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

      final Map<String, dynamic> payload = service.lastRunRequest!;
      expect(payload['symbols'], <String>['BTCUSDT']);
      expect(payload['baseTimeframe'], '15m');
      expect(payload['stateTimeframes'], <String>['15m']);
      expect(payload['initialCash'], 25000);
      expect(payload['leverage'], 5);
      expect(payload['conversationId'], 'session-1');
      expect(payload['sessionId'], 'codegen-1');
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

    test('run 缺少 publishedSnapshotId 时本地拦截，不请求后端', () async {
      final _StubBacktestService service = _StubBacktestService(
        result: <String, dynamic>{'id': 'job-1'},
      );
      final ApiBacktestRepository repo = ApiBacktestRepository(service);

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
      expect(service.lastRunRequest, isNull);
    });

    test(
      '完整响应映射 equity / drawdown / monthly / trades / risk / assessment',
      () async {
        final ApiBacktestRepository repo = ApiBacktestRepository(
          _StubBacktestService(
            result: <String, dynamic>{
              'data': <String, dynamic>{
                'id': 'job-2329',
                'totalReturnPercent': 42.5,
                'cagrPercent': 12.3,
                'maxDrawdownPercent': -8.1,
                'sharpe': 1.7,
                'calmar': 1.5,
                'winRatePercent': 61.2,
                'profitLossRatio': 1.9,
                'avgHoldDuration': '8h 12m',
                'totalTrades': 3,
                'rangeStart': '2026-01-01T00:00:00Z',
                'rangeEnd': '2026-03-01T00:00:00Z',
                'equityCurve': <num>[1, 1.08, 1.21],
                'drawdownMarkers': <num>[1, 2],
                'monthlyRows': <Map<String, dynamic>>[
                  <String, dynamic>{
                    'year': 2026,
                    'values': <Object?>[1.1, -0.4, null, 2.5],
                  },
                ],
                'trades': <Map<String, dynamic>>[
                  <String, dynamic>{
                    'time': '2026-01-10T08:30:00Z',
                    'side': '多',
                    'entry': 42000,
                    'exit': 43100,
                    'pnlPercent': 2.6,
                    'duration': '3h 20m',
                    'win': true,
                  },
                ],
                'riskRows': <Map<String, dynamic>>[
                  <String, dynamic>{
                    'label': '最大回撤',
                    'value': '-8.1%',
                    'barFraction': 0.42,
                    'tone': 'danger',
                    'note': '低于阈值',
                  },
                ],
                'aiAssessment': '风险收益良好。',
              },
            },
          ),
        );

        final BacktestResult result = await repo.getResult('job-2329');

        expect(result.id, 'job-2329');
        expect(result.equityCurve, <double>[1, 1.08, 1.21]);
        expect(result.drawdownMarkers, <int>[1, 2]);
        expect(result.monthlyRows.single.year, 2026);
        expect(result.monthlyRows.single.values.length, 12);
        expect(result.monthlyRows.single.values.take(4), <double?>[
          1.1,
          -0.4,
          null,
          2.5,
        ]);
        expect(result.trades.single.side, '多');
        expect(result.trades.single.entry, 42000);
        expect(result.trades.single.exit, 43100);
        expect(result.trades.single.win, isTrue);
        expect(result.riskRows.single.tone, BacktestRiskTone.danger);
        expect(result.riskRows.single.barFraction, 0.42);
        expect(result.aiAssessment, '风险收益良好。');
      },
    );

    test('缺少深层数组时仅该段为空，summary 标量仍正常显示', () async {
      final ApiBacktestRepository repo = ApiBacktestRepository(
        _StubBacktestService(
          result: <String, dynamic>{
            'id': 'partial-job',
            'totalReturnPercent': 9.8,
            'sharpe': 1.2,
            'monthlyRows': <Map<String, dynamic>>[
              <String, dynamic>{
                'year': 2026,
                'values': <num>[0.5],
              },
            ],
            'riskRows': <Map<String, dynamic>>[
              <String, dynamic>{
                'label': '胜率',
                'value': '58%',
                'barFraction': 0.58,
                'tone': 'neutral',
                'note': '稳定',
              },
            ],
          },
        ),
      );

      final BacktestResult result = await repo.getResult('partial-job');

      expect(result.id, 'partial-job');
      expect(result.totalReturnPercent, 9.8);
      expect(result.sharpe, 1.2);
      expect(result.equityCurve, isEmpty);
      expect(result.drawdownMarkers, isEmpty);
      expect(result.trades, isEmpty);
      expect(result.monthlyRows, hasLength(1));
      expect(result.riskRows, hasLength(1));
    });

    test('真实 backtesting result summary 字段映射到 mobile 核心指标', () async {
      final ApiBacktestRepository repo = ApiBacktestRepository(
        _StubBacktestService(
          result: <String, dynamic>{
            'data': <String, dynamic>{
              'summary': <String, dynamic>{
                'netProfitPct': -0.1125,
                'maxDrawdownPct': 0.1229,
                'winRate': 0,
                'profitFactor': 0,
                'totalTrades': 9,
              },
              'equityCurve': <Map<String, dynamic>>[
                <String, dynamic>{'ts': 1778572800000, 'equity': 10000},
                <String, dynamic>{'ts': 1778573700000, 'equity': 9999.97},
              ],
              'inputSummary': <String, dynamic>{
                'appliedRange': <String, dynamic>{
                  'fromTs': 1778572800000,
                  'toTs': 1781164800000,
                },
              },
            },
          },
        ),
      );

      final BacktestResult result = await repo.getResult('btjob-real');

      expect(result.id, 'btjob-real');
      expect(result.totalReturnPercent, -0.1125);
      expect(result.maxDrawdownPercent, 0.1229);
      expect(result.winRatePercent, 0);
      expect(result.profitLossRatio, 0);
      expect(result.totalTrades, 9);
      expect(result.equityCurve, <double>[10000, 9999.97]);
      expect(result.rangeStart.millisecondsSinceEpoch, 1778572800000);
      expect(result.rangeEnd.millisecondsSinceEpoch, 1781164800000);
    });
  });
}
