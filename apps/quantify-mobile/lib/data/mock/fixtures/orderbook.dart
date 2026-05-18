import '../../models/orderbook_models.dart';

/// 生成一份对称的盘口快照：以 `mid` 为中心，向两侧每档间距 `step`、数量随档位递增。
OrderbookSnapshot buildMockOrderbook({
  required String symbol,
  required double mid,
  required DateTime timestamp,
  int depth = 10,
  double step = 1.0,
}) {
  final List<OrderbookLevel> bids = <OrderbookLevel>[];
  final List<OrderbookLevel> asks = <OrderbookLevel>[];
  for (int i = 1; i <= depth; i++) {
    bids.add(OrderbookLevel(price: mid - step * i, quantity: 0.5 + i * 0.1));
    asks.add(OrderbookLevel(price: mid + step * i, quantity: 0.5 + i * 0.1));
  }
  return OrderbookSnapshot(
    symbol: symbol,
    bids: bids,
    asks: asks,
    timestamp: timestamp,
  );
}
