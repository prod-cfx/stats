import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_ticker_repository.dart';
import 'package:quantify_mobile/data/models/ticker_models.dart';
import 'package:quantify_mobile/data/services/generated_backend_api.dart';

Map<String, Object?> _tickerJson({
  required String symbol,
  String currentPrice = '87010.5',
  String volumeUsd = '1234567890.12',
  String? exchange,
  String? priceChangePercent24h,
  String? openInterestUsd,
  String? indexPrice,
  String? fundingRate,
}) {
  final Map<String, Object?> json = <String, Object?>{
    'symbol': symbol,
    'currentPrice': currentPrice,
    'volumeUsd': volumeUsd,
  };
  if (exchange != null) json['exchange'] = exchange;
  if (priceChangePercent24h != null) {
    json['priceChangePercent24h'] = priceChangePercent24h;
  }
  if (openInterestUsd != null) json['openInterestUsd'] = openInterestUsd;
  if (indexPrice != null) json['indexPrice'] = indexPrice;
  if (fundingRate != null) json['fundingRate'] = fundingRate;
  return json;
}

void main() {
  test('generated ticker fields map to mobile Ticker fields', () {
    final Ticker ticker = Ticker.fromBackendFields(
      symbol: 'BTC',
      currentPrice: '87010.5',
      priceChangePercent24h: '-0.45',
      volumeUsd: '1234567890.12',
    );

    expect(ticker.symbol, 'BTC');
    expect(ticker.price, 87010.5);
    expect(ticker.changePercent, -0.45);
    expect(ticker.volume24h, 1234567890.12);
  });

  test(
    'ApiTickerRepository.listTickers maps real spot and perp contract data',
    () async {
      final List<({String symbol, String? exchange})> requests =
          <({String symbol, String? exchange})>[];
      final Dio dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
        ..interceptors.add(
          InterceptorsWrapper(
            onRequest: (RequestOptions options, RequestInterceptorHandler h) {
              expect(options.path, '/markets/ticker');
              final String symbol = options.queryParameters['symbol'] as String;
              final String? exchange =
                  options.queryParameters['exchange'] as String?;
              requests.add((symbol: symbol, exchange: exchange));

              final bool isPerp = exchange != null;
              h.resolve(
                Response<Object?>(
                  requestOptions: options,
                  statusCode: 200,
                  data: _tickerJson(
                    symbol: symbol,
                    exchange: exchange,
                    priceChangePercent24h: isPerp ? '2.5' : '1.5',
                    openInterestUsd: isPerp ? '987654321.00' : null,
                    indexPrice: isPerp ? '87000.00' : null,
                    fundingRate: isPerp ? '0.0001' : null,
                  ),
                ),
              );
            },
          ),
        );

      final List<Ticker> tickers = await ApiTickerRepository(
        GeneratedBackendApi(dio: dio),
      ).listTickers();

      expect(requests, contains((symbol: 'BTC', exchange: null)));
      expect(requests, contains((symbol: 'BTC', exchange: 'Binance')));
      expect(tickers, hasLength(requests.length));
      expect(
        tickers.any(
          (Ticker t) => t.symbol == 'BTC' && t.kind == MarketKind.spot,
        ),
        isTrue,
      );
      final Ticker btcPerp = tickers.firstWhere(
        (Ticker t) => t.symbol == 'BTC' && t.kind == MarketKind.perp,
      );
      expect(btcPerp.openInterest, 987654321.00);
      expect(btcPerp.indexPrice, 87000.00);
      expect(btcPerp.fundingRate, 0.0001);
    },
  );
}
