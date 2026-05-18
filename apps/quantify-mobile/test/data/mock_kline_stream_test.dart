import 'dart:async';

import 'package:fake_async/fake_async.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:quantify_mobile/data/mock/mock_kline_repository.dart';
import 'package:quantify_mobile/data/models/kline_models.dart';

void main() {
  test('MockKlineRepository.watchCandles 每 1 秒推一根新蜡烛', () {
    fakeAsync((FakeAsync async) {
      final MockKlineRepository repo = MockKlineRepository();
      final List<Candle> received = <Candle>[];
      final StreamSubscription<Candle> sub = repo
          .watchCandles(symbol: 'BTCUSDT', interval: KlineInterval.m1)
          .listen(received.add);

      // 不足 1 秒：未触发任何事件
      async.elapse(const Duration(milliseconds: 500));
      expect(received, isEmpty);

      // 推进到 1s：触发第 1 根
      async.elapse(const Duration(milliseconds: 500));
      expect(received.length, 1);

      // 再 2 秒：累计 3 根，时间戳严格递增
      async.elapse(const Duration(seconds: 2));
      expect(received.length, 3);
      expect(
        received[1].openTime.isAfter(received[0].openTime),
        isTrue,
      );
      expect(
        received[2].openTime.isAfter(received[1].openTime),
        isTrue,
      );

      sub.cancel();
      // 取消订阅后 timer 应被释放
      async.elapse(const Duration(seconds: 5));
      expect(received.length, 3);
    });
  });
}
