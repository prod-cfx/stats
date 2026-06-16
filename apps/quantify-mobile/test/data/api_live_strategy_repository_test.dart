import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_live_strategy_repository.dart';
import 'package:quantify_mobile/data/services/api_client.dart';
import 'package:quantify_mobile/data/services/strategy_services.dart';
import 'package:quantify_mobile/domain/models/live_strategy_models.dart';

/// 用预置响应替身校验 [ApiLiveStrategyRepository] 对契约
/// `AccountAiQuantStrategyDetailResponseDto` 的解析与 mock 短路；不发真实 HTTP。
///
/// position/trades/params 三方法在 repo 内已短路到 mock，不应触达 service；
/// 替身的 [listStrategies] 计数 + [getStrategy] 计数用于断言「无 HTTP 调用」。
class _StubLiveStrategyService extends LiveStrategyService {
  _StubLiveStrategyService({this.listResponse, this.detailResponse})
    : super(ApiClient(baseUrl: 'http://localhost'));

  final Object? listResponse;
  final Object? detailResponse;

  int listCalls = 0;
  int detailCalls = 0;
  int actionCalls = 0;
  int deleteCalls = 0;
  String? lastAction;
  bool? lastDeleteStoppedStrategy;

  @override
  Future<dynamic> listStrategies() async {
    listCalls++;
    return listResponse;
  }

  @override
  Future<dynamic> getStrategy(String id) async {
    detailCalls++;
    return detailResponse;
  }

  @override
  Future<dynamic> getSummary() async => null;

  @override
  Future<dynamic> performAction(String id, String action) async {
    actionCalls++;
    lastAction = action;
    return detailResponse;
  }

  @override
  Future<void> deleteStrategy(
    String id, {
    bool deleteStoppedStrategy = false,
  }) async {
    deleteCalls++;
    lastDeleteStoppedStrategy = deleteStoppedStrategy;
  }
}

void main() {
  group('ApiLiveStrategyRepository 契约解析', () {
    test('listStrategies 解析契约 typed 标量（symbol → pair）', () async {
      final _StubLiveStrategyService svc = _StubLiveStrategyService(
        listResponse: <String, dynamic>{
          'data': <Map<String, dynamic>>[
            <String, dynamic>{
              'id': 'QF-1',
              'name': '动量策略',
              'symbol': 'BTCUSDT',
              'timeframe': '1h',
              'exchange': 'binance',
              'status': 'running',
              'totalPnl': 123.4,
              'todayPnl': 5.6,
            },
          ],
        },
      );
      final ApiLiveStrategyRepository repo = ApiLiveStrategyRepository(svc);
      final List<LiveStrategy> rows = await repo.listStrategies();

      expect(rows, hasLength(1));
      expect(rows.first.id, 'QF-1');
      expect(rows.first.pair, 'BTCUSDT'); // symbol 键解析到 pair
      expect(rows.first.totalPnl, 123.4);
      expect(rows.first.todayPnl, 5.6);
      expect(rows.first.status, LiveStrategyStatus.running);
    });

    test('getStrategy 解封 {data:{...}} 信封并解析 symbol', () async {
      final _StubLiveStrategyService svc = _StubLiveStrategyService(
        detailResponse: <String, dynamic>{
          'data': <String, dynamic>{
            'id': 'QF-9',
            'name': '网格',
            'symbol': 'ETHUSDT',
            'status': 'warning',
          },
        },
      );
      final ApiLiveStrategyRepository repo = ApiLiveStrategyRepository(svc);
      final LiveStrategy s = await repo.getStrategy('QF-9');

      expect(s.id, 'QF-9');
      expect(s.pair, 'ETHUSDT');
      expect(s.status, LiveStrategyStatus.warning);
    });

    test('getStrategy 无 data 键时回退原 map（扁平兜底）', () async {
      final _StubLiveStrategyService svc = _StubLiveStrategyService(
        detailResponse: <String, dynamic>{
          'id': 'QF-flat',
          'name': '扁平',
          'symbol': 'SOLUSDT',
        },
      );
      final ApiLiveStrategyRepository repo = ApiLiveStrategyRepository(svc);
      final LiveStrategy s = await repo.getStrategy('QF-flat');

      expect(s.id, 'QF-flat');
      expect(s.pair, 'SOLUSDT');
    });

    test('getStrategy 解析部署快照字段用于部署成功页回访', () async {
      final _StubLiveStrategyService svc = _StubLiveStrategyService(
        detailResponse: <String, dynamic>{
          'data': <String, dynamic>{
            'id': 'cmqepafqd0ag4duqs0jxmlcda',
            'name': '交易标的是 BTC-USDT-S',
            'symbol': 'BTCUSDT',
            'timeframe': '15m',
            'exchange': 'okx',
            'status': 'running',
            'accountOverview': <String, dynamic>{
              'initialBalance': 66154.74714299,
            },
            'snapshot': <String, dynamic>{
              'publishedSnapshotId': 'cmqepafqv0ag5duqsm0z3utqd',
              'deployAt': '2026-06-15T17:39:15.153Z',
              'deployAccountName': 'mobile-test',
              'strategyConfig': <String, dynamic>{'marketType': 'perp'},
              'deploymentExecutionCurrent': <String, dynamic>{'leverage': 1},
            },
          },
        },
      );
      final ApiLiveStrategyRepository repo = ApiLiveStrategyRepository(svc);

      final LiveStrategy s = await repo.getStrategy(
        'cmqepafqd0ag4duqs0jxmlcda',
      );

      expect(s.status, LiveStrategyStatus.running);
      expect(s.market, '永续');
      expect(s.capital, 66154.74714299);
      expect(s.publishedSnapshotId, 'cmqepafqv0ag5duqsm0z3utqd');
      expect(s.deployedAt, DateTime.parse('2026-06-15T17:39:15.153Z'));
      expect(s.deployAccountName, 'mobile-test');
      expect(s.deploymentLeverage, 1);
    });

    test('空 data → listStrategies 返回空列表且不回退 mock', () async {
      final _StubLiveStrategyService svc = _StubLiveStrategyService(
        listResponse: <String, dynamic>{'data': <Map<String, dynamic>>[]},
      );
      final ApiLiveStrategyRepository repo = ApiLiveStrategyRepository(svc);
      final List<LiveStrategy> rows = await repo.listStrategies();

      expect(rows, isEmpty);
    });

    test('空 data → getStrategy 返回默认空模型且不回退 mock', () async {
      final _StubLiveStrategyService svc = _StubLiveStrategyService(
        detailResponse: <String, dynamic>{},
      );
      final ApiLiveStrategyRepository repo = ApiLiveStrategyRepository(svc);
      final LiveStrategy s = await repo.getStrategy('QF-AY7K2P');

      expect(s.id, isEmpty);
      expect(s.pair, isEmpty);
    });

    test('生产解析不读取 mock-only 字段，draft 不进入实盘列表', () async {
      final _StubLiveStrategyService svc = _StubLiveStrategyService(
        listResponse: <String, dynamic>{
          'data': <Map<String, dynamic>>[
            <String, dynamic>{
              'id': 'real-1',
              'name': '真实策略',
              'symbol': 'BTCUSDT',
              'pair': 'MOCK/USDT',
              'exchange': 'okx',
              'exchangeGlyph': 'M',
              'market': 'mock market',
              'runFor': '99 天',
              'statusNote': 'mock note',
              'trades': 999,
              'winRate': 99,
              'spark': <num>[1, 2, 3],
              'status': 'running',
              'metrics': <String, dynamic>{'tradeCount': 2, 'winRatePct': 50},
            },
            <String, dynamic>{'id': 'draft-1', 'name': '草稿', 'status': 'draft'},
          ],
        },
      );
      final ApiLiveStrategyRepository repo = ApiLiveStrategyRepository(svc);

      final List<LiveStrategy> rows = await repo.listStrategies();

      expect(rows, hasLength(1));
      expect(rows.single.id, 'real-1');
      expect(rows.single.pair, 'BTCUSDT');
      expect(rows.single.exchangeGlyph, 'O');
      expect(rows.single.market, isEmpty);
      expect(rows.single.runFor, isEmpty);
      expect(rows.single.statusNote, isNull);
      expect(rows.single.trades, 2);
      expect(rows.single.winRate, 50);
      expect(rows.single.spark, isEmpty);
    });
  });

  group('详情 tab 真实数据解析', () {
    test('getPosition 从详情 positionOverview 解析持仓，不回退 mock', () async {
      final _StubLiveStrategyService svc = _StubLiveStrategyService(
        detailResponse: <String, dynamic>{
          'data': <String, dynamic>{
            'id': 'real-1',
            'symbol': 'ETHUSDT',
            'positionOverview': <String, dynamic>{
              'positionState': 'short',
              'entryPrice': '2500.5',
              'currentPrice': 2400,
              'quantity': '0.75',
              'unrealizedPnl': 88.5,
              'pnlPct': '3.2',
              'stopLoss': 2600,
              'stopDistancePct': '-4.1',
              'takeProfitDistancePct': 5.5,
              'holdFor': '2h 10m',
            },
          },
        },
      );
      final ApiLiveStrategyRepository repo = ApiLiveStrategyRepository(svc);

      final LiveStrategyPosition? pos = await repo.getPosition('real-1');

      expect(pos, isNotNull);
      expect(pos!.pair, 'ETHUSDT');
      expect(pos.side, PositionSide.short);
      expect(pos.entryPrice, 2500.5);
      expect(pos.currentPrice, 2400);
      expect(pos.qty, 0.75);
      expect(pos.pnl, 88.5);
      expect(pos.pct, 3.2);
      expect(pos.stopPrice, 2600);
      expect(pos.stopPct, -4.1);
      expect(pos.tpPct, 5.5);
      expect(pos.holdFor, '2h 10m');
      expect(svc.detailCalls, 1);
    });

    test('listTrades 从详情 latestOrders 解析并按 limit 截断', () async {
      final _StubLiveStrategyService svc = _StubLiveStrategyService(
        detailResponse: <String, dynamic>{
          'data': <String, dynamic>{
            'latestOrders': <Map<String, dynamic>>[
              <String, dynamic>{
                'executedAt': '2026-06-07T10:30:00.000Z',
                'side': 'SELL',
                'price': '2400.25',
                'quantity': 0.2,
                'pnlPct': '1.8',
                'realizedPnl': 12,
                'holdFor': '45m',
              },
              <String, dynamic>{
                'executedAt': '2026-06-07T09:00:00.000Z',
                'side': 'BUY',
                'price': 2300,
              },
            ],
          },
        },
      );
      final ApiLiveStrategyRepository repo = ApiLiveStrategyRepository(svc);

      final List<LiveStrategyTrade> trades = await repo.listTrades(
        'real-1',
        limit: 1,
      );

      expect(trades, hasLength(1));
      expect(trades.first.time, '2026-06-07 10:30');
      expect(trades.first.side, PositionSide.short);
      expect(trades.first.entryPrice, 2400.25);
      expect(trades.first.exitPrice, 2400.25);
      expect(trades.first.pct, 1.8);
      expect(trades.first.win, isTrue);
      expect(trades.first.holdFor, '45m');
      expect(svc.detailCalls, 1);
    });

    test('listParams 从 paramValues/paramSchema 解析', () async {
      final _StubLiveStrategyService svc = _StubLiveStrategyService(
        detailResponse: <String, dynamic>{
          'data': <String, dynamic>{
            'paramValues': <String, dynamic>{'fast_ma': 12, 'leverage': '3'},
            'paramSchema': <String, dynamic>{
              'fast_ma': <String, dynamic>{'description': '快线'},
              'leverage': <String, dynamic>{'label': '杠杆'},
            },
          },
        },
      );
      final ApiLiveStrategyRepository repo = ApiLiveStrategyRepository(svc);

      final List<LiveStrategyParam> params = await repo.listParams('real-1');

      expect(params.map((LiveStrategyParam p) => p.key), <String>[
        'fast_ma',
        'leverage',
      ]);
      expect(params.first.value, '12');
      expect(params.first.note, '快线');
      expect(params.last.note, '杠杆');
      expect(svc.detailCalls, 1);
    });
  });

  group('真实状态操作', () {
    test('pause/resume 调用 action endpoint 并解析返回详情', () async {
      final _StubLiveStrategyService svc = _StubLiveStrategyService(
        detailResponse: <String, dynamic>{
          'data': <String, dynamic>{
            'id': 'real-1',
            'name': '真实策略',
            'symbol': 'BTCUSDT',
            'status': 'paused',
          },
        },
      );
      final ApiLiveStrategyRepository repo = ApiLiveStrategyRepository(svc);

      final LiveStrategy paused = await repo.pause('real-1');
      expect(paused.status, LiveStrategyStatus.paused);
      expect(svc.actionCalls, 1);
      expect(svc.lastAction, 'pause');

      await repo.resume('real-1');
      expect(svc.actionCalls, 2);
      expect(svc.lastAction, 'resume');
    });

    test('softDelete/permanentDelete 调用 delete endpoint 参数正确', () async {
      final _StubLiveStrategyService svc = _StubLiveStrategyService();
      final ApiLiveStrategyRepository repo = ApiLiveStrategyRepository(svc);

      await repo.softDelete('real-1');
      expect(svc.deleteCalls, 1);
      expect(svc.lastDeleteStoppedStrategy, isFalse);

      await repo.permanentDelete('real-1');
      expect(svc.deleteCalls, 2);
      expect(svc.lastDeleteStoppedStrategy, isTrue);
    });
  });
}
