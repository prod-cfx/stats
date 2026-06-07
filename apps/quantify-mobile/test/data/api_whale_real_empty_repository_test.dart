import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/api/api_whale_holdings_repository.dart';
import 'package:quantify_mobile/data/api/api_whale_leaderboard_repository.dart';
import 'package:quantify_mobile/data/api/api_whale_profile_repository.dart';
import 'package:quantify_mobile/data/api/api_whale_watch_repository.dart';
import 'package:quantify_mobile/data/models/whale_profile_models.dart';
import 'package:quantify_mobile/data/services/api_client.dart';
import 'package:quantify_mobile/data/services/whale_services.dart';

class _FakeApiClient extends ApiClient {
  _FakeApiClient(this.response) : super(baseUrl: 'http://localhost');

  final dynamic response;

  @override
  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async =>
      response;
}

void main() {
  group('ApiWhale*Repository 真实空态', () {
    test('leaderboard 空响应返回空列表，不回退 mockWhaleLeaders', () async {
      final repo = ApiWhaleLeaderboardRepository(
        WhaleLeaderboardService(_FakeApiClient(<String, dynamic>{'data': []})),
      );

      expect(await repo.getLeaderboard(), isEmpty);
    });

    test('holdings 空响应返回空列表，不回退 mockWhaleHoldings', () async {
      final repo = ApiWhaleHoldingsRepository(
        WhaleHoldingsService(_FakeApiClient(<String, dynamic>{'items': []})),
      );

      expect(await repo.getHoldings(), isEmpty);
    });

    test('watch rules 空响应返回空列表，不回退 mockWatchRules', () async {
      final repo = ApiWhaleWatchRepository(
        WhaleWatchService(_FakeApiClient(<String, dynamic>{'data': []})),
      );

      expect(await repo.listRules(), isEmpty);
    });

    test('profile 空响应返回空画像，不回退 buildFallbackWhaleProfile', () async {
      final repo = ApiWhaleProfileRepository(
        WhaleProfileService(_FakeApiClient(<String, dynamic>{})),
      );

      final WhaleProfile profile = await repo.getProfile('0xempty');
      expect(profile.address, '0xempty');
      expect(profile.tag, '未标记');
      expect(profile.holdings, isEmpty);
      expect(profile.recentActions, isEmpty);
      expect(profile.spotHoldings, isEmpty);
      expect(profile.perpHoldings, isEmpty);
      expect(profile.stats.assetPerf, isEmpty);
    });
  });
}
