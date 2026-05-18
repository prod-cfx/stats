import '../models/orderbook_models.dart';

/// 盘口 Repository 接口。
abstract class OrderbookRepository {
  Future<OrderbookSnapshot> getSnapshot(String symbol);
  Stream<OrderbookSnapshot> watchOrderbook(String symbol);
}
