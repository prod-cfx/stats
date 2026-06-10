import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_coin_stock_repository.dart';
import 'package:quantify_mobile/data/models/coin_stock_models.dart';

CryptoStockQuoteResponseDto _dto({
  String symbol = 'MSTR',
  String? name,
  String? exchange,
  String price = '410.5',
  String? openPrice,
  String? highPrice,
  String? lowPrice,
  String? closePrice,
  String? priceChange,
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
  String source = 'BBX_SCRAPER',
  DateTime? quoteTimestamp,
  DateTime? updatedAt,
}) {
  final DateTime t = DateTime.utc(2026, 6, 6);
  return CryptoStockQuoteResponseDto((b) {
    b
      ..id = 1
      ..symbol = symbol
      ..name = name
      ..exchange = exchange
      ..price = price
      ..openPrice = openPrice
      ..highPrice = highPrice
      ..lowPrice = lowPrice
      ..closePrice = closePrice
      ..priceChange = priceChange
      ..priceChangePercent = priceChangePercent
      ..marketCap = marketCap
      ..mNav = mNav
      ..holdingsValue = holdingsValue
      ..holdingValue = holdingValue
      ..holdingsAmount = holdingsAmount
      ..holdingQuantity = holdingQuantity
      ..assetSymbol = assetSymbol
      ..companyType = companyType
      ..source_ = source
      ..quoteTimestamp = quoteTimestamp ?? t
      ..createdAt = t
      ..updatedAt = updatedAt ?? t;
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

    test('normalizes lowercase asset and keeps invalid change empty', () {
      final CoinStock c = ApiCoinStockRepository.mapCoinStock(
        _dto(assetSymbol: ' eth ', priceChangePercent: 'not-a-number'),
      );

      expect(c.coin, 'ETH');
      expect(c.hold, 'ETH');
      expect(c.ch, '');
      expect(c.up, isTrue);
    });
  });

  group('ApiCoinStockRepository.mergeQuotesBySymbol', () {
    test('prefers BBX quote fields while keeping holdings fields', () {
      final DateTime holdingTime = DateTime.utc(2026, 6, 6);
      final DateTime priceTime = DateTime.utc(2026, 6, 7);
      final CryptoStockQuoteResponseDto holding = _dto(
        holdingsValue: '\$58.00B',
        holdingsAmount: '671.27K BTC',
        price: '100',
        openPrice: '90',
        highPrice: '110',
        lowPrice: '80',
        closePrice: '95',
        priceChange: '0',
        priceChangePercent: '0',
        assetSymbol: 'BTC',
        companyType: 'Treasury',
        infoParagraphs: <String>['holding intro'],
        quoteTimestamp: holdingTime,
        updatedAt: holdingTime,
        source: 'BBX_SCRAPER',
      );
      final CryptoStockQuoteResponseDto price = _dto(
        price: '165.12',
        openPrice: '160',
        highPrice: '170',
        lowPrice: '155',
        closePrice: '158',
        priceChange: '3.81',
        priceChangePercent: '2.37',
        quoteTimestamp: priceTime,
        updatedAt: priceTime,
        source: 'BBX',
      );

      final List<CryptoStockQuoteResponseDto> merged =
          ApiCoinStockRepository.mergeQuotesBySymbol(
            <CryptoStockQuoteResponseDto>[holding],
            <CryptoStockQuoteResponseDto>[price],
          );

      expect(merged, hasLength(1));
      expect(merged.first.price, '165.12');
      expect(merged.first.openPrice, '160');
      expect(merged.first.highPrice, '170');
      expect(merged.first.lowPrice, '155');
      expect(merged.first.closePrice, '158');
      expect(merged.first.priceChange, '3.81');
      expect(merged.first.priceChangePercent, '2.37');
      expect(merged.first.quoteTimestamp, priceTime);
      expect(merged.first.updatedAt, priceTime);
      expect(merged.first.holdingsValue, '\$58.00B');
      expect(merged.first.holdingsAmount, '671.27K BTC');
      expect(merged.first.assetSymbol, 'BTC');
      expect(merged.first.companyType, 'Treasury');
      expect(merged.first.infoParagraphs?.toList(), <String>['holding intro']);
      expect(merged.first.source_, 'BBX');
    });

    test('keeps holdings rows when no matching BBX symbol exists', () {
      final CryptoStockQuoteResponseDto holding = _dto(symbol: 'COIN');
      final CryptoStockQuoteResponseDto price = _dto(
        symbol: 'MSTR',
        source: 'BBX',
      );

      final List<CryptoStockQuoteResponseDto> merged =
          ApiCoinStockRepository.mergeQuotesBySymbol(
            <CryptoStockQuoteResponseDto>[holding],
            <CryptoStockQuoteResponseDto>[price],
          );

      expect(merged, hasLength(1));
      expect(merged.first.symbol, 'COIN');
      expect(merged.first.source_, 'BBX_SCRAPER');
    });

    test('returns price rows when holdings source is empty', () {
      final CryptoStockQuoteResponseDto price = _dto(source: 'BBX');

      final List<CryptoStockQuoteResponseDto> merged =
          ApiCoinStockRepository.mergeQuotesBySymbol(
            const <CryptoStockQuoteResponseDto>[],
            <CryptoStockQuoteResponseDto>[price],
          );

      expect(merged, <CryptoStockQuoteResponseDto>[price]);
    });
  });

  group('ApiCoinStockRepository.listCoinStocks', () {
    test('returns BBX rows when BBX_SCRAPER fails', () async {
      final ApiCoinStockRepository repo = ApiCoinStockRepository.test(
        loadQuotes: (String source) async {
          if (source == 'BBX_SCRAPER') throw StateError('scraper down');
          return <CryptoStockQuoteResponseDto>[
            _dto(
              source: 'BBX',
              assetSymbol: 'BTC',
              price: '165.12',
              priceChangePercent: '2.37',
            ),
          ];
        },
      );

      final List<CoinStock> rows = await repo.listCoinStocks();

      expect(rows, hasLength(1));
      expect(rows.single.sym, 'MSTR');
      expect(rows.single.px, '165.12');
      expect(rows.single.ch, '+2.37%');
      expect(rows.single.coin, 'BTC');
    });

    test('returns BBX_SCRAPER rows when BBX fails', () async {
      final ApiCoinStockRepository repo = ApiCoinStockRepository.test(
        loadQuotes: (String source) async {
          if (source == 'BBX') throw StateError('bbx down');
          return <CryptoStockQuoteResponseDto>[
            _dto(
              source: 'BBX_SCRAPER',
              assetSymbol: 'ETH',
              holdingsValue: r'$12.67B',
              holdingsAmount: '4.07M ETH',
              price: '30.07',
            ),
          ];
        },
      );

      final List<CoinStock> rows = await repo.listCoinStocks();

      expect(rows, hasLength(1));
      expect(rows.single.coin, 'ETH');
      expect(rows.single.holdV, r'$12.67B');
      expect(rows.single.holdQ, '4.07M ETH');
      expect(rows.single.px, '30.07');
    });

    test('throws first source error when both sources fail', () async {
      final StateError scraperError = StateError('scraper down');
      final ApiCoinStockRepository repo = ApiCoinStockRepository.test(
        loadQuotes: (String source) async {
          if (source == 'BBX_SCRAPER') throw scraperError;
          throw StateError('bbx down');
        },
      );

      expect(repo.listCoinStocks(), throwsA(same(scraperError)));
    });
  });
}
