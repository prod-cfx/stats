import '../models/agg_market_data.dart';
import '../repositories/agg_orderbook_repository.dart';
import 'fixtures/agg_orders.dart';

class MockAggOrderbookRepository implements AggOrderbookRepository {
  const MockAggOrderbookRepository();

  @override
  Future<AggMarketData> getMarketData() async {
    return AggMarketData(
      exchanges: kAggExchanges,
      exchangeMap: kAggExchangeMap,
      precisions: kAggPrecisions,
      asks: kAggAsks,
      bids: kAggBids,
      oiCoins: kOiCoins,
      oiExchangeMap: kOiExchangeMap,
      oiData: kOiData,
      volCoins: kVolCoins,
      volExchangeName: kVolExchangeName,
      volColor: kVolColor,
      volData: kVolData,
      coinColor: kAggCoinColor,
    );
  }
}
