import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_coin_stock_repository.dart';
import 'package:quantify_mobile/data/models/coin_stock_models.dart';

CryptoStockQuoteResponseDto _dto({
  String symbol = 'MSTR',
  String? name,
  String? exchange,
  String price = '410.5',
  String? priceChangePercent,
  String? marketCap,
  String? mNav,
  String? holdingsValue,
  String? holdingValue,
  String? holdingsAmount,
  String? holdingQuantity,
  String? assetSymbol,
  String? companyType,
  List<String>? infoParagraphs,
}) {
  final DateTime t = DateTime.utc(2026, 6, 6);
  return CryptoStockQuoteResponseDto((b) {
    b
      ..id = 1
      ..symbol = symbol
      ..name = name
      ..exchange = exchange
      ..price = price
      ..priceChangePercent = priceChangePercent
      ..marketCap = marketCap
      ..mNav = mNav
      ..holdingsValue = holdingsValue
      ..holdingValue = holdingValue
      ..holdingsAmount = holdingsAmount
      ..holdingQuantity = holdingQuantity
      ..assetSymbol = assetSymbol
      ..companyType = companyType
      ..source_ = 'test'
      ..quoteTimestamp = t
      ..createdAt = t
      ..updatedAt = t;
    if (infoParagraphs != null) b.infoParagraphs.replace(infoParagraphs);
  });
}

void main() {
  group('ApiCoinStockRepository.mapCoinStock', () {
    test('maps typed fields; null numeric → empty string', () {
      final CoinStock c = ApiCoinStockRepository.mapCoinStock(
        _dto(name: 'MicroStrategy', exchange: 'NASDAQ', assetSymbol: 'BTC'),
      );
      expect(c.sym, 'MSTR');
      expect(c.cn, 'MicroStrategy');
      expect(c.ex, 'NASDAQ');
      expect(c.px, '410.5');
      expect(c.coin, 'BTC');
      expect(c.hold, 'BTC');
      // null numeric fields fall back to empty string
      expect(c.mcap, '');
      expect(c.mnav, '');
      expect(c.holdV, '');
      expect(c.hq, '');
      expect(c.listed, '');
    });

    test('positive change → +x.xx% and up=true', () {
      final CoinStock c = ApiCoinStockRepository.mapCoinStock(
        _dto(priceChangePercent: '1.683'),
      );
      expect(c.ch, '+1.68%');
      expect(c.up, isTrue);
    });

    test('negative change → -x.xx% and up=false', () {
      final CoinStock c = ApiCoinStockRepository.mapCoinStock(
        _dto(priceChangePercent: '-2.5'),
      );
      expect(c.ch, '-2.50%');
      expect(c.up, isFalse);
    });

    test('holdings fall back to db raw fields when display absent', () {
      final CoinStock c = ApiCoinStockRepository.mapCoinStock(
        _dto(holdingValue: '1000', holdingQuantity: '12'),
      );
      expect(c.holdV, '1000');
      expect(c.holdQ, '12');
    });

    test('empty assetSymbol falls back to OTHER', () {
      final CoinStock c = ApiCoinStockRepository.mapCoinStock(
        _dto(assetSymbol: '  '),
      );
      expect(c.coin, 'OTHER');
      expect(c.hold, 'OTHER');
    });

    test('infoParagraphs joined into intro', () {
      final CoinStock c = ApiCoinStockRepository.mapCoinStock(
        _dto(infoParagraphs: <String>['a', 'b']),
      );
      expect(c.intro, 'a\nb');
    });
  });
}
