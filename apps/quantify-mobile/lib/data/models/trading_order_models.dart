enum TradingOrderDirection { buy, sell }

enum TradingOrderKind { limit, market, conditional }

enum TradingMarginMode { cross, isolated }

class TradingOrderContext {
  const TradingOrderContext({
    required this.symbol,
    required this.availableBalanceUsd,
    this.fee,
    this.liquidationPrice,
    this.minAmount,
  });

  final String symbol;
  final double availableBalanceUsd;
  final double? fee;
  final double? liquidationPrice;
  final double? minAmount;
}

class TradingOrderPreview {
  const TradingOrderPreview({
    required this.canSubmit,
    this.fee,
    this.liquidationPrice,
    this.minAmount,
    this.reason,
  });

  final bool canSubmit;
  final double? fee;
  final double? liquidationPrice;
  final double? minAmount;
  final String? reason;
}

class TradingOrderRequest {
  const TradingOrderRequest({
    required this.symbol,
    required this.direction,
    required this.kind,
    required this.amount,
    required this.leverage,
    required this.marginMode,
    this.price,
    this.triggerPrice,
    this.takeProfit,
    this.stopLoss,
  });

  final String symbol;
  final TradingOrderDirection direction;
  final TradingOrderKind kind;
  final double? price;
  final double amount;
  final double leverage;
  final TradingMarginMode marginMode;
  final double? triggerPrice;
  final double? takeProfit;
  final double? stopLoss;

  Map<String, dynamic> toApiJson() {
    return <String, dynamic>{
      'symbol': symbol,
      'side': direction.apiValue,
      'type': kind.apiValue,
      if (price != null) 'price': price,
      'amount': amount,
      'leverage': leverage,
      'marginMode': marginMode.apiValue,
      if (triggerPrice != null) 'triggerPrice': triggerPrice,
      if (takeProfit != null) 'takeProfit': takeProfit,
      if (stopLoss != null) 'stopLoss': stopLoss,
    };
  }
}

class TradingOrderSubmitResult {
  const TradingOrderSubmitResult({this.orderId, this.requestId});

  final String? orderId;
  final String? requestId;
}

extension TradingOrderDirectionApi on TradingOrderDirection {
  String get apiValue => switch (this) {
    TradingOrderDirection.buy => 'BUY',
    TradingOrderDirection.sell => 'SELL',
  };

  String get key => switch (this) {
    TradingOrderDirection.buy => 'buy',
    TradingOrderDirection.sell => 'sell',
  };
}

extension TradingOrderKindApi on TradingOrderKind {
  String get apiValue => switch (this) {
    TradingOrderKind.limit => 'LIMIT',
    TradingOrderKind.market => 'MARKET',
    TradingOrderKind.conditional => 'CONDITIONAL',
  };

  String get key => switch (this) {
    TradingOrderKind.limit => 'limit',
    TradingOrderKind.market => 'market',
    TradingOrderKind.conditional => 'conditional',
  };
}

extension TradingMarginModeApi on TradingMarginMode {
  String get apiValue => switch (this) {
    TradingMarginMode.cross => 'CROSS',
    TradingMarginMode.isolated => 'ISOLATED',
  };
}
