import '../models/whale_watch_models.dart';

/// 巨鲸搜索与地址监控 Repository 接口（#1754）。
///
/// 真实读写路径依赖 #1682（监控数据）/ #1683（实时告警推送）；接通前由
/// `test WhaleWatchRepository` 驱动，监控规则的 CRUD 在 UI 层维护内存态。
abstract class WhaleWatchRepository {
  /// 监控规则初始列表（UI 载入一次后转为本地内存态）。
  Future<List<WatchRule>> listRules();

  /// 创建监控规则。返回后端持久化后的规则（含服务端 ID）。
  Future<WatchRule> createRule(WatchRule rule);

  /// 更新监控规则。用于编辑阈值/渠道/备注和启停状态。
  Future<WatchRule> updateRule(WatchRule rule);

  /// 删除监控规则。
  Future<void> deleteRule(WatchRule rule);

  /// 搜索地址 / 标签 / 资产 / 交易所 / 事件类型；空 query 返回空列表。
  Future<List<WhaleSearchResult>> search(String query);
}
