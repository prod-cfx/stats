import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:built_collection/built_collection.dart';

import '../models/strategy_models.dart';
import '../repositories/strategy_repository.dart';
import '../services/generated_backend_api.dart';
import '../services/json_codec.dart' show asDateTime, asString;

StrategyCategory _categoryFromText(Object? raw) {
  final String s = asString(raw).toLowerCase();
  bool hasChinese(String value) => s.contains(value);
  bool has(String value) => s.contains(value.toLowerCase());
  for (final StrategyCategory c in StrategyCategory.values) {
    if (c.name == s) return c;
  }
  if (has('grid') || hasChinese('网格') || has('dca')) {
    return StrategyCategory.grid;
  }
  if (has('trend') || hasChinese('趋势') || has('ema') || has('macd')) {
    return StrategyCategory.trend;
  }
  if (has('reversal') || hasChinese('反转') || has('rsi')) {
    return StrategyCategory.reversal;
  }
  if (has('hedge') || hasChinese('对冲') || hasChinese('风控')) {
    return StrategyCategory.hedge;
  }
  if (has('arbitrage') || hasChinese('套利')) {
    return StrategyCategory.arbitrage;
  }
  if (hasChinese('突破') || hasChinese('盘口') || hasChinese('衍生品事件')) {
    return StrategyCategory.highFreq;
  }
  return StrategyCategory.all;
}

StrategyCategory _categoryFromApi(StrategyPlazaTemplateResponseDto dto) {
  final String haystack = <String>[
    dto.name,
    dto.scenario,
    ...dto.tags,
  ].join(' ');
  return _categoryFromText(haystack);
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
  ApiStrategyRepository(this._api, {String Function()? tokenSupplier})
    : _tokenSupplier = tokenSupplier;

  final GeneratedBackendApi _api;
  final String Function()? _tokenSupplier;

  StrategyPlazaApi get _strategyPlazaApi => _api.client.getStrategyPlazaApi();

  Future<List<StrategyPlazaTemplateResponseDto>> _listTemplates() async {
    final response = await _strategyPlazaApi.strategyPlazaProxyControllerList();
    return response.data?.data.toList(growable: false) ??
        const <StrategyPlazaTemplateResponseDto>[];
  }

  List<double> _numbers(Iterable<num>? raw) =>
      raw?.map((num e) => e.toDouble()).toList(growable: false) ??
      const <double>[];

  List<double> _officialEquity(StrategyPlazaTemplateResponseDto dto) {
    final List<double> official = dto.officialBacktest.equityCurve
        .map((StrategyPlazaOfficialBacktestEquityPointResponseDto p) {
          return p.equity.toDouble();
        })
        .toList(growable: false);
    if (official.isNotEmpty) return official;
    return _numbers(dto.equityCurve);
  }

  List<double> _templateSparkline(StrategyPlazaTemplateResponseDto dto) {
    final List<double> sparkline = _numbers(dto.sparkline);
    if (sparkline.isNotEmpty) return sparkline;
    final List<double> equityCurve = _numbers(dto.equityCurve);
    if (equityCurve.isNotEmpty) return equityCurve;
    return _officialEquity(dto);
  }

  Map<String, double> _params(StrategyPlazaTemplateResponseDto dto) {
    final BuiltMap<String, num>? raw = dto.params;
    if (raw == null || raw.isEmpty) return const <String, double>{};
    return Map<String, double>.fromEntries(
      raw.entries.map(
        (MapEntry<String, num> e) =>
            MapEntry<String, double>(e.key, e.value.toDouble()),
      ),
    );
  }

  String _marketType(StrategyPlazaTemplateResponseDto dto) {
    return dto.marketType == StrategyPlazaTemplateResponseDtoMarketTypeEnum.perp
        ? 'perp'
        : 'spot';
  }

  String _dataSourceLabel(StrategyPlazaTemplateResponseDto dto) {
    final String exchange = dto.exchange.name.toUpperCase();
    final String market = _marketType(dto) == 'perp' ? 'swap' : 'spot';
    return '$exchange $market';
  }

  String _authorization() {
    final String token = _tokenSupplier?.call().trim() ?? '';
    if (token.isEmpty) {
      throw StateError('strategy plaza action requires login');
    }
    return token.startsWith('Bearer ') ? token : 'Bearer $token';
  }

  String _newRunRequestId() {
    final int micros = DateTime.now().microsecondsSinceEpoch;
    return 'plaza-run-mobile-$micros';
  }

  StrategyMarketStats _stats(StrategyPlazaTemplateResponseDto dto) {
    final StrategyPlazaDisplayMetricsResponseDto metrics = dto.displayMetrics;
    final StrategyPlazaOfficialBacktestMetricsResponseDto officialMetrics =
        dto.officialBacktest.metrics;
    final double drawdown = metrics.maxDrawdownPct?.toDouble() ?? 0;
    final double winRate = metrics.winRatePct?.toDouble() ?? 0;
    return StrategyMarketStats(
      cagr: metrics.returnPct?.toDouble() ?? 0,
      sharpe: metrics.sharpe?.toDouble() ?? 0,
      tradeCount:
          officialMetrics.tradeCount?.toInt() ?? metrics.tradeCount?.toInt(),
      maxDrawdown: drawdown > 0 ? -drawdown : drawdown,
      winRate: winRate > 1 ? winRate / 100 : winRate,
      users: metrics.users?.toInt() ?? 0,
      confidenceLevel: dto.officialBacktest.confidence.level.name,
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
      category: _categoryFromApi(dto),
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
      sparkline: _templateSparkline(dto),
      stats: _stats(dto),
    );
  }

  StrategyDetail _detail(StrategyPlazaTemplateResponseDto dto) {
    final StrategyPlazaDisplayMetricsResponseDto metrics = dto.displayMetrics;
    final StrategyPlazaOfficialBacktestMetricsResponseDto officialMetrics =
        dto.officialBacktest.metrics;
    final double returnPct =
        officialMetrics.returnPct?.toDouble() ??
        metrics.returnPct?.toDouble() ??
        0;
    final double winRate =
        officialMetrics.winRatePct?.toDouble() ??
        metrics.winRatePct?.toDouble() ??
        0;
    final double drawdown =
        officialMetrics.maxDrawdownPct?.toDouble() ??
        metrics.maxDrawdownPct?.toDouble() ??
        0;
    return StrategyDetail(
      card: _card(dto),
      return7d: returnPct,
      return30d: returnPct,
      returnAll: returnPct,
      maxDrawdown: drawdown > 0 ? -drawdown : drawdown,
      sharpe: metrics.sharpe?.toDouble(),
      winRate: winRate > 1 ? winRate / 100 : winRate,
      cagr: returnPct,
      profitLossRatio: metrics.profitLossRatio?.toDouble(),
      tradeCount:
          officialMetrics.tradeCount?.toInt() ??
          metrics.tradeCount?.toInt() ??
          0,
      users: metrics.users?.toInt() ?? 0,
      equityCurve: _officialEquity(dto),
      logicDescription: dto.logicDescription,
      confidenceLevel: dto.officialBacktest.confidence.level.name,
      confidenceReasons: dto.officialBacktest.confidence.reasons.toList(
        growable: false,
      ),
      disclaimer: dto.officialBacktest.disclaimer,
      backtestFromMs: dto.officialBacktest.backtestFrom.toInt(),
      backtestToMs: dto.officialBacktest.backtestTo.toInt(),
      generatedAt: dto.officialBacktest.generatedAt,
      dataSourceLabel: _dataSourceLabel(dto),
      candleCount: dto.officialBacktest.candleCount.toInt(),
      marketType: _marketType(dto),
      positionPct: dto.positionPct.toDouble(),
      leverage: dto.leverage?.toDouble(),
      params: _params(dto),
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
    final response = await _strategyPlazaApi.strategyPlazaProxyControllerSignals(
      id: id,
      limit: limit,
    );
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

  @override
  Future<StrategyRunResult> runTemplate(String id) async {
    final response = await _strategyPlazaApi.strategyPlazaProxyControllerRun(
      authorization: _authorization(),
      id: id,
      strategyPlazaRunRequestDto: StrategyPlazaRunRequestDto(
        (StrategyPlazaRunRequestDtoBuilder b) =>
            b.runRequestId = _newRunRequestId(),
      ),
    );
    final Object? value = response.data?.data.oneOf.value;
    if (value is StrategyPlazaRunExistingResponseDto) {
      return StrategyRunResult(strategyId: value.strategy.id, existing: true);
    }
    if (value is AccountAiQuantStrategyDetailResponseDto) {
      return StrategyRunResult(strategyId: value.id);
    }
    return StrategyRunResult(strategyId: id);
  }

  @override
  Future<StrategyEditSession> startEditSession(
    String id, {
    String? locale,
  }) async {
    final response = await _strategyPlazaApi
        .strategyPlazaProxyControllerEditSession(
          authorization: _authorization(),
          id: id,
          locale: locale,
        );
    final StrategyPlazaEditSessionResponseDto data = response.data!.data;
    return StrategyEditSession(
      sessionId: data.sessionId,
      templateId: data.templateId,
      initialMessage: data.initialMessage,
    );
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
        tradeCount: null,
        maxDrawdown: 0,
        winRate: 0,
        users: 0,
        confidenceLevel: null,
      ),
    );
  }
}
