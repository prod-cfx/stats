import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/models/kline_models.dart';

void main() {
  test('Candle.fromMap maps backend time millis and string numeric fields', () {
    final Candle candle = Candle.fromMap(<String, dynamic>{
      'time': 1780916400000,
      'open': '63131.4',
      'high': 63547.9,
      'low': '63020',
      'close': 63467.2,
      'volume': '223600453.04',
    });

    expect(
      candle.openTime,
      DateTime.fromMillisecondsSinceEpoch(1780916400000, isUtc: true),
    );
    expect(candle.open, 63131.4);
    expect(candle.high, 63547.9);
    expect(candle.low, 63020);
    expect(candle.close, 63467.2);
    expect(candle.volume, 223600453.04);
  });
}
