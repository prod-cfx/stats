import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_whale_holdings_repository.dart';
import 'package:quantify_mobile/data/api/api_whale_leaderboard_repository.dart';
import 'package:quantify_mobile/data/api/api_whale_profile_repository.dart';
import 'package:quantify_mobile/data/api/api_whale_watch_repository.dart';
import 'package:quantify_mobile/data/models/whale_profile_models.dart';
import 'package:quantify_mobile/data/services/generated_backend_api.dart';
import 'package:quantify_mobile/domain/models/whale_leader_models.dart';

GeneratedBackendApi _discoverApi(Object data, List<String> calls) {
  final Dio dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
    ..interceptors.add(
      InterceptorsWrapper(
        onRequest: (RequestOptions options, RequestInterceptorHandler handler) {
          calls.add(options.path);
          handler.resolve(
            Response<Object>(
              requestOptions: options,
              statusCode: 200,
              data: data,
            ),
          );
        },
      ),
    );
  return GeneratedBackendApi(dio: dio);
}

GeneratedBackendApi _emptyProfileApi(List<String> calls) {
  final Dio dio = Dio(BaseOptions(baseUrl: 'https://api.example.test'))
    ..interceptors.add(
      InterceptorsWrapper(
        onRequest: (RequestOptions options, RequestInterceptorHandler handler) {
          calls.add(options.path);
          handler.resolve(
            Response<Object>(
              requestOptions: options,
              statusCode: 200,
              data: _emptyProfileResponse(options.path),
            ),
          );
        },
      ),
    );
  return GeneratedBackendApi(dio: dio);
}

Object _emptyProfileResponse(String path) {
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

Map<String, Object?> _discoverTrader({
  required String variant,
  required String address,
  required String avatarColor,
  required num totalValueUsd,
  required num pnlUsd,
  required num winRatePct,
  String? handle,
  String? tag,
  num? trades,
  num? positions,
  List<Map<String, Object?>>? aiTags,
}) {
  return <String, Object?>{
    'variant': variant,
    'address': address,
    'handle': handle,
    'tag': tag,
    'totalValueUsd': totalValueUsd,
    'pnlUsd': pnlUsd,
    'pnlLabelKey': 'realizedPnl1m',
    'trades': trades,
    'positions': positions,
    'winRatePct': winRatePct,
    'winRateLabelKey': 'winRate1m',
    'avatarColor': avatarColor,
    'aiTags': aiTags,
  };
}

void main() {
  group('ApiWhale*Repository 真实空态', () {
    test('leaderboard 空 discover DTO 返回空列表，不回退 mockWhaleLeaders', () async {
      final List<String> calls = <String>[];
      final repo = ApiWhaleLeaderboardRepository(
        _discoverApi(<String, Object>{
          'recommended': <Map<String, Object>>[],
          'details': <Map<String, Object>>[],
        }, calls),
      );

      expect(await repo.getLeaderboard(), isEmpty);
      expect(calls, <String>['/whale-tracking/discover']);
    });

    test('holdings 空响应返回空列表，不回退 mockWhaleHoldings', () async {
      final List<String> calls = <String>[];
      final repo = ApiWhaleHoldingsRepository(
        _discoverApi(<String, Object>{
          'total': 0,
          'page': 1,
          'limit': 200,
          'items': <Map<String, Object>>[],
        }, calls),
      );

      expect(await repo.getHoldings(), isEmpty);
      expect(calls, <String>['/whale-holdings']);
    });

    test('watch rules 空响应返回空列表，不回退 mockWatchRules', () async {
      final List<String> calls = <String>[];
      final repo = ApiWhaleWatchRepository(
        _discoverApi(<Map<String, Object?>>[], calls),
      );

      expect(await repo.listRules(), isEmpty);
      expect(calls, <String>['/whale-notification/rules']);
    });

    test('profile 空响应返回空画像，不回退 buildFallbackWhaleProfile', () async {
      final List<String> calls = <String>[];
      final repo = ApiWhaleProfileRepository(_emptyProfileApi(calls));

      final WhaleProfile profile = await repo.getProfile('0xempty');
      expect(calls, <String>[
        '/whale-tracking/traders/0xempty/snapshot',
        '/whale-tracking/traders/0xempty/positions',
        '/whale-tracking/traders/0xempty/open-orders',
        '/whale-tracking/traders/0xempty/performance',
        '/whale-tracking/traders/0xempty/discover-tags',
      ]);
      expect(profile.address, '0xempty');
      expect(profile.tag, '未标记');
      expect(profile.holdings, isEmpty);
      expect(profile.recentActions, isEmpty);
      expect(profile.spotHoldings, isEmpty);
      expect(profile.perpHoldings, isEmpty);
      expect(profile.stats.assetPerf, isEmpty);
    });
  });

  group('ApiWhaleLeaderboardRepository discover contract mapping', () {
    test(
      'maps recommended and detail DTOs from generated WhaleTrackingApi',
      () async {
        final List<String> calls = <String>[];
        final repo = ApiWhaleLeaderboardRepository(
          _discoverApi(<String, Object?>{
            'recommended': <Map<String, Object?>>[
              _discoverTrader(
                variant: 'recommended',
                address: '0xabcdefabcdefabcdef01',
                handle: '@alpha',
                tag: r'$50M HYPERUNIT WHALE',
                avatarColor: '#60a5fa',
                totalValueUsd: 123456789,
                pnlUsd: -2500000,
                trades: 42,
                positions: 7,
                winRatePct: 73.81,
                aiTags: <Map<String, Object?>>[
                  <String, Object?>{
                    'key': 'treasuryKeeper',
                    'color': '#92400E',
                    'bgColor': '#FEF3C7',
                    'descriptionKey': 'treasuryKeeper',
                  },
                ],
              ),
            ],
            'details': <Map<String, Object?>>[
              _discoverTrader(
                variant: 'detail',
                address: '0x11112222333344445555',
                avatarColor: '#34d399',
                totalValueUsd: 9876543,
                pnlUsd: 123400,
                trades: 9,
                positions: 3,
                winRatePct: 61.5,
                aiTags: <Map<String, Object?>>[
                  <String, Object?>{
                    'key': 'bullWarGod',
                    'color': '#1E40AF',
                    'bgColor': '#DBEAFE',
                  },
                ],
              ),
            ],
          }, calls),
        );

        final List<WhaleLeaderEntry> entries = await repo.getLeaderboard();

        expect(calls, <String>['/whale-tracking/discover']);
        expect(entries, hasLength(2));
        expect(entries.first.id, '0xabcdefabcdefabcdef01');
        expect(entries.first.avatarText, 'AB');
        expect(entries.first.avatarBgHex, 0xFF60A5FA);
        expect(entries.first.tier, r'$50M HYPERUNIT WHALE');
        expect(entries.first.aumDisplay, r'$123.46M');
        expect(entries.first.pnlDisplay, r'-$2.50M');
        expect(entries.first.pnlPositive, isFalse);
        expect(entries.first.trades, 42);
        expect(entries.first.positions, 7);
        expect(entries.first.winRate, 73.81);
        expect(entries.first.tags, <String>['金库管家']);

        expect(entries.last.id, '0x11112222333344445555');
        expect(entries.last.avatarText, isNull);
        expect(entries.last.aumValue, 9876543);
        expect(entries.last.pnlDisplay, r'+$123.40K');
        expect(entries.last.pnlPositive, isTrue);
        expect(entries.last.tags, <String>['多头战神']);
      },
    );

    test(
      'unwraps backend BaseResponse envelope before mapping discover DTOs',
      () async {
        final List<String> calls = <String>[];
        final repo = ApiWhaleLeaderboardRepository(
          _discoverApi(<String, Object?>{
            'data': <String, Object?>{
              'recommended': <Map<String, Object?>>[
                _discoverTrader(
                  variant: 'recommended',
                  address: '0xabcdefabcdefabcdef01',
                  avatarColor: '#60a5fa',
                  totalValueUsd: 50000000,
                  pnlUsd: 1200000,
                  winRatePct: 80,
                ),
              ],
              'details': <Map<String, Object?>>[],
            },
            'message': 'Success',
          }, calls),
        );

        final List<WhaleLeaderEntry> entries = await repo.getLeaderboard();

        expect(calls, <String>['/whale-tracking/discover']);
        expect(entries, hasLength(1));
        expect(entries.single.id, '0xabcdefabcdefabcdef01');
        expect(entries.single.aumDisplay, r'$50.00M');
      },
    );

    test(
      'maps trader performance DTO into trade stats asset and position rows',
      () async {
        final List<String> calls = <String>[];
        final repo = ApiWhaleLeaderboardRepository(
          _discoverApi(<String, Object?>{
            'summary': <String, Object?>{
              'address': '0xperf',
              'lookbackDays': 7,
              'trades': 5,
              'positions': 2,
              'totalValueUsd': 2200000,
              'longCount': 3,
              'shortCount': 2,
              'winRatePct': 60,
              'pnlUsd': 12000,
            },
            'byAsset': <Map<String, Object?>>[
              <String, Object?>{
                'symbol': 'BTC',
                'totalValueUsd': 1500000,
                'trades': 3,
                'longCount': 2,
                'shortCount': 1,
              },
              <String, Object?>{
                'symbol': 'ETH',
                'totalValueUsd': 700000,
                'trades': 2,
                'longCount': 1,
                'shortCount': 1,
              },
            ],
            'trades': <Map<String, Object?>>[
              <String, Object?>{
                'address': '0xperf',
                'symbol': 'BTC',
                'side': 'LONG',
                'positionSize': 0.25,
                'positionValueUsd': 1500000,
                'entryPrice': 100000,
                'liquidationPrice': 80000,
                'positionAction': '1',
                'createTime': DateTime.now()
                    .toUtc()
                    .subtract(const Duration(hours: 3))
                    .toIso8601String(),
              },
            ],
          }, calls),
        );

        final WhaleTradeStats stats = await repo.getTradeStats('0xperf');

        expect(calls, <String>['/whale-tracking/traders/0xperf/performance']);
        expect(stats.pnlDisplay, r'+$12.00K');
        expect(stats.winRatePct, 60);
        expect(stats.tradesTotal, 5);
        expect(stats.wins, 3);
        expect(stats.losses, 2);
        expect(stats.longPct, 60);
        expect(stats.shortPct, 40);
        expect(stats.assetPerf, hasLength(2));
        expect(stats.assetPerf.first.symbol, 'BTC');
        expect(stats.assetPerf.first.tradeCount, 3);
        expect(stats.assetPerf.first.pnlDisplay, '1.50M');
        expect(stats.positionPerf, hasLength(1));
        expect(stats.positionPerf.first.sym, 'BTC');
        expect(stats.positionPerf.first.side, '做多');
        expect(stats.positionPerf.first.sizeDisplay, '0.2500 BTC');
      },
    );
  });
}
