import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/mock_long_short_repository.dart';
import 'package:quantify_mobile/data/models/kline_models.dart';
import 'package:quantify_mobile/data/models/long_short_models.dart';

void main() {
  group('MockLongShortRepository', () {
    test('getRatio 已知 symbol 返回 long+short=1', () async {
      final MockLongShortRepository repo = MockLongShortRepository();
      final LongShortRatio r = await repo.getRatio(
        symbol: 'BTCUSDT',
        interval: KlineInterval.h1,
      );
      expect(r.symbol, 'BTCUSDT');
      expect((r.longRatio + r.shortRatio - 1.0).abs() < 1e-9, isTrue);
    });

    test('getRatio 未知 symbol 回退为 0.5/0.5', () async {
      final MockLongShortRepository repo = MockLongShortRepository();
      final LongShortRatio r = await repo.getRatio(
        symbol: 'NOPE',
        interval: KlineInterval.h1,
      );
      expect(r.longRatio, 0.5);
      expect(r.shortRatio, 0.5);
    });
  });
}
