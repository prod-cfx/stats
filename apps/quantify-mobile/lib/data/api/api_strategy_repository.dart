import '../mock/mock_strategy_repository.dart';
import '../models/strategy_models.dart';
import '../repositories/strategy_repository.dart';
import '../services/json_codec.dart';
import '../services/strategy_services.dart';

/// [StrategyCategory] <-> 后端串。
String? strategyCategoryToApi(StrategyCategory? c) {
  if (c == null || c == StrategyCategory.all) return null;
  return c.name;
}

StrategyCategory _categoryFromApi(Object? raw) {
  final String s = asString(raw);
  for (final StrategyCategory c in StrategyCategory.values) {
    if (c.name == s) return c;
  }
  return StrategyCategory.all;
}

StrategyStatusBadge? _badgeFromApi(Object? raw) {
  final String s = asString(raw);
  for (final StrategyStatusBadge b in StrategyStatusBadge.values) {
    if (b.name == s) return b;
  }
  return null;
}

/// [StrategyRepository] 真实现（issue #2189）。
///
/// 简单卡片型方法（list/detail card / market）走真实 HTTP + JSON 反序列化。
/// 深度派生型方法（[StrategyMarketItem] 的 sparkline/4 格指标、[StrategyDetail]、
/// equity curve、signals）后端完整形态契约未定，空响应回退 [MockStrategyRepository]
/// 的确定性派生展示骨架（属子 issue B 的富映射缺口）。
class ApiStrategyRepository implements StrategyRepository {
  ApiStrategyRepository(this._service) : _fallback = MockStrategyRepository();

  final StrategyService _service;
  final MockStrategyRepository _fallback;

  StrategyCard _card(Map<String, dynamic> m) {
    return StrategyCard(
      id: asString(pick(m, <String>['id'])),
      name: asString(pick(m, <String>['name'])),
      description: asString(pick(m, <String>['description'])),
      author: asString(pick(m, <String>['author'])),
      pnlPercent: asDouble(pick(m, <String>['pnlPercent', 'pnl'])),
      subscribers: asInt(pick(m, <String>['subscribers'])),
      tags: asList(pick(m, <String>['tags']))
          .map(asString)
          .toList(growable: false),
      category: _categoryFromApi(pick(m, <String>['category'])),
      status: _badgeFromApi(pick(m, <String>['status'])),
      verified: asBool(pick(m, <String>['verified'])),
      pair: asString(pick(m, <String>['pair'])),
      period: asString(pick(m, <String>['period'])),
    );
  }

  List<StrategyCard> _cards(dynamic raw) {
    final Object? list =
        raw is Map ? pick(asMap(raw), <String>['items', 'data']) : raw;
    return asMapList(list ?? raw).map(_card).toList(growable: false);
  }

  @override
  Future<List<StrategyCard>> listFeatured() async {
    final List<StrategyCard> cards = _cards(await _service.listFeatured());
    return cards.isEmpty ? _fallback.listFeatured() : cards;
  }

  @override
  Future<List<StrategyCard>> listMine() async {
    final List<StrategyCard> cards = _cards(await _service.listMine());
    return cards.isEmpty ? _fallback.listMine() : cards;
  }

  @override
  Future<StrategyCard> getDetail(String id) async {
    final Map<String, dynamic> m = asMap(await _service.getDetail(id));
    return m.isEmpty ? _fallback.getDetail(id) : _card(m);
  }

  @override
  Future<StrategyMarketPage> listMarket({
    int page = 1,
    int pageSize = 10,
    String? query,
    StrategyCategory? category,
  }) async {
    final Map<String, dynamic> m = asMap(
      await _service.listMarket(
        page: page,
        pageSize: pageSize,
        query: query,
        category: strategyCategoryToApi(category),
      ),
    );
    final List<Map<String, dynamic>> rows =
        asMapList(pick(m, <String>['items', 'data']));
    // 列表项含 sparkline/stats 派生字段，后端未提供 → 回退 mock 分页。
    if (rows.isEmpty) {
      return _fallback.listMarket(
        page: page,
        pageSize: pageSize,
        query: query,
        category: category,
      );
    }
    final bool hasMore = asBool(pick(m, <String>['hasMore']));
    final List<StrategyMarketItem> items = rows.map((Map<String, dynamic> r) {
      final StrategyCard card = _card(r);
      return StrategyMarketItem(
        card: card,
        sparkline: asList(pick(r, <String>['sparkline']))
            .map((Object? e) => asDouble(e))
            .toList(growable: false),
        stats: StrategyMarketStats(
          cagr: asDouble(pick(r, <String>['cagr']), fallback: card.pnlPercent),
          sharpe: asDouble(pick(r, <String>['sharpe'])),
          maxDrawdown: asDouble(pick(r, <String>['maxDrawdown'])),
          winRate: asDouble(pick(r, <String>['winRate'])),
          users: asInt(pick(r, <String>['users']), fallback: card.subscribers),
        ),
      );
    }).toList(growable: false);
    return StrategyMarketPage(
      items: items,
      hasMore: hasMore,
      page: page,
      pageSize: pageSize,
    );
  }

  @override
  Future<StrategyMarketItem> getFeaturedHero() async {
    // hero 含派生 sparkline/stats，后端未提供完整形态 → 走 mock 派生。
    return _fallback.getFeaturedHero();
  }

  @override
  Future<StrategyDetail> getStrategyDetail(String id) async {
    // 详情指标多为 mock 派生（profitLossRatio/tradeCount 等后端未提供）→
    // 走 mock 派生展示骨架（子 issue B 补真实映射）。
    return _fallback.getStrategyDetail(id);
  }

  @override
  Future<List<StrategySignal>> listStrategySignals(String id, {int limit = 20}) async {
    final dynamic raw = await _service.listSignals(id, limit: limit);
    final Object? list =
        raw is Map ? pick(asMap(raw), <String>['items', 'data']) : raw;
    final List<Map<String, dynamic>> rows = asMapList(list ?? raw);
    if (rows.isEmpty) return _fallback.listStrategySignals(id, limit: limit);
    return rows.map((Map<String, dynamic> m) {
      return StrategySignal(
        time: asDateTime(pick(m, <String>['time', 'timestamp'])),
        side: asString(pick(m, <String>['side'])).toLowerCase() == 'sell'
            ? StrategySignalSide.sell
            : StrategySignalSide.buy,
        price: asDouble(pick(m, <String>['price'])),
        pnlPercent: asDouble(pick(m, <String>['pnlPercent'])),
      );
    }).toList(growable: false);
  }

  @override
  Future<List<double>> getEquityCurve(String id, EquityTimeframe timeframe) async {
    final dynamic raw = await _service.getEquityCurve(id, timeframe.name);
    final Object? list =
        raw is Map ? pick(asMap(raw), <String>['points', 'data']) : raw;
    final List<double> points =
        asList(list ?? raw).map((Object? e) => asDouble(e)).toList(growable: false);
    return points.isEmpty ? _fallback.getEquityCurve(id, timeframe) : points;
  }
}
