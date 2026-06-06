import 'api_client.dart';

/// 策略域 Service 集合（issue #2189）。stateless，只持 [ApiClient]。
/// 策略广场 path 对齐 `packages/api-contracts-dart` 生成契约。

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

  Future<dynamic> getFeaturedHero() =>
      _client.get('/strategy-plaza/templates');

  Future<dynamic> getStrategyDetail(String id) =>
      _client.get('/strategy-plaza/templates/$id');
}

class LiveStrategyService {
  const LiveStrategyService(this._client);
  final ApiClient _client;

  Future<dynamic> listStrategies() => _client.get('/account/ai-quant/strategies');

  Future<dynamic> getStrategy(String id) =>
      _client.get('/account/ai-quant/strategies/$id');

  Future<dynamic> getSummary() =>
      _client.get('/account/ai-quant/strategies');
}

class BacktestService {
  const BacktestService(this._client);
  final ApiClient _client;

  Future<dynamic> run(Map<String, dynamic> request) =>
      _client.post('/backtesting/jobs', body: request);

  Future<dynamic> getResult(String id) => _client.get('/backtesting/jobs/$id/result');
}
