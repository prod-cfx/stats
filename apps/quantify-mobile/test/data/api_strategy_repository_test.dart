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
    if (options.path.endsWith('/run') ||
        options.path.endsWith('/edit-session')) {
      expect(options.headers['authorization'], 'Bearer test-token');
    }
    final Object data = switch (options.path) {
      '/strategy-plaza/templates' => <String, Object>{
        'data': <Map<String, Object>>[
          _template('real-grid'),
          _template('fallback-equity', includeSparkline: false),
          _template(
            'fallback-official',
            includeSparkline: false,
            includeEquityCurve: false,
          ),
        ],
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
      '/strategy-plaza/templates/real-grid/run' => <String, Object>{
        'data': <String, Object>{
          'id': 'strategy-real-grid',
          'name': '真实网格策略',
          'status': 'running',
          'isSubscribed': true,
          'metrics': <String, Object>{},
          'updatedAt': '2026-06-10T00:00:00.000Z',
          'equitySeries': <Map<String, Object>>[],
          'snapshot': <String, Object>{},
          'timeline': <Map<String, Object>>[],
          'accountOverview': <String, Object>{},
          'positionOverview': <String, Object>{},
          'latestOrders': <Map<String, Object>>[],
        },
      },
      '/strategy-plaza/templates/real-grid/edit-session' => <String, Object>{
        'data': <String, Object>{
          'sessionId': 'session-real-grid',
          'templateId': 'real-grid',
          'initialMessage': '编辑真实网格策略',
        },
      },
      _ => throw StateError('unexpected HTTP call: ${options.path}'),
    };
    handler.resolve(
      Response<Object>(requestOptions: options, statusCode: 200, data: data),
    );
  }
}

Map<String, Object> _template(
  String id, {
  bool includeSparkline = true,
  bool includeEquityCurve = true,
}) {
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
    'officialBacktest': <String, Object>{
      'generatedAt': '2026-06-10T00:00:00.000Z',
      'backtestFrom': 1717200000000,
      'backtestTo': 1719800000000,
      'source': 'official_sample_backtest',
      'dataSource': <String, Object>{'exchange': 'okx', 'marketType': 'perp'},
      'candleCount': 120,
      'metrics': <String, Object>{
        'returnPct': 43.5,
        'winRatePct': 62,
        'maxDrawdownPct': 7.5,
        'tradeCount': 35,
      },
      'equityCurve': <Map<String, Object>>[
        <String, Object>{'ts': 1717200000000, 'equity': 1},
        <String, Object>{'ts': 1719800000000, 'equity': 1.14},
      ],
      'trades': <Map<String, Object>>[],
      'confidence': <String, Object>{
        'level': 'high',
        'reasons': <String>['fixture'],
      },
      'disclaimer': 'fixture only',
    },
    if (includeSparkline) 'sparkline': <num>[1, 1.03, 1.02, 1.08],
    if (includeEquityCurve) 'equityCurve': <num>[1, 1.04, 1.11],
    'params': <String, num>{'stopLossPct': 2.5},
    'signals': <Map<String, Object>>[],
  };
}

ApiStrategyRepository _buildRepo(List<String> calls) {
  final Dio dio = Dio(BaseOptions(baseUrl: 'http://stub.invalid'))
    ..interceptors.add(_FixtureInterceptor(calls));
  return ApiStrategyRepository(
    GeneratedBackendApi(dio: dio),
    tokenSupplier: () => 'test-token',
  );
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
      expect(hero.stats.tradeCount, 35);
      expect(hero.stats.confidenceLevel, 'high');
      expect(hero.sparkline, <double>[1, 1.03, 1.02, 1.08]);
      expect(detail.card.id, 'real-grid');
      expect(detail.cagr, 43.5);
      expect(detail.winRate, 0.62);
      expect(detail.maxDrawdown, -7.5);
      expect(detail.profitLossRatio, 1.9);
      expect(detail.tradeCount, 35);
      expect(detail.users, 88);
      expect(detail.equityCurve, <double>[1, 1.14]);
      expect(detail.backtestFromMs, 1717200000000);
      expect(detail.backtestToMs, 1719800000000);
      expect(detail.generatedAt, '2026-06-10T00:00:00.000Z');
      expect(detail.dataSourceLabel, 'OKX swap');
      expect(detail.candleCount, 120);
      expect(detail.marketType, 'perp');
      expect(detail.positionPct, 25);
      expect(detail.leverage, 3);
      expect(detail.params, <String, double>{'stopLossPct': 2.5});
    });

    test('列表卡片曲线按 sparkline、equityCurve、officialBacktest 兜底', () async {
      final List<String> calls = <String>[];
      final ApiStrategyRepository repo = _buildRepo(calls);

      final StrategyMarketPage page = await repo.listMarket(pageSize: 10);

      expect(page.items, hasLength(3));
      expect(page.items[0].sparkline, <double>[1, 1.03, 1.02, 1.08]);
      expect(page.items[1].sparkline, <double>[1, 1.04, 1.11]);
      expect(page.items[2].sparkline, <double>[1, 1.14]);
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

    test('run 和 edit-session 使用真实策略广场动作 endpoint', () async {
      final List<String> calls = <String>[];
      final ApiStrategyRepository repo = _buildRepo(calls);

      final StrategyRunResult run = await repo.runTemplate('real-grid');
      final StrategyEditSession edit = await repo.startEditSession(
        'real-grid',
        locale: 'zh',
      );

      expect(calls, contains('/strategy-plaza/templates/real-grid/run'));
      expect(
        calls,
        contains('/strategy-plaza/templates/real-grid/edit-session'),
      );
      expect(run.strategyId, 'strategy-real-grid');
      expect(run.existing, isFalse);
      expect(edit.sessionId, 'session-real-grid');
      expect(edit.templateId, 'real-grid');
      expect(edit.initialMessage, '编辑真实网格策略');
    });
  });
}
