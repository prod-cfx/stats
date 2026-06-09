import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_whale_feed_repository.dart';
import 'package:quantify_mobile/data/models/whale_models.dart';
import 'package:quantify_mobile/data/services/generated_backend_api.dart';

void main() {
  test('ApiWhaleFeedRepository maps generated whale trades contract', () async {
    final List<RequestOptions> requests = <RequestOptions>[];
    final Dio dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
      ..interceptors.add(
        InterceptorsWrapper(
          onRequest: (RequestOptions options, RequestInterceptorHandler h) {
            requests.add(options);
            h.resolve(
              Response<Object?>(
                requestOptions: options,
                statusCode: 200,
                data: <String, Object?>{
                  'total': 1,
                  'page': 1,
                  'limit': 7,
                  'items': <Map<String, Object?>>[
                    <String, Object?>{
                      'user_address': '0xabcdefabcdefabcdef01',
                      'symbol': 'BTC',
                      'side': 'Short',
                      'trade_size': 0.25,
                      'price': 65000.5,
                      'trade_value_usd': 16250.125,
                      'trade_time': '2026-06-09T01:02:03.000Z',
                    },
                  ],
                },
              ),
            );
          },
        ),
      );

    final ApiWhaleFeedRepository repo = ApiWhaleFeedRepository(
      GeneratedBackendApi(dio: dio),
    );

    final List<WhaleEvent> events = await repo.listRecent(limit: 7);

    expect(requests, hasLength(1));
    expect(requests.single.path, '/whale-alerts/trades');
    expect(requests.single.queryParameters['limit'], 7);
    expect(
      requests.single.queryParameters.containsKey('min_trade_value_usd'),
      isFalse,
    );

    expect(events, hasLength(1));
    expect(
      events.single.id,
      '0xabcdefabcdefabcdef01-BTC-2026-06-09T01:02:03.000Z-16250.125-65000.5',
    );
    expect(events.single.address, '0xabcdefabcdefabcdef01');
    expect(events.single.symbol, 'BTC');
    expect(events.single.amountUsd, 16250.125);
    expect(events.single.direction, 'out');
    expect(events.single.fromLabel, 'Hyperliquid');
    expect(events.single.toLabel, 'BTC Short');
    expect(events.single.side, 'short');
    expect(events.single.positionValue, 16250.125);
    expect(events.single.quantity, '0.2500 BTC');
    expect(events.single.openPrice, 65000.5);
    expect(events.single.traderTag, '成交');
    expect(events.single.isFresh, isTrue);
    expect(events.single.winRate, inInclusiveRange(45, 85));
    expect(events.single.timestamp, DateTime.parse('2026-06-09T01:02:03.000Z'));
  });
}
