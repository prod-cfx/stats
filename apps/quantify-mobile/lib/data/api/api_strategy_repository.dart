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
  final String lower = s.toLowerCase();
  if (lower.contains('grid')) {
    return StrategyCategory.grid;
  }
  if (lower.contains('trend') ||
      lower.contains('ma') ||
      lower.contains('macd')) {
    return StrategyCategory.trend;
  }
  if (lower.contains('reversal') || lower.contains('rsi')) {
    return StrategyCategory.reversal;
  }
  if (lower.contains('hedge')) {
    return StrategyCategory.hedge;
  }
  if (lower.contains('arbitrage')) {
    return StrategyCategory.arbitrage;
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

/// [StrategyRepository] 真实现（issue #2189 / #2308）。
///
/// `USE_MOCK=false` 时只消费 backend/quantify OpenAPI 数据。缺失的 signals
/// 与 equity curve 保持空集合，由页面隐藏模块或显示空态，不回退 mock。
class ApiStrategyRepository implements StrategyRepository {
  ApiStrategyRepository(this._service);

  final StrategyService _service;

  Object? _data(Object? raw) {
    final Map<String, dynamic> m = asMap(raw);
    return m.containsKey('data') ? m['data'] : raw;
  }

  Map<String, dynamic> _dataMap(Object? raw) => asMap(_data(raw));

  List<Map<String, dynamic>> _dataMapList(Object? raw) => asMapList(_data(raw));

  List<double> _numbers(Object? raw) => asList(
    _data(raw),
  ).map((Object? e) => asDouble(e)).toList(growable: false);

  Map<String, dynamic> _metrics(Map<String, dynamic> m) =>
      asMap(pick(m, <String>['displayMetrics', 'stats', 'metrics']));

  StrategyMarketStats _stats(Map<String, dynamic> m, StrategyCard card) {
    final Map<String, dynamic> metrics = _metrics(m);
    final double drawdown = asDouble(
      pick(metrics, <String>['maxDrawdownPct', 'maxDrawdown']),
    );
    final double winRate = asDouble(
      pick(metrics, <String>['winRatePct', 'winRate']),
    );
    return StrategyMarketStats(
      cagr: asDouble(
        pick(metrics, <String>['returnPct', 'cagr']),
        fallback: card.pnlPercent,
      ),
      sharpe: asDouble(pick(metrics, <String>['sharpe'])),
      maxDrawdown: drawdown > 0 ? -drawdown : drawdown,
      winRate: winRate > 1 ? winRate / 100 : winRate,
      users: asInt(
        pick(metrics, <String>['users']),
        fallback: card.subscribers,
      ),
    );
  }

  List<double> _sparkline(Map<String, dynamic> m) => asList(
    pick(m, <String>['sparkline']),
  ).map((Object? e) => asDouble(e)).toList(growable: false);

  StrategyCard _card(Map<String, dynamic> m) {
    return StrategyCard(
      id: asString(pick(m, <String>['id'])),
      name: asString(pick(m, <String>['name'])),
      description: asString(pick(m, <String>['description'])),
      author: asString(pick(m, <String>['author'])),
      pnlPercent: asDouble(
        pick(m, <String>['pnlPercent', 'pnl', 'returnPct']),
        fallback: asDouble(pick(_metrics(m), <String>['returnPct'])),
      ),
      subscribers: asInt(
        pick(m, <String>['subscribers']),
        fallback: asInt(pick(_metrics(m), <String>['users'])),
      ),
      tags: asList(
        pick(m, <String>['tags']),
      ).map(asString).toList(growable: false),
      category: _categoryFromApi(
        pick(m, <String>['category']) ??
            asList(pick(m, <String>['tags'])).map(asString).join(','),
      ),
      status:
          _badgeFromApi(pick(m, <String>['status'])) ??
          (asString(pick(m, <String>['status'])) == 'live'
              ? StrategyStatusBadge.official
              : null),
      verified: asBool(pick(m, <String>['verified'])),
      pair: asString(pick(m, <String>['pair', 'symbol'])),
      period: asString(pick(m, <String>['period', 'timeframe'])),
    );
  }

  List<StrategyCard> _cards(dynamic raw) {
    final Object? list = raw is Map
        ? pick(asMap(raw), <String>['items', 'data'])
        : _data(raw);
    return asMapList(list).map(_card).toList(growable: false);
  }

  StrategyMarketItem _marketItem(Map<String, dynamic> r) {
    final StrategyCard card = _card(r);
    return StrategyMarketItem(
      card: card,
      sparkline: _sparkline(r),
      stats: _stats(r, card),
    );
  }

  StrategyDetail _detail(Map<String, dynamic> m) {
    final StrategyCard card = _card(m);
    final Map<String, dynamic> metrics = _metrics(m);
    final double returnPct = asDouble(pick(metrics, <String>['returnPct']));
    final double winRate = asDouble(
      pick(metrics, <String>['winRatePct', 'winRate']),
    );
    final double drawdown = asDouble(
      pick(metrics, <String>['maxDrawdownPct', 'maxDrawdown']),
    );
    return StrategyDetail(
      card: card,
      return7d: asDouble(
        pick(metrics, <String>['return7d']),
        fallback: returnPct,
      ),
      return30d: asDouble(
        pick(metrics, <String>['return30d']),
        fallback: returnPct,
      ),
      returnAll: asDouble(
        pick(metrics, <String>['returnAll']),
        fallback: returnPct,
      ),
      maxDrawdown: drawdown > 0 ? -drawdown : drawdown,
      sharpe: asDouble(pick(metrics, <String>['sharpe'])),
      winRate: winRate > 1 ? winRate / 100 : winRate,
      cagr: returnPct,
      profitLossRatio: asDouble(pick(metrics, <String>['profitLossRatio'])),
      tradeCount: asInt(pick(metrics, <String>['tradeCount'])),
      users: asInt(
        pick(metrics, <String>['users']),
        fallback: card.subscribers,
      ),
      equityCurve: _numbers(pick(m, <String>['equityCurve'])),
    );
  }

  StrategySignal _signal(Map<String, dynamic> m) {
    final String side = asString(pick(m, <String>['side'])).toLowerCase();
    return StrategySignal(
      time: asDateTime(pick(m, <String>['time', 'createdAt', 'ts'])),
      side: side == 'sell' ? StrategySignalSide.sell : StrategySignalSide.buy,
      price: asDouble(pick(m, <String>['price'])),
      pnlPercent: asDouble(pick(m, <String>['pnlPercent', 'pnl'])),
    );
  }

  @override
  Future<List<StrategyCard>> listFeatured() async {
    final List<StrategyCard> cards = _cards(await _service.listFeatured());
    return cards;
  }

  @override
  Future<List<StrategyCard>> listMine() async {
    final List<StrategyCard> cards = _cards(await _service.listMine());
    return cards;
  }

  @override
  Future<StrategyCard> getDetail(String id) async {
    return _card(_dataMap(await _service.getDetail(id)));
  }

  @override
  Future<StrategyMarketPage> listMarket({
    int page = 1,
    int pageSize = 10,
    String? query,
    StrategyCategory? category,
  }) async {
    final Object? raw = await _service.listMarket(
      page: page,
      pageSize: pageSize,
      query: query,
      category: strategyCategoryToApi(category),
    );
    final Map<String, dynamic> m = asMap(raw);
    final List<Map<String, dynamic>> rows = asMapList(
      m.containsKey('items') ? m['items'] : _data(raw),
    );
    final bool hasMore = asBool(pick(m, <String>['hasMore']));
    final List<StrategyMarketItem> items = rows
        .map(_marketItem)
        .toList(growable: false);
    return StrategyMarketPage(
      items: items,
      hasMore: hasMore,
      page: page,
      pageSize: pageSize,
    );
  }

  @override
  Future<StrategyMarketItem> getFeaturedHero() async {
    final List<Map<String, dynamic>> rows = _dataMapList(
      await _service.getFeaturedHero(),
    );
    return rows.isEmpty
        ? _marketItem(const <String, dynamic>{})
        : _marketItem(rows.first);
  }

  @override
  Future<StrategyDetail> getStrategyDetail(String id) async {
    return _detail(_dataMap(await _service.getStrategyDetail(id)));
  }

  @override
  Future<List<StrategySignal>> listStrategySignals(
    String id, {
    int limit = 20,
  }) async {
    return _dataMapList(
      await _service.listStrategySignals(id, limit: limit),
    ).map(_signal).toList(growable: false);
  }

  @override
  Future<List<double>> getEquityCurve(
    String id,
    EquityTimeframe timeframe,
  ) async {
    return _numbers(await _service.getEquityCurve(id, timeframe.name));
  }
}
