import '../mock/fixtures/whale_leaders.dart';
import '../../domain/models/whale_leader_models.dart';
import '../repositories/whale_leaderboard_repository.dart';
import '../services/json_codec.dart';
import '../services/whale_services.dart';

/// [WhaleLeaderboardRepository] 真实现（issue #2189）。
///
/// 走真实 HTTP 拉排行榜。[WhaleLeaderEntry] 含大量纯展示串（头像色/tier 标签
/// 等），后端不提供这些 UI 资产——故空响应时回退 [mockWhaleLeaders] 展示骨架，
/// 富字段映射属子 issue B。命中 JSON 时解析核心数值 + 展示串。
class ApiWhaleLeaderboardRepository implements WhaleLeaderboardRepository {
  ApiWhaleLeaderboardRepository(this._service);

  final WhaleLeaderboardService _service;

  WhaleLeaderEntry _parse(Map<String, dynamic> m) {
    return WhaleLeaderEntry(
      id: asString(pick(m, <String>['id', 'address'])),
      aumDisplay: asString(pick(m, <String>['aumDisplay'])),
      aumValue: asDouble(pick(m, <String>['aumValue', 'aum'])),
      pnlDisplay: asString(pick(m, <String>['pnlDisplay'])),
      pnlValue: asDouble(pick(m, <String>['pnlValue', 'pnl'])),
      pnlPositive: asBool(pick(m, <String>['pnlPositive']), fallback: true),
      trades: asInt(pick(m, <String>['trades'])),
      positions: asInt(pick(m, <String>['positions'])),
      winRate: asDouble(pick(m, <String>['winRate'])),
      tags: asList(pick(m, <String>['tags']))
          .map((Object? e) => asString(e))
          .toList(growable: false),
      avatarText: asStringOrNull(pick(m, <String>['avatarText'])),
      avatarBgHex: asIntOrNull(pick(m, <String>['avatarBgHex'])),
      avatarTextHex: asIntOrNull(pick(m, <String>['avatarTextHex'])),
      tier: asStringOrNull(pick(m, <String>['tier'])),
    );
  }

  @override
  Future<List<WhaleLeaderEntry>> getLeaderboard() async {
    final dynamic raw = await _service.getLeaderboard();
    final Object? list =
        raw is Map ? pick(asMap(raw), <String>['items', 'data']) : raw;
    final List<Map<String, dynamic>> rows = asMapList(list ?? raw);
    if (rows.isEmpty) return mockWhaleLeaders;
    return rows.map(_parse).toList(growable: false);
  }
}
