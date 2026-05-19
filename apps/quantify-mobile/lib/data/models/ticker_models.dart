/// 品种类型：现货 / 永续合约。
///
/// 用于 #1561 行情列表「现货 / 合约」tab 的本地过滤。后端真实接入后应替换为
/// markets API 返回的 instrument type。
enum MarketKind { spot, perp }

/// 行情相关值对象。
class Ticker {
  final String symbol;
  final double price;
  final double changePercent;
  final double volume24h;
  final MarketKind kind;

  const Ticker({
    required this.symbol,
    required this.price,
    required this.changePercent,
    required this.volume24h,
    this.kind = MarketKind.spot,
  });

  Map<String, dynamic> toMap() => <String, dynamic>{
    'symbol': symbol,
    'price': price,
    'changePercent': changePercent,
    'volume24h': volume24h,
    'kind': kind.name,
  };

  factory Ticker.fromMap(Map<String, dynamic> map) => Ticker(
    symbol: (map['symbol'] as String?) ?? '',
    price: _parseDouble(map['price']),
    changePercent: _parseDouble(map['changePercent']),
    volume24h: _parseDouble(map['volume24h']),
    kind: _parseKind(map['kind']),
  );

  static double _parseDouble(Object? raw) {
    if (raw is num) return raw.toDouble();
    return 0.0;
  }

  static MarketKind _parseKind(Object? raw) {
    if (raw is String) {
      for (final MarketKind k in MarketKind.values) {
        if (k.name == raw) return k;
      }
    }
    return MarketKind.spot;
  }
}
