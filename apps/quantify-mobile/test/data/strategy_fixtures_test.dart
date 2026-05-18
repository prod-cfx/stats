import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/fixtures/strategies.dart';
import 'package:quantify_mobile/data/models/strategy_models.dart';

void main() {
  group('strategy fixtures', () {
    test('mockFeaturedStrategies 至少 20 条（issue #1509 验收 #2）', () {
      expect(mockFeaturedStrategies.length, greaterThanOrEqualTo(20));
    });

    test('覆盖全部 3 个非 all category，每类至少 1 条', () {
      for (final StrategyCategory cat in <StrategyCategory>[
        StrategyCategory.highReturn,
        StrategyCategory.lowDrawdown,
        StrategyCategory.newListing,
      ]) {
        final int n = mockFeaturedStrategies
            .where((StrategyCard s) => s.category == cat)
            .length;
        expect(n, greaterThanOrEqualTo(1), reason: 'category $cat 应至少 1 条');
      }
    });

    test('id 唯一', () {
      final Set<String> ids =
          mockFeaturedStrategies.map((StrategyCard s) => s.id).toSet();
      expect(ids.length, mockFeaturedStrategies.length);
    });
  });
}
