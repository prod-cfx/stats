import 'package:quantify_mobile/data/models/coin_stock_models.dart';
import 'package:quantify_mobile/data/repositories/coin_stock_repository.dart';
import 'fixtures/coin_stocks.dart';

class MockCoinStockRepository implements CoinStockRepository {
  const MockCoinStockRepository();

  @override
  Future<List<CoinStock>> listCoinStocks() async => kCoinStocks;
}
