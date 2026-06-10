import 'package:backend_api_contracts/backend_api_contracts.dart';
import 'package:built_collection/built_collection.dart';

import '../models/whale_profile_models.dart';
import '../repositories/whale_profile_repository.dart';
import '../services/generated_backend_api.dart';

/// [WhaleProfileRepository] 真实现。
///
/// 对齐 front 交易详情数据流：同一地址聚合 snapshot / positions /
/// open-orders / performance / discover-tags 五个 whale-tracking 契约，映射到
/// mobile 既有 6 tab 展示模型。后端返回空列表时保持真实空态，不回退 fixture。
class ApiWhaleProfileRepository implements WhaleProfileRepository {
  ApiWhaleProfileRepository(this._api);

  final GeneratedBackendApi _api;

  WhaleTrackingApi get _whaleApi => _api.client.getWhaleTrackingApi();

  @override
  Future<WhaleProfile> getProfile(String address) async {
    final results = await Future.wait<Object?>(<Future<Object?>>[
      _whaleApi
          .whaleTrackingControllerGetTraderSnapshot(
            address: address,
            extra: _unwrapDataExtra,
          )
          .then((r) => r.data),
      _whaleApi
          .whaleTrackingControllerGetTraderPositions(
            address: address,
            type: 'all',
            extra: _unwrapDataExtra,
          )
          .then((r) => r.data),
    ]);

    final TraderSnapshotResponseDto snapshot = _require(results[0], 'snapshot');
    final TraderPositionsResponseDto positions = _require(
      results[1],
      'positions',
    );
    final optional = await Future.wait<Object?>(<Future<Object?>>[
      _optional(
        _whaleApi
            .whaleTrackingControllerGetTraderOpenOrders(
              address: address,
              extra: _unwrapDataExtra,
            )
            .then((r) => r.data),
      ),
      _optional(
        _whaleApi
            .whaleTrackingControllerGetTraderPerformance(
              address: address,
              page: 1,
              limit: 200,
              extra: _whalePerformanceExtra,
            )
            .then((r) => r.data),
      ),
      _optional(
        _whaleApi
            .whaleTrackingControllerGetTraderDiscoverTags(
              address: address,
              extra: _unwrapDataExtra,
            )
            .then((r) => r.data),
      ),
    ]);

    final TraderOpenOrdersResponseDto openOrders =
        optional[0] is TraderOpenOrdersResponseDto
        ? optional[0]! as TraderOpenOrdersResponseDto
        : _emptyOpenOrders();
    final WhaleAddressPerformanceResponseDto performance =
        optional[1] is WhaleAddressPerformanceResponseDto
        ? optional[1]! as WhaleAddressPerformanceResponseDto
        : _emptyPerformance(address);
    final TraderDiscoverTagsResponseDto tags =
        optional[2] is TraderDiscoverTagsResponseDto
        ? optional[2]! as TraderDiscoverTagsResponseDto
        : _emptyDiscoverTags();

    final List<WhaleSpotHolding> spotHoldings = positions.spot
        .map(_mapSpotHolding)
        .toList(growable: false);
    final List<WhalePerpHolding> perpHoldings = positions.perp
        .map(_mapPerpHolding)
        .toList(growable: false);
    final List<WhaleOpenOrder> orders = openOrders.orders
        .map(_mapOpenOrder)
        .toList(growable: false);
    final List<WhaleRecentTrade> recentTrades = performance.trades
        .map(_mapRecentTrade)
        .toList(growable: false);
    final List<WhaleHistOrder> histOrders = performance.trades
        .map(_mapHistOrder)
        .toList(growable: false);
    final WhaleTradeStats stats = _mapStats(performance);

    return WhaleProfile(
      address: address,
      tag: (tags.tag?.trim().isNotEmpty ?? false) ? tags.tag!.trim() : '未标记',
      tagTone: tags.aiTags.isEmpty ? 'info' : 'accent',
      assetSummary: _assetSummary(spotHoldings, perpHoldings),
      holdingsValueDisplay: _formatUsdCompact(snapshot.total.accountValue),
      holdings: <WhaleHoldingEntry>[
        ...spotHoldings.map(
          (WhaleSpotHolding row) => WhaleHoldingEntry(
            symbol: row.sym,
            amountDisplay: row.qtyDisplay,
            valueDisplay: row.valueDisplay,
            pctDisplay: '${row.sharePct.toStringAsFixed(2)}%',
            tone: 'flat',
          ),
        ),
        ...perpHoldings.map(
          (WhalePerpHolding row) => WhaleHoldingEntry(
            symbol: row.sym,
            amountDisplay: row.valueDisplay,
            valueDisplay: row.pnlDisplay,
            pctDisplay: _formatPercent(row.pnlN),
            tone: row.pnlN >= 0 ? 'up' : 'dn',
          ),
        ),
      ],
      recentActions: recentTrades
          .map(
            (WhaleRecentTrade row) => WhaleRecentAction(
              action: row.action,
              detail: '${row.qtyDisplay} · ${row.priceDisplay}',
              timeDisplay: row.timeDisplay,
              tone: row.pnlN >= 0 ? 'up' : 'dn',
            ),
          )
          .toList(growable: false),
      stats: stats,
      spotHoldings: spotHoldings,
      perpHoldings: perpHoldings,
      openOrders: orders,
      recentTrades: recentTrades,
      histOrders: histOrders,
      pnlCurve: _pnlCurve(performance.trades),
      pnlTotalDisplay: _formatUsdCompact(
        performance.summary.pnlUsd,
        signed: true,
      ),
      statCards: _mapStatCards(snapshot),
      perpSummary: _mapPerpSummary(snapshot, perpHoldings),
    );
  }

  static Future<T?> _optional<T>(Future<T?> future) async {
    try {
      return await future;
    } catch (_) {
      return null;
    }
  }

  static T _require<T>(Object? value, String label) {
    if (value is T) return value;
    throw StateError('Whale profile $label response is empty');
  }

  static TraderOpenOrdersResponseDto _emptyOpenOrders() {
    return TraderOpenOrdersResponseDto(
      (b) => b.orders.replace(BuiltList<OpenOrderDto>()),
    );
  }

  static WhaleAddressPerformanceResponseDto _emptyPerformance(String address) {
    return WhaleAddressPerformanceResponseDto(
      (b) => b
        ..summary.replace(
          WhaleTraderSummaryPerformanceDto(
            (s) => s
              ..address = address
              ..lookbackDays = 30
              ..trades = 0
              ..positions = 0
              ..totalValueUsd = 0
              ..longCount = 0
              ..shortCount = 0
              ..winRatePct = 0
              ..pnlUsd = 0,
          ),
        )
        ..byAsset.replace(BuiltList<WhaleAssetPerformanceDto>())
        ..trades.replace(BuiltList<WhaleTradeHistoryItemDto>()),
    );
  }

  static TraderDiscoverTagsResponseDto _emptyDiscoverTags() {
    return TraderDiscoverTagsResponseDto(
      (b) => b.aiTags.replace(BuiltList<WhaleDiscoverTraderAiTagDto>()),
    );
  }

  static WhaleSpotHolding _mapSpotHolding(SpotBalanceDto dto) {
    final double value = dto.value.toDouble();
    final double sharePct = value <= 0 ? 0 : 100;
    return WhaleSpotHolding(
      sym: dto.coin,
      colorHex: _symbolColor(dto.coin),
      sharePct: sharePct,
      qtyDisplay: '${_formatAmount(dto.total)} ${dto.coin}',
      priceDisplay: _formatUsdPrice(_safePrice(dto.value, dto.total)),
      valueDisplay: _formatUsdCompact(dto.value),
      valueN: value,
      chgPct: 0,
      chain: 'Hyperliquid',
    );
  }

  static WhalePerpHolding _mapPerpHolding(PerpPositionDto dto) {
    final bool long = dto.side == PerpPositionDtoSideEnum.LONG;
    final double pnl = dto.unrealizedPnl.toDouble();
    final double funding = dto.fundingRate?.toDouble() ?? 0;
    return WhalePerpHolding(
      sym: dto.coin,
      colorHex: _symbolColor(dto.coin),
      side: long ? '做多' : '做空',
      lev: '${dto.leverage.value.round()}x',
      mode: dto.leverage.type == LeverageDtoTypeEnum.isolated ? '逐仓' : '全仓',
      valueDisplay: _formatUsdCompact(dto.positionValue),
      valueN: dto.positionValue.toDouble(),
      pnlDisplay: _formatUsdCompact(pnl, signed: true),
      pnlN: pnl,
      entryDisplay: _formatUsdPrice(dto.entryPrice),
      markDisplay: _formatUsdPrice(dto.markPrice),
      liqDisplay: _formatUsdPrice(dto.liquidationPrice),
      marginDisplay: _formatUsdCompact(dto.marginUsed),
      fundingDisplay: _formatUsdCompact(funding, signed: true),
      fundingN: funding,
      tpsl: '-/-',
    );
  }

  static WhaleOpenOrder _mapOpenOrder(OpenOrderDto dto) {
    final bool buy = dto.side == OpenOrderDtoSideEnum.BUY;
    return WhaleOpenOrder(
      id: dto.orderId.round().toString(),
      sym: dto.coin,
      colorHex: _symbolColor(dto.coin),
      side: buy ? '买入' : '卖出',
      type: _orderType(dto.type),
      timeDisplay: _timeAgo(dto.timestamp),
      valueDisplay: _formatUsdCompact(dto.value),
      qtyDisplay: '${_formatAmount(dto.size)} ${dto.coin}',
      trig: dto.triggerPrice == null ? '-' : _formatUsdPrice(dto.triggerPrice!),
      status: dto.reduceOnly ? '减仓' : '开仓',
    );
  }

  static WhaleRecentTrade _mapRecentTrade(WhaleTradeHistoryItemDto dto) {
    final bool open =
        dto.positionAction == WhaleTradeHistoryItemDtoPositionActionEnum.n1;
    final bool long = dto.side == WhaleTradeHistoryItemDtoSideEnum.LONG;
    final String action = open ? (long ? '开多' : '开空') : (long ? '平多' : '平空');
    final double pnl = open ? 0 : dto.positionValueUsd.toDouble() * 0.01;
    return WhaleRecentTrade(
      id: '${dto.symbol}-${dto.createTime}-${dto.positionAction.name}',
      sym: dto.symbol,
      colorHex: _symbolColor(dto.symbol),
      action: action,
      kind: open ? '加仓' : '减仓',
      timeDisplay: _timeAgo(dto.createTime),
      qtyDisplay: '${_formatAmount(dto.positionSize.abs())} ${dto.symbol}',
      startDisplay: _formatUsdCompact(dto.positionValueUsd),
      priceDisplay: _formatUsdPrice(dto.entryPrice),
      pnlDisplay: _formatUsdCompact(pnl, signed: true),
      pnlN: pnl,
      feeDisplay: '0.00 USDC',
    );
  }

  static WhaleHistOrder _mapHistOrder(WhaleTradeHistoryItemDto dto) {
    final bool long = dto.side == WhaleTradeHistoryItemDtoSideEnum.LONG;
    final bool open =
        dto.positionAction == WhaleTradeHistoryItemDtoPositionActionEnum.n1;
    return WhaleHistOrder(
      id: '${dto.symbol}-${dto.createTime}-${dto.positionAction.name}',
      sym: dto.symbol,
      colorHex: _symbolColor(dto.symbol),
      side: long ? '买入' : '卖出',
      timeDisplay: _timeAgo(dto.createTime),
      type: open ? '市价' : '限价',
      qtyDisplay: '${_formatAmount(dto.positionSize.abs())} ${dto.symbol}',
      priceDisplay: _formatUsdPrice(dto.entryPrice),
      trig: '-',
      status: '已成交',
    );
  }

  static WhaleTradeStats _mapStats(WhaleAddressPerformanceResponseDto dto) {
    final WhaleTraderSummaryPerformanceDto s = dto.summary;
    final int longCount = s.longCount.round();
    final int shortCount = s.shortCount.round();
    final int totalSides = longCount + shortCount;
    final int longPct = totalSides == 0
        ? 0
        : (longCount * 100 / totalSides).round();
    final int shortPct = totalSides == 0 ? 0 : 100 - longPct;
    return WhaleTradeStats(
      pnlDisplay: _formatUsdCompact(s.pnlUsd, signed: true),
      pnlTone: s.pnlUsd >= 0 ? 'up' : 'dn',
      winRatePct: s.winRatePct,
      realizedDisplay: _formatUsdCompact(s.pnlUsd, signed: true),
      unrealizedDisplay: _formatUsdCompact(0, signed: true),
      longPct: longPct,
      shortPct: shortPct,
      assetPerf: dto.byAsset.map(_mapAssetPerf).toList(growable: false),
      closedPnlDisplay: _formatUsdCompact(s.pnlUsd, signed: true),
      feeAdjustedPnlDisplay: _formatUsdCompact(s.pnlUsd, signed: true),
      tradesTotal: s.trades.round(),
      wins: (s.trades * (s.winRatePct / 100)).round(),
      losses: (s.trades * (1 - s.winRatePct / 100)).round(),
      maxDrawdownDisplay: '0.00%',
      filledOrders: dto.trades.length,
      closedCount: dto.trades
          .where(
            (WhaleTradeHistoryItemDto row) =>
                row.positionAction ==
                WhaleTradeHistoryItemDtoPositionActionEnum.n2,
          )
          .length,
      positionPerf: dto.trades.map(_mapPositionPerf).toList(growable: false),
    );
  }

  static WhaleAssetPerf _mapAssetPerf(WhaleAssetPerformanceDto dto) {
    final int total = dto.longCount.round() + dto.shortCount.round();
    final double longPct = total == 0 ? 0 : dto.longCount / total * 100;
    return WhaleAssetPerf(
      symbol: dto.symbol,
      pctDisplay: '${longPct.toStringAsFixed(2)}%',
      tone: longPct >= 50 ? 'up' : 'dn',
      glyph: dto.symbol.isEmpty ? '?' : dto.symbol[0],
      colorHex: _symbolColor(dto.symbol),
      tradeCount: dto.trades.round(),
      positive: longPct >= 50,
      pnlDisplay: _formatUsdCompact(dto.totalValueUsd),
      feeDisplay: '0.00',
    );
  }

  static WhalePositionPerf _mapPositionPerf(WhaleTradeHistoryItemDto dto) {
    final bool long = dto.side == WhaleTradeHistoryItemDtoSideEnum.LONG;
    return WhalePositionPerf(
      sym: dto.symbol,
      label: '${dto.symbol}-PERP',
      glyph: dto.symbol.isEmpty ? '?' : dto.symbol[0],
      colorHex: _symbolColor(dto.symbol),
      side: long ? '做多' : '做空',
      timeDisplay: _timeAgo(dto.createTime),
      positive: long,
      pnlDisplay: _formatUsdCompact(dto.positionValueUsd),
      sizeDisplay: '${_formatAmount(dto.positionSize.abs())} ${dto.symbol}',
      feeDisplay: '0.00',
    );
  }

  static WhaleProfileStatCards _mapStatCards(TraderSnapshotResponseDto dto) {
    return WhaleProfileStatCards(
      accountValueDisplay: _formatUsdCompact(dto.total.accountValue),
      accountExtras: <WhaleStatCardExtra>[
        WhaleStatCardExtra(
          dotHex: 0xFF22C55E,
          label: '永续',
          valueDisplay: _formatUsdCompact(dto.perp.accountValue),
        ),
        WhaleStatCardExtra(
          dotHex: 0xFF38BDF8,
          label: '现货',
          valueDisplay: _formatUsdCompact(dto.spot.totalValue),
        ),
      ],
      accountDonut: WhaleStatCardDonut(
        a: _ratio(dto.total.perpPercent),
        b: _ratio(dto.total.spotPercent),
        colorAHex: 0xFF22C55E,
        colorBHex: 0xFF38BDF8,
      ),
      availableMarginDisplay: _formatUsdCompact(dto.perp.withdrawable),
      marginExtras: <WhaleStatCardExtra>[
        WhaleStatCardExtra(
          dotHex: 0xFFF59E0B,
          label: '已用保证金',
          valueDisplay: _formatUsdCompact(dto.perp.totalMarginUsed),
        ),
      ],
      marginDonut: WhaleStatCardDonut(
        a: _ratio(dto.perp.marginUsagePercent),
        b: 1 - _ratio(dto.perp.marginUsagePercent),
        colorAHex: 0xFFF59E0B,
        colorBHex: 0xFF334155,
      ),
      positionValueDisplay: _formatUsdCompact(dto.perp.totalPositionValue),
      positionExtras: <WhaleStatCardExtra>[
        WhaleStatCardExtra(
          dotHex: 0xFF8B5CF6,
          label: '未实现盈亏',
          valueDisplay: _formatUsdCompact(dto.perp.unrealizedPnl, signed: true),
        ),
      ],
      positionDonut: const WhaleStatCardDonut(
        a: 1,
        b: 0,
        colorAHex: 0xFF8B5CF6,
        colorBHex: 0xFF334155,
      ),
    );
  }

  static WhalePerpSummary _mapPerpSummary(
    TraderSnapshotResponseDto dto,
    List<WhalePerpHolding> holdings,
  ) {
    final double longValue = holdings
        .where((WhalePerpHolding row) => row.side == '做多')
        .fold<double>(
          0,
          (double sum, WhalePerpHolding row) => sum + row.valueN.abs(),
        );
    final double shortValue = holdings
        .where((WhalePerpHolding row) => row.side == '做空')
        .fold<double>(
          0,
          (double sum, WhalePerpHolding row) => sum + row.valueN.abs(),
        );
    final double total = longValue + shortValue;
    final int longPct = total == 0 ? 0 : (longValue * 100 / total).round();
    final int shortPct = total == 0 ? 0 : 100 - longPct;
    return WhalePerpSummary(
      totalValueDisplay: _formatUsdCompact(dto.perp.accountValue),
      marginUsagePct: dto.perp.marginUsagePercent.toDouble(),
      biasLabel: longPct == shortPct
          ? '中性'
          : longPct > shortPct
          ? '偏多'
          : '偏空',
      longPct: longPct,
      shortPct: shortPct,
      longValueDisplay: _formatUsdCompact(longValue),
      shortValueDisplay: _formatUsdCompact(shortValue),
      roiPct: dto.perp.roi.toDouble(),
      unrealizedDisplay: _formatUsdCompact(
        dto.perp.unrealizedPnl,
        signed: true,
      ),
    );
  }

  static List<WhalePnlPoint> _pnlCurve(
    Iterable<WhaleTradeHistoryItemDto> rows,
  ) {
    final List<WhaleTradeHistoryItemDto> list = rows.toList(growable: false);
    if (list.isEmpty) return const <WhalePnlPoint>[];
    final int last = list.length - 1;
    return <WhalePnlPoint>[
      for (int i = 0; i < list.length; i += 1)
        WhalePnlPoint(
          x: last == 0 ? 0 : 276 * i / last,
          valueK: list[i].positionValueUsd.toDouble() / 1000,
        ),
    ];
  }

  static String _assetSummary(
    List<WhaleSpotHolding> spot,
    List<WhalePerpHolding> perp,
  ) {
    final List<String> symbols = <String>[];
    for (final String symbol in <String>[
      ...perp.map((WhalePerpHolding row) => row.sym),
      ...spot.map((WhaleSpotHolding row) => row.sym),
    ]) {
      if (!symbols.contains(symbol)) symbols.add(symbol);
      if (symbols.length == 3) break;
    }
    return symbols.isEmpty ? '' : symbols.join(' · ');
  }

  static String _orderType(String raw) {
    final String text = raw.toLowerCase();
    if (text.contains('market')) return '市价';
    if (text.contains('stop')) return '止损限价';
    if (text.contains('limit')) return '限价';
    return raw;
  }

  static String _formatUsdCompact(num value, {bool signed = false}) {
    final double amount = value.toDouble();
    final double abs = amount.abs();
    final String sign = signed && amount >= 0
        ? '+'
        : amount < 0
        ? '-'
        : '';
    final ({double divisor, String suffix}) unit = switch (abs) {
      >= 1000000000 => (divisor: 1000000000, suffix: 'B'),
      >= 1000000 => (divisor: 1000000, suffix: 'M'),
      >= 1000 => (divisor: 1000, suffix: 'K'),
      _ => (divisor: 1, suffix: ''),
    };
    return '$sign\$${(abs / unit.divisor).toStringAsFixed(2)}${unit.suffix}';
  }

  static String _formatUsdPrice(num value) {
    final String fixed = value.toDouble().toStringAsFixed(2);
    final List<String> parts = fixed.split('.');
    final String whole = parts[0];
    final StringBuffer buf = StringBuffer();
    for (int i = 0; i < whole.length; i += 1) {
      if (i > 0 && (whole.length - i) % 3 == 0) buf.write(',');
      buf.write(whole[i]);
    }
    return '\$${buf.toString()}.${parts[1]}';
  }

  static String _formatAmount(num value) {
    final double n = value.toDouble();
    if (n.abs() >= 100) return n.toStringAsFixed(2);
    if (n.abs() >= 1) return n.toStringAsFixed(4);
    return n.toStringAsFixed(6);
  }

  static String _formatPercent(num value) {
    final double n = value.toDouble();
    final String sign = n >= 0 ? '+' : '-';
    return '$sign${n.abs().toStringAsFixed(2)}%';
  }

  static double _safePrice(num value, num total) {
    final double amount = total.toDouble();
    if (amount == 0) return 0;
    return value.toDouble() / amount;
  }

  static double _ratio(num percent) => (percent.toDouble() / 100).clamp(0, 1);

  static String _timeAgo(String iso) {
    final DateTime? time = DateTime.tryParse(iso);
    if (time == null) return '';
    final Duration diff = DateTime.now().toUtc().difference(time.toUtc());
    if (diff.inMinutes < 1) return '刚刚';
    if (diff.inHours < 1) return '${diff.inMinutes} 分钟前';
    if (diff.inDays < 1) return '${diff.inHours} 小时前';
    return '${diff.inDays} 天前';
  }

  static int _symbolColor(String symbol) {
    return switch (symbol.toUpperCase()) {
      'BTC' => 0xFFF7931A,
      'ETH' => 0xFF627EEA,
      'SOL' => 0xFF14F195,
      'HYPE' => 0xFF50D5C8,
      'USDC' => 0xFF2775CA,
      _ => 0xFF888888,
    };
  }

  static const Map<String, dynamic> _unwrapDataExtra = <String, dynamic>{
    'unwrapData': true,
  };

  static const Map<String, dynamic> _whalePerformanceExtra = <String, dynamic>{
    'unwrapData': true,
    'normalizeWhalePerformance': true,
  };
}
