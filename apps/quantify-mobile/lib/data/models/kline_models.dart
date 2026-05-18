/// K 线周期枚举。
enum KlineInterval { m1, m5, m15, h1, h4, d1 }

/// 单根蜡烛。
class Candle {
  final DateTime openTime;
  final double open;
  final double high;
  final double low;
  final double close;
  final double volume;

  const Candle({
    required this.openTime,
    required this.open,
    required this.high,
    required this.low,
    required this.close,
    required this.volume,
  });

  Map<String, dynamic> toMap() => <String, dynamic>{
    'openTime': openTime.toIso8601String(),
    'open': open,
    'high': high,
    'low': low,
    'close': close,
    'volume': volume,
  };

  factory Candle.fromMap(Map<String, dynamic> map) => Candle(
    openTime: DateTime.parse(map['openTime'] as String),
    open: (map['open'] as num).toDouble(),
    high: (map['high'] as num).toDouble(),
    low: (map['low'] as num).toDouble(),
    close: (map['close'] as num).toDouble(),
    volume: (map['volume'] as num).toDouble(),
  );
}
