import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_backtest_repository.dart';
import 'package:quantify_mobile/data/models/backtest_models.dart';
import 'package:quantify_mobile/data/services/api_client.dart';
import 'package:quantify_mobile/data/services/strategy_services.dart';

class _StubBacktestService extends BacktestService {
  _StubBacktestService({required this.result})
    : super(ApiClient(baseUrl: 'http://localhost'));

  final Object? result;

  @override
  Future<dynamic> getResult(String id) async => result;
}

void main() {
  group('ApiBacktestRepository deep result mapping', () {
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
  });
}
