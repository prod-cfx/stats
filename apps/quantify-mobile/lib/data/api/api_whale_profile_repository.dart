import '../models/whale_profile_models.dart';
import '../repositories/whale_profile_repository.dart';
import '../services/json_codec.dart';
import '../services/whale_services.dart';

/// [WhaleProfileRepository] 真实现（issue #2189）。
///
/// 走真实 HTTP 拉地址画像。后端返回空对象时展示真实空画像，不回退 mock fixture。
class ApiWhaleProfileRepository implements WhaleProfileRepository {
  ApiWhaleProfileRepository(this._service);

  final WhaleProfileService _service;

  @override
  Future<WhaleProfile> getProfile(String address) async {
    final dynamic raw = await _service.getProfile(address);
    final Map<String, dynamic> m = asMap(raw);
    return _profileFromMap(m, address);
  }

  WhaleProfile _profileFromMap(Map<String, dynamic> m, String address) {
    return WhaleProfile(
      address: asString(pick(m, <String>['address']), fallback: address),
      tag: asString(pick(m, <String>['tag']), fallback: '未标记'),
      tagTone: asString(pick(m, <String>['tagTone']), fallback: 'info'),
      assetSummary: asString(pick(m, <String>['assetSummary'])),
      holdingsValueDisplay: asString(
        pick(m, <String>['holdingsValueDisplay', 'holdingsValue']),
        fallback: '—',
      ),
      holdings: const <WhaleHoldingEntry>[],
      recentActions: const <WhaleRecentAction>[],
      stats: const WhaleTradeStats(
        pnlDisplay: '—',
        pnlTone: 'flat',
        winRatePct: 0,
        realizedDisplay: '—',
        unrealizedDisplay: '—',
        longPct: 0,
        shortPct: 0,
        assetPerf: <WhaleAssetPerf>[],
      ),
    );
  }
}
