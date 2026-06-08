import 'dart:async';

import 'package:backend_api_contracts/backend_api_contracts.dart';

import '../models/trade_models.dart';
import '../repositories/trades_repository.dart';
import '../services/generated_backend_api.dart';
import '../services/json_codec.dart';
import '../services/market_symbol.dart';

/// [TradesRepository] 真实现（issue #2270）。
///
/// 经 generated [MarketsApi] 调真实 backend `/markets/trades/latest`。契约必填
/// `exchange` / `instrumentType`，本 issue 定默认 `binance` / `SPOT`（后续页面
/// 需切换交易所再参数化）。响应 `items` 为 `BuiltList<JsonObject>`，用
/// [json_codec] 防御解析；`mid` 仅 mock 用，真实路径忽略。
class ApiTradesRepository implements TradesRepository {
  ApiTradesRepository(this._api);

  static const String _defaultExchange = 'binance';
  static const String _defaultInstrumentType = 'SPOT';

  final GeneratedBackendApi _api;

  @override
  Future<List<Trade>> listTrades({
    required String symbol,
    required double mid,
  }) async {
    final Response<MarketsControllerGetLatestTrades200Response> response =
        await _api.client.getMarketsApi().marketsControllerGetLatestTrades(
          exchange: _defaultExchange,
          instrumentType: _defaultInstrumentType,
          symbol: normalizeKlineSymbol(symbol),
        );
    final List<Trade> result = <Trade>[];
    final items = response.data?.items;
    if (items == null) return result;
    for (final item in items) {
      result.add(parseTrade(asMap(item.value)));
    }
    return result;
  }

  /// 把单条成交 JSON map 解析为 [Trade]，字段名兼容常见别名。
  static Trade parseTrade(Map<String, dynamic> m) {
    return Trade(
      time: asDateTime(
        pick(m, <String>[
          'time',
          'ts',
          'timestamp',
          'tradeTimestamp',
          'tradeTime',
          'createdAt',
        ]),
      ),
      price: asDouble(pick(m, <String>['price', 'px'])),
      qty: asDouble(pick(m, <String>['size', 'qty', 'quantity', 'amount'])),
      isBuy: _isBuy(pick(m, <String>['side', 'isBuy', 'isBuyerMaker'])),
    );
  }

  static bool _isBuy(Object? raw) {
    if (raw is bool) return raw;
    if (raw is String) {
      final String s = raw.toLowerCase();
      if (s == 'buy' || s == 'b' || s == 'bid') return true;
      if (s == 'sell' || s == 's' || s == 'ask') return false;
    }
    return asBool(raw, fallback: true);
  }
}
