import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:built_value/json_object.dart';
import 'package:built_value/serializer.dart';
import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_agg_orderbook_repository.dart';
import 'package:quantify_mobile/data/models/agg_market_data.dart';
import 'package:quantify_mobile/data/repositories/agg_orderbook_repository.dart';
import 'package:quantify_mobile/data/services/generated_backend_api.dart';

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

Map<String, Object?> _dtoJson(String base, String type) => <String, Object?>{
  'marketKey': '$base-$type',
  'base': base,
  'type': type,
  'midPrice': 100,
  'updatedAt': 0,
  'asks': <Object?>[
    <String, Object?>{
      'price': 101,
      'sizeTotal': 2,
      'details': <Object?>[
        <String, Object?>{'venueId': 'binance', 'size': 2},
      ],
    },
  ],
  'bids': <Object?>[
    <String, Object?>{
      'price': 99,
      'sizeTotal': 3,
      'details': <Object?>[
        <String, Object?>{'venueId': 'okx', 'size': 3},
      ],
    },
  ],
  'venues': <Object?>['binance', 'okx'],
  'mergedQuotes': <Object?>[],
};

OiAggregateSnapshotDto _oiDto() {
  return OiAggregateSnapshotDto((b) {
    b
      ..symbol = 'BTC'
      ..dataTimestamp = '2026-06-09T00:00:00.000Z';
    b.total
      ..qty = 10
      ..usd = 1000
      ..h24 = 1.5;
    b.rows.replace(<OiAggregateRowDto>[
      OiAggregateRowDto(
        (r) => r
          ..exchange = 'Binance'
          ..qty = 6
          ..usd = 600
          ..pct = 60
          ..h1 = 0.1
          ..h4 = 0.4
          ..h24 = 2
          ..oiVol = 600,
      ),
      OiAggregateRowDto(
        (r) => r
          ..exchange = 'CME'
          ..qty = 3
          ..usd = 300
          ..pct = 30
          ..h1 = 0.2
          ..h4 = 0.5
          ..h24 = 3
          ..oiVol = 300,
      ),
      OiAggregateRowDto(
        (r) => r
          ..exchange = 'dYdX'
          ..qty = 1
          ..usd = 100
          ..pct = 10
          ..h1 = 0.3
          ..h4 = 0.6
          ..h24 = 4
          ..oiVol = 100,
      ),
    ]);
  });
}

AggregatedVolumeSnapshotResponseDto _volDto() {
  return AggregatedVolumeSnapshotResponseDto((b) {
    b
      ..symbol = 'BTC'
      ..total = 1000;
    b.rows.replace(<AggregatedVolumeRowDto>[
      AggregatedVolumeRowDto(
        (r) => r
          ..exchange = 'okx'
          ..value = 400,
      ),
    ]);
  });
}

void main() {
  group('AggMarketRequest', () {
    test('normalizes base and type', () {
      const AggMarketRequest request = AggMarketRequest(
        base: ' btc ',
        type: 'PERP',
      );

      expect(request.normalizedBase, 'BTC');
      expect(request.normalizedType, 'perp');
    });

    test('defaults to BTC perp', () {
      const AggMarketRequest request = AggMarketRequest.defaultMarket();

      expect(request.normalizedBase, 'BTC');
      expect(request.normalizedType, 'perp');
    });
  });

  group('ApiAggOrderbookRepository.buildMarketData', () {
    test('maps asks/bids levels with venue source', () {
      final AggMarketData d = ApiAggOrderbookRepository.buildMarketData(_dto());
      expect(d.asks.single.price, 101);
      expect(d.asks.single.qty, 2);
      expect(d.asks.single.exchange, 'binance');
      expect(d.bids.single.price, 99);
      expect(d.bids.single.exchange, 'okx');
    });

    test('normalizes backend perp venue ids to configured venue keys', () {
      final AggBookLevel l = ApiAggOrderbookRepository.mapLevel(
        _level(101, 2, <VenueDetailDto>[_venue('binance-perp', 2)]),
      );
      expect(l.exchange, 'binance');
    });

    test('venues → exchanges + exchangeMap', () {
      final AggMarketData d = ApiAggOrderbookRepository.buildMarketData(_dto());
      expect(d.exchanges.map((AggExchange e) => e.key), <String>[
        'binance',
        'okx',
      ]);
      expect(d.exchangeMap['binance']!.letter, 'B');
      expect(d.exchangeMap['binance']!.logoUrl, contains('/binance.png'));
      expect(d.exchangeMap['okx']!.logoUrl, contains('/okx.png'));
    });

    test('maps oi and volume snapshots into shared market data', () {
      final OiSnapshot oi = ApiAggOrderbookRepository.mapOiSnapshot(_oiDto());
      final VolSnapshot vol = ApiAggOrderbookRepository.mapVolSnapshot(
        _volDto(),
      );
      final AggMarketData d = ApiAggOrderbookRepository.buildMarketData(
        _dto(),
        oiData: <String, OiSnapshot>{'BTC': oi, 'LINK': oi, 'AVAX': oi},
        volData: <String, VolSnapshot>{'BTC': vol, 'LINK': vol, 'AVAX': vol},
      );

      expect(d.oiCoins, <String>['BTC', 'LINK', 'AVAX']);
      expect(d.oiData['BTC']!.total.usd, 1000);
      expect(d.oiData['BTC']!.rows.first.exchange, 'Binance');
      expect(d.oiExchangeMap['Binance']!.letter, 'B');
      expect(d.oiExchangeMap['Binance']!.logoUrl, contains('/binance.png'));
      expect(d.oiExchangeMap['CME']!.logoUrl, contains('/cme.png'));
      expect(d.oiExchangeMap['dYdX']!.logoUrl, contains('dydx'));
      expect(d.volCoins, <String>['BTC', 'LINK', 'AVAX']);
      expect(d.volData['BTC']!.total, 1000);
      expect(d.volData['BTC']!.rows.single.exchange, 'okx');
      expect(d.volExchangeName['okx'], 'okx');
      expect(d.volColor['okx'], isNotNull);
      expect(d.coinColor['BTC'], isNotNull);
      expect(d.precisions, <int>[1, 10, 100]);
    });

    test('orders metric coins by request candidate order', () {
      final OiSnapshot oi = ApiAggOrderbookRepository.mapOiSnapshot(_oiDto());
      final VolSnapshot vol = ApiAggOrderbookRepository.mapVolSnapshot(
        _volDto(),
      );
      final AggMarketData d = ApiAggOrderbookRepository.buildMarketData(
        _dto(),
        oiData: <String, OiSnapshot>{'BTC': oi, 'ETH': oi},
        volData: <String, VolSnapshot>{'BTC': vol, 'ETH': vol},
        metricCoins: <String>['ETH', 'BTC'],
      );

      expect(d.oiCoins, <String>['ETH', 'BTC']);
      expect(d.volCoins, <String>['ETH', 'BTC']);
    });

    test(
      'deserializes aggregate oi envelope data from contract JsonObject',
      () {
        final OpenInterestControllerGetAggregateSnapshot200Response response =
            OpenInterestControllerGetAggregateSnapshot200Response(
              (b) => b
                ..data = JsonObject(<String, Object?>{
                  'symbol': 'BTC',
                  'dataTimestamp': '2026-06-09T00:00:00.000Z',
                  'total': <String, Object?>{
                    'qty': 10,
                    'usd': 1000,
                    'h24': 1.5,
                  },
                  'rows': <Object?>[
                    <String, Object?>{
                      'exchange': 'Binance',
                      'qty': 6,
                      'usd': 600,
                      'pct': 60,
                      'h1': 0.1,
                      'h4': 0.4,
                      'h24': 2,
                      'oiVol': 600,
                    },
                  ],
                })
                ..message = 'Success',
            );

        final OiAggregateSnapshotDto dto =
            standardSerializers.deserialize(
                  response.data.value,
                  specifiedType: const FullType(OiAggregateSnapshotDto),
                )
                as OiAggregateSnapshotDto;

        expect(dto.symbol, 'BTC');
        expect(dto.rows.single.exchange, 'Binance');
        expect(ApiAggOrderbookRepository.mapOiSnapshot(dto).total.usd, 1000);
      },
    );

    test('deserializes aggregate volume envelope data into contract dto', () {
      final AggregatedVolumeSnapshotResponseDto dto =
          ApiAggOrderbookRepository.decodeVolumeSnapshot(<String, Object?>{
                'data': <String, Object?>{
                  'symbol': 'BTC',
                  'total': 1000,
                  'rows': <Object?>[
                    <String, Object?>{'exchange': 'Binance', 'value': 600},
                  ],
                },
                'message': 'Success',
              }, serializers: standardSerializers)
              as AggregatedVolumeSnapshotResponseDto;

      expect(dto.symbol, 'BTC');
      expect(dto.rows.single.exchange, 'Binance');
      expect(ApiAggOrderbookRepository.mapVolSnapshot(dto).total, 1000);
    });

    test('mapLevel falls back to AGG when no venue details', () {
      final AggBookLevel l = ApiAggOrderbookRepository.mapLevel(
        _level(50, 1, <VenueDetailDto>[]),
      );
      expect(l.exchange, 'AGG');
    });
  });

  group('ApiAggOrderbookRepository.getMarketData', () {
    test('passes base and type into generated orderbook API', () async {
      final List<Uri> calls = <Uri>[];
      final Dio dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
        ..interceptors.add(
          InterceptorsWrapper(
            onRequest: (RequestOptions options, RequestInterceptorHandler h) {
              calls.add(options.uri);
              if (options.path == '/orderbook/aggregated') {
                h.resolve(
                  Response<Object?>(
                    requestOptions: options,
                    statusCode: 200,
                    data: <String, Object?>{
                      'data': _dtoJson('ETH', 'spot'),
                      'message': 'Success',
                    },
                  ),
                );
                return;
              }
              if (options.path.startsWith('/open-interest/aggregate/')) {
                h.resolve(
                  Response<Object?>(
                    requestOptions: options,
                    statusCode: 404,
                    data: <String, Object?>{'code': 'OPEN_INTEREST_NOT_FOUND'},
                  ),
                );
                return;
              }
              if (options.path.startsWith('/markets/volume/snapshot/')) {
                h.resolve(
                  Response<Object?>(
                    requestOptions: options,
                    statusCode: 200,
                    data: <String, Object?>{
                      'symbol': 'ETH',
                      'total': 0,
                      'rows': <Object?>[],
                    },
                  ),
                );
                return;
              }
              h.next(options);
            },
          ),
        );
      final ApiAggOrderbookRepository repo = ApiAggOrderbookRepository(
        GeneratedBackendApi(dio: dio),
      );

      final AggMarketData data = await repo.getMarketData(
        request: const AggMarketRequest(base: 'ETH', type: 'spot'),
      );

      final Uri orderbookCall = calls.singleWhere(
        (Uri uri) => uri.path == '/orderbook/aggregated',
      );
      expect(orderbookCall.queryParameters['base'], 'ETH');
      expect(orderbookCall.queryParameters['type'], 'spot');
      expect(data.asks, isNotEmpty);
    });

    test('uses generated MarketsApi volume snapshot path', () async {
      final List<String> paths = <String>[];
      final Dio dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
        ..interceptors.add(
          InterceptorsWrapper(
            onRequest: (RequestOptions options, RequestInterceptorHandler h) {
              paths.add(options.path);
              if (options.path == '/orderbook/aggregated') {
                h.resolve(
                  Response<Object?>(
                    requestOptions: options,
                    statusCode: 200,
                    data: <String, Object?>{
                      'data': _dtoJson('BTC', 'perp'),
                      'message': 'Success',
                    },
                  ),
                );
                return;
              }
              if (options.path.startsWith('/open-interest/aggregate/')) {
                h.resolve(
                  Response<Object?>(
                    requestOptions: options,
                    statusCode: 404,
                    data: <String, Object?>{'code': 'OPEN_INTEREST_NOT_FOUND'},
                  ),
                );
                return;
              }
              if (options.path == '/markets/volume/snapshot/BTC') {
                h.resolve(
                  Response<Object?>(
                    requestOptions: options,
                    statusCode: 200,
                    data: <String, Object?>{
                      'symbol': 'BTC',
                      'total': 1000,
                      'rows': <Object?>[],
                    },
                  ),
                );
                return;
              }
              if (options.path.startsWith('/markets/volume/snapshot/')) {
                h.resolve(
                  Response<Object?>(
                    requestOptions: options,
                    statusCode: 404,
                    data: <String, Object?>{'code': 'VOLUME_NOT_FOUND'},
                  ),
                );
                return;
              }
              h.next(options);
            },
          ),
        );
      final ApiAggOrderbookRepository repo = ApiAggOrderbookRepository(
        GeneratedBackendApi(dio: dio),
      );

      await repo.getMarketData(request: const AggMarketRequest.defaultMarket());

      expect(paths, contains('/markets/volume/snapshot/BTC'));
    });

    test(
      'unwraps runtime envelope from generated MarketsApi volume response',
      () async {
        final Dio dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
          ..interceptors.add(
            InterceptorsWrapper(
              onRequest: (RequestOptions options, RequestInterceptorHandler h) {
                if (options.path == '/orderbook/aggregated') {
                  h.resolve(
                    Response<Object?>(
                      requestOptions: options,
                      statusCode: 200,
                      data: <String, Object?>{
                        'data': _dtoJson('BTC', 'perp'),
                        'message': 'Success',
                      },
                    ),
                  );
                  return;
                }
                if (options.path.startsWith('/open-interest/aggregate/')) {
                  h.resolve(
                    Response<Object?>(
                      requestOptions: options,
                      statusCode: 404,
                      data: <String, Object?>{
                        'code': 'OPEN_INTEREST_NOT_FOUND',
                      },
                    ),
                  );
                  return;
                }
                if (options.path == '/markets/volume/snapshot/BTC') {
                  h.resolve(
                    Response<Object?>(
                      requestOptions: options,
                      statusCode: 200,
                      data: <String, Object?>{
                        'data': <String, Object?>{
                          'symbol': 'BTC',
                          'total': 1000,
                          'rows': <Object?>[
                            <String, Object?>{
                              'exchange': 'Binance',
                              'value': 600,
                            },
                          ],
                        },
                        'message': 'Success',
                      },
                    ),
                  );
                  return;
                }
                if (options.path.startsWith('/markets/volume/snapshot/')) {
                  h.resolve(
                    Response<Object?>(
                      requestOptions: options,
                      statusCode: 404,
                      data: <String, Object?>{'code': 'VOLUME_NOT_FOUND'},
                    ),
                  );
                  return;
                }
                h.next(options);
              },
            ),
          );
        final ApiAggOrderbookRepository repo = ApiAggOrderbookRepository(
          GeneratedBackendApi(dio: dio),
        );

        final AggMarketData data = await repo.getMarketData(
          request: const AggMarketRequest.defaultMarket(),
        );

        expect(data.volData['BTC']!.total, 1000);
        expect(data.volData['BTC']!.rows.single.exchange, 'Binance');
      },
    );
  });
}
