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
                      'user_address': '0x95ab1234567890abcdefc60a',
                      'symbol': 'BTC',
                      'side': 'Long',
                      'trade_size': 12.3456,
                      'price': 68000,
                      'trade_value_usd': 1250000,
                      'trade_time': '2026-06-11T08:30:00.000Z',
                    },
                    <String, Object?>{
                      'user_address': '0xshort1234567890abcdefc60a',
                      'symbol': 'ETH',
                      'side': 'Short',
                      'trade_size': 2.5,
                      'price': 3500,
                      'trade_value_usd': 8750,
                      'trade_time': '2026-06-11T08:31:00.000Z',
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
    expect(requests.single.queryParameters['min_trade_value_usd'], 10000);

    expect(events, hasLength(2));
    final WhaleEvent event = events.first;
    expect(event.id, contains('0x95ab1234567890abcdefc60a'));
    expect(event.address, '0x95ab1234567890abcdefc60a');
    expect(event.symbol, 'BTC');
    expect(event.amountUsd, 1250000);
    expect(event.direction, 'in');
    expect(event.fromLabel, 'Hyperliquid');
    expect(event.toLabel, 'BTC Long');
    expect(event.traderTag, '成交');
    expect(event.mode, isNull);
    expect(event.side, 'long');
    expect(event.positionValue, 1250000);
    expect(event.quantity, '12.3456 BTC');
    expect(event.openPrice, 68000);
    expect(event.winRate, inInclusiveRange(45, 85));
    expect(
      event.timestamp.toUtc(),
      DateTime.parse('2026-06-11T08:30:00.000Z'),
    );

    final WhaleEvent shortEvent = events.last;
    expect(shortEvent.direction, 'out');
    expect(shortEvent.side, 'short');
    expect(shortEvent.toLabel, 'ETH Short');
  });
}
