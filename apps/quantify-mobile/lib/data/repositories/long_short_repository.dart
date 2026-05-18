import '../models/kline_models.dart';
import '../models/long_short_models.dart';

/// 多空比 Repository 接口。
abstract class LongShortRepository {
  Future<LongShortRatio> getRatio({
    required String symbol,
    required KlineInterval interval,
  });
}
