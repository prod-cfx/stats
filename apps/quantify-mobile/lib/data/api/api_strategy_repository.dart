import 'package:backend_api_contracts/backend_api_contracts.dart';

import '../models/strategy_models.dart';
import '../repositories/strategy_repository.dart';
import '../services/generated_backend_api.dart';
import '../services/json_codec.dart' show asDateTime, asString;

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
/// 只消费 [packages/api-contracts-dart] 生成的 backend strategy-plaza 契约。
/// 缺失的 signals 与 equity curve 保持空集合，由页面隐藏模块或显示空态，
/// 不回退 fixture/mock。
class ApiStrategyRepository implements StrategyRepository {
  ApiStrategyRepository(this._api);

  final GeneratedBackendApi _api;

  StrategyPlazaApi get _strategyPlazaApi => _api.client.getStrategyPlazaApi();

  Future<List<StrategyPlazaTemplateResponseDto>> _listTemplates() async {
    final response = await _strategyPlazaApi.strategyPlazaProxyControllerList();
    return response.data?.data.toList(growable: false) ??
        const <StrategyPlazaTemplateResponseDto>[];
  }

  List<double> _numbers(Iterable<num>? raw) =>
      raw?.map((num e) => e.toDouble()).toList(growable: false) ??
      const <double>[];

  StrategyMarketStats _stats(StrategyPlazaTemplateResponseDto dto) {
    final StrategyPlazaDisplayMetricsResponseDto metrics = dto.displayMetrics;
    final double drawdown = metrics.maxDrawdownPct?.toDouble() ?? 0;
    final double winRate = metrics.winRatePct?.toDouble() ?? 0;
    return StrategyMarketStats(
      cagr: metrics.returnPct?.toDouble() ?? 0,
      sharpe: metrics.sharpe?.toDouble() ?? 0,
      maxDrawdown: drawdown > 0 ? -drawdown : drawdown,
      winRate: winRate > 1 ? winRate / 100 : winRate,
      users: metrics.users?.toInt() ?? 0,
    );
  }

  StrategyCard _card(StrategyPlazaTemplateResponseDto dto) {
    return StrategyCard(
      id: dto.id,
      name: dto.name,
      description: dto.description,
      author: 'Quantify 官方',
      pnlPercent: dto.displayMetrics.returnPct?.toDouble() ?? 0,
      subscribers: dto.displayMetrics.users?.toInt() ?? 0,
      tags: dto.tags.toList(growable: false),
      category: _categoryFromApi(
        dto.tags.join(',').isEmpty ? dto.name : dto.tags.join(','),
      ),
      status:
          _badgeFromApi(dto.status.name) ??
          (dto.status == StrategyPlazaTemplateResponseDtoStatusEnum.live
              ? StrategyStatusBadge.official
              : null),
      verified: dto.status == StrategyPlazaTemplateResponseDtoStatusEnum.live,
      pair: dto.symbol,
      period: dto.timeframe,
    );
  }

  StrategyMarketItem _marketItem(StrategyPlazaTemplateResponseDto dto) {
    return StrategyMarketItem(
      card: _card(dto),
      sparkline: _numbers(dto.sparkline),
      stats: _stats(dto),
    );
  }

  StrategyDetail _detail(StrategyPlazaTemplateResponseDto dto) {
    final StrategyPlazaDisplayMetricsResponseDto metrics = dto.displayMetrics;
    final double returnPct = metrics.returnPct?.toDouble() ?? 0;
    final double winRate = metrics.winRatePct?.toDouble() ?? 0;
    final double drawdown = metrics.maxDrawdownPct?.toDouble() ?? 0;
    return StrategyDetail(
      card: _card(dto),
      return7d: returnPct,
      return30d: returnPct,
      returnAll: returnPct,
      maxDrawdown: drawdown > 0 ? -drawdown : drawdown,
      sharpe: metrics.sharpe?.toDouble() ?? 0,
      winRate: winRate > 1 ? winRate / 100 : winRate,
      cagr: returnPct,
      profitLossRatio: metrics.profitLossRatio?.toDouble() ?? 0,
      tradeCount: metrics.tradeCount?.toInt() ?? 0,
      users: metrics.users?.toInt() ?? 0,
      equityCurve: _numbers(dto.equityCurve),
    );
  }

  StrategySignal _signal(StrategyPlazaSignalResponseDto dto) {
    return StrategySignal(
      time: asDateTime(dto.time),
      side: dto.side == StrategyPlazaSignalResponseDtoSideEnum.sell
          ? StrategySignalSide.sell
          : StrategySignalSide.buy,
      price: dto.price.toDouble(),
      pnlPercent: dto.pnlPercent.toDouble(),
    );
  }

  @override
  Future<List<StrategyCard>> listFeatured() async {
    final templates = await _listTemplates();
    return templates.map(_card).toList(growable: false);
  }

  @override
  Future<List<StrategyCard>> listMine() async {
    return listFeatured();
  }

  @override
  Future<StrategyCard> getDetail(String id) async {
    final response = await _strategyPlazaApi.strategyPlazaProxyControllerDetail(
      id: id,
    );
    return _card(response.data!.data);
  }

  @override
  Future<StrategyMarketPage> listMarket({
    int page = 1,
    int pageSize = 10,
    String? query,
    StrategyCategory? category,
  }) async {
    final List<StrategyPlazaTemplateResponseDto> all = await _listTemplates();
    final String q = query?.trim().toLowerCase() ?? '';
    final List<StrategyPlazaTemplateResponseDto> filtered = all
        .where((dto) {
          final StrategyCategory dtoCategory = _card(dto).category;
          final bool categoryMatched =
              category == null ||
              category == StrategyCategory.all ||
              dtoCategory == category;
          if (!categoryMatched) return false;
          if (q.isEmpty) return true;
          final String haystack = <String>[
            dto.id,
            dto.name,
            dto.description,
            dto.logicDescription,
            dto.symbol,
            dto.timeframe,
            ...dto.tags,
          ].join(' ').toLowerCase();
          return haystack.contains(q);
        })
        .toList(growable: false);
    final int start = (page - 1).clamp(0, 1 << 30) * pageSize;
    final int end = (start + pageSize).clamp(0, filtered.length);
    final List<StrategyMarketItem> items = start >= filtered.length
        ? const <StrategyMarketItem>[]
        : filtered.sublist(start, end).map(_marketItem).toList(growable: false);
    return StrategyMarketPage(
      items: items,
      hasMore: end < filtered.length,
      page: page,
      pageSize: pageSize,
    );
  }

  @override
  Future<StrategyMarketItem> getFeaturedHero() async {
    final templates = await _listTemplates();
    return templates.isEmpty
        ? _emptyMarketItem()
        : _marketItem(templates.first);
  }

  @override
  Future<StrategyDetail> getStrategyDetail(String id) async {
    final response = await _strategyPlazaApi.strategyPlazaProxyControllerDetail(
      id: id,
    );
    return _detail(response.data!.data);
  }

  @override
  Future<List<StrategySignal>> listStrategySignals(
    String id, {
    int limit = 20,
  }) async {
    final response = await _strategyPlazaApi
        .strategyPlazaProxyControllerSignals(id: id, limit: limit.toString());
    return response.data?.data.map(_signal).toList(growable: false) ??
        const <StrategySignal>[];
  }

  @override
  Future<List<double>> getEquityCurve(
    String id,
    EquityTimeframe timeframe,
  ) async {
    final response = await _strategyPlazaApi
        .strategyPlazaProxyControllerEquityCurve(
          id: id,
          timeframe: timeframe.name,
        );
    return _numbers(response.data?.data);
  }

  StrategyMarketItem _emptyMarketItem() {
    const StrategyCard card = StrategyCard(
      id: '',
      name: '',
      description: '',
      author: '',
      pnlPercent: 0,
      subscribers: 0,
      tags: <String>[],
      category: StrategyCategory.all,
      verified: false,
      pair: '',
      period: '',
    );
    return const StrategyMarketItem(
      card: card,
      sparkline: <double>[],
      stats: StrategyMarketStats(
        cagr: 0,
        sharpe: 0,
        maxDrawdown: 0,
        winRate: 0,
        users: 0,
      ),
    );
  }
}
