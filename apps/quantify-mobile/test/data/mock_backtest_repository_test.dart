import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/mock_backtest_repository.dart';
import 'package:quantify_mobile/data/models/backtest_models.dart';

void main() {
  group('MockBacktestRepository', () {
    test('run 返回 fixture 结果（含扩展指标字段）', () async {
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
      // 扩展指标（验收 #1）：新增字段均有 mock 数据
      expect(r.cagrPercent, isNonZero);
      expect(r.calmar, greaterThan(0));
      expect(r.winRatePercent, inInclusiveRange(0, 100));
      expect(r.profitLossRatio, greaterThan(0));
      expect(r.avgHoldDuration, isNotEmpty);
      expect(r.aiAssessment, isNotEmpty);
    });

    test('getResult 任意 id 返回 fixture（交易/月度/风险三段非空）', () async {
      final MockBacktestRepository repo = MockBacktestRepository();
      final BacktestResult r = await repo.getResult('any');
      expect(r.totalTrades, greaterThan(0));
      expect(r.trades, isNotEmpty);
      expect(r.monthlyRows, isNotEmpty);
      // 每行月度数据固定 12 列
      expect(r.monthlyRows.every((BacktestMonthlyRow m) => m.values.length == 12),
          isTrue);
      expect(r.riskRows, isNotEmpty);
      expect(r.drawdownMarkers, isNotEmpty);
    });
  });
}
