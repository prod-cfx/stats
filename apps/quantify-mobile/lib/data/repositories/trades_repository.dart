import '../models/trade_models.dart';

/// 成交记录 Repository 接口（issue #2216）。
///
/// mock 阶段按 `symbol` + `mid` 锚价生成滚动成交；真实接入（#2189）后换为
/// `GET /markets/{symbol}/trades` + WS aggTrade。
abstract class TradesRepository {
  Future<List<Trade>> listTrades({required String symbol, required double mid});
}
