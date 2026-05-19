import '../models/exchange_long_short_models.dart';
import '../models/kline_models.dart';
import '../models/long_short_models.dart';

/// 多空比 Repository 接口。
abstract class LongShortRepository {
  Future<LongShortRatio> getRatio({
    required String symbol,
    required KlineInterval interval,
  });

  /// 返回多空比页 hero 卡 + 6 家交易所分布的整体快照。
  Future<MarketLongShortSnapshot> getSnapshot({required String symbol});
}
