import 'api_client.dart';

/// 策略域 Service 集合（issue #2189）。stateless，只持 [ApiClient]。
/// path 为占位 RESTful 约定，后端契约就绪后校正。

class StrategyService {
  const StrategyService(this._client);
  final ApiClient _client;

  Future<dynamic> listFeatured() => _client.get('/api/strategies/featured');

  Future<dynamic> listMine() => _client.get('/api/strategies/mine');

  Future<dynamic> getDetail(String id) => _client.get('/api/strategies/$id');

  Future<dynamic> listMarket({
    required int page,
    required int pageSize,
    String? query,
    String? category,
  }) {
    return _client.get(
      '/api/strategies/market',
      query: <String, dynamic>{
        'page': page,
        'pageSize': pageSize,
        if (query != null && query.isNotEmpty) 'q': query,
        'category': ?category,
      },
    );
  }

  Future<dynamic> getFeaturedHero() =>
      _client.get('/api/strategies/featured/hero');

  Future<dynamic> getStrategyDetail(String id) =>
      _client.get('/api/strategies/$id/detail');

  Future<dynamic> listSignals(String id, {required int limit}) {
    return _client.get(
      '/api/strategies/$id/signals',
      query: <String, dynamic>{'limit': limit},
    );
  }

  Future<dynamic> getEquityCurve(String id, String timeframe) {
    return _client.get(
      '/api/strategies/$id/equity',
      query: <String, dynamic>{'timeframe': timeframe},
    );
  }
}

class LiveStrategyService {
  const LiveStrategyService(this._client);
  final ApiClient _client;

  Future<dynamic> listStrategies() => _client.get('/api/live-strategies');

  Future<dynamic> getStrategy(String id) =>
      _client.get('/api/live-strategies/$id');

  Future<dynamic> getSummary() =>
      _client.get('/api/live-strategies/summary');

  Future<dynamic> getPosition(String id) =>
      _client.get('/api/live-strategies/$id/position');

  Future<dynamic> listTrades(String id, {required int limit}) {
    return _client.get(
      '/api/live-strategies/$id/trades',
      query: <String, dynamic>{'limit': limit},
    );
  }

  Future<dynamic> listParams(String id) =>
      _client.get('/api/live-strategies/$id/params');
}

class BacktestService {
  const BacktestService(this._client);
  final ApiClient _client;

  Future<dynamic> run(Map<String, dynamic> request) =>
      _client.post('/api/backtests', body: request);

  Future<dynamic> getResult(String id) => _client.get('/api/backtests/$id');
}
