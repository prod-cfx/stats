import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/models/orderbook_models.dart';
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
  final List<OrderbookLevel> out = buckets.entries
      .map((MapEntry<double, double> e) =>
          OrderbookLevel(price: e.key, quantity: e.value))
      .toList()
    ..sort((OrderbookLevel a, OrderbookLevel b) =>
        isBid ? b.price.compareTo(a.price) : a.price.compareTo(b.price));
  return out;
}

class OrderbookView extends ConsumerStatefulWidget {
  const OrderbookView({super.key, required this.symbol});

  final String symbol;

  @override
  ConsumerState<OrderbookView> createState() => _OrderbookViewState();
}

class _OrderbookViewState extends ConsumerState<OrderbookView> {
  OrderbookSnapshot? _snapshot;
  StreamSubscription<OrderbookSnapshot>? _sub;
  bool _loading = true;
  Object? _error;

  ObView _view = ObView.both;
  double _precision = 1;

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
      return QzEmptyState(title: AppLocalizations.of(context).orderbookLoadError);
    }
    final OrderbookSnapshot snap = _snapshot!;
    final List<OrderbookLevel> bids =
        aggregateLevels(snap.bids, _precision, true);
    final List<OrderbookLevel> asks =
        aggregateLevels(snap.asks, _precision, false);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        _Toolbar(
          view: _view,
          precision: _precision,
          onViewChanged: (ObView v) => setState(() => _view = v),
          onPrecisionTap: _openPrecisionSheet,
        ),
        const SizedBox(height: QzSpacing.sm),
        _body(bids, asks),
      ],
    );
  }

  Widget _body(List<OrderbookLevel> bids, List<OrderbookLevel> asks) {
    switch (_view) {
      case ObView.both:
        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Expanded(child: _OrderbookSide(levels: bids, isBid: true)),
            const SizedBox(width: QzSpacing.md),
            Expanded(child: _OrderbookSide(levels: asks, isBid: false)),
          ],
        );
      case ObView.asks:
        return _OrderbookSide(levels: asks, isBid: false);
      case ObView.bids:
        return _OrderbookSide(levels: bids, isBid: true);
    }
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
    return Row(
      children: <Widget>[
        IconButton(
          tooltip: l10n.orderbookRefreshFuture,
          icon: const Icon(Icons.refresh, size: 16),
          color: c.textDim,
          onPressed: null, // future（#1682/#1683 真实数据接入后启用）
        ),
        _ViewSegmented(view: view, onChanged: onViewChanged),
        IconButton(
          tooltip: l10n.orderbookSortFuture,
          icon: const Icon(Icons.swap_vert, size: 16),
          color: c.textDim,
          onPressed: null, // future
        ),
        const Spacer(),
        OutlinedButton(
          onPressed: onPrecisionTap,
          style: OutlinedButton.styleFrom(
            minimumSize: const Size(0, 28),
            padding: const EdgeInsets.symmetric(horizontal: QzSpacing.sm),
            side: BorderSide(color: c.border),
            foregroundColor: c.text,
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
                  fontFamilyFallback: QzFont.monoFallback,
                ),
              ),
              const SizedBox(width: 2),
              Icon(Icons.keyboard_arrow_down, size: 14, color: c.textMid),
            ],
          ),
        ),
      ],
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
    final List<(ObView, String)> items = <(ObView, String)>[
      (ObView.both, l10n.orderbookViewBoth),
      (ObView.asks, l10n.orderbookViewAsks),
      (ObView.bids, l10n.orderbookViewBids),
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
          for (final (ObView, String) item in items)
            GestureDetector(
              onTap: () => onChanged(item.$1),
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: QzSpacing.sm,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: view == item.$1 ? c.bgElev : Colors.transparent,
                  borderRadius: BorderRadius.circular(5),
                ),
                child: Text(
                  item.$2,
                  style: TextStyle(
                    color: view == item.$1 ? c.accent : c.textMid,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _OrderbookSide extends StatelessWidget {
  const _OrderbookSide({required this.levels, required this.isBid});

  final List<OrderbookLevel> levels;
  final bool isBid;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color color = isBid ? c.marketUp : c.marketDown;
    return Column(
      children: <Widget>[
        for (final OrderbookLevel level in levels.take(10))
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 3),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    level.price.toStringAsFixed(2),
                    style: TextStyle(
                      color: color,
                      fontSize: 12,
                      fontFamilyFallback: QzFont.monoFallback,
                    ),
                  ),
                ),
                Text(
                  level.quantity.toStringAsFixed(3),
                  style: TextStyle(
                    color: c.textMid,
                    fontSize: 12,
                    fontFamilyFallback: QzFont.monoFallback,
                  ),
                ),
              ],
            ),
          ),
      ],
    );
  }
}
