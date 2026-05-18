import 'dart:async';
import 'dart:math';

import '../models/kline_models.dart';
import '../repositories/kline_repository.dart';
import 'fixtures/candles.dart';

class MockKlineRepository implements KlineRepository {
  @override
  Future<List<Candle>> listCandles({
    required String symbol,
    required KlineInterval interval,
    required int limit,
  }) async {
    await Future<void>.delayed(const Duration(milliseconds: 200));
    return generateSeededCandles(interval: interval, count: limit);
  }

  /// 每秒推一根新蜡烛；基于「最后一根 + Random(42) 抖动」生成。
  ///
  /// 实现要点：
  /// - 使用 `Stream.periodic` 作为 timer 源，订阅取消时 `Timer` 自动释放
  /// - 通过闭包变量 `last` 维护连续性
  /// - **不接续 `listCandles` 的最后一根**：起点为 `baseline` 单根序列的末尾（行为
  ///   等价于"从 baseline 起点向后继续推一段"）。`symbol` 在 mock 阶段被忽略
  @override
  Stream<Candle> watchCandles({
    required String symbol,
    required KlineInterval interval,
  }) {
    final List<Candle> history =
        generateSeededCandles(interval: interval, count: 1);
    Candle last = history.last;
    final Random rng = Random(42);
    return Stream<Candle>.periodic(const Duration(seconds: 1), (int _) {
      last = nextSeededCandle(last: last, interval: interval, rng: rng);
      return last;
    });
  }
}
