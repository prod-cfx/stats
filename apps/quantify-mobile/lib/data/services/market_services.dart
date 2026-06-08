import 'api_client.dart';
import 'market_symbol.dart';

/// 行情/市场域 Service 集合（issue #2189）。stateless，只持 [ApiClient]。
/// path 对齐 `packages/api-contracts-dart` 生成契约。

class TickerService {
  const TickerService(this._client);
  final ApiClient _client;

  Future<dynamic> listTickers() => _client.get('/markets/pairs');

  Future<dynamic> getTicker(String symbol) => _client.get(
    '/markets/ticker',
    query: <String, dynamic>{'symbol': symbol},
  );
}

class KlineService {
  const KlineService(this._client);
  final ApiClient _client;

  Future<dynamic> listCandles({
    required String symbol,
    required String interval,
    required int limit,
  }) {
    final int now = DateTime.now().millisecondsSinceEpoch ~/ 1000;
    final int span = _intervalSeconds(interval) * (limit + 1);
    return _client.get(
      '/kline',
      query: <String, dynamic>{
        'symbol': normalizeKlineSymbol(symbol),
        'interval': interval,
        'from': now - span,
        'to': now,
        'limit': limit,
      },
    );
  }

  int _intervalSeconds(String interval) {
    switch (interval) {
      case '1m':
        return 60;
      case '5m':
        return 5 * 60;
      case '15m':
        return 15 * 60;
      case '1h':
        return 60 * 60;
      case '4h':
        return 4 * 60 * 60;
      case '1d':
        return 24 * 60 * 60;
      default:
        return 60;
    }
  }
}

class OrderbookService {
  const OrderbookService(this._client);
  final ApiClient _client;

  Future<dynamic> getSnapshot(String symbol) => _client.get(
    '/orderbook/aggregated',
    query: <String, dynamic>{'symbol': symbol},
  );
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
