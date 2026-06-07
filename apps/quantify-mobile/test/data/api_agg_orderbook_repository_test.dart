import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_agg_orderbook_repository.dart';
import 'package:quantify_mobile/data/models/agg_market_data.dart';

VenueDetailDto _venue(String id, num size) {
  return VenueDetailDto(
    (b) => b
      ..venueId = id
      ..size = size,
  );
}

AggregatedLevelDto _level(num price, num size, List<VenueDetailDto> details) {
  return AggregatedLevelDto((b) {
    b
      ..price = price
      ..sizeTotal = size;
    b.details.replace(details);
  });
}

AggregatedOrderbookResponseDto _dto() {
  return AggregatedOrderbookResponseDto((b) {
    b
      ..marketKey = 'BTC-SPOT'
      ..base_ = 'BTC'
      ..type = 'SPOT'
      ..midPrice = 100
      ..updatedAt = 0;
    b.asks.replace(<AggregatedLevelDto>[
      _level(101, 2, <VenueDetailDto>[_venue('binance', 2)]),
    ]);
    b.bids.replace(<AggregatedLevelDto>[
      _level(99, 3, <VenueDetailDto>[_venue('okx', 3)]),
    ]);
    b.venues.replace(<String>['binance', 'okx']);
    b.mergedQuotes.replace(<String>[]);
  });
}

void main() {
  group('ApiAggOrderbookRepository.buildMarketData', () {
    test('maps asks/bids levels with venue source', () {
      final AggMarketData d = ApiAggOrderbookRepository.buildMarketData(_dto());
      expect(d.asks.single.price, 101);
      expect(d.asks.single.qty, 2);
      expect(d.asks.single.exchange, 'binance');
      expect(d.bids.single.price, 99);
      expect(d.bids.single.exchange, 'okx');
    });

    test('venues → exchanges + exchangeMap', () {
      final AggMarketData d = ApiAggOrderbookRepository.buildMarketData(_dto());
      expect(d.exchanges.map((AggExchange e) => e.key), <String>[
        'binance',
        'okx',
      ]);
      expect(d.exchangeMap['binance']!.letter, 'B');
    });

    test(
      'real mode keeps oi and volume empty when backend contract has no fields',
      () {
        final AggMarketData d = ApiAggOrderbookRepository.buildMarketData(
          _dto(),
        );
        expect(d.oiCoins, isEmpty);
        expect(d.oiData, isEmpty);
        expect(d.volCoins, isEmpty);
        expect(d.volData, isEmpty);
        expect(d.precisions, <int>[1, 10, 100]);
      },
    );

    test('mapLevel falls back to AGG when no venue details', () {
      final AggBookLevel l = ApiAggOrderbookRepository.mapLevel(
        _level(50, 1, <VenueDetailDto>[]),
      );
      expect(l.exchange, 'AGG');
    });
  });
}
