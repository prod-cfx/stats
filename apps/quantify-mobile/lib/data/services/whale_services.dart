import 'api_client.dart';

/// 巨鲸域 Service 集合（issue #2189）。stateless，只持 [ApiClient]。
/// path 对齐 `packages/api-contracts-dart` 生成契约。

class WhaleFeedService {
  const WhaleFeedService(this._client);
  final ApiClient _client;

  Future<dynamic> listRecent({required int limit}) {
    return _client.get(
      '/whale-alerts/realtime',
      query: <String, dynamic>{'limit': limit},
    );
  }
}

class WhaleLeaderboardService {
  const WhaleLeaderboardService(this._client);
  final ApiClient _client;

  Future<dynamic> getLeaderboard() => _client.get('/whale-tracking/discover');
}

class WhaleHoldingsService {
  const WhaleHoldingsService(this._client);
  final ApiClient _client;

  Future<dynamic> getHoldings() => _client.get('/whale-holdings');
}

class WhaleProfileService {
  const WhaleProfileService(this._client);
  final ApiClient _client;

  Future<dynamic> getProfile(String address) =>
      _client.get('/whale-tracking/traders/$address/snapshot');
}

class WhaleWatchService {
  const WhaleWatchService(this._client);
  final ApiClient _client;

  Future<dynamic> listRules() => _client.get('/whale-notification/rules');

  Future<dynamic> search(String query) => _client.get(
        '/whale-tracking/discover',
        query: <String, dynamic>{'q': query},
      );
}
