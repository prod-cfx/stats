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
    openTime: _parseOpenTime(map['openTime'] ?? map['time']),
    open: _parseDouble(map['open']),
    high: _parseDouble(map['high']),
    low: _parseDouble(map['low']),
    close: _parseDouble(map['close']),
    volume: _parseDouble(map['volume']),
  );

  static DateTime _parseOpenTime(Object? raw) {
    if (raw is DateTime) return raw;
    if (raw is num) {
      final int value = raw.toInt();
      return DateTime.fromMillisecondsSinceEpoch(
        value > 100000000000 ? value : value * 1000,
        isUtc: true,
      );
    }
    if (raw is String && raw.isNotEmpty) {
      final int? value = int.tryParse(raw);
      if (value != null) {
        return DateTime.fromMillisecondsSinceEpoch(
          value > 100000000000 ? value : value * 1000,
          isUtc: true,
        );
      }
      return DateTime.parse(raw);
    }
    return DateTime.fromMillisecondsSinceEpoch(0, isUtc: true);
  }

  static double _parseDouble(Object? raw) {
    if (raw is num) return raw.toDouble();
    if (raw is String) return double.tryParse(raw) ?? 0;
    return 0;
  }
}
