import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/models/orderbook_models.dart';
import '../../../data/models/trade_models.dart' show splitSymbolAssets;
import '../../../data/providers.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_empty_state.dart';
import '../../../widgets/qz_spinner.dart';

/// 盘口视图模式（设计稿 `m-screens-3.jsx:508-528`）。
enum ObView { both, asks, bids }

/// 价格精度聚合档位（设计稿 `:538-555`）。
const List<double> kOrderbookPrecisions = <double>[0.01, 0.1, 1, 10, 100];

/// 把原始档位按 `precision` 聚合分桶并累加数量。
///
/// bid 向下取整、ask 向上取整，保证桶边界落在 mid 两侧不重叠。结果按价格距 mid
/// 由近及远排序（bid 价高在前、ask 价低在前），与未聚合时的展示顺序一致。
/// 纯函数，便于单测。
List<OrderbookLevel> aggregateLevels(
  List<OrderbookLevel> levels,
  double precision,
  bool isBid,
) {
  if (precision <= 0 || levels.isEmpty) return levels;
  final Map<double, double> buckets = <double, double>{};
  for (final OrderbookLevel lvl in levels) {
    final double bucket = isBid
        ? (lvl.price / precision).floorToDouble() * precision
        : (lvl.price / precision).ceilToDouble() * precision;
    buckets[bucket] = (buckets[bucket] ?? 0) + lvl.quantity;
  }
  final List<OrderbookLevel> out =
      buckets.entries
          .map(
            (MapEntry<double, double> e) =>
                OrderbookLevel(price: e.key, quantity: e.value),
          )
          .toList()
        ..sort(
          (OrderbookLevel a, OrderbookLevel b) =>
              isBid ? b.price.compareTo(a.price) : a.price.compareTo(b.price),
        );
  return out;
}

class OrderbookView extends ConsumerStatefulWidget {
  const OrderbookView({
    super.key,
    required this.symbol,
    this.mid,
    this.changePercent,
  });

  final String symbol;

  /// 中间价（mid 行展示）；缺省时由最优买卖档推导。
  final double? mid;

  /// 24H 涨跌百分比（mid 行展示）；缺省时不渲染涨跌。
  final double? changePercent;

  @override
  ConsumerState<OrderbookView> createState() => _OrderbookViewState();
}

class _OrderbookViewState extends ConsumerState<OrderbookView> {
  OrderbookSnapshot? _snapshot;
  StreamSubscription<OrderbookSnapshot>? _sub;
  bool _loading = true;
  Object? _error;

  ObView _view = ObView.both;
  double _precision = 0.01;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void didUpdateWidget(OrderbookView oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.symbol != widget.symbol) {
      _sub?.cancel();
      _load();
    }
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    final repo = ref.read(orderbookRepositoryProvider);
    try {
      final OrderbookSnapshot initial = await repo.getSnapshot(widget.symbol);
      if (!mounted) return;
      setState(() {
        _snapshot = initial;
        _loading = false;
      });
      _sub = repo.watchOrderbook(widget.symbol).listen((
        OrderbookSnapshot next,
      ) {
        if (!mounted) return;
        setState(() => _snapshot = next);
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  Future<void> _openPrecisionSheet() async {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final double? picked = await showModalBottomSheet<double>(
      context: context,
      builder: (BuildContext sheetCtx) {
        final QzColorScheme c = sheetCtx.qzScheme;
        return SafeArea(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Padding(
                padding: const EdgeInsets.all(QzSpacing.lg),
                child: Text(
                  l10n.orderbookPrecisionTitle,
                  style: TextStyle(
                    color: c.text,
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              for (final double p in kOrderbookPrecisions)
                ListTile(
                  title: Text(
                    _fmtPrecision(p),
                    style: TextStyle(
                      color: p == _precision ? c.accent : c.text,
                      fontFamily: QzFont.mono,
                      fontFamilyFallback: QzFont.monoFallback,
                    ),
                  ),
                  trailing: p == _precision
                      ? Icon(Icons.check, color: c.accent, size: 18)
                      : null,
                  onTap: () => Navigator.of(sheetCtx).pop(p),
                ),
            ],
          ),
        );
      },
    );
    if (picked != null && mounted) {
      setState(() => _precision = picked);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_loading) return const Center(child: QzSpinner());
    if (_error != null || _snapshot == null) {
      return QzEmptyState(
        title: AppLocalizations.of(context).orderbookLoadError,
      );
    }
    final OrderbookSnapshot snap = _snapshot!;
    final List<OrderbookLevel> bids = aggregateLevels(
      snap.bids,
      _precision,
      true,
    ).take(10).toList();
    final List<OrderbookLevel> asks = aggregateLevels(
      snap.asks,
      _precision,
      false,
    ).take(10).toList();

    // 累计量：从 mid 向外累加。bid 价高在前（近 mid），ask 价低在前（近 mid）。
    final List<double> bidCum = _cumulative(bids);
    final List<double> askCum = _cumulative(asks);
    final double maxCum = <double>[
      ...bidCum,
      ...askCum,
      0,
    ].reduce((double a, double b) => a > b ? a : b);

    final (String base, String quote) = splitSymbolAssets(widget.symbol);
    final double mid = widget.mid ?? _deriveMid(bids, asks);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        _Toolbar(
          view: _view,
          precision: _precision,
          onViewChanged: (ObView v) => setState(() => _view = v),
          onPrecisionTap: _openPrecisionSheet,
        ),
        _Header(base: base, quote: quote),
        _body(bids, asks, bidCum, askCum, maxCum, mid),
      ],
    );
  }

  /// 单侧累计量序列：`cum[i]` = 该侧从 mid 向外到第 i 档的数量累加。
  ///
  /// 入参档位已按距 mid 由近及远排序（ask 价低在前、bid 价高在前），直接顺序累加即可。
  List<double> _cumulative(List<OrderbookLevel> levels) {
    final List<double> out = <double>[];
    double sum = 0;
    for (final OrderbookLevel l in levels) {
      sum += l.quantity;
      out.add(sum);
    }
    return out;
  }

  double _deriveMid(List<OrderbookLevel> bids, List<OrderbookLevel> asks) {
    final double? bestBid = bids.isNotEmpty ? bids.first.price : null;
    final double? bestAsk = asks.isNotEmpty ? asks.first.price : null;
    if (bestBid != null && bestAsk != null) return (bestBid + bestAsk) / 2;
    return bestBid ?? bestAsk ?? 0;
  }

  Widget _body(
    List<OrderbookLevel> bids,
    List<OrderbookLevel> asks,
    List<double> bidCum,
    List<double> askCum,
    double maxCum,
    double mid,
  ) {
    final bool showAsks = _view != ObView.bids;
    final bool showBids = _view != ObView.asks;
    // ask 渲染需价高在上：列表近 mid 在前，倒序后高价落顶部。
    final List<int> askOrder = List<int>.generate(
      asks.length,
      (int i) => i,
    ).reversed.toList();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        if (showAsks)
          for (final int i in askOrder)
            _OrderRow(
              level: asks[i],
              cum: askCum[i],
              maxCum: maxCum,
              isBid: false,
            ),
        if (_view == ObView.both)
          _MidRow(mid: mid, changePercent: widget.changePercent),
        if (showBids)
          for (int i = 0; i < bids.length; i++)
            _OrderRow(
              level: bids[i],
              cum: bidCum[i],
              maxCum: maxCum,
              isBid: true,
            ),
      ],
    );
  }
}

String _fmtPrecision(double p) {
  if (p >= 1) return p.toStringAsFixed(0);
  return p.toString();
}

/// 盘口工具栏：视图模式三态 + 精度下拉；refresh / sort icon 暂禁用标 future。
class _Toolbar extends StatelessWidget {
  const _Toolbar({
    required this.view,
    required this.precision,
    required this.onViewChanged,
    required this.onPrecisionTap,
  });

  final ObView view;
  final double precision;
  final ValueChanged<ObView> onViewChanged;
  final VoidCallback onPrecisionTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.lg,
        vertical: QzSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border(bottom: BorderSide(color: c.borderSoft)),
      ),
      child: Row(
        children: <Widget>[
          _ToolbarIconButton(
            tooltip: l10n.orderbookRefreshFuture,
            icon: Icons.refresh,
            onTap: null, // future（#1682/#1683 真实数据接入后启用）
          ),
          const SizedBox(width: QzSpacing.xs),
          _ViewSegmented(view: view, onChanged: onViewChanged),
          const SizedBox(width: QzSpacing.xs),
          _ToolbarIconButton(
            tooltip: l10n.orderbookSortFuture,
            icon: Icons.swap_vert,
            onTap: null, // future
          ),
          const Spacer(),
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: onPrecisionTap,
              borderRadius: BorderRadius.circular(6),
              child: Container(
                height: 24,
                padding: const EdgeInsets.symmetric(horizontal: QzSpacing.sm),
                decoration: BoxDecoration(
                  color: c.bgElev,
                  border: Border.all(color: c.border),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    Text(
                      _fmtPrecision(precision),
                      style: TextStyle(
                        color: c.text,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        fontFamily: QzFont.mono,
                        fontFamilyFallback: QzFont.monoFallback,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Icon(Icons.keyboard_arrow_down, size: 12, color: c.textMid),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ToolbarIconButton extends StatelessWidget {
  const _ToolbarIconButton({
    required this.tooltip,
    required this.icon,
    required this.onTap,
  });

  final String tooltip;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(6),
          child: SizedBox(
            width: 26,
            height: 24,
            child: Icon(icon, size: 14, color: c.textDim),
          ),
        ),
      ),
    );
  }
}

class _ViewSegmented extends StatelessWidget {
  const _ViewSegmented({required this.view, required this.onChanged});

  final ObView view;
  final ValueChanged<ObView> onChanged;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<({ObView view, String label, Key key})> items =
        <({ObView view, String label, Key key})>[
          (
            view: ObView.both,
            label: l10n.orderbookViewBoth,
            key: const Key('orderbook-view-both'),
          ),
          (
            view: ObView.asks,
            label: l10n.orderbookViewAsks,
            key: const Key('orderbook-view-asks'),
          ),
          (
            view: ObView.bids,
            label: l10n.orderbookViewBids,
            key: const Key('orderbook-view-bids'),
          ),
        ];
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: c.bgSoft,
        borderRadius: BorderRadius.circular(7),
        border: Border.all(color: c.borderSoft),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          for (final item in items)
            Tooltip(
              message: item.label,
              child: Container(
                key: item.key,
                decoration: BoxDecoration(
                  color: view == item.view ? c.bgElev : Colors.transparent,
                  borderRadius: BorderRadius.circular(5),
                ),
                child: GestureDetector(
                  onTap: () => onChanged(item.view),
                  child: SizedBox(
                    width: 26,
                    height: 22,
                    child: Center(
                      child: _ObViewIcon(
                        view: item.view,
                        color: view == item.view ? c.accent : c.textMid,
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _ObViewIcon extends StatelessWidget {
  const _ObViewIcon({required this.view, required this.color});

  final ObView view;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final List<double> widths = switch (view) {
      ObView.asks => <double>[12, 9, 6],
      ObView.bids => <double>[6, 9, 12],
      ObView.both => <double>[11, 8, 11],
    };
    final List<double> opacities = switch (view) {
      ObView.asks => <double>[0.9, 0.7, 0.5],
      ObView.bids => <double>[0.5, 0.7, 0.9],
      ObView.both => <double>[0.85, 0.85, 0.55],
    };
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        for (int i = 0; i < widths.length; i++) ...<Widget>[
          Container(
            width: widths[i],
            height: 1.8,
            decoration: BoxDecoration(
              color: color.withValues(alpha: opacities[i]),
              borderRadius: BorderRadius.circular(0.5),
            ),
          ),
          if (i != widths.length - 1) const SizedBox(height: 3),
        ],
      ],
    );
  }
}

/// 三列列头：价格(quote) / 数量(base) / 委托额($)，对齐设计稿 `:558-568`。
class _Header extends StatelessWidget {
  const _Header({required this.base, required this.quote});

  final String base;
  final String quote;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    TextStyle style() => TextStyle(
      color: c.textDim,
      fontSize: 10,
      fontFamily: QzFont.mono,
      fontFamilyFallback: QzFont.monoFallback,
    );
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.lg,
        vertical: 6,
      ),
      child: Row(
        children: <Widget>[
          Expanded(child: Text(l10n.orderbookColPrice(quote), style: style())),
          Expanded(
            child: Text(
              l10n.orderbookColQty(base),
              textAlign: TextAlign.right,
              style: style(),
            ),
          ),
          Expanded(
            child: Text(
              l10n.orderbookColAmount,
              textAlign: TextAlign.right,
              style: style(),
            ),
          ),
        ],
      ),
    );
  }
}

/// 单档行：累计量背景深度条 + 价格 / 数量 / 委托额三列，对齐设计稿 `OrderRow`。
class _OrderRow extends StatelessWidget {
  const _OrderRow({
    required this.level,
    required this.cum,
    required this.maxCum,
    required this.isBid,
  });

  final OrderbookLevel level;
  final double cum;
  final double maxCum;
  final bool isBid;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color color = isBid ? c.marketUp : c.marketDown;
    final double widthFactor = maxCum > 0
        ? (cum / maxCum).clamp(0.0, 1.0)
        : 0.0;
    // 委托额 = 价格 × 累计数量（notional），设计稿口径。
    final double notional = level.price * cum;
    TextStyle mono(Color col) => TextStyle(
      color: col,
      fontSize: 12,
      fontFamily: QzFont.mono,
      fontFamilyFallback: QzFont.monoFallback,
    );
    return Stack(
      children: <Widget>[
        Positioned.fill(
          child: Align(
            alignment: Alignment.centerRight,
            child: FractionallySizedBox(
              widthFactor: widthFactor,
              child: ColoredBox(color: color.withValues(alpha: 0.10)),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: QzSpacing.lg,
            vertical: 5,
          ),
          child: Row(
            children: <Widget>[
              Expanded(
                child: Text(level.price.toStringAsFixed(2), style: mono(color)),
              ),
              Expanded(
                child: Text(
                  level.quantity.toStringAsFixed(3),
                  textAlign: TextAlign.right,
                  style: mono(c.text),
                ),
              ),
              Expanded(
                child: Text(
                  _fmtNotional(notional),
                  textAlign: TextAlign.right,
                  style: mono(c.textMid),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// 双向视图中间 mid 价格行：大字价格 + 涨跌% + ≈$，对齐设计稿 `:575-588`。
class _MidRow extends StatelessWidget {
  const _MidRow({required this.mid, required this.changePercent});

  final double mid;
  final double? changePercent;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final double? pct = changePercent;
    final Color pctColor = pct == null || pct >= 0 ? c.marketUp : c.marketDown;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.lg,
        vertical: 10,
      ),
      decoration: BoxDecoration(
        color: c.bgSoft,
        border: Border(
          top: BorderSide(color: c.borderSoft),
          bottom: BorderSide(color: c.borderSoft),
        ),
      ),
      child: Row(
        children: <Widget>[
          Text(
            mid.toStringAsFixed(2),
            style: TextStyle(
              color: c.text,
              fontSize: 18,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.3,
              fontFamily: QzFont.mono,
              fontFamilyFallback: QzFont.monoFallback,
            ),
          ),
          const SizedBox(width: QzSpacing.sm),
          if (pct != null)
            Text(
              '${pct >= 0 ? '+' : ''}${pct.toStringAsFixed(2)}%',
              style: TextStyle(
                color: pctColor,
                fontSize: 11,
                fontWeight: FontWeight.w600,
                fontFamily: QzFont.mono,
                fontFamilyFallback: QzFont.monoFallback,
              ),
            ),
          const Spacer(),
          Text(
            '≈ \$${_fmtNotional(mid)}',
            style: TextStyle(
              color: c.textDim,
              fontSize: 10.5,
              fontFamily: QzFont.mono,
              fontFamilyFallback: QzFont.monoFallback,
            ),
          ),
        ],
      ),
    );
  }
}

/// 委托额/金额格式化：千分位整数，保持紧凑。
String _fmtNotional(double v) {
  final int rounded = v.round();
  final String s = rounded.abs().toString();
  final StringBuffer buf = StringBuffer();
  for (int i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) buf.write(',');
    buf.write(s[i]);
  }
  return '${rounded < 0 ? '-' : ''}$buf';
}
