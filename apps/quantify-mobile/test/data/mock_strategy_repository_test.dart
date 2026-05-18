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
  });
}
