/// 盘口快照。
class OrderbookLevel {
  final double price;
  final double quantity;

  const OrderbookLevel({required this.price, required this.quantity});
}

class OrderbookSnapshot {
  final String symbol;
  final List<OrderbookLevel> bids;
  final List<OrderbookLevel> asks;
  final DateTime timestamp;

  const OrderbookSnapshot({
    required this.symbol,
    required this.bids,
    required this.asks,
    required this.timestamp,
  });
}
