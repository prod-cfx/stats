import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/mock_backtest_repository.dart';
import 'package:quantify_mobile/data/models/backtest_models.dart';

void main() {
  group('MockBacktestRepository', () {
    test('run 返回 fixture 结果', () async {
      final MockBacktestRepository repo = MockBacktestRepository();
      final BacktestResult r = await repo.run(BacktestRequest(
        strategyId: 's-1',
        symbol: 'BTCUSDT',
        startTime: DateTime.fromMillisecondsSinceEpoch(0),
        endTime: DateTime.fromMillisecondsSinceEpoch(1000),
        params: const <String, dynamic>{},
      ));
      expect(r.id, 'bt-mock-1');
      expect(r.equityCurve, isNotEmpty);
    });

    test('getResult 任意 id 返回 fixture', () async {
      final MockBacktestRepository repo = MockBacktestRepository();
      final BacktestResult r = await repo.getResult('any');
      expect(r.trades, greaterThan(0));
    });
  });
}
