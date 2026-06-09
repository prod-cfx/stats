import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_strategy_repository.dart';
import 'package:quantify_mobile/data/models/strategy_models.dart';
import 'package:quantify_mobile/data/services/generated_backend_api.dart';

class _FixtureInterceptor extends Interceptor {
  _FixtureInterceptor(this.calls);

  final List<String> calls;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    calls.add(options.path);
    if (options.path == '/strategy-plaza/templates') {
      expect(options.queryParameters, isEmpty);
    }
    final Object data = switch (options.path) {
      '/strategy-plaza/templates' => <String, Object>{
        'data': <Map<String, Object>>[_template('real-grid')],
      },
      '/strategy-plaza/templates/real-grid' => <String, Object>{
        'data': _template('real-grid'),
      },
      '/strategy-plaza/templates/real-grid/signals' => <String, Object>{
        'data': <Map<String, Object>>[
          <String, Object>{
            'time': '2026-06-07T00:00:00.000Z',
            'side': 'buy',
            'price': 101.5,
            'pnlPercent': 2.5,
          },
        ],
      },
      '/strategy-plaza/templates/real-grid/equity-curve' => <String, Object>{
        'data': <num>[1, 1.05, 1.12],
      },
      '/strategy-plaza/templates/empty-grid/signals' => <String, Object>{
        'data': <Map<String, Object>>[],
      },
      '/strategy-plaza/templates/empty-grid/equity-curve' => <String, Object>{
        'data': <num>[],
      },
      _ => throw StateError('unexpected HTTP call: ${options.path}'),
    };
    handler.resolve(
      Response<Object>(requestOptions: options, statusCode: 200, data: data),
    );
  }
}

Map<String, Object> _template(String id) {
  return <String, Object>{
    'id': id,
    'name': '真实网格策略',
    'description': '真实接口返回的策略',
    'logicDescription': '低买高卖',
    'tags': <String>['grid', 'real'],
    'riskLevel': 'medium',
    'scenario': '震荡行情',
    'exchange': 'okx',
    'environment': 'demo',
    'marketType': 'perp',
    'symbol': 'BTCUSDT',
    'timeframe': '30D',
    'positionPct': 25,
    'leverage': 3,
    'status': 'live',
    'displayOrder': 1,
    'displayMetrics': <String, Object>{
      'label': 'official_sample_backtest',
      'returnPct': 42.5,
      'winRatePct': 61,
      'maxDrawdownPct': 8.5,
      'sharpe': 1.7,
      'profitLossRatio': 1.9,
      'tradeCount': 34,
      'users': 88,
    },
    'sparkline': <num>[1, 1.03, 1.02, 1.08],
    'equityCurve': <num>[1, 1.04, 1.11],
    'signals': <Map<String, Object>>[],
  };
}

ApiStrategyRepository _buildRepo(List<String> calls) {
  final Dio dio = Dio(BaseOptions(baseUrl: 'http://stub.invalid'))
    ..interceptors.add(_FixtureInterceptor(calls));
  return ApiStrategyRepository(GeneratedBackendApi(dio: dio));
}

void main() {
  group('ApiStrategyRepository 真实策略广场映射', () {
    test('hero 和 detail 使用真实 template DTO，不回退 mock', () async {
      final List<String> calls = <String>[];
      final ApiStrategyRepository repo = _buildRepo(calls);

      final StrategyMarketItem hero = await repo.getFeaturedHero();
      final StrategyDetail detail = await repo.getStrategyDetail('real-grid');

      expect(calls, contains('/strategy-plaza/templates'));
      expect(calls, contains('/strategy-plaza/templates/real-grid'));
      expect(hero.card.id, 'real-grid');
      expect(hero.card.name, '真实网格策略');
      expect(hero.stats.cagr, 42.5);
      expect(hero.sparkline, <double>[1, 1.03, 1.02, 1.08]);
      expect(detail.card.id, 'real-grid');
      expect(detail.cagr, 42.5);
      expect(detail.winRate, 0.61);
      expect(detail.maxDrawdown, -8.5);
      expect(detail.profitLossRatio, 1.9);
      expect(detail.tradeCount, 34);
      expect(detail.users, 88);
      expect(detail.equityCurve, <double>[1, 1.04, 1.11]);
    });

    test('signals 和 equity curve 使用真实 endpoint，空响应保持空态', () async {
      final List<String> calls = <String>[];
      final ApiStrategyRepository repo = _buildRepo(calls);

      final List<StrategySignal> signals = await repo.listStrategySignals(
        'real-grid',
        limit: 5,
      );
      final List<double> curve = await repo.getEquityCurve(
        'real-grid',
        EquityTimeframe.d30,
      );
      final List<StrategySignal> emptySignals = await repo.listStrategySignals(
        'empty-grid',
        limit: 5,
      );
      final List<double> emptyCurve = await repo.getEquityCurve(
        'empty-grid',
        EquityTimeframe.d30,
      );

      expect(calls, contains('/strategy-plaza/templates/real-grid/signals'));
      expect(
        calls,
        contains('/strategy-plaza/templates/real-grid/equity-curve'),
      );
      expect(signals, hasLength(1));
      expect(signals.single.side, StrategySignalSide.buy);
      expect(signals.single.price, 101.5);
      expect(curve, <double>[1, 1.05, 1.12]);
      expect(emptySignals, isEmpty);
      expect(emptyCurve, isEmpty);
    });
  });
}
