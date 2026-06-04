import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/models/agg_market_data.dart';
import '../../../data/providers.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_grab_handle.dart';
import 'agg_depth_chart.dart';
import 'agg_exchange_avatar.dart';
import 'agg_orderbook_math.dart';
part 'agg_orderbook_card.controls.part.dart';
part 'agg_orderbook_card.book.part.dart';

/// 订单簿视图模式。
enum AggView { both, asks, bids }

/// 加载/错误态空 bundle 占位（渲染空盘口，不抛错）。
const AggMarketData _emptyAggData = AggMarketData(
  exchanges: <AggExchange>[],
  exchangeMap: <String, AggExchange>{},
  precisions: <int>[],
  asks: <AggBookLevel>[],
  bids: <AggBookLevel>[],
  oiCoins: <String>[],
  oiExchangeMap: <String, AggExchange>{},
  oiData: <String, OiSnapshot>{},
  volCoins: <String>[],
  volExchangeName: <String, String>{},
  volColor: <String, Color>{},
  volData: <String, VolSnapshot>{},
  coinColor: <String, Color>{},
);

/// 聚合挂单子屏（设计稿 `ScreenAggOrders` 的 `聚合挂单` 分支:370）。
///
/// 合约·现货 + 币种 segment；24h 统计行；订单簿卡（双向/卖/买切换、价格精度
/// 抽屉、交易所来源抽屉、累计深度条、hot 高亮、买一↔卖一中价条）；深度图卡。
class AggOrderbookCard extends ConsumerStatefulWidget {
  const AggOrderbookCard({super.key});

  @override
  ConsumerState<AggOrderbookCard> createState() => _AggOrderbookCardState();
}

class _AggOrderbookCardState extends ConsumerState<AggOrderbookCard> {
  bool _futures = true; // true=合约 false=现货
  String _coin = 'BTC';
  AggView _view = AggView.both;
  int _precision = 1;
  bool _precisionOpen = false;

  /// 来源筛选选中集合。null = 尚未初始化（首次有数据时填全选）。
  Set<String>? _selectedEx;

  /// 当前帧 provider 数据缓存，供 sheet 回调（精度档位 / 来源全集）读取。
  List<int> _precisions = const <int>[];
  List<AggExchange> _exchanges = const <AggExchange>[];

  /// 解析来源选中集合：已有用户选择则用之；否则首帧用全集初始化。
  /// 数据为空（加载中）时不缓存，待真实数据到达再初始化全选。
  Set<String> _selectionOf(AggMarketData data) {
    if (_selectedEx != null) return _selectedEx!;
    if (data.exchanges.isEmpty) return const <String>{};
    return _selectedEx = data.exchanges.map((AggExchange e) => e.key).toSet();
  }

  List<AggBookLevel> _side(
    List<AggBookLevel> raw,
    bool isAsk,
    Set<String> selected,
  ) {
    final List<AggBookLevel> filtered = raw
        .where((AggBookLevel r) => selected.contains(r.exchange))
        .toList();
    return withCumulative(aggregateLevels(filtered, _precision, isAsk), isAsk);
  }

  Future<void> _openPrecisionSheet() async {
    final AppLocalizations l10n = AppLocalizations.of(context);
    setState(() => _precisionOpen = true);
    final int? picked = await showModalBottomSheet<int>(
      context: context,
      useRootNavigator: true,
      builder: (BuildContext ctx) {
        final QzColorScheme c = ctx.qzScheme;
        return SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              const QzGrabHandle(margin: EdgeInsets.fromLTRB(0, 10, 0, 0)),
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  QzSpacing.lg,
                  QzSpacing.sm,
                  QzSpacing.lg,
                  QzSpacing.sm,
                ),
                child: Text(
                  l10n.aggPrecisionTitle,
                  style: TextStyle(
                    color: c.text,
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ),
              for (final int p in _precisions)
                _PrecisionOption(
                  key: Key('agg-precision-$p'),
                  value: p,
                  selected: p == _precision,
                  onTap: () => Navigator.of(ctx).pop(p),
                ),
              const SizedBox(height: QzSpacing.md),
            ],
          ),
        );
      },
    );
    if (mounted) setState(() => _precisionOpen = false);
    if (picked != null) setState(() => _precision = picked);
  }

  Future<void> _openSourceSheet() async {
    final Set<String> initial =
        _selectedEx?.toSet() ??
        _exchanges.map((AggExchange e) => e.key).toSet();
    await showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      builder: (BuildContext ctx) => _SourceSheet(
        initial: initial,
        exchanges: _exchanges,
        onSelectionChanged: (Set<String> selected) {
          if (mounted) setState(() => _selectedEx = selected);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    // 聚合数据经单一共享 aggOrderbookProvider 注入（issue #2216）；加载/错误态
    // 回退空 bundle（渲染空盘口，与改前 mock 同步可用语义一致）。
    final AggMarketData data =
        ref.watch(aggOrderbookProvider).value ?? _emptyAggData;
    _precisions = data.precisions;
    _exchanges = data.exchanges;
    final Set<String> selected = _selectionOf(data);
    final List<AggBookLevel> asks = _side(data.asks, true, selected);
    final List<AggBookLevel> bids = _side(data.bids, false, selected);
    final double maxCum = <double>[
      asks.isEmpty ? 0 : asks.first.total,
      bids.isEmpty ? 0 : bids.last.total,
    ].reduce((double a, double b) => a > b ? a : b);
    final double? bestAsk = asks.isEmpty ? null : asks.last.price;
    final double? bestBid = bids.isEmpty ? null : bids.first.price;

    return ListView(
      key: const Key('agg-orderbook-list'),
      padding: const EdgeInsets.only(bottom: 100),
      children: <Widget>[
        // 合约/现货 + BTC/ETH segments
        Padding(
          padding: const EdgeInsets.fromLTRB(
            QzSpacing.lg,
            QzSpacing.md,
            QzSpacing.lg,
            QzSpacing.sm,
          ),
          child: Row(
            children: <Widget>[
              _ModeSegment(
                futures: _futures,
                onChanged: (bool v) => setState(() => _futures = v),
              ),
              const SizedBox(width: QzSpacing.sm),
              _CoinSegment(
                coin: _coin,
                onChanged: (String v) => setState(() => _coin = v),
              ),
            ],
          ),
        ),
        // 24h stats
        Padding(
          padding: const EdgeInsets.fromLTRB(
            QzSpacing.lg,
            0,
            QzSpacing.lg,
            QzSpacing.md,
          ),
          child: _StatsLine(coin: _coin),
        ),
        // orderbook card
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: QzSpacing.md),
          child: Container(
            decoration: BoxDecoration(
              color: c.bgElev,
              borderRadius: BorderRadius.circular(QzRadii.card),
              border: Border.all(color: c.borderSoft),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: <Widget>[
                _CardHeader(
                  title: l10n.aggOrderbookTitle(
                    _coin,
                    _futures ? l10n.aggModeFutures : l10n.aggModeSpot,
                  ),
                  view: _view,
                  precision: _precision,
                  precisionExpanded: _precisionOpen,
                  onView: (AggView v) => setState(() => _view = v),
                  onPrecision: _openPrecisionSheet,
                  onSource: _openSourceSheet,
                ),
                _ColumnHeader(coin: _coin),
                if (_view != AggView.bids)
                  for (final AggBookLevel r in asks)
                    _BookRow(
                      level: r,
                      isAsk: true,
                      maxCum: maxCum,
                      exchangeMap: data.exchangeMap,
                    ),
                if (_view == AggView.both)
                  _MidStrip(bestBid: bestBid, bestAsk: bestAsk),
                if (_view != AggView.asks)
                  for (final AggBookLevel r in bids)
                    _BookRow(
                      level: r,
                      isAsk: false,
                      maxCum: maxCum,
                      exchangeMap: data.exchangeMap,
                    ),
              ],
            ),
          ),
        ),
        // depth chart
        Padding(
          padding: const EdgeInsets.fromLTRB(
            QzSpacing.md,
            QzSpacing.md,
            QzSpacing.md,
            QzSpacing.lg,
          ),
          child: Container(
            decoration: BoxDecoration(
              color: c.bgElev,
              borderRadius: BorderRadius.circular(QzRadii.card),
              border: Border.all(color: c.borderSoft),
            ),
            padding: const EdgeInsets.all(QzSpacing.md),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Text(
                      l10n.aggDepthTitle,
                      style: TextStyle(
                        color: c.text,
                        fontSize: 12.5,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const Spacer(),
                    TextButton.icon(
                      key: const Key('agg-liquidity-heatmap'),
                      onPressed: null, // future
                      icon: Icon(
                        Icons.whatshot_outlined,
                        size: 13,
                        color: c.statusWarn,
                      ),
                      label: Text(
                        l10n.aggLiquidityHeatmap,
                        style: TextStyle(
                          color: c.statusWarn,
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                          horizontal: QzSpacing.sm,
                        ),
                        minimumSize: const Size(0, 22),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: QzSpacing.sm),
                AggDepthChart(
                  asks: asks,
                  bids: bids,
                  upColor: c.marketUp,
                  downColor: c.marketDown,
                  gridColor: c.borderSoft,
                  labelColor: c.textFaint,
                ),
                const SizedBox(height: QzSpacing.xs),
                _DepthLegend(coin: _coin),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

