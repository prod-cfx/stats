import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_whale_profile_repository.dart';
import 'package:quantify_mobile/data/models/whale_profile_models.dart';
import 'package:quantify_mobile/data/services/api_client.dart';
import 'package:quantify_mobile/data/services/whale_services.dart';

class _FakeApiClient extends ApiClient {
  _FakeApiClient(this.response) : super(baseUrl: 'http://localhost');

  final Object? response;

  @override
  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async =>
      response;
}

void main() {
  group('ApiWhaleProfileRepository deep mapping', () {
    test(
      '完整响应映射 holdings / actions / stats / stat cards / performance',
      () async {
        final ApiWhaleProfileRepository repo = ApiWhaleProfileRepository(
          WhaleProfileService(
            _FakeApiClient(<String, dynamic>{
              'data': <String, dynamic>{
                'address': '0xabc',
                'tag': '聪明钱',
                'tagTone': 'accent',
                'assetSummary': 'BTC · ETH',
                'holdingsValueDisplay': r'$12.3M',
                'holdings': <Map<String, dynamic>>[
                  <String, dynamic>{
                    'symbol': 'BTC',
                    'amountDisplay': '12 BTC',
                    'valueDisplay': r'$1.2M',
                    'pctDisplay': '+8.1%',
                    'tone': 'up',
                  },
                ],
                'recentActions': <Map<String, dynamic>>[
                  <String, dynamic>{
                    'action': '买入',
                    'detail': '12 BTC · Binance',
                    'timeDisplay': '刚刚',
                    'tone': 'up',
                  },
                ],
                'stats': <String, dynamic>{
                  'pnlDisplay': r'+$8.4M',
                  'pnlTone': 'up',
                  'winRatePct': 72.34,
                  'realizedDisplay': r'+$4.1M',
                  'unrealizedDisplay': r'+$4.3M',
                  'longPct': 64,
                  'shortPct': 36,
                  'maxDrawdownDisplay': '12.4%',
                  'filledOrders': 128,
                  'closedCount': 42,
                  'assetPerf': <Map<String, dynamic>>[
                    <String, dynamic>{
                      'symbol': 'ETH',
                      'pctDisplay': '+21.2%',
                      'tone': 'up',
                      'glyph': 'E',
                      'colorHex': 0xff627eea,
                      'tradeCount': 18,
                      'positive': true,
                      'pnlDisplay': r'+$210K',
                      'feeDisplay': r'$310',
                    },
                  ],
                  'positionPerf': <Map<String, dynamic>>[
                    <String, dynamic>{
                      'sym': 'BTC',
                      'label': 'BTC-PERP',
                      'glyph': 'B',
                      'colorHex': 0xfff7931a,
                      'side': '做多',
                      'timeDisplay': '8 小时前',
                      'positive': true,
                      'pnlDisplay': r'+$82K',
                      'sizeDisplay': '2 BTC',
                      'feeDisplay': r'$90',
                    },
                  ],
                },
                'statCards': <String, dynamic>{
                  'accountValueDisplay': r'$12.3M',
                  'accountExtras': <Map<String, dynamic>>[
                    <String, dynamic>{
                      'dotHex': 0xff00ff00,
                      'label': '现货',
                      'valueDisplay': r'$7.0M',
                    },
                  ],
                  'accountDonut': <String, dynamic>{
                    'a': 0.7,
                    'b': 0.3,
                    'colorAHex': 0xff00ff00,
                    'colorBHex': 0xffff0000,
                  },
                  'availableMarginDisplay': r'$4.2M',
                  'marginExtras': <Map<String, dynamic>>[],
                  'marginDonut': <String, dynamic>{
                    'a': 0.4,
                    'b': 0.6,
                    'colorAHex': 0xff00ff00,
                    'colorBHex': 0xffff0000,
                  },
                  'positionValueDisplay': r'$5.1M',
                  'positionExtras': <Map<String, dynamic>>[],
                  'positionDonut': <String, dynamic>{
                    'a': 0.6,
                    'b': 0.4,
                    'colorAHex': 0xff00ff00,
                    'colorBHex': 0xffff0000,
                  },
                },
              },
            }),
          ),
        );

        final WhaleProfile profile = await repo.getProfile('0xabc');

        expect(profile.address, '0xabc');
        expect(profile.holdings.single.symbol, 'BTC');
        expect(profile.recentActions.single.detail, '12 BTC · Binance');
        expect(profile.stats.pnlDisplay, r'+$8.4M');
        expect(profile.stats.maxDrawdownDisplay, '12.4%');
        expect(profile.stats.filledOrders, 128);
        expect(profile.stats.closedCount, 42);
        expect(profile.stats.assetPerf.single.symbol, 'ETH');
        expect(profile.stats.positionPerf.single.label, 'BTC-PERP');
        expect(profile.statCards!.accountValueDisplay, r'$12.3M');
        expect(profile.statCards!.accountExtras.single.label, '现货');
      },
    );

    test('空响应保持真实空态，不回退 fixture', () async {
      final ApiWhaleProfileRepository repo = ApiWhaleProfileRepository(
        WhaleProfileService(_FakeApiClient(<String, dynamic>{})),
      );

      final WhaleProfile profile = await repo.getProfile('0xempty');

      expect(profile.address, '0xempty');
      expect(profile.holdings, isEmpty);
      expect(profile.recentActions, isEmpty);
      expect(profile.stats.assetPerf, isEmpty);
      expect(profile.stats.maxDrawdownDisplay, isNull);
      expect(profile.statCards, isNull);
    });
  });
}
