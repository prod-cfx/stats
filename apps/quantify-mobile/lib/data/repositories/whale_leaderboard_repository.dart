import '../../domain/models/whale_leader_models.dart';

/// 巨鲸「发现」tab 排行榜 Repository 接口（issue #1789）。
///
/// 生产实现走 `packages/api-contracts-dart` 的鲸鱼发现契约；测试可用
/// fake/mock repository 覆盖 provider。
abstract class WhaleLeaderboardRepository {
  /// 获取巨鲸排行榜（含 top3 头像鲸与普通条目）。
  Future<List<WhaleLeaderEntry>> getLeaderboard();
}
