import '../models/live_strategy_models.dart';

/// 实盘策略 Repository 接口（#1752）。
///
/// 读路径本迭代由 mock 驱动；写路径（暂停/恢复/删除）暂不暴露，
/// UI 侧入口禁用，等真实实例接口（#1679/#1682/#1683）接通后再补。
abstract class LiveStrategyRepository {
  /// 全部实盘策略（含 stopped）。
  Future<List<LiveStrategy>> listStrategies();

  /// 按 id 取单个策略；未命中回退首条（与详情页「被删除则回弹」语义解耦，
  /// 由调用方决定空态处理）。
  Future<LiveStrategy> getStrategy(String id);

  /// 列表页聚合摘要（排除 stopped）。
  Future<LiveStrategySummary> getSummary();

  /// 当前持仓；仅 running / warning 策略返回非 null。
  Future<LiveStrategyPosition?> getPosition(String id);

  /// 历史成交（默认 6 条，最近在前）。
  Future<List<LiveStrategyTrade>> listTrades(String id, {int limit = 6});

  /// 策略参数列表。
  Future<List<LiveStrategyParam>> listParams(String id);
}
