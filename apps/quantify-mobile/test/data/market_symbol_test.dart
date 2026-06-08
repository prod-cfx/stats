import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/services/api_client.dart';
import 'package:quantify_mobile/data/services/market_services.dart';
import 'package:quantify_mobile/data/services/market_symbol.dart';

class _CaptureApiClient extends ApiClient {
  _CaptureApiClient() : super(baseUrl: 'https://api.example.test');

  String? path;
  Map<String, dynamic>? query;

  @override
  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async {
    this.path = path;
    this.query = query;
    return <String, Object?>{'data': <Object?>[]};
  }
}

void main() {
  test(
    'normalizeKlineSymbol maps base and display symbols to backend pair',
    () {
      expect(normalizeKlineSymbol('BTC'), 'BTCUSDT');
      expect(normalizeKlineSymbol('btc/usdt'), 'BTCUSDT');
      expect(normalizeKlineSymbol('BTC-USDT'), 'BTCUSDT');
      expect(normalizeKlineSymbol('ETH_USDC'), 'ETHUSDC');
      expect(normalizeKlineSymbol(''), '');
    },
  );

  test('KlineService sends normalized kline symbol', () async {
    final _CaptureApiClient client = _CaptureApiClient();

    await KlineService(
      client,
    ).listCandles(symbol: 'BTC', interval: '1m', limit: 1);

    expect(client.path, '/kline');
    expect(client.query?['symbol'], 'BTCUSDT');
  });
}
