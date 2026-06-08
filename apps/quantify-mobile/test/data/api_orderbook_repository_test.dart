import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_orderbook_repository.dart';
import 'package:quantify_mobile/data/models/orderbook_models.dart';

VenueDetailDto _venue(String id, num size) {
  return VenueDetailDto(
    (b) => b
      ..venueId = id
      ..size = size,
  );
}

AggregatedLevelDto _level(num price, num size) {
  return AggregatedLevelDto((b) {
    b
      ..price = price
      ..sizeTotal = size;
    b.details.replace(<VenueDetailDto>[_venue('binance', size)]);
  });
}

AggregatedOrderbookResponseDto _dto() {
  return AggregatedOrderbookResponseDto((b) {
    b
      ..marketKey = 'BTC-SPOT'
      ..base_ = 'BTC'
      ..type = 'SPOT'
      ..midPrice = 100
      ..updatedAt = 1710000000000;
    b.asks.replace(<AggregatedLevelDto>[_level(101, 2)]);
    b.bids.replace(<AggregatedLevelDto>[_level(99, 3)]);
    b.venues.replace(<String>['binance']);
    b.mergedQuotes.replace(<String>['USDT', 'USDC']);
  });
}

void main() {
  group('ApiOrderbookRepository contract mapping', () {
    test('normalizes app symbols to backend base asset', () {
      expect(ApiOrderbookRepository.orderbookBaseFromSymbol('BTC'), 'BTC');
      expect(ApiOrderbookRepository.orderbookBaseFromSymbol('BTCUSDT'), 'BTC');
      expect(ApiOrderbookRepository.orderbookBaseFromSymbol('btc/usdc'), 'BTC');
      expect(ApiOrderbookRepository.orderbookBaseFromSymbol('ETH-USD'), 'ETH');
    });

    test('maps aggregated orderbook DTO to detail snapshot levels', () {
      final OrderbookSnapshot snap = ApiOrderbookRepository.buildSnapshot(
        'BTCUSDT',
        _dto(),
      );

      expect(snap.symbol, 'BTCUSDT');
      expect(snap.asks.single.price, 101);
      expect(snap.asks.single.quantity, 2);
      expect(snap.bids.single.price, 99);
      expect(snap.bids.single.quantity, 3);
      expect(snap.midPrice, 100);
      expect(snap.timestamp.toUtc().millisecondsSinceEpoch, 1710000000000);
    });
  });
}
