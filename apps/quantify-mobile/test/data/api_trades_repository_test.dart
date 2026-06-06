import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_trades_repository.dart';
import 'package:quantify_mobile/data/models/trade_models.dart';

void main() {
  group('ApiTradesRepository.parseTrade', () {
    test('parses price/qty/side(string buy)/time', () {
      final Trade t = ApiTradesRepository.parseTrade(<String, dynamic>{
        'price': '101.5',
        'size': '2.0',
        'side': 'BUY',
        'time': '2026-06-06T00:00:00.000Z',
      });
      expect(t.price, 101.5);
      expect(t.qty, 2.0);
      expect(t.isBuy, isTrue);
      expect(t.time.toUtc().year, 2026);
    });

    test('side string sell → isBuy false', () {
      final Trade t = ApiTradesRepository.parseTrade(<String, dynamic>{
        'price': 100,
        'qty': 1,
        'side': 'sell',
      });
      expect(t.isBuy, isFalse);
    });

    test('bool isBuyerMaker honored; field aliases work', () {
      final Trade t = ApiTradesRepository.parseTrade(<String, dynamic>{
        'px': 50,
        'quantity': 3,
        'isBuyerMaker': false,
        'ts': '2026-01-01T00:00:00.000Z',
      });
      expect(t.price, 50);
      expect(t.qty, 3);
      expect(t.isBuy, isFalse);
    });

    test('missing side falls back to buy', () {
      final Trade t = ApiTradesRepository.parseTrade(<String, dynamic>{
        'price': 1,
        'qty': 1,
      });
      expect(t.isBuy, isTrue);
    });
  });
}
