import '../../models/trade_models.dart';

/// 生成滚动成交记录 mock：以 `mid` 为锚，价格 ±0.05% 抖动；时间倒序 1 秒一行；
/// `side` 用 `(symbol, i)` 哈希伪随机，保证同一 symbol 多次调用稳定。
///
/// 真实 API 接入后应替换为 `GET /markets/{symbol}/trades` + WS aggTrade。
List<Trade> buildMockTrades({
  required String symbol,
  required double mid,
  int count = 36,
  DateTime? now,
}) {
  final DateTime base = now ?? DateTime.now();
  final List<Trade> out = <Trade>[];
  for (int i = 0; i < count; i++) {
    final int h = (symbol.hashCode ^ (i * 2654435761)) & 0x7fffffff;
    final double drift = ((h % 1000) / 1000 - 0.5) * 0.001; // ±0.05%
    final double qty = 0.01 + ((h >> 10) % 500) / 1000; // 0.01–0.51
    final bool isBuy = (h & 1) == 0;
    out.add(
      Trade(
        time: base.subtract(Duration(seconds: i)),
        price: mid * (1 + drift),
        qty: qty,
        isBuy: isBuy,
      ),
    );
  }
  return out;
}
