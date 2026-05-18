import 'dart:math';

import '../../models/kline_models.dart';

/// 蜡烛基线起点：与 `mockTickers` 的 BTCUSDT 价格对齐，保持视觉一致性。
const double kCandleBaselinePrice = 68250.42;

/// 周期对应的毫秒长度。
const Map<KlineInterval, int> kIntervalMs = <KlineInterval, int>{
  KlineInterval.m1: 60 * 1000,
  KlineInterval.m5: 5 * 60 * 1000,
  KlineInterval.m15: 15 * 60 * 1000,
  KlineInterval.h1: 60 * 60 * 1000,
  KlineInterval.h4: 4 * 60 * 60 * 1000,
  KlineInterval.d1: 24 * 60 * 60 * 1000,
};

/// 用种子 `Random` 从 `baseline` 起点生成 `count` 根历史蜡烛。
///
/// 蜡烛按 `interval` 时长向前排列，最后一根的 `openTime` 为 `now`。
/// 价格走势为简单随机游走（每根 ±0.6%），高低点在 open/close 之外再扩 0.3%。
List<Candle> generateSeededCandles({
  required KlineInterval interval,
  required int count,
  double baseline = kCandleBaselinePrice,
  int seed = 42,
  DateTime? now,
}) {
  assert(count > 0, 'generateSeededCandles 需要 count > 0');
  final Random rng = Random(seed);
  final int stepMs = kIntervalMs[interval]!;
  final DateTime endTime = now ?? DateTime.fromMillisecondsSinceEpoch(1_716_000_000_000);
  final List<Candle> candles = <Candle>[];
  double price = baseline;
  // 先从最早一根走到最新一根，保证最后一根贴近 baseline 视觉锚点。
  // 这里从 baseline 反推到最早起点：先生成正向序列再返回。
  final DateTime startTime =
      endTime.subtract(Duration(milliseconds: stepMs * (count - 1)));
  for (int i = 0; i < count; i++) {
    final double open = price;
    final double drift = (rng.nextDouble() - 0.5) * 0.012; // ±0.6%
    final double close = open * (1 + drift);
    final double spread = open * 0.003;
    final double high = (open > close ? open : close) + spread;
    final double low = (open < close ? open : close) - spread;
    final double volume = 50 + rng.nextDouble() * 100;
    candles.add(Candle(
      openTime: startTime.add(Duration(milliseconds: stepMs * i)),
      open: open,
      high: high,
      low: low,
      close: close,
      volume: volume,
    ));
    price = close;
  }
  return candles;
}

/// 基于「最后一根 + Random 抖动」生成下一根蜡烛，供 Stream 推流使用。
Candle nextSeededCandle({
  required Candle last,
  required KlineInterval interval,
  required Random rng,
}) {
  final int stepMs = kIntervalMs[interval]!;
  final double open = last.close;
  final double drift = (rng.nextDouble() - 0.5) * 0.012;
  final double close = open * (1 + drift);
  final double spread = open * 0.003;
  final double high = (open > close ? open : close) + spread;
  final double low = (open < close ? open : close) - spread;
  final double volume = 50 + rng.nextDouble() * 100;
  return Candle(
    openTime: last.openTime.add(Duration(milliseconds: stepMs)),
    open: open,
    high: high,
    low: low,
    close: close,
    volume: volume,
  );
}
