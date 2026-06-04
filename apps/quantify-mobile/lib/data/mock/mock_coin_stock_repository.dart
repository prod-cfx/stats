import '../models/coin_stock_models.dart';
import '../repositories/coin_stock_repository.dart';
import 'fixtures/coin_stocks.dart';

class MockCoinStockRepository implements CoinStockRepository {
  const MockCoinStockRepository();

  @override
  Future<List<CoinStock>> listCoinStocks() async => kCoinStocks;
}
