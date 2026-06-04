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
import 'agg_orderbook_controller.dart';
part 'agg_orderbook_card.controls.part.dart';
part 'agg_orderbook_card.book.part.dart';

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
  // 精度抽屉展开态：UI 瞬时态，保留 widget（非业务派生）。
  bool _precisionOpen = false;

  AggOrderbookController get _controller =>
      ref.read(aggOrderbookControllerProvider.notifier);

  Future<void> _openPrecisionSheet() async {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<int> precisions = _controller.precisions;
    final int current = ref.read(aggOrderbookControllerProvider).precision;
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
              for (final int p in precisions)
                _PrecisionOption(
                  key: Key('agg-precision-$p'),
                  value: p,
                  selected: p == current,
                  onTap: () => Navigator.of(ctx).pop(p),
                ),
              const SizedBox(height: QzSpacing.md),
            ],
          ),
        );
      },
    );
    if (mounted) setState(() => _precisionOpen = false);
    // autoDispose controller：sheet 异步 gap 后 card 可能已卸载，
    // 缺 mounted 守卫会在已 dispose 的 Notifier 上 `state=` 抛 StateError。
    if (picked != null && mounted) _controller.setPrecision(picked);
  }

  Future<void> _openSourceSheet() async {
    final Set<String> initial = _controller.currentSelection.toSet();
    await showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      builder: (BuildContext ctx) => _SourceSheet(
        initial: initial,
        exchanges: _controller.exchanges,
        // mounted 守卫：sheet 经 rootNavigator 独立挂载，card 卸载后
        // autoDispose 会销毁 controller，裸回调会在已 dispose Notifier 上崩溃。
        onSelectionChanged: (Set<String> selected) {
          if (mounted) _controller.setExchanges(selected);
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    // 原始聚合数据经单一共享 aggOrderbookProvider 注入（issue #2216）；加载/
    // 错误态回退空 bundle。过滤/聚合/累计派生上移 AggOrderbookController
    // （#2218 C4），View 仅 watch 输入态 + 调 controller 取派生 asks/bids。
    final AggMarketData data =
        ref.watch(aggOrderbookProvider).value ?? kEmptyAggData;
    final AggOrderbookState s = ref.watch(aggOrderbookControllerProvider);
    final AggOrderbookController ctrl = _controller;
    final List<AggBookLevel> asks = ctrl.asksOf(data);
    final List<AggBookLevel> bids = ctrl.bidsOf(data);
    // maxCum/bestAsk/bestBid 为纯 UI 渲染量（深度条比例 / 中价条），保留 View。
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
                  view: s.view,
                  precision: s.precision,
                  precisionExpanded: _precisionOpen,
                  onView: ctrl.setView,
                  onPrecision: _openPrecisionSheet,
                  onSource: _openSourceSheet,
                ),
                _ColumnHeader(coin: _coin),
                if (s.view != AggView.bids)
                  for (final AggBookLevel r in asks)
                    _BookRow(
                      level: r,
                      isAsk: true,
                      maxCum: maxCum,
                      exchangeMap: data.exchangeMap,
                    ),
                if (s.view == AggView.both)
                  _MidStrip(bestBid: bestBid, bestAsk: bestAsk),
                if (s.view != AggView.asks)
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

