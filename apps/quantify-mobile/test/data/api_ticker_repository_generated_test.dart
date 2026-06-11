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

Map<String, Object?> _pairJson({
  required String symbol,
  required String baseAsset,
  required String instrumentType,
  String exchange = 'BINANCE',
}) {
  return <String, Object?>{
    'id': '$symbol.$exchange.$instrumentType',
    'displaySymbol': '$baseAsset/USDT',
    'symbol': symbol,
    'baseAsset': baseAsset,
    'quoteAsset': 'USDT',
    'venueType': 'CEX',
    'instrumentType': instrumentType,
    'pricePrecision': 2,
    'quantityPrecision': 6,
    'enabled': true,
    'exchange': exchange,
    'exchangeSymbol': symbol,
  };
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
              if (options.path == '/markets/pairs') {
                h.resolve(
                  Response<Object?>(
                    requestOptions: options,
                    statusCode: 200,
                    data: <Object?>[
                      _pairJson(
                        symbol: 'BTCUSDT',
                        baseAsset: 'BTC',
                        instrumentType: 'SPOT',
                      ),
                      _pairJson(
                        symbol: 'BTCUSDT',
                        baseAsset: 'BTC',
                        instrumentType: 'PERPETUAL',
                      ),
                      _pairJson(
                        symbol: 'ETHUSDT',
                        baseAsset: 'ETH',
                        instrumentType: 'SPOT',
                      ),
                    ],
                  ),
                );
                return;
              }

              if (options.path == '/kline') {
                h.resolve(
                  Response<Object?>(
                    requestOptions: options,
                    statusCode: 200,
                    data: <String, Object?>{
                      'data': <Object?>[
                        <String, Object?>{
                          'time': 1780916400000,
                          'open': 90000,
                          'high': 90001,
                          'low': 89999,
                          'close': 90012.34,
                          'volume': 1,
                        },
                      ],
                      'message': 'Success',
                    },
                  ),
                );
                return;
              }

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
                  data: <String, Object?>{
                    'data': _tickerJson(
                      symbol: symbol,
                      exchange: exchange,
                      priceChangePercent24h: isPerp ? '2.5' : '1.5',
                      openInterestUsd: isPerp ? '987654321.00' : null,
                      indexPrice: isPerp ? '87000.00' : null,
                      fundingRate: isPerp ? '0.0001' : null,
                    ),
                    'message': 'Success',
                  },
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
      expect(requests, contains((symbol: 'ETH', exchange: null)));
      expect(tickers, hasLength(requests.length));
      expect(tickers.first.price, 90012.34);
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

  test(
    'ApiTickerRepository.listTickers skips failed ticker requests',
    () async {
      final Dio dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
        ..interceptors.add(
          InterceptorsWrapper(
            onRequest: (RequestOptions options, RequestInterceptorHandler h) {
              if (options.path == '/markets/pairs') {
                h.resolve(
                  Response<Object?>(
                    requestOptions: options,
                    statusCode: 200,
                    data: <Object?>[
                      _pairJson(
                        symbol: 'BTCUSDT',
                        baseAsset: 'BTC',
                        instrumentType: 'SPOT',
                      ),
                      _pairJson(
                        symbol: 'ETHUSDT',
                        baseAsset: 'ETH',
                        instrumentType: 'SPOT',
                      ),
                    ],
                  ),
                );
                return;
              }

              final String symbol = options.queryParameters['symbol'] as String;
              if (symbol == 'ETH') {
                h.reject(
                  DioException(
                    requestOptions: options,
                    response: Response<Object?>(
                      requestOptions: options,
                      statusCode: 500,
                    ),
                  ),
                );
                return;
              }

              h.resolve(
                Response<Object?>(
                  requestOptions: options,
                  statusCode: 200,
                  data: <String, Object?>{
                    'data': _tickerJson(symbol: symbol),
                    'message': 'Success',
                  },
                ),
              );
            },
          ),
        );

      final List<Ticker> tickers = await ApiTickerRepository(
        GeneratedBackendApi(dio: dio),
      ).listTickers();

      expect(tickers.map((Ticker t) => t.symbol), <String>['BTC']);
    },
  );

  test(
    'ApiTickerRepository.listTickers skips wrapped null ticker responses',
    () async {
      final Dio dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
        ..interceptors.add(
          InterceptorsWrapper(
            onRequest: (RequestOptions options, RequestInterceptorHandler h) {
              if (options.path == '/markets/pairs') {
                h.resolve(
                  Response<Object?>(
                    requestOptions: options,
                    statusCode: 200,
                    data: <Object?>[
                      _pairJson(
                        symbol: 'BTCUSDT',
                        baseAsset: 'BTC',
                        instrumentType: 'SPOT',
                      ),
                      _pairJson(
                        symbol: 'XRPUSDT',
                        baseAsset: 'XRP',
                        instrumentType: 'SPOT',
                      ),
                    ],
                  ),
                );
                return;
              }

              final String symbol = options.queryParameters['symbol'] as String;
              h.resolve(
                Response<Object?>(
                  requestOptions: options,
                  statusCode: 200,
                  data: <String, Object?>{
                    'data': symbol == 'XRP'
                        ? null
                        : _tickerJson(symbol: symbol),
                    'message': 'Success',
                  },
                ),
              );
            },
          ),
        );

      final List<Ticker> tickers = await ApiTickerRepository(
        GeneratedBackendApi(dio: dio),
      ).listTickers();

      expect(tickers.map((Ticker t) => t.symbol), <String>['BTC']);
      expect(tickers.any((Ticker t) => t.price == 0), isFalse);
    },
  );

  test(
    'ApiTickerRepository.listTickers uses fresher 5m kline when 1m is stale',
    () async {
      final int nowSeconds = DateTime.now().millisecondsSinceEpoch ~/ 1000;
      final List<String> klineIntervals = <String>[];
      final Dio dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
        ..interceptors.add(
          InterceptorsWrapper(
            onRequest: (RequestOptions options, RequestInterceptorHandler h) {
              if (options.path == '/markets/pairs') {
                h.resolve(
                  Response<Object?>(
                    requestOptions: options,
                    statusCode: 200,
                    data: <Object?>[
                      _pairJson(
                        symbol: 'BTCUSDT',
                        baseAsset: 'BTC',
                        instrumentType: 'SPOT',
                      ),
                    ],
                  ),
                );
                return;
              }

              if (options.path == '/markets/ticker') {
                h.resolve(
                  Response<Object?>(
                    requestOptions: options,
                    statusCode: 200,
                    data: <String, Object?>{
                      'data': _tickerJson(
                        symbol: 'BTC',
                        currentPrice: '67344.7',
                      ),
                      'message': 'Success',
                    },
                  ),
                );
                return;
              }

              expect(options.path, '/kline');
              expect(options.queryParameters['symbol'], 'BTCUSDT');
              final String interval =
                  options.queryParameters['interval'] as String;
              klineIntervals.add(interval);
              final bool isFiveMinute = interval == '5m';
              h.resolve(
                Response<Object?>(
                  requestOptions: options,
                  statusCode: 200,
                  data: <String, Object?>{
                    'data': <Object?>[
                      <String, Object?>{
                        'time':
                            (isFiveMinute
                                ? nowSeconds - 300
                                : nowSeconds - 3600) *
                            1000,
                        'open': isFiveMinute ? 62700 : 63200,
                        'high': isFiveMinute ? 62750 : 63300,
                        'low': isFiveMinute ? 62680 : 63100,
                        'close': isFiveMinute ? 62742.4 : 63285.5,
                        'volume': 1,
                      },
                    ],
                    'message': 'Success',
                  },
                ),
              );
            },
          ),
        );

      final List<Ticker> tickers = await ApiTickerRepository(
        GeneratedBackendApi(dio: dio),
      ).listTickers();

      expect(klineIntervals, <String>['1m', '5m']);
      expect(tickers.single.price, 62742.4);
    },
  );

  test('ApiTickerRepository.watchTicker uses latest kline close', () async {
    final int nowSeconds = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    final Dio dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
      ..interceptors.add(
        InterceptorsWrapper(
          onRequest: (RequestOptions options, RequestInterceptorHandler h) {
            if (options.path == '/markets/ticker') {
              h.resolve(
                Response<Object?>(
                  requestOptions: options,
                  statusCode: 200,
                  data: <String, Object?>{
                    'data': _tickerJson(symbol: 'BTC', currentPrice: '67344.7'),
                    'message': 'Success',
                  },
                ),
              );
              return;
            }

            expect(options.path, '/kline');
            expect(options.queryParameters['symbol'], 'BTCUSDT');
            h.resolve(
              Response<Object?>(
                requestOptions: options,
                statusCode: 200,
                data: <String, Object?>{
                  'data': <Object?>[
                    <String, Object?>{
                      'time': (nowSeconds - 60) * 1000,
                      'open': 62800,
                      'high': 62890,
                      'low': 62790,
                      'close': 62888.3,
                      'volume': 1,
                    },
                  ],
                  'message': 'Success',
                },
              ),
            );
          },
        ),
      );

    final Ticker ticker = await ApiTickerRepository(
      GeneratedBackendApi(dio: dio),
    ).watchTicker('BTC').first;

    expect(ticker.price, 62888.3);
  });

  test(
    'ApiTickerRepository.getTicker fetches one market with exchange',
    () async {
      final List<({String symbol, String? exchange})> requests =
          <({String symbol, String? exchange})>[];
      final Dio dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
        ..interceptors.add(
          InterceptorsWrapper(
            onRequest: (RequestOptions options, RequestInterceptorHandler h) {
              if (options.path == '/kline') {
                h.resolve(
                  Response<Object?>(
                    requestOptions: options,
                    statusCode: 200,
                    data: const <String, Object?>{'data': <Object?>[]},
                  ),
                );
                return;
              }

              expect(options.path, '/markets/ticker');
              requests.add((
                symbol: options.queryParameters['symbol'] as String,
                exchange: options.queryParameters['exchange'] as String?,
              ));
              h.resolve(
                Response<Object?>(
                  requestOptions: options,
                  statusCode: 200,
                  data: <String, Object?>{
                    'data': _tickerJson(
                      symbol: 'BTC',
                      exchange: 'Binance',
                      openInterestUsd: '987654321.00',
                    ),
                    'message': 'Success',
                  },
                ),
              );
            },
          ),
        );

      final Ticker? ticker = await ApiTickerRepository(
        GeneratedBackendApi(dio: dio),
      ).getTicker(symbol: 'BTC', kind: MarketKind.perp, exchange: 'Binance');

      expect(requests, <({String symbol, String? exchange})>[
        (symbol: 'BTC', exchange: 'Binance'),
      ]);
      expect(ticker?.kind, MarketKind.perp);
      expect(ticker?.openInterest, 987654321.00);
    },
  );

  test(
    'ApiTickerRepository.watchTicker preserves requested kind and exchange',
    () async {
      final List<({String symbol, String? exchange})> requests =
          <({String symbol, String? exchange})>[];
      final Dio dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
        ..interceptors.add(
          InterceptorsWrapper(
            onRequest: (RequestOptions options, RequestInterceptorHandler h) {
              if (options.path == '/kline') {
                h.resolve(
                  Response<Object?>(
                    requestOptions: options,
                    statusCode: 200,
                    data: const <String, Object?>{'data': <Object?>[]},
                  ),
                );
                return;
              }

              expect(options.path, '/markets/ticker');
              requests.add((
                symbol: options.queryParameters['symbol'] as String,
                exchange: options.queryParameters['exchange'] as String?,
              ));
              h.resolve(
                Response<Object?>(
                  requestOptions: options,
                  statusCode: 200,
                  data: <String, Object?>{
                    'data': _tickerJson(
                      symbol: 'ETH',
                      exchange: 'OKX',
                      priceChangePercent24h: '-1.5',
                    ),
                    'message': 'Success',
                  },
                ),
              );
            },
          ),
        );

      final Ticker ticker = await ApiTickerRepository(
        GeneratedBackendApi(dio: dio),
      ).watchTicker('ETH', kind: MarketKind.spot, exchange: 'OKX').first;

      expect(requests, <({String symbol, String? exchange})>[
        (symbol: 'ETH', exchange: 'OKX'),
      ]);
      expect(ticker.kind, MarketKind.spot);
      expect(ticker.changePercent, -1.5);
    },
  );
}
