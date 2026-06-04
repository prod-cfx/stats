import 'api_client.dart';

/// 巨鲸域 Service 集合（issue #2189）。stateless，只持 [ApiClient]。
/// path 为占位 RESTful 约定，后端契约就绪后校正。

class WhaleFeedService {
  const WhaleFeedService(this._client);
  final ApiClient _client;

  Future<dynamic> listRecent({required int limit}) {
    return _client.get(
      '/api/whales/feed',
      query: <String, dynamic>{'limit': limit},
    );
  }
}

class WhaleLeaderboardService {
  const WhaleLeaderboardService(this._client);
  final ApiClient _client;

  Future<dynamic> getLeaderboard() => _client.get('/api/whales/leaderboard');
}

class WhaleHoldingsService {
  const WhaleHoldingsService(this._client);
  final ApiClient _client;

  Future<dynamic> getHoldings() => _client.get('/api/whales/holdings');
}

class WhaleProfileService {
  const WhaleProfileService(this._client);
  final ApiClient _client;

  Future<dynamic> getProfile(String address) =>
      _client.get('/api/whales/profiles/$address');
}

class WhaleWatchService {
  const WhaleWatchService(this._client);
  final ApiClient _client;

  Future<dynamic> listRules() => _client.get('/api/whales/watch/rules');

  Future<dynamic> search(String query) => _client.get(
        '/api/whales/watch/search',
        query: <String, dynamic>{'q': query},
      );
}
