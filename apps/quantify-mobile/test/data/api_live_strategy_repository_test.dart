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

    test('空 data → listStrategies 回退 mock 非空', () async {
      final _StubLiveStrategyService svc = _StubLiveStrategyService(
        listResponse: <String, dynamic>{'data': <Map<String, dynamic>>[]},
      );
      final ApiLiveStrategyRepository repo = ApiLiveStrategyRepository(svc);
      final List<LiveStrategy> rows = await repo.listStrategies();

      expect(rows, isNotEmpty); // 回退到 mockLiveStrategies
    });

    test('空 data → getStrategy 回退 mock', () async {
      final _StubLiveStrategyService svc = _StubLiveStrategyService(
        detailResponse: <String, dynamic>{},
      );
      final ApiLiveStrategyRepository repo = ApiLiveStrategyRepository(svc);
      final LiveStrategy s = await repo.getStrategy('QF-AY7K2P');

      expect(s.id, 'QF-AY7K2P'); // 来自 mock fixture
    });
  });

  group('position/trades/params 短路 mock（无 HTTP 调用）', () {
    test('getPosition 不触达 service，返回 mock 持仓', () async {
      final _StubLiveStrategyService svc = _StubLiveStrategyService();
      final ApiLiveStrategyRepository repo = ApiLiveStrategyRepository(svc);

      final LiveStrategyPosition? pos = await repo.getPosition('QF-AY7K2P');

      expect(pos, isNotNull);
      expect(pos!.pair, 'BTC/USDT'); // 来自 mockLivePositions
      expect(svc.listCalls, 0);
      expect(svc.detailCalls, 0); // 无任何详情请求
    });

    test('listTrades 不触达 service，返回 mock 非空', () async {
      final _StubLiveStrategyService svc = _StubLiveStrategyService();
      final ApiLiveStrategyRepository repo = ApiLiveStrategyRepository(svc);

      final List<LiveStrategyTrade> trades = await repo.listTrades('QF-AY7K2P');

      expect(trades, isNotEmpty);
      expect(svc.detailCalls, 0);
    });

    test('listParams 不触达 service，返回 mock 非空', () async {
      final _StubLiveStrategyService svc = _StubLiveStrategyService();
      final ApiLiveStrategyRepository repo = ApiLiveStrategyRepository(svc);

      final List<LiveStrategyParam> params = await repo.listParams('QF-AY7K2P');

      expect(params, isNotEmpty);
      expect(svc.detailCalls, 0);
    });
  });
}
