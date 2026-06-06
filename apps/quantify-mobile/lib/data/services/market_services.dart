import 'api_client.dart';

/// 行情/市场域 Service 集合（issue #2189）。stateless，只持 [ApiClient]。
/// path 对齐 `packages/api-contracts-dart` 生成契约。

class TickerService {
  const TickerService(this._client);
  final ApiClient _client;

  Future<dynamic> listTickers() => _client.get('/markets/pairs');

  Future<dynamic> getTicker(String symbol) =>
      _client.get('/markets/ticker', query: <String, dynamic>{'symbol': symbol});
}

class KlineService {
  const KlineService(this._client);
  final ApiClient _client;

  Future<dynamic> listCandles({
    required String symbol,
    required String interval,
    required int limit,
  }) {
    return _client.get(
      '/kline',
      query: <String, dynamic>{
        'symbol': symbol,
        'interval': interval,
        'limit': limit,
      },
    );
  }
}

class OrderbookService {
  const OrderbookService(this._client);
  final ApiClient _client;

  Future<dynamic> getSnapshot(String symbol) =>
      _client.get('/orderbook/aggregated',
          query: <String, dynamic>{'symbol': symbol});
}

class LongShortService {
  const LongShortService(this._client);
  final ApiClient _client;

  Future<dynamic> getRatio({required String symbol, required String interval}) {
    return _client.get(
      '/markets/long-short-ratio',
      query: <String, dynamic>{'symbol': symbol, 'interval': interval},
    );
  }

  Future<dynamic> getSnapshot({required String symbol}) {
    return _client.get(
      '/markets/long-short-ratio/exchanges',
      query: <String, dynamic>{'symbol': symbol},
    );
  }
}
