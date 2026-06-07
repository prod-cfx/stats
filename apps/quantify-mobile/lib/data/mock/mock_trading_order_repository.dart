import '../mock/fixtures/account.dart';
import '../models/trading_order_models.dart';
import '../repositories/trading_order_repository.dart';

class MockTradingOrderRepository implements TradingOrderRepository {
  const MockTradingOrderRepository();

  static const double _takerFeeRate = 0.0005;
  static const double _liqK = 0.9;

  @override
  Future<TradingOrderContext> getOrderContext({required String symbol}) async {
    return TradingOrderContext(
      symbol: symbol,
      availableBalanceUsd: mockAccountInfo.availableBalanceUsd,
    );
  }

  @override
  Future<TradingOrderPreview> previewOrder(TradingOrderRequest request) async {
    final double? entry = request.price;
    final double notional = request.amount * (entry ?? 0);
    return TradingOrderPreview(
      canSubmit: request.amount > 0,
      fee: notional * _takerFeeRate,
      liquidationPrice: entry == null || request.leverage <= 0
          ? null
          : request.direction == TradingOrderDirection.buy
          ? entry * (1 - _liqK / request.leverage)
          : entry * (1 + _liqK / request.leverage),
    );
  }

  @override
  Future<TradingOrderSubmitResult> submitOrder(
    TradingOrderRequest request,
  ) async {
    return TradingOrderSubmitResult(
      orderId:
          'mock-${request.symbol}-${request.direction.key}-${request.kind.key}',
    );
  }
}
