import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/ticker_models.dart';

void main() {
  test('generated ticker fields map to mobile Ticker fields', () {
    final Ticker ticker = Ticker.fromBackendFields(
      symbol: 'BTC',
      currentPrice: '87010.5',
      priceChangePercent24h: '-0.45',
      volumeUsd: '1234567890.12',
    );

    expect(ticker.symbol, 'BTC');
    expect(ticker.price, 87010.5);
    expect(ticker.changePercent, -0.45);
    expect(ticker.volume24h, 1234567890.12);
  });
}
