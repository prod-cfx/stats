import '../../domain/models/whale_holding_models.dart';

/// 巨鲸「持仓」tab 持仓明细 Repository 接口（issue #1790）。
///
/// mock-first：真实读路径依赖 #1682；接通前由
/// `MockWhaleHoldingsRepository` 驱动。
abstract class WhaleHoldingsRepository {
  /// 获取巨鲸持仓明细列表（筛选与排序在 tab 本地态完成）。
  Future<List<WhaleHoldingPosition>> getHoldings();
}
