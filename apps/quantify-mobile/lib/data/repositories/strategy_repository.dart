import '../models/strategy_models.dart';

/// 策略 Repository 接口。
abstract class StrategyRepository {
  Future<List<StrategyCard>> listFeatured();
  Future<List<StrategyCard>> listMine();
  Future<StrategyCard> getDetail(String id);

  /// 策略广场分页查询。
  ///
  /// - [page]: 1-based 页码
  /// - [pageSize]: 每页条数（默认 10）
  /// - [query]: 模糊匹配 name / author / tags（lowercase contains），null 不过滤
  /// - [category]: [StrategyCategory.all] 或 null 时不过滤分类
  Future<StrategyMarketPage> listMarket({
    int page = 1,
    int pageSize = 10,
    String? query,
    StrategyCategory? category,
  });

  /// 策略详情：卡片元信息 + 6 项收益指标 + 收益曲线占位采样点。
  ///
  /// 未命中的 id 应回退到首条 fixture（与 [getDetail] 保持一致行为）。
  Future<StrategyDetail> getStrategyDetail(String id);

  /// 近 N 条历史信号，默认 20；按时间倒序（最近在前）。
  Future<List<StrategySignal>> listStrategySignals(
    String id, {
    int limit = 20,
  });
}
