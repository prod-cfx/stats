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
    final Map<String, dynamic> envelope = asMap(raw);
    final Map<String, dynamic> m = asMap(envelope['data']);
    if (m.isEmpty) m.addAll(envelope);
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
      holdings: _parseHoldings(m),
      recentActions: _parseRecentActions(m),
      stats: _parseStats(asMap(pick(m, <String>['stats', 'tradeStats']))),
      statCards: _parseStatCards(asMap(pick(m, <String>['statCards']))),
    );
  }

  List<WhaleHoldingEntry> _parseHoldings(Map<String, dynamic> m) {
    return asMapList(pick(m, <String>['holdings', 'holdingRows']))
        .map(
          (Map<String, dynamic> row) => WhaleHoldingEntry(
            symbol: asString(pick(row, <String>['symbol', 'sym'])),
            amountDisplay: asString(
              pick(row, <String>['amountDisplay', 'amount']),
            ),
            valueDisplay: asString(
              pick(row, <String>['valueDisplay', 'value']),
            ),
            pctDisplay: asString(pick(row, <String>['pctDisplay', 'pct'])),
            tone: asString(pick(row, <String>['tone']), fallback: 'flat'),
          ),
        )
        .toList(growable: false);
  }

  List<WhaleRecentAction> _parseRecentActions(Map<String, dynamic> m) {
    return asMapList(pick(m, <String>['recentActions', 'actions']))
        .map(
          (Map<String, dynamic> row) => WhaleRecentAction(
            action: asString(pick(row, <String>['action', 'type'])),
            detail: asString(pick(row, <String>['detail', 'description'])),
            timeDisplay: asString(pick(row, <String>['timeDisplay', 'time'])),
            tone: asString(pick(row, <String>['tone']), fallback: 'flat'),
          ),
        )
        .toList(growable: false);
  }

  WhaleTradeStats _parseStats(Map<String, dynamic> m) {
    return WhaleTradeStats(
      pnlDisplay: asString(pick(m, <String>['pnlDisplay']), fallback: '—'),
      pnlTone: asString(pick(m, <String>['pnlTone']), fallback: 'flat'),
      winRatePct: asDouble(pick(m, <String>['winRatePct', 'winRate'])),
      realizedDisplay: asString(
        pick(m, <String>['realizedDisplay', 'realizedPnlDisplay']),
        fallback: '—',
      ),
      unrealizedDisplay: asString(
        pick(m, <String>['unrealizedDisplay', 'unrealizedPnlDisplay']),
        fallback: '—',
      ),
      longPct: asInt(pick(m, <String>['longPct'])),
      shortPct: asInt(pick(m, <String>['shortPct'])),
      assetPerf: _parseAssetPerf(
        pick(m, <String>['assetPerf', 'assetPerformance']),
      ),
      closedPnlDisplay: asStringOrNull(pick(m, <String>['closedPnlDisplay'])),
      feeAdjustedPnlDisplay: asStringOrNull(
        pick(m, <String>['feeAdjustedPnlDisplay']),
      ),
      tradesTotal: asIntOrNull(pick(m, <String>['tradesTotal'])),
      wins: asIntOrNull(pick(m, <String>['wins'])),
      losses: asIntOrNull(pick(m, <String>['losses'])),
      maxDrawdownDisplay: asStringOrNull(
        pick(m, <String>['maxDrawdownDisplay', 'maxDrawdown']),
      ),
      filledOrders: asIntOrNull(pick(m, <String>['filledOrders'])),
      closedCount: asIntOrNull(pick(m, <String>['closedCount'])),
      positionPerf: _parsePositionPerf(
        pick(m, <String>['positionPerf', 'positionPerformance']),
      ),
    );
  }

  List<WhaleAssetPerf> _parseAssetPerf(Object? raw) {
    return asMapList(raw)
        .map(
          (Map<String, dynamic> row) => WhaleAssetPerf(
            symbol: asString(pick(row, <String>['symbol', 'sym'])),
            pctDisplay: asString(pick(row, <String>['pctDisplay', 'pct'])),
            tone: asString(pick(row, <String>['tone']), fallback: 'flat'),
            glyph: asStringOrNull(pick(row, <String>['glyph'])),
            colorHex: asIntOrNull(pick(row, <String>['colorHex'])),
            tradeCount: asIntOrNull(pick(row, <String>['tradeCount'])),
            positive: row.containsKey('positive')
                ? asBool(row['positive'])
                : null,
            pnlDisplay: asStringOrNull(pick(row, <String>['pnlDisplay'])),
            feeDisplay: asStringOrNull(pick(row, <String>['feeDisplay'])),
          ),
        )
        .toList(growable: false);
  }

  List<WhalePositionPerf> _parsePositionPerf(Object? raw) {
    return asMapList(raw)
        .map(
          (Map<String, dynamic> row) => WhalePositionPerf(
            sym: asString(pick(row, <String>['sym', 'symbol'])),
            label: asStringOrNull(pick(row, <String>['label'])),
            glyph: asString(pick(row, <String>['glyph'])),
            colorHex: asInt(pick(row, <String>['colorHex'])),
            side: asString(pick(row, <String>['side'])),
            timeDisplay: asString(pick(row, <String>['timeDisplay', 'time'])),
            positive: asBool(pick(row, <String>['positive'])),
            pnlDisplay: asString(pick(row, <String>['pnlDisplay'])),
            sizeDisplay: asString(pick(row, <String>['sizeDisplay', 'size'])),
            feeDisplay: asString(pick(row, <String>['feeDisplay'])),
          ),
        )
        .toList(growable: false);
  }

  WhaleProfileStatCards? _parseStatCards(Map<String, dynamic> m) {
    if (m.isEmpty) return null;
    return WhaleProfileStatCards(
      accountValueDisplay: asString(pick(m, <String>['accountValueDisplay'])),
      accountExtras: _parseStatExtras(pick(m, <String>['accountExtras'])),
      accountDonut: _parseDonut(asMap(pick(m, <String>['accountDonut']))),
      availableMarginDisplay: asString(
        pick(m, <String>['availableMarginDisplay']),
      ),
      marginExtras: _parseStatExtras(pick(m, <String>['marginExtras'])),
      marginDonut: _parseDonut(asMap(pick(m, <String>['marginDonut']))),
      positionValueDisplay: asString(pick(m, <String>['positionValueDisplay'])),
      positionExtras: _parseStatExtras(pick(m, <String>['positionExtras'])),
      positionDonut: _parseDonut(asMap(pick(m, <String>['positionDonut']))),
    );
  }

  List<WhaleStatCardExtra> _parseStatExtras(Object? raw) {
    return asMapList(raw)
        .map(
          (Map<String, dynamic> row) => WhaleStatCardExtra(
            dotHex: asInt(pick(row, <String>['dotHex'])),
            label: asString(pick(row, <String>['label'])),
            valueDisplay: asString(pick(row, <String>['valueDisplay'])),
            info: asBool(pick(row, <String>['info'])),
          ),
        )
        .toList(growable: false);
  }

  WhaleStatCardDonut _parseDonut(Map<String, dynamic> m) {
    return WhaleStatCardDonut(
      a: asDouble(pick(m, <String>['a'])),
      b: asDouble(pick(m, <String>['b'])),
      colorAHex: asInt(pick(m, <String>['colorAHex'])),
      colorBHex: asInt(pick(m, <String>['colorBHex'])),
    );
  }
}
