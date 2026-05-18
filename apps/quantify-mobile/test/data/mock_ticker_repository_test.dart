import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/mock_ticker_repository.dart';
import 'package:quantify_mobile/data/models/ticker_models.dart';

void main() {
  group('MockTickerRepository', () {
    test('listTickers 返回非空 fixture 列表，含 BTCUSDT', () async {
      final MockTickerRepository repo = MockTickerRepository();
      final List<Ticker> list = await repo.listTickers();
      expect(list, isNotEmpty);
      expect(list.any((Ticker t) => t.symbol == 'BTCUSDT'), isTrue);
    });

    test('watchTicker 至少推送一条与 symbol 匹配的 ticker', () async {
      final MockTickerRepository repo = MockTickerRepository();
      final Ticker first = await repo.watchTicker('BTCUSDT').first;
      expect(first.symbol, 'BTCUSDT');
    });
  });
}
