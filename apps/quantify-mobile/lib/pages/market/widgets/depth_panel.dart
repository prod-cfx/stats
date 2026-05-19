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

/// 深度图面板（#1563）。
///
/// 自己订阅 `orderbookRepositoryProvider` 取 snapshot，避免外层重复 stream；
/// `CustomPainter` 内只做几何计算，所有颜色 / 文本由外层提供以保证主题切换。
class DepthPanel extends ConsumerStatefulWidget {
  const DepthPanel({super.key, required this.symbol, required this.mid});

  final String symbol;
  final double mid;

  @override
  ConsumerState<DepthPanel> createState() => _DepthPanelState();
}

class _DepthPanelState extends ConsumerState<DepthPanel> {
  OrderbookSnapshot? _snapshot;
  Object? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      final OrderbookSnapshot snap = await ref
          .read(orderbookRepositoryProvider)
          .getSnapshot(widget.symbol);
      if (!mounted) return;
      setState(() {
        _snapshot = snap;
        _loading = false;
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
  Widget build(BuildContext context) {
    if (_loading) {
      return const SizedBox(height: 240, child: Center(child: QzSpinner()));
    }
    if (_error != null || _snapshot == null) {
      return SizedBox(
        height: 240,
        child: QzEmptyState(
          title: AppLocalizations.of(context).orderbookLoadError,
        ),
      );
    }
    return _DepthChart(snapshot: _snapshot!, mid: widget.mid);
  }
}

class _DepthChart extends StatelessWidget {
  const _DepthChart({required this.snapshot, required this.mid});

  final OrderbookSnapshot snapshot;
  final double mid;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);

    // 累积数量（从中间向外）。bids 价格从高到低、asks 价格从低到高。
    final List<OrderbookLevel> bids = <OrderbookLevel>[...snapshot.bids]
      ..sort((OrderbookLevel a, OrderbookLevel b) => b.price.compareTo(a.price));
    final List<OrderbookLevel> asks = <OrderbookLevel>[...snapshot.asks]
      ..sort((OrderbookLevel a, OrderbookLevel b) => a.price.compareTo(b.price));

    double bidCum = 0;
    final List<_DepthPoint> bidPts = <_DepthPoint>[];
    for (final OrderbookLevel lvl in bids) {
      bidCum += lvl.quantity;
      bidPts.add(_DepthPoint(price: lvl.price, cum: bidCum));
    }
    double askCum = 0;
    final List<_DepthPoint> askPts = <_DepthPoint>[];
    for (final OrderbookLevel lvl in asks) {
      askCum += lvl.quantity;
      askPts.add(_DepthPoint(price: lvl.price, cum: askCum));
    }

    final double maxCum = (bidCum > askCum ? bidCum : askCum) * 1.1;
    final double range = _calcRange(bidPts, askPts, mid);
    final double xMin = mid - range;
    final double xMax = mid + range;
    // crossed book（mock 偶发）会出现 ask<bid，取 abs 保证 SPREAD 永远 ≥0。
    final double spread = asks.isNotEmpty && bids.isNotEmpty
        ? (asks.first.price - bids.first.price).abs()
        : 0;
    final (String baseAsset, _) = splitSymbolAssets(snapshot.symbol);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.fromLTRB(
            QzSpacing.lg,
            QzSpacing.md,
            QzSpacing.lg,
            QzSpacing.xs,
          ),
          child: Row(
            children: <Widget>[
              Expanded(
                child: _Legend(
                  label: l10n.marketDetailDepthBid,
                  value: '${bidCum.toStringAsFixed(2)} $baseAsset',
                  color: c.marketUp,
                ),
              ),
              Expanded(
                child: _Legend(
                  label: l10n.marketDetailDepthSpread,
                  value: spread.toStringAsFixed(2),
                  color: c.text,
                  align: TextAlign.center,
                ),
              ),
              Expanded(
                child: _Legend(
                  label: l10n.marketDetailDepthAsk,
                  value: '${askCum.toStringAsFixed(2)} $baseAsset',
                  color: c.marketDown,
                  align: TextAlign.right,
                ),
              ),
            ],
          ),
        ),
        SizedBox(
          height: 200,
          child: LayoutBuilder(
            builder: (BuildContext _, BoxConstraints box) {
              return CustomPaint(
                size: Size(box.maxWidth, 200),
                painter: _DepthPainter(
                  bidPts: bidPts,
                  askPts: askPts,
                  mid: mid,
                  xMin: xMin,
                  xMax: xMax,
                  maxCum: maxCum,
                  upColor: c.marketUp,
                  downColor: c.marketDown,
                  gridColor: c.borderSoft,
                  midColor: c.textDim,
                ),
              );
            },
          ),
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(
            QzSpacing.lg,
            QzSpacing.sm,
            QzSpacing.lg,
            QzSpacing.md,
          ),
          child: Row(
            children: <Widget>[
              Text(
                xMin.toStringAsFixed(0),
                style: TextStyle(
                  color: c.textDim,
                  fontSize: 10,
                  fontFamilyFallback: QzFont.monoFallback,
                ),
              ),
              Expanded(
                child: Text(
                  mid.toStringAsFixed(2),
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: c.textMid,
                    fontSize: 10,
                    fontFamilyFallback: QzFont.monoFallback,
                  ),
                ),
              ),
              Text(
                xMax.toStringAsFixed(0),
                style: TextStyle(
                  color: c.textDim,
                  fontSize: 10,
                  fontFamilyFallback: QzFont.monoFallback,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  /// 选取一个对称的 x 轴范围：覆盖最远档位 + 5% 缓冲；下限保证 >= mid * 0.002。
  static double _calcRange(
    List<_DepthPoint> bid,
    List<_DepthPoint> ask,
    double mid,
  ) {
    double far = 0;
    for (final _DepthPoint p in bid) {
      final double d = (mid - p.price).abs();
      if (d > far) far = d;
    }
    for (final _DepthPoint p in ask) {
      final double d = (p.price - mid).abs();
      if (d > far) far = d;
    }
    final double padded = far * 1.05;
    final double minRange = mid * 0.002;
    return padded > minRange ? padded : minRange;
  }
}

class _DepthPoint {
  const _DepthPoint({required this.price, required this.cum});
  final double price;
  final double cum;
}

class _Legend extends StatelessWidget {
  const _Legend({
    required this.label,
    required this.value,
    required this.color,
    this.align = TextAlign.left,
  });

  final String label;
  final String value;
  final Color color;
  final TextAlign align;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Column(
      crossAxisAlignment: align == TextAlign.right
          ? CrossAxisAlignment.end
          : align == TextAlign.center
              ? CrossAxisAlignment.center
              : CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          label,
          style: TextStyle(
            color: c.textDim,
            fontSize: 10,
            fontFamilyFallback: QzFont.monoFallback,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(
            color: color,
            fontSize: 14,
            fontWeight: FontWeight.w700,
            fontFamilyFallback: QzFont.monoFallback,
          ),
        ),
      ],
    );
  }
}

class _DepthPainter extends CustomPainter {
  _DepthPainter({
    required this.bidPts,
    required this.askPts,
    required this.mid,
    required this.xMin,
    required this.xMax,
    required this.maxCum,
    required this.upColor,
    required this.downColor,
    required this.gridColor,
    required this.midColor,
  });

  final List<_DepthPoint> bidPts;
  final List<_DepthPoint> askPts;
  final double mid;
  final double xMin;
  final double xMax;
  final double maxCum;
  final Color upColor;
  final Color downColor;
  final Color gridColor;
  final Color midColor;

  @override
  void paint(Canvas canvas, Size size) {
    final double w = size.width;
    final double h = size.height;
    // 所有档位 quantity 都为 0 时 maxCum=0，会让 yOf 产生 Infinity / NaN。
    // xMax==xMin 同理（极端 range=0）。出现任一情况直接放弃绘制。
    if (maxCum <= 0 || xMax <= xMin) return;
    double xOf(double p) => ((p - xMin) / (xMax - xMin)) * w;
    double yOf(double c) => h - (c / maxCum) * (h - 16) - 8;

    // grid
    final Paint grid = Paint()
      ..color = gridColor
      ..strokeWidth = 1;
    for (final double k in <double>[0.25, 0.5, 0.75]) {
      canvas.drawLine(Offset(0, h * k), Offset(w, h * k), grid);
    }

    // bid path（左半区，价格高 → 低，从 mid 向 xMin）
    if (bidPts.isNotEmpty) {
      final Path bidPath = Path()..moveTo(xOf(mid), h);
      for (final _DepthPoint p in bidPts) {
        bidPath.lineTo(xOf(p.price), yOf(p.cum));
      }
      bidPath.lineTo(xOf(xMin), h);
      bidPath.close();
      canvas.drawPath(
        bidPath,
        Paint()..color = upColor.withValues(alpha: 0.25),
      );
      canvas.drawPath(
        bidPath,
        Paint()
          ..color = upColor
          ..strokeWidth = 1.4
          ..style = PaintingStyle.stroke,
      );
    }

    // ask path（右半区，价格低 → 高）
    if (askPts.isNotEmpty) {
      final Path askPath = Path()..moveTo(xOf(mid), h);
      for (final _DepthPoint p in askPts) {
        askPath.lineTo(xOf(p.price), yOf(p.cum));
      }
      askPath.lineTo(xOf(xMax), h);
      askPath.close();
      canvas.drawPath(
        askPath,
        Paint()..color = downColor.withValues(alpha: 0.25),
      );
      canvas.drawPath(
        askPath,
        Paint()
          ..color = downColor
          ..strokeWidth = 1.4
          ..style = PaintingStyle.stroke,
      );
    }

    // mid line
    final Paint midPaint = Paint()
      ..color = midColor.withValues(alpha: 0.6)
      ..strokeWidth = 1;
    final double midX = xOf(mid);
    const double dash = 4;
    const double gap = 3;
    double y = 0;
    while (y < h) {
      final double end = (y + dash).clamp(0, h).toDouble();
      canvas.drawLine(Offset(midX, y), Offset(midX, end), midPaint);
      y += dash + gap;
    }
  }

  @override
  bool shouldRepaint(covariant _DepthPainter old) {
    // bidPts/askPts 在 _DepthChart.build 每次都重新 new，引用比较恒为 true，
    // 会让 CustomPaint 在父树任何 rebuild 时全量重绘。改成基于 maxCum / 数据
    // 长度 / 区间的值语义比较：mock 阶段 snapshot 变化必然影响这几个标量。
    return old.maxCum != maxCum ||
        old.mid != mid ||
        old.xMin != xMin ||
        old.xMax != xMax ||
        old.bidPts.length != bidPts.length ||
        old.askPts.length != askPts.length ||
        old.upColor != upColor ||
        old.downColor != downColor ||
        old.gridColor != gridColor ||
        old.midColor != midColor;
  }
}
