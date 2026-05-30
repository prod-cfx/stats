import '../models/whale_leader_models.dart';
import '../repositories/whale_leaderboard_repository.dart';
import 'fixtures/whale_leaders.dart';

/// 巨鲸「发现」tab 排行榜 mock 实现（issue #1789）。
///
/// 返回 [mockWhaleLeaders]；真实读路径依赖 #1682，接通后整体替换。
class MockWhaleLeaderboardRepository implements WhaleLeaderboardRepository {
  @override
  Future<List<WhaleLeaderEntry>> getLeaderboard() async => mockWhaleLeaders;
}
