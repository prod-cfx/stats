/// 行情相关值对象。
class Ticker {
  final String symbol;
  final double price;
  final double changePercent;
  final double volume24h;

  const Ticker({
    required this.symbol,
    required this.price,
    required this.changePercent,
    required this.volume24h,
  });

  Map<String, dynamic> toMap() => <String, dynamic>{
    'symbol': symbol,
    'price': price,
    'changePercent': changePercent,
    'volume24h': volume24h,
  };

  factory Ticker.fromMap(Map<String, dynamic> map) => Ticker(
    symbol: map['symbol'] as String,
    price: (map['price'] as num).toDouble(),
    changePercent: (map['changePercent'] as num).toDouble(),
    volume24h: (map['volume24h'] as num).toDouble(),
  );
}
