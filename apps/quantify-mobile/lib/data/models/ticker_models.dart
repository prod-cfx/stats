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
  final double? high24h;
  final double? low24h;
  final double? openInterest;
  final double? indexPrice;
  final double? markPrice;
  final double? fundingRate;
  final double? turnover24h;
  final double? netInflow24h;

  const Ticker({
    required this.symbol,
    required this.price,
    required this.changePercent,
    required this.volume24h,
    this.kind = MarketKind.spot,
    this.high24h,
    this.low24h,
    this.openInterest,
    this.indexPrice,
    this.markPrice,
    this.fundingRate,
    this.turnover24h,
    this.netInflow24h,
  });

  Map<String, dynamic> toMap() => <String, dynamic>{
    'symbol': symbol,
    'price': price,
    'changePercent': changePercent,
    'volume24h': volume24h,
    'kind': kind.name,
    'high24h': high24h,
    'low24h': low24h,
    'openInterest': openInterest,
    'indexPrice': indexPrice,
    'markPrice': markPrice,
    'fundingRate': fundingRate,
    'turnover24h': turnover24h,
    'netInflow24h': netInflow24h,
  };

  factory Ticker.fromMap(Map<String, dynamic> map) => Ticker(
    symbol: (map['symbol'] as String?) ?? '',
    price: _parseDouble(map['price']),
    changePercent: _parseDouble(map['changePercent']),
    volume24h: _parseDouble(map['volume24h']),
    kind: _parseKind(map['kind']),
    high24h: _parseNullableDouble(map['high24h']),
    low24h: _parseNullableDouble(map['low24h']),
    openInterest: _parseNullableDouble(map['openInterest']),
    indexPrice: _parseNullableDouble(map['indexPrice']),
    markPrice: _parseNullableDouble(map['markPrice']),
    fundingRate: _parseNullableDouble(map['fundingRate']),
    turnover24h: _parseNullableDouble(map['turnover24h']),
    netInflow24h: _parseNullableDouble(map['netInflow24h']),
  );

  /// 从 backend `TickerResponseDto` 的 string numeric 字段构造。
  factory Ticker.fromBackendFields({
    required String symbol,
    required String currentPrice,
    String? priceChangePercent24h,
    required String volumeUsd,
    MarketKind kind = MarketKind.spot,
    String? high24h,
    String? low24h,
    String? openInterestUsd,
    String? indexPrice,
    String? fundingRate,
  }) {
    final double price = _parseDouble(currentPrice);
    return Ticker(
      symbol: symbol,
      price: price,
      changePercent: _parseDouble(priceChangePercent24h),
      volume24h: _parseDouble(volumeUsd),
      kind: kind,
      high24h: _parseNullableDouble(high24h),
      low24h: _parseNullableDouble(low24h),
      openInterest: _parseNullableDouble(openInterestUsd),
      indexPrice: _parseNullableDouble(indexPrice),
      fundingRate: _parseNullableDouble(fundingRate),
      turnover24h: _parseNullableDouble(volumeUsd),
    );
  }

  static double _parseDouble(Object? raw) {
    if (raw is num) return raw.toDouble();
    if (raw is String) return double.tryParse(raw) ?? 0.0;
    return 0.0;
  }

  static double? _parseNullableDouble(Object? raw) {
    if (raw == null) return null;
    if (raw is num) return raw.toDouble();
    if (raw is String) return double.tryParse(raw);
    return null;
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
