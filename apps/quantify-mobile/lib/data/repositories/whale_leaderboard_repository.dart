import '../../domain/models/whale_leader_models.dart';

/// 巨鲸「发现」tab 排行榜 Repository 接口（issue #1789）。
///
/// mock-first：真实读路径依赖 #1682；接通前由
/// `MockWhaleLeaderboardRepository` 驱动。
abstract class WhaleLeaderboardRepository {
  /// 获取巨鲸排行榜（含 top3 头像鲸与普通条目）。
  Future<List<WhaleLeaderEntry>> getLeaderboard();
}
