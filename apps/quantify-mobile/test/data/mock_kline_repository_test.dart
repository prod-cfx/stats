import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/mock_kline_repository.dart';
import 'package:quantify_mobile/data/models/kline_models.dart';

void main() {
  group('MockKlineRepository', () {
    test('listCandles 返回指定 limit 的种子蜡烛序列', () async {
      final MockKlineRepository repo = MockKlineRepository();
      final List<Candle> candles = await repo.listCandles(
        symbol: 'BTCUSDT',
        interval: KlineInterval.m1,
        limit: 50,
      );
      expect(candles.length, 50);
      expect(candles.first.openTime.isBefore(candles.last.openTime), isTrue);
    });

    test('listCandles 使用固定种子，两次调用结果一致', () async {
      final MockKlineRepository repo = MockKlineRepository();
      final List<Candle> a = await repo.listCandles(
          symbol: 'BTCUSDT', interval: KlineInterval.m1, limit: 5);
      final List<Candle> b = await repo.listCandles(
          symbol: 'BTCUSDT', interval: KlineInterval.m1, limit: 5);
      for (int i = 0; i < 5; i++) {
        expect(a[i].close, b[i].close);
      }
    });
  });
}
