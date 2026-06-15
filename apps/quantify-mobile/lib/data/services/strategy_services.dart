import 'api_client.dart';

/// 策略域 Service 集合（issue #2189）。stateless，只持 [ApiClient]。
/// 策略广场 path 对齐 backend/quantify OpenAPI 的 strategy-plaza 契约。

class StrategyService {
  const StrategyService(this._client);
  final ApiClient _client;

  Future<dynamic> listFeatured() => _client.get('/strategy-plaza/templates');

  Future<dynamic> listMine() => _client.get('/account/ai-quant/strategies');

  Future<dynamic> getDetail(String id) =>
      _client.get('/strategy-plaza/templates/$id');

  Future<dynamic> listMarket({
    required int page,
    required int pageSize,
    String? query,
    String? category,
  }) {
    return _client.get(
      '/strategy-plaza/templates',
      query: <String, dynamic>{
        'page': page,
        'pageSize': pageSize,
        if (query != null && query.isNotEmpty) 'q': query,
        'category': ?category,
      },
    );
  }

  Future<dynamic> getFeaturedHero() => _client.get('/strategy-plaza/templates');

  Future<dynamic> getStrategyDetail(String id) =>
      _client.get('/strategy-plaza/templates/$id');

  Future<dynamic> listStrategySignals(String id, {int limit = 20}) =>
      _client.get(
        '/strategy-plaza/templates/$id/signals',
        query: <String, dynamic>{'limit': limit},
      );

  Future<dynamic> getEquityCurve(String id, String timeframe) => _client.get(
    '/strategy-plaza/templates/$id/equity-curve',
    query: <String, dynamic>{'timeframe': timeframe},
  );
}

class LiveStrategyService {
  const LiveStrategyService(this._client);
  final ApiClient _client;

  Future<dynamic> listStrategies() => _client.get(
    '/account/ai-quant/strategies',
    query: <String, dynamic>{'excludeDraft': true},
  );

  Future<dynamic> getStrategy(String id) =>
      _client.get('/account/ai-quant/strategies/$id');

  Future<dynamic> getSummary() => _client.get('/account/ai-quant/strategies');

  Future<dynamic> performAction(String id, String action) => _client.post(
    '/account/ai-quant/strategies/$id/actions',
    body: <String, dynamic>{'action': action},
  );

  Future<void> deleteStrategy(
    String id, {
    bool deleteStoppedStrategy = false,
  }) async {
    await _client.delete(
      '/account/ai-quant/strategies/$id',
      query: <String, dynamic>{
        if (deleteStoppedStrategy) 'deleteStoppedStrategy': true,
      },
    );
  }
}
