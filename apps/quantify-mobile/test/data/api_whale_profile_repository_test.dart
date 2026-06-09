import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_whale_profile_repository.dart';
import 'package:quantify_mobile/data/models/whale_profile_models.dart';
import 'package:quantify_mobile/data/services/generated_backend_api.dart';

void main() {
  group('ApiWhaleProfileRepository contract mapping', () {
    test(
      'loads profile from whale-tracking generated contract endpoints',
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
                    data: _responseFor(options.path),
                  ),
                );
              },
            ),
          );
        final ApiWhaleProfileRepository repo = ApiWhaleProfileRepository(
          GeneratedBackendApi(dio: dio),
        );

        final WhaleProfile profile = await repo.getProfile('0xabc');

        expect(requests.map((RequestOptions r) => r.path), <String>[
          '/whale-tracking/traders/0xabc/snapshot',
          '/whale-tracking/traders/0xabc/positions',
          '/whale-tracking/traders/0xabc/open-orders',
          '/whale-tracking/traders/0xabc/performance',
          '/whale-tracking/traders/0xabc/discover-tags',
        ]);
        expect(requests[1].queryParameters['type'], 'all');
        expect(requests[2].queryParameters.containsKey('coin'), isFalse);
        expect(requests[3].queryParameters['limit'], 200);

        expect(profile.address, '0xabc');
        expect(profile.tag, r'$10M+ HYPERUNIT WHALE');
        expect(profile.assetSummary, 'BTC · ETH');
        expect(profile.holdingsValueDisplay, r'$12.00M');
        expect(profile.pnlTotalDisplay, r'+$420.00K');
        expect(profile.statCards!.accountValueDisplay, r'$12.00M');
        expect(profile.perpSummary!.totalValueDisplay, r'$8.00M');
        expect(profile.perpSummary!.marginUsagePct, 25);
        expect(profile.stats.pnlDisplay, r'+$420.00K');
        expect(profile.stats.tradesTotal, 9);
        expect(profile.stats.assetPerf.single.symbol, 'BTC');

        expect(profile.spotHoldings, hasLength(1));
        expect(profile.spotHoldings.single.sym, 'ETH');
        expect(profile.spotHoldings.single.valueDisplay, r'$4.00M');
        expect(profile.spotHoldings.single.chain, 'Hyperliquid');

        expect(profile.perpHoldings, hasLength(1));
        expect(profile.perpHoldings.single.sym, 'BTC');
        expect(profile.perpHoldings.single.side, '做多');
        expect(profile.perpHoldings.single.lev, '5x');
        expect(profile.perpHoldings.single.mode, '全仓');
        expect(profile.perpHoldings.single.pnlDisplay, r'+$250.00K');

        expect(profile.openOrders, hasLength(1));
        expect(profile.openOrders.single.id, '42');
        expect(profile.openOrders.single.side, '买入');
        expect(profile.openOrders.single.valueDisplay, r'$3.10M');

        expect(profile.recentTrades, hasLength(1));
        expect(profile.recentTrades.single.action, '开多');
        expect(profile.recentTrades.single.priceDisplay, r'$65,000.00');
        expect(profile.histOrders, hasLength(1));
        expect(profile.histOrders.single.status, '已成交');
      },
    );

    test('empty contract lists keep real empty detail state', () async {
      final Dio dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
        ..interceptors.add(
          InterceptorsWrapper(
            onRequest: (RequestOptions options, RequestInterceptorHandler h) {
              h.resolve(
                Response<Object?>(
                  requestOptions: options,
                  statusCode: 200,
                  data: _emptyResponseFor(options.path),
                ),
              );
            },
          ),
        );
      final ApiWhaleProfileRepository repo = ApiWhaleProfileRepository(
        GeneratedBackendApi(dio: dio),
      );

      final WhaleProfile profile = await repo.getProfile('0xempty');

      expect(profile.address, '0xempty');
      expect(profile.tag, '未标记');
      expect(profile.spotHoldings, isEmpty);
      expect(profile.perpHoldings, isEmpty);
      expect(profile.openOrders, isEmpty);
      expect(profile.recentTrades, isEmpty);
      expect(profile.histOrders, isEmpty);
      expect(profile.stats.assetPerf, isEmpty);
    });
  });
}

Object _responseFor(String path) {
  if (path.endsWith('/snapshot')) {
    return <String, Object?>{
      'perp': <String, Object?>{
        'accountValue': 8000000,
        'totalMarginUsed': 2000000,
        'totalPositionValue': 9000000,
        'withdrawable': 6000000,
        'marginUsagePercent': 25,
        'leverageRatio': 4.5,
        'unrealizedPnl': 250000,
        'roi': 12.5,
      },
      'spot': <String, Object?>{
        'totalValue': 4000000,
        'balances': <Map<String, Object?>>[
          <String, Object?>{
            'coin': 'ETH',
            'total': 1200,
            'hold': 50,
            'value': 4000000,
            'sharePercent': 33.333,
          },
        ],
      },
      'total': <String, Object?>{
        'accountValue': 12000000,
        'perpPercent': 66.667,
        'spotPercent': 33.333,
      },
    };
  }
  if (path.endsWith('/positions')) {
    return <String, Object?>{
      'perp': <Map<String, Object?>>[
        <String, Object?>{
          'coin': 'BTC',
          'side': 'LONG',
          'size': 138.46,
          'entryPrice': 63000,
          'markPrice': 65000,
          'liquidationPrice': 51000,
          'positionValue': 9000000,
          'marginUsed': 1800000,
          'leverage': <String, Object?>{'type': 'cross', 'value': 5},
          'unrealizedPnl': 250000,
          'unrealizedPnlPercent': 13.8889,
          'fundingRate': -1200,
          'roi': 13.8889,
        },
      ],
      'spot': <Map<String, Object?>>[
        <String, Object?>{
          'coin': 'ETH',
          'total': 1200,
          'hold': 50,
          'available': 1150,
          'value': 4000000,
        },
      ],
    };
  }
  if (path.endsWith('/open-orders')) {
    return <String, Object?>{
      'orders': <Map<String, Object?>>[
        <String, Object?>{
          'orderId': 42,
          'coin': 'BTC',
          'side': 'BUY',
          'type': 'Limit',
          'price': 62000,
          'size': 50,
          'origSize': 50,
          'value': 3100000,
          'timestamp': '2026-06-09T01:02:03.000Z',
          'triggerPrice': null,
          'triggerCondition': null,
          'reduceOnly': false,
        },
      ],
    };
  }
  if (path.endsWith('/performance')) {
    return <String, Object?>{
      'summary': <String, Object?>{
        'address': '0xabc',
        'lookbackDays': 30,
        'trades': 9,
        'positions': 2,
        'totalValueUsd': 12000000,
        'longCount': 6,
        'shortCount': 3,
        'winRatePct': 66.67,
        'pnlUsd': 420000,
      },
      'byAsset': <Map<String, Object?>>[
        <String, Object?>{
          'symbol': 'BTC',
          'totalValueUsd': 9000000,
          'trades': 6,
          'longCount': 5,
          'shortCount': 1,
        },
      ],
      'trades': <Map<String, Object?>>[
        <String, Object?>{
          'address': '0xabc',
          'symbol': 'BTC',
          'side': 'LONG',
          'positionSize': 1.25,
          'positionValueUsd': 81250,
          'entryPrice': 65000,
          'liquidationPrice': 51000,
          'positionAction': '1',
          'createTime': '2026-06-09T01:02:03.000Z',
        },
      ],
    };
  }
  if (path.endsWith('/discover-tags')) {
    return <String, Object?>{
      'tag': r'$10M+ HYPERUNIT WHALE',
      'aiTags': <Map<String, Object?>>[],
    };
  }
  throw StateError('Unhandled path $path');
}

Object _emptyResponseFor(String path) {
  if (path.endsWith('/snapshot')) {
    return <String, Object?>{
      'perp': <String, Object?>{
        'accountValue': 0,
        'totalMarginUsed': 0,
        'totalPositionValue': 0,
        'withdrawable': 0,
        'marginUsagePercent': 0,
        'leverageRatio': 0,
        'unrealizedPnl': 0,
        'roi': 0,
      },
      'spot': <String, Object?>{
        'totalValue': 0,
        'balances': <Map<String, Object?>>[],
      },
      'total': <String, Object?>{
        'accountValue': 0,
        'perpPercent': 0,
        'spotPercent': 0,
      },
    };
  }
  if (path.endsWith('/positions')) {
    return <String, Object?>{
      'perp': <Map<String, Object?>>[],
      'spot': <Map<String, Object?>>[],
    };
  }
  if (path.endsWith('/open-orders')) {
    return <String, Object?>{'orders': <Map<String, Object?>>[]};
  }
  if (path.endsWith('/performance')) {
    return <String, Object?>{
      'summary': <String, Object?>{
        'address': '0xempty',
        'lookbackDays': 30,
        'trades': 0,
        'positions': 0,
        'totalValueUsd': 0,
        'longCount': 0,
        'shortCount': 0,
        'winRatePct': 0,
        'pnlUsd': 0,
      },
      'byAsset': <Map<String, Object?>>[],
      'trades': <Map<String, Object?>>[],
    };
  }
  if (path.endsWith('/discover-tags')) {
    return <String, Object?>{'tag': null, 'aiTags': <Map<String, Object?>>[]};
  }
  throw StateError('Unhandled path $path');
}
