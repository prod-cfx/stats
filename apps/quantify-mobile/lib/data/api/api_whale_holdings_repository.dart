import '../mock/fixtures/whale_holdings.dart';
import '../../domain/models/whale_holding_models.dart';
import '../repositories/whale_holdings_repository.dart';
import '../services/json_codec.dart';
import '../services/whale_services.dart';

/// [WhaleHoldingsRepository] 真实现（issue #2189）。
///
/// 走真实 HTTP 拉持仓明细。[WhaleHoldingPosition] 含大量展示串（已格式化的
/// 价值/盈亏/时间串、币种圆点色），后端不提供这些 UI 资产——空响应回退
/// [mockWhaleHoldings] 展示骨架，富字段映射属子 issue B。
class ApiWhaleHoldingsRepository implements WhaleHoldingsRepository {
  ApiWhaleHoldingsRepository(this._service);

  final WhaleHoldingsService _service;

  WhaleHoldingSide _side(Object? raw) {
    return asString(raw).toLowerCase() == 'short'
        ? WhaleHoldingSide.short
        : WhaleHoldingSide.long;
  }

  WhaleHoldingPosition _parse(Map<String, dynamic> m) {
    return WhaleHoldingPosition(
      address: asString(pick(m, <String>['address'])),
      symbol: asString(pick(m, <String>['symbol'])),
      symbolColorHex: asInt(pick(m, <String>['symbolColorHex']), fallback: 0xFF888888),
      mode: asString(pick(m, <String>['mode'])),
      side: _side(pick(m, <String>['side'])),
      leverage: asInt(pick(m, <String>['leverage'])),
      value: asDouble(pick(m, <String>['value'])),
      valueDisplay: asString(pick(m, <String>['valueDisplay'])),
      qtyDisplay: asString(pick(m, <String>['qtyDisplay'])),
      pnl: asDouble(pick(m, <String>['pnl'])),
      pnlDisplay: asString(pick(m, <String>['pnlDisplay'])),
      pnlPctDisplay: asString(pick(m, <String>['pnlPctDisplay'])),
      margin: asDouble(pick(m, <String>['margin'])),
      marginDisplay: asString(pick(m, <String>['marginDisplay'])),
      openDisplay: asString(pick(m, <String>['openDisplay'])),
      liqDisplay: asString(pick(m, <String>['liqDisplay'])),
      liqBreached: asBool(pick(m, <String>['liqBreached'])),
      hoursAgo: asInt(pick(m, <String>['hoursAgo'])),
      timeDisplay: asString(pick(m, <String>['timeDisplay'])),
    );
  }

  @override
  Future<List<WhaleHoldingPosition>> getHoldings() async {
    final dynamic raw = await _service.getHoldings();
    final Object? list =
        raw is Map ? pick(asMap(raw), <String>['items', 'data']) : raw;
    final List<Map<String, dynamic>> rows = asMapList(list ?? raw);
    if (rows.isEmpty) return mockWhaleHoldings;
    return rows.map(_parse).toList(growable: false);
  }
}
