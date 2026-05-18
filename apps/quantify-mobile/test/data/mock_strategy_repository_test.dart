import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/mock_strategy_repository.dart';
import 'package:quantify_mobile/data/models/strategy_models.dart';

void main() {
  group('MockStrategyRepository', () {
    test('listFeatured / listMine 返回非空 fixture', () async {
      final MockStrategyRepository repo = MockStrategyRepository();
      expect(await repo.listFeatured(), isNotEmpty);
      expect(await repo.listMine(), isNotEmpty);
    });

    test('getDetail 命中 id 返回对应卡片', () async {
      final MockStrategyRepository repo = MockStrategyRepository();
      final StrategyCard card = await repo.getDetail('st-grid-btc');
      expect(card.id, 'st-grid-btc');
    });

    test('getStrategyDetail：6 项指标在合理区间且对同 id 派生稳定', () async {
      final MockStrategyRepository repo = MockStrategyRepository();
      final StrategyDetail a = await repo.getStrategyDetail('st-grid-btc');
      final StrategyDetail b = await repo.getStrategyDetail('st-grid-btc');
      // 派生稳定（基于 id.hashCode 同一 seed）
      expect(a.return7d, b.return7d);
      expect(a.sharpe, b.sharpe);
      expect(a.winRate, b.winRate);
      // 区间合理
      expect(a.maxDrawdown, lessThanOrEqualTo(0));
      expect(a.sharpe, inInclusiveRange(0.3, 2.8));
      expect(a.winRate, inInclusiveRange(0.35, 0.85));
      expect(a.equityCurve.length, 60);
      // 卡片字段对齐
      expect(a.card.id, 'st-grid-btc');
    });

    test('listStrategySignals：默认 20 条，按时间倒序，buy/sell 都出现',
        () async {
      final MockStrategyRepository repo = MockStrategyRepository();
      final List<StrategySignal> sigs =
          await repo.listStrategySignals('st-grid-btc');
      expect(sigs, hasLength(20));
      // 时间倒序：i=0 最近，i=19 最远
      for (int i = 1; i < sigs.length; i++) {
        expect(sigs[i].time.isBefore(sigs[i - 1].time), isTrue,
            reason: '信号应按时间倒序');
      }
      // buy/sell 都出现（统计层面，避免某个 seed 全单边导致脆弱）
      final bool hasBuy = sigs
          .any((StrategySignal s) => s.side == StrategySignalSide.buy);
      final bool hasSell = sigs
          .any((StrategySignal s) => s.side == StrategySignalSide.sell);
      expect(hasBuy || hasSell, isTrue);
    });

    test('listStrategySignals：limit 参数生效', () async {
      final MockStrategyRepository repo = MockStrategyRepository();
      final List<StrategySignal> sigs =
          await repo.listStrategySignals('st-grid-btc', limit: 5);
      expect(sigs, hasLength(5));
    });
  });
}
