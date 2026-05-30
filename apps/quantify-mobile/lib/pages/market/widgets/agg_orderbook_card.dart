import 'package:flutter/material.dart';

import '../../../data/mock/fixtures/agg_orders.dart';
import '../../../data/models/agg_orders_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import 'agg_depth_chart.dart';
import 'agg_exchange_avatar.dart';

/// 订单簿视图模式。
enum AggView { both, asks, bids }

/// 聚合挂单子屏（设计稿 `ScreenAggOrders` 的 `聚合挂单` 分支:370）。
///
/// 合约·现货 + 币种 segment；24h 统计行；订单簿卡（双向/卖/买切换、价格精度
/// 抽屉、交易所来源抽屉、累计深度条、hot 高亮、买一↔卖一中价条）；深度图卡。
class AggOrderbookCard extends StatefulWidget {
  const AggOrderbookCard({super.key});

  @override
  State<AggOrderbookCard> createState() => _AggOrderbookCardState();
}

class _AggOrderbookCardState extends State<AggOrderbookCard> {
  bool _futures = true; // true=合约 false=现货
  String _coin = 'BTC';
  AggView _view = AggView.both;
  int _precision = 1;
  late Set<String> _selectedEx = kAggExchanges
      .map((AggExchange e) => e.key)
      .toSet();

  List<AggBookLevel> _side(List<AggBookLevel> raw, bool isAsk) {
    final List<AggBookLevel> filtered = raw
        .where((AggBookLevel r) => _selectedEx.contains(r.exchange))
        .toList();
    return withCumulative(aggregateLevels(filtered, _precision, isAsk), isAsk);
  }

  Future<void> _openPrecisionSheet() async {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final int? picked = await showModalBottomSheet<int>(
      context: context,
      builder: (BuildContext ctx) {
        final QzColorScheme c = ctx.qzScheme;
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Padding(
                padding: const EdgeInsets.all(QzSpacing.lg),
                child: Text(l10n.aggPrecisionTitle,
                    style: TextStyle(
                        color: c.text,
                        fontSize: 14,
                        fontWeight: FontWeight.w700)),
              ),
              for (final int p in kAggPrecisions)
                ListTile(
                  key: Key('agg-precision-$p'),
                  title: Text('$p',
                      style: TextStyle(
                        color: p == _precision ? c.accent : c.text,
                        fontFamily: QzFont.mono,
                        fontFamilyFallback: QzFont.monoFallback,
                        fontWeight: FontWeight.w600,
                      )),
                  trailing: p == _precision
                      ? Icon(Icons.check, color: c.accent, size: 18)
                      : null,
                  onTap: () => Navigator.of(ctx).pop(p),
                ),
            ],
          ),
        );
      },
    );
    if (picked != null) setState(() => _precision = picked);
  }

  Future<void> _openSourceSheet() async {
    final Set<String>? result = await showModalBottomSheet<Set<String>>(
      context: context,
      isScrollControlled: true,
      builder: (BuildContext ctx) =>
          _SourceSheet(initial: _selectedEx.toSet()),
    );
    if (result != null) setState(() => _selectedEx = result);
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<AggBookLevel> asks = _side(kAggAsks, true);
    final List<AggBookLevel> bids = _side(kAggBids, false);
    final double maxCum = <double>[
      asks.isEmpty ? 0 : asks.first.total,
      bids.isEmpty ? 0 : bids.last.total,
    ].reduce((double a, double b) => a > b ? a : b);
    final double? bestAsk = asks.isEmpty ? null : asks.last.price;
    final double? bestBid = bids.isEmpty ? null : bids.first.price;

    return ListView(
      key: const Key('agg-orderbook-list'),
      padding: const EdgeInsets.only(bottom: QzSpacing.xxl),
      children: <Widget>[
        // 合约/现货 + BTC/ETH segments
        Padding(
          padding: const EdgeInsets.fromLTRB(
              QzSpacing.lg, QzSpacing.md, QzSpacing.lg, QzSpacing.sm),
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
              QzSpacing.lg, 0, QzSpacing.lg, QzSpacing.md),
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
                  onView: (AggView v) => setState(() => _view = v),
                  onPrecision: _openPrecisionSheet,
                  onSource: _openSourceSheet,
                ),
                _ColumnHeader(coin: _coin),
                if (_view != AggView.bids)
                  for (final AggBookLevel r in asks)
                    _BookRow(level: r, isAsk: true, maxCum: maxCum),
                if (_view == AggView.both)
                  _MidStrip(bestBid: bestBid, bestAsk: bestAsk),
                if (_view != AggView.asks)
                  for (final AggBookLevel r in bids)
                    _BookRow(level: r, isAsk: false, maxCum: maxCum),
              ],
            ),
          ),
        ),
        // depth chart
        Padding(
          padding: const EdgeInsets.fromLTRB(
              QzSpacing.md, QzSpacing.md, QzSpacing.md, QzSpacing.lg),
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
                    Text(l10n.aggDepthTitle,
                        style: TextStyle(
                            color: c.text,
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600)),
                    const Spacer(),
                    TextButton.icon(
                      key: const Key('agg-liquidity-heatmap'),
                      onPressed: null, // future
                      icon: Icon(Icons.whatshot_outlined,
                          size: 13, color: c.statusWarn),
                      label: Text(l10n.aggLiquidityHeatmap,
                          style: TextStyle(
                              color: c.statusWarn,
                              fontSize: 11,
                              fontWeight: FontWeight.w600)),
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(
                            horizontal: QzSpacing.sm),
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

class _ModeSegment extends StatelessWidget {
  const _ModeSegment({required this.futures, required this.onChanged});

  final bool futures;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return _Pills(
      options: <String>[l10n.aggModeFutures, l10n.aggModeSpot],
      selectedIndex: futures ? 0 : 1,
      onIndex: (int i) => onChanged(i == 0),
      keyPrefix: 'agg-mode',
    );
  }
}

class _CoinSegment extends StatelessWidget {
  const _CoinSegment({required this.coin, required this.onChanged});

  final String coin;
  final ValueChanged<String> onChanged;

  static const List<String> _coins = <String>['BTC', 'ETH'];

  @override
  Widget build(BuildContext context) {
    return _Pills(
      options: _coins,
      selectedIndex: _coins.indexOf(coin).clamp(0, _coins.length - 1),
      onIndex: (int i) => onChanged(_coins[i]),
      keyPrefix: 'agg-coin-mode',
    );
  }
}

/// accent 填充的 pill 段控件（合约/现货、BTC/ETH）。
class _Pills extends StatelessWidget {
  const _Pills({
    required this.options,
    required this.selectedIndex,
    required this.onIndex,
    required this.keyPrefix,
  });

  final List<String> options;
  final int selectedIndex;
  final ValueChanged<int> onIndex;
  final String keyPrefix;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: c.bgSoft,
        borderRadius: BorderRadius.circular(QzRadii.input),
        border: Border.all(color: c.borderSoft),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          for (int i = 0; i < options.length; i++)
            GestureDetector(
              key: Key('$keyPrefix-$i'),
              onTap: () => onIndex(i),
              child: Container(
                height: 26,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: i == selectedIndex ? c.accent : Colors.transparent,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  options[i],
                  style: TextStyle(
                    color: i == selectedIndex ? c.accentOn : c.textMid,
                    fontSize: 12,
                    fontWeight:
                        i == selectedIndex ? FontWeight.w600 : FontWeight.w500,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _StatsLine extends StatelessWidget {
  const _StatsLine({required this.coin});

  final String coin;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    TextStyle dim() => TextStyle(
          color: c.textDim,
          fontSize: 10.5,
          fontFamily: QzFont.mono,
          fontFamilyFallback: QzFont.monoFallback,
        );
    TextStyle strong() => TextStyle(
          color: c.text,
          fontSize: 10.5,
          fontWeight: FontWeight.w600,
          fontFamily: QzFont.mono,
          fontFamilyFallback: QzFont.monoFallback,
        );
    return Wrap(
      spacing: 14,
      runSpacing: QzSpacing.xs,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: <Widget>[
        Text.rich(TextSpan(children: <InlineSpan>[
          TextSpan(text: '${l10n.aggStat24hVolume} ', style: dim()),
          TextSpan(text: '6.82万 $coin', style: strong()),
        ])),
        Text.rich(TextSpan(children: <InlineSpan>[
          TextSpan(text: '${l10n.aggStat24hTurnover} ', style: dim()),
          TextSpan(text: 'US\$7159万', style: strong()),
        ])),
      ],
    );
  }
}

class _CardHeader extends StatelessWidget {
  const _CardHeader({
    required this.title,
    required this.view,
    required this.precision,
    required this.onView,
    required this.onPrecision,
    required this.onSource,
  });

  final String title;
  final AggView view;
  final int precision;
  final ValueChanged<AggView> onView;
  final VoidCallback onPrecision;
  final VoidCallback onSource;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.fromLTRB(
          QzSpacing.md, QzSpacing.md, QzSpacing.md, QzSpacing.sm),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: c.borderSoft)),
      ),
      child: Row(
        children: <Widget>[
          Flexible(
            child: Text(title,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                    color: c.text,
                    fontSize: 12.5,
                    fontWeight: FontWeight.w600)),
          ),
          const SizedBox(width: QzSpacing.sm),
          const Spacer(),
          _ViewToggle(view: view, onChanged: onView),
          const SizedBox(width: QzSpacing.xs),
          OutlinedButton(
            key: const Key('agg-precision-button'),
            onPressed: onPrecision,
            style: OutlinedButton.styleFrom(
              minimumSize: const Size(0, 24),
              padding: const EdgeInsets.symmetric(horizontal: QzSpacing.xs),
              side: BorderSide(color: c.border),
            ),
            child: Row(mainAxisSize: MainAxisSize.min, children: <Widget>[
              Text('$precision',
                  style: TextStyle(
                    color: c.text,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    fontFamily: QzFont.mono,
                    fontFamilyFallback: QzFont.monoFallback,
                  )),
              Icon(Icons.keyboard_arrow_down, size: 14, color: c.textMid),
            ]),
          ),
          const SizedBox(width: QzSpacing.xs),
          IconButton(
            key: const Key('agg-source-button'),
            tooltip: AppLocalizations.of(context).aggExchangeSourceTooltip,
            onPressed: onSource,
            iconSize: 16,
            visualDensity: VisualDensity.compact,
            constraints: const BoxConstraints(minWidth: 28, minHeight: 24),
            padding: EdgeInsets.zero,
            icon: Icon(Icons.tune, color: c.textMid),
          ),
        ],
      ),
    );
  }
}

class _ViewToggle extends StatelessWidget {
  const _ViewToggle({required this.view, required this.onChanged});

  final AggView view;
  final ValueChanged<AggView> onChanged;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<(AggView, IconData, String)> items =
        <(AggView, IconData, String)>[
      (AggView.both, Icons.view_agenda_outlined, l10n.aggViewBoth),
      (AggView.asks, Icons.trending_down, l10n.aggViewAsks),
      (AggView.bids, Icons.trending_up, l10n.aggViewBids),
    ];
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: c.bgSoft,
        borderRadius: BorderRadius.circular(7),
        border: Border.all(color: c.borderSoft),
      ),
      child: Row(mainAxisSize: MainAxisSize.min, children: <Widget>[
        for (final (AggView, IconData, String) item in items)
          GestureDetector(
            key: Key('agg-view-${item.$1.name}'),
            onTap: () => onChanged(item.$1),
            child: Semantics(
              label: item.$3,
              selected: view == item.$1,
              button: true,
              child: Container(
                width: 24,
                height: 22,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: view == item.$1 ? c.bgElev : Colors.transparent,
                  borderRadius: BorderRadius.circular(5),
                ),
                child: Icon(item.$2,
                    size: 13,
                    color: view == item.$1 ? c.accent : c.textMid),
              ),
            ),
          ),
      ]),
    );
  }
}

const List<int> _bookFlex = <int>[16, 34, 24, 26];

class _ColumnHeader extends StatelessWidget {
  const _ColumnHeader({required this.coin});

  final String coin;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    TextStyle s() => TextStyle(
          color: c.textDim,
          fontSize: 10,
          fontFamily: QzFont.mono,
          fontFamilyFallback: QzFont.monoFallback,
        );
    return Container(
      padding: const EdgeInsets.symmetric(
          horizontal: QzSpacing.md, vertical: QzSpacing.sm),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: c.borderSoft)),
      ),
      child: Row(children: <Widget>[
        Expanded(flex: _bookFlex[0], child: const SizedBox()),
        Expanded(flex: _bookFlex[1], child: Text(l10n.aggColPrice, style: s())),
        Expanded(
            flex: _bookFlex[2],
            child: Text(l10n.aggColQty(coin),
                textAlign: TextAlign.right, style: s())),
        Expanded(
            flex: _bookFlex[3],
            child: Text(l10n.aggColTotal(coin),
                textAlign: TextAlign.right, style: s())),
      ]),
    );
  }
}

class _BookRow extends StatelessWidget {
  const _BookRow({
    required this.level,
    required this.isAsk,
    required this.maxCum,
  });

  final AggBookLevel level;
  final bool isAsk;
  final double maxCum;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color side = isAsk ? c.marketDown : c.marketUp;
    final double w = maxCum <= 0 ? 0 : (level.total / maxCum).clamp(0, 1);
    final AggExchange? ex = kAggExchangeMap[level.exchange];
    return Stack(
      children: <Widget>[
        Positioned.fill(
          child: Align(
            alignment: Alignment.centerRight,
            child: FractionallySizedBox(
              widthFactor: w,
              child: ColoredBox(
                color: side.withValues(alpha: level.hot ? 0.18 : 0.1),
              ),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(
              horizontal: QzSpacing.md, vertical: 7),
          child: Row(children: <Widget>[
            Expanded(
              flex: _bookFlex[0],
              child: ex == null
                  ? const SizedBox()
                  : Align(
                      alignment: Alignment.centerLeft,
                      child: AggExchangeAvatar(exchange: ex, size: 16)),
            ),
            Expanded(
              flex: _bookFlex[1],
              child: Text(
                level.price.toStringAsFixed(2),
                style: TextStyle(
                  color: side,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w600,
                  fontFamily: QzFont.mono,
                  fontFamilyFallback: QzFont.monoFallback,
                ),
              ),
            ),
            Expanded(
              flex: _bookFlex[2],
              child: Text(
                level.qty.toStringAsFixed(4),
                textAlign: TextAlign.right,
                style: TextStyle(
                  color: c.text,
                  fontSize: 11.5,
                  fontFamily: QzFont.mono,
                  fontFamilyFallback: QzFont.monoFallback,
                ),
              ),
            ),
            Expanded(
              flex: _bookFlex[3],
              child: Text(
                level.total.toStringAsFixed(4),
                textAlign: TextAlign.right,
                style: TextStyle(
                  color: c.text,
                  fontSize: 11.5,
                  fontWeight: FontWeight.w500,
                  fontFamily: QzFont.mono,
                  fontFamilyFallback: QzFont.monoFallback,
                ),
              ),
            ),
          ]),
        ),
      ],
    );
  }
}

class _MidStrip extends StatelessWidget {
  const _MidStrip({required this.bestBid, required this.bestAsk});

  final double? bestBid;
  final double? bestAsk;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(
          horizontal: QzSpacing.md, vertical: QzSpacing.sm),
      decoration: BoxDecoration(
        color: c.bgSoft,
        border: Border(
          top: BorderSide(color: c.borderSoft),
          bottom: BorderSide(color: c.borderSoft),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: <Widget>[
          Text(l10n.aggBestBidAsk,
              style: TextStyle(color: c.textDim, fontSize: 10)),
          Text.rich(TextSpan(children: <InlineSpan>[
            TextSpan(
              text: bestBid?.toStringAsFixed(2) ?? '--',
              style: TextStyle(
                color: c.marketUp,
                fontSize: 13,
                fontWeight: FontWeight.w700,
                fontFamily: QzFont.mono,
                fontFamilyFallback: QzFont.monoFallback,
              ),
            ),
            TextSpan(
                text: '  ↔  ',
                style: TextStyle(color: c.textDim, fontSize: 13)),
            TextSpan(
              text: bestAsk?.toStringAsFixed(2) ?? '--',
              style: TextStyle(
                color: c.marketDown,
                fontSize: 13,
                fontWeight: FontWeight.w700,
                fontFamily: QzFont.mono,
                fontFamilyFallback: QzFont.monoFallback,
              ),
            ),
          ])),
        ],
      ),
    );
  }
}

class _DepthLegend extends StatelessWidget {
  const _DepthLegend({required this.coin});

  final String coin;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    Widget dot(Color color, String label) => Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                    color: color,
                    borderRadius: BorderRadius.circular(2))),
            const SizedBox(width: QzSpacing.xxs),
            Text(label, style: TextStyle(color: c.textDim, fontSize: 10)),
          ],
        );
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: <Widget>[
        Row(children: <Widget>[
          dot(c.marketUp, l10n.aggDepthLegendBids),
          const SizedBox(width: QzSpacing.md),
          dot(c.marketDown, l10n.aggDepthLegendAsks),
        ]),
        Text(l10n.aggUnit(coin),
            style: TextStyle(
              color: c.textDim,
              fontSize: 10,
              fontFamily: QzFont.mono,
              fontFamilyFallback: QzFont.monoFallback,
            )),
      ],
    );
  }
}

/// 交易所来源底部抽屉（多选 + 全选/清空）。
class _SourceSheet extends StatefulWidget {
  const _SourceSheet({required this.initial});

  final Set<String> initial;

  @override
  State<_SourceSheet> createState() => _SourceSheetState();
}

class _SourceSheetState extends State<_SourceSheet> {
  late Set<String> _selected = widget.initial.toSet();

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return SafeArea(
      top: false,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.fromLTRB(
                QzSpacing.lg, QzSpacing.md, QzSpacing.sm, QzSpacing.sm),
            child: Row(children: <Widget>[
              Expanded(
                child: Text(l10n.aggExchangeSourceTitle,
                    style: TextStyle(
                        color: c.text,
                        fontSize: 14,
                        fontWeight: FontWeight.w700)),
              ),
              TextButton(
                key: const Key('agg-source-select-all'),
                onPressed: () => setState(() => _selected =
                    kAggExchanges.map((AggExchange e) => e.key).toSet()),
                child: Text(l10n.aggSelectAll,
                    style: TextStyle(color: c.accent)),
              ),
              TextButton(
                key: const Key('agg-source-clear-all'),
                onPressed: () => setState(() => _selected = <String>{}),
                child:
                    Text(l10n.aggClearAll, style: TextStyle(color: c.textMid)),
              ),
            ]),
          ),
          for (final AggExchange ex in kAggExchanges)
            CheckboxListTile(
              key: Key('agg-source-${ex.key}'),
              value: _selected.contains(ex.key),
              onChanged: (bool? v) => setState(() {
                if (v ?? false) {
                  _selected.add(ex.key);
                } else {
                  _selected.remove(ex.key);
                }
              }),
              activeColor: c.accent,
              controlAffinity: ListTileControlAffinity.trailing,
              secondary: AggExchangeAvatar(exchange: ex, size: 20),
              title: Text(ex.name,
                  style: TextStyle(
                      color: _selected.contains(ex.key) ? c.text : c.textMid,
                      fontSize: 13.5,
                      fontWeight: FontWeight.w600)),
            ),
          Padding(
            padding: const EdgeInsets.all(QzSpacing.sm),
            child: TextButton(
              onPressed: () => Navigator.of(context).pop(_selected),
              child: Text(l10n.aggCancel, style: TextStyle(color: c.text)),
            ),
          ),
        ],
      ),
    );
  }
}
