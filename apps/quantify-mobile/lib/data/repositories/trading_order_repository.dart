import '../models/trading_order_models.dart';

abstract class TradingOrderRepository {
  Future<TradingOrderContext> getOrderContext({required String symbol});
  Future<TradingOrderPreview> previewOrder(TradingOrderRequest request);
  Future<TradingOrderSubmitResult> submitOrder(TradingOrderRequest request);
}
