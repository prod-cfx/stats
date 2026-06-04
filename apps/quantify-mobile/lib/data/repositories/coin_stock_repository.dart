import '../models/coin_stock_models.dart';

/// 币股 Repository 接口（issue #2216）。
abstract class CoinStockRepository {
  Future<List<CoinStock>> listCoinStocks();
}
