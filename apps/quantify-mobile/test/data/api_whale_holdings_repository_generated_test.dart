import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_whale_holdings_repository.dart';
import 'package:quantify_mobile/data/services/generated_backend_api.dart';
import 'package:quantify_mobile/domain/models/whale_holding_models.dart';

void main() {
  test('ApiWhaleHoldingsRepository maps generated whale holdings contract',
      () async {
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
                  'limit': 200,
                  'items': <Map<String, Object?>>[
                    <String, Object?>{
                      'userAddress': '0xabcdefabcdefabcdef01',
                      'symbol': 'BTC',
                      'side': 'LONG',
                      'positionSize': 0.25,
                      'positionValueUsd': 16250.125,
                      'entryPrice': 65000.5,
                      'liquidationPrice': 52000,
                      'pnl': 1234.56,
                      'roe': 0.075,
                      'leverage': 10,
                      'snapshotTime': '2026-06-09T01:02:03.000Z',
                    },
                  ],
                },
              ),
            );
          },
        ),
      );

    final ApiWhaleHoldingsRepository repo = ApiWhaleHoldingsRepository(
      GeneratedBackendApi(dio: dio),
    );

    final List<WhaleHoldingPosition> rows = await repo.getHoldings();

    expect(requests, hasLength(1));
    expect(requests.single.path, '/whale-holdings');
    expect(requests.single.queryParameters['page'], 1);
    expect(requests.single.queryParameters['limit'], 200);
    expect(requests.single.queryParameters['minPositionValueUsd'], 1000000);

    expect(rows, hasLength(1));
    final WhaleHoldingPosition row = rows.single;
    expect(row.address, '0xabcdefabcdefabcdef01');
    expect(row.symbol, 'BTC');
    expect(row.side, WhaleHoldingSide.long);
    expect(row.leverage, 10);
    expect(row.value, 16250.125);
    expect(row.valueDisplay, r'$16.25K');
    expect(row.qtyDisplay, '0.2500 BTC');
    expect(row.pnl, 1234.56);
    expect(row.pnlDisplay, r'+$1.23K');
    expect(row.pnlPctDisplay, '+7.50%');
    expect(row.margin, 1625.0125);
    expect(row.marginDisplay, r'$1.63K');
    expect(row.openDisplay, r'$65,000.50');
    expect(row.liqDisplay, r'$52,000.00');
    expect(row.liqBreached, isFalse);
    expect(row.hoursAgo, greaterThanOrEqualTo(0));
    expect(row.timeDisplay, isNotEmpty);
  });
}
