import '../mock/fixtures/whale_profiles.dart';
import '../models/whale_profile_models.dart';
import '../repositories/whale_profile_repository.dart';
import '../services/json_codec.dart';
import '../services/whale_services.dart';

/// [WhaleProfileRepository] 真实现（issue #2189）。
///
/// 走真实 HTTP 拉地址画像。[WhaleProfile] 为深层嵌套的纯展示聚合（6 tab 明细、
/// 已格式化展示串、颜色 hex 等），后端不提供完整 UI 形态——以
/// [buildFallbackWhaleProfile] 作展示骨架，覆盖 JSON 中可得的顶层核心串
/// （tag / 资产摘要 / 总估值）。完整富 tab 映射属子 issue B。
class ApiWhaleProfileRepository implements WhaleProfileRepository {
  ApiWhaleProfileRepository(this._service);

  final WhaleProfileService _service;

  @override
  Future<WhaleProfile> getProfile(String address) async {
    final dynamic raw = await _service.getProfile(address);
    final Map<String, dynamic> m = asMap(raw);
    final WhaleProfile base = buildFallbackWhaleProfile(address);
    if (m.isEmpty) return base;
    return WhaleProfile(
      address: asString(pick(m, <String>['address']), fallback: base.address),
      tag: asString(pick(m, <String>['tag']), fallback: base.tag),
      tagTone: asString(pick(m, <String>['tagTone']), fallback: base.tagTone),
      assetSummary:
          asString(pick(m, <String>['assetSummary']), fallback: base.assetSummary),
      holdingsValueDisplay: asString(
        pick(m, <String>['holdingsValueDisplay']),
        fallback: base.holdingsValueDisplay,
      ),
      holdings: base.holdings,
      recentActions: base.recentActions,
      stats: base.stats,
      spotHoldings: base.spotHoldings,
      perpHoldings: base.perpHoldings,
      openOrders: base.openOrders,
      recentTrades: base.recentTrades,
      histOrders: base.histOrders,
      pnlCurve: base.pnlCurve,
      pnlTotalDisplay: base.pnlTotalDisplay,
      statCards: base.statCards,
      perpSummary: base.perpSummary,
    );
  }
}
