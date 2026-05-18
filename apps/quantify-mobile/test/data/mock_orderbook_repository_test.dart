import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/mock_orderbook_repository.dart';
import 'package:quantify_mobile/data/models/orderbook_models.dart';

void main() {
  group('MockOrderbookRepository', () {
    test('getSnapshot 返回对称的 bids/asks 列表', () async {
      final MockOrderbookRepository repo = MockOrderbookRepository();
      final OrderbookSnapshot snap = await repo.getSnapshot('BTCUSDT');
      expect(snap.symbol, 'BTCUSDT');
      expect(snap.bids, isNotEmpty);
      expect(snap.asks, isNotEmpty);
      expect(snap.bids.length, snap.asks.length);
      expect(snap.bids.first.price < snap.asks.first.price, isTrue);
    });
  });
}
