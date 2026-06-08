import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_long_short_repository.dart';
import 'package:quantify_mobile/data/models/exchange_long_short_models.dart';
import 'package:quantify_mobile/data/services/generated_backend_api.dart';

Map<String, Object?> _exchangeJson({
  required num rank,
  required String name,
  required num longPercent,
  required num shortPercent,
  required num longAmountUsd,
  required num shortAmountUsd,
}) {
  return <String, Object?>{
    'rank': rank,
    'name': name,
    'longPercent': longPercent,
    'shortPercent': shortPercent,
    'longAmountUsd': longAmountUsd,
    'shortAmountUsd': shortAmountUsd,
  };
}

void main() {
  test('getSnapshot uses generated exchange long-short contract', () async {
    final List<Map<String, Object?>> requests = <Map<String, Object?>>[];
    final Dio dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
      ..interceptors.add(
        InterceptorsWrapper(
          onRequest: (RequestOptions options, RequestInterceptorHandler h) {
            requests.add(<String, Object?>{
              'path': options.path,
              'query': Map<String, Object?>.from(options.queryParameters),
            });
            expect(options.path, '/markets/long-short-ratio/exchanges');
            h.resolve(
              Response<Object?>(
                requestOptions: options,
                statusCode: 200,
                data: <String, Object?>{
                  'data': <Object?>[
                    _exchangeJson(
                      rank: 1,
                      name: 'Binance',
                      longPercent: 60,
                      shortPercent: 40,
                      longAmountUsd: 1200000000,
                      shortAmountUsd: 800000000,
                    ),
                    _exchangeJson(
                      rank: 2,
                      name: 'OKX',
                      longPercent: 40,
                      shortPercent: 60,
                      longAmountUsd: 400000000,
                      shortAmountUsd: 600000000,
                    ),
                  ],
                  'message': 'Success',
                },
              ),
            );
          },
        ),
      );

    final MarketLongShortSnapshot snapshot = await ApiLongShortRepository(
      GeneratedBackendApi(dio: dio),
    ).getSnapshot(symbol: 'BTCUSDT');

    expect(requests, hasLength(1));
    expect(requests.single['query'], <String, Object?>{
      'symbol': 'BTC',
      'timeRange': '4h',
    });
    expect(snapshot.baseAsset, 'BTC');
    expect(snapshot.longNotional, r'$1.60B');
    expect(snapshot.shortNotional, r'$1.40B');
    expect(snapshot.longPct, closeTo(53.3333, 0.001));
    expect(snapshot.shortPct, closeTo(46.6667, 0.001));
    expect(
      snapshot.exchanges.map((ExchangeLongShort e) => e.exchange),
      <String>['Binance', 'OKX'],
    );
    expect(snapshot.exchanges.first.longAmount, r'$1.20B');
    expect(snapshot.exchanges.first.shortAmount, r'$800.00M');
  });

  test('getSnapshot returns empty state for empty contract response', () async {
    final Dio dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
      ..interceptors.add(
        InterceptorsWrapper(
          onRequest: (RequestOptions options, RequestInterceptorHandler h) {
            h.resolve(
              Response<Object?>(
                requestOptions: options,
                statusCode: 200,
                data: <String, Object?>{
                  'data': <Object?>[],
                  'message': 'Success',
                },
              ),
            );
          },
        ),
      );

    final MarketLongShortSnapshot snapshot = await ApiLongShortRepository(
      GeneratedBackendApi(dio: dio),
    ).getSnapshot(symbol: 'ETH');

    expect(snapshot.baseAsset, 'ETH');
    expect(snapshot.totalNotional, r'$0');
    expect(snapshot.exchanges, isEmpty);
  });
}
