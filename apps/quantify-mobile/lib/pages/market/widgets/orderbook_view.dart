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
part 'orderbook_view.parts.part.dart';

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
      useRootNavigator: true,
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

