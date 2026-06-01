import 'package:flutter/material.dart';

import '../../../data/models/agg_orders_models.dart';

/// 累计深度图（设计稿 `DepthChart`:862）。
///
/// bids 绿色填充 + 描边（左半 / 高累计→近 mid 低累计），asks 红色填充 + 描边
/// （右半），叠加水平虚线网格。右侧 Y 轴渲染 5 档累计量刻度，底部 X 轴渲染
/// 最小/中点/最大价格。X 轴价格升序，Y 轴累计数量。
class AggDepthChart extends StatelessWidget {
  const AggDepthChart({
    super.key,
    required this.asks,
    required this.bids,
    required this.upColor,
    required this.downColor,
    required this.gridColor,
    required this.labelColor,
  });

  final List<AggBookLevel> asks;
  final List<AggBookLevel> bids;
  final Color upColor;
  final Color downColor;
  final Color gridColor;
  final Color labelColor;

  /// Y 轴刻度比例（对应 maxCum 的占比），与设计稿一致。
  static const List<double> _ticks = <double>[0, 0.25, 0.5, 0.75, 1];

  /// 右侧 Y 轴标签预留宽度（容纳累计量数字）。
  static const double _padRight = 28;

  /// 底部 X 轴标签预留高度。
  static const double _padBottom = 14;

  @override
  Widget build(BuildContext context) {
    final _DepthExtent? extent = _DepthExtent.from(asks: asks, bids: bids);
    final TextStyle labelStyle = TextStyle(
      fontSize: 9,
      color: labelColor,
      fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
    );

    return SizedBox(
      height: 140,
      width: double.infinity,
      child: Stack(
        children: <Widget>[
          Positioned.fill(
            child: CustomPaint(
              painter: _DepthPainter(
                asks: asks,
                bids: bids,
                upColor: upColor,
                downColor: downColor,
                gridColor: gridColor,
                padRight: _padRight,
                padBottom: _padBottom,
              ),
            ),
          ),
          if (extent != null) ...<Widget>[
            _buildYAxisLabels(extent, labelStyle),
            _buildXAxisLabels(extent, labelStyle),
          ],
        ],
      ),
    );
  }

  /// 右侧 5 档 Y 轴累计量标签（0/0.25/0.5/0.75/1 × maxCum，自上而下递减）。
  Widget _buildYAxisLabels(_DepthExtent extent, TextStyle style) {
    final double plotH = 140 - _padBottom;
    return Positioned(
      right: 0,
      top: 0,
      bottom: _padBottom,
      width: _padRight,
      child: Stack(
        children: _ticks.map((double t) {
          // t=1 在顶部，t=0 在底部；居中对齐刻度线。
          final double top = (1 - t) * plotH - 6;
          return Positioned(
            right: 0,
            top: top.clamp(0.0, plotH),
            child: Text(
              (t * extent.maxCum).toStringAsFixed(0),
              style: style,
            ),
          );
        }).toList(),
      ),
    );
  }

  /// 底部 X 轴价格标签（最小价 / 中点价 / 最大价）。
  Widget _buildXAxisLabels(_DepthExtent extent, TextStyle style) {
    return Positioned(
      left: 0,
      right: _padRight,
      bottom: 0,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: <Widget>[
          Text(extent.minP.floorToDouble().toStringAsFixed(0), style: style),
          Text(
            ((extent.minP + extent.maxP) / 2).floorToDouble().toStringAsFixed(0),
            style: style,
          ),
          Text(extent.maxP.floorToDouble().toStringAsFixed(0), style: style),
        ],
      ),
    );
  }
}

/// 深度图坐标范围（价格区间 + 最大累计量）。无效数据返回 null。
class _DepthExtent {
  const _DepthExtent({
    required this.minP,
    required this.maxP,
    required this.maxCum,
  });

  final double minP;
  final double maxP;
  final double maxCum;

  static _DepthExtent? from({
    required List<AggBookLevel> asks,
    required List<AggBookLevel> bids,
  }) {
    if (asks.isEmpty || bids.isEmpty) return null;
    final List<double> prices = <double>[
      ...asks.map((AggBookLevel r) => r.price),
      ...bids.map((AggBookLevel r) => r.price),
    ];
    final double minP = prices.reduce((double a, double b) => a < b ? a : b);
    final double maxP = prices.reduce((double a, double b) => a > b ? a : b);
    final double maxCum = <double>[
      asks.first.total,
      bids.last.total,
    ].reduce((double a, double b) => a > b ? a : b);
    if (maxP <= minP || maxCum <= 0) return null;
    return _DepthExtent(minP: minP, maxP: maxP, maxCum: maxCum);
  }
}

class _DepthPainter extends CustomPainter {
  _DepthPainter({
    required this.asks,
    required this.bids,
    required this.upColor,
    required this.downColor,
    required this.gridColor,
    required this.padRight,
    required this.padBottom,
  });

  final List<AggBookLevel> asks;
  final List<AggBookLevel> bids;
  final Color upColor;
  final Color downColor;
  final Color gridColor;
  final double padRight;
  final double padBottom;

  @override
  void paint(Canvas canvas, Size size) {
    final _DepthExtent? extent = _DepthExtent.from(asks: asks, bids: bids);
    if (extent == null) return;

    final double plotW = size.width - padRight;
    final double plotH = size.height - padBottom;
    if (plotW <= 0 || plotH <= 0) return;

    double x(double p) =>
        (p - extent.minP) / (extent.maxP - extent.minP) * plotW;
    double y(double v) => plotH - (v / extent.maxCum) * plotH;

    // 虚线网格（设计稿 strokeDasharray "2 3"）。
    final Paint grid = Paint()
      ..color = gridColor
      ..strokeWidth = 0.6;
    for (final double t in AggDepthChart._ticks) {
      final double yy = y(t * extent.maxCum);
      _drawDashedLine(canvas, Offset(0, yy), Offset(plotW, yy), grid);
    }

    _drawSide(canvas, plotH, bids.toList(), y, x, upColor);
    _drawSide(canvas, plotH, asks.reversed.toList(), y, x, downColor);
  }

  /// 画水平虚线，dash 2 / gap 3，贴合设计稿 `2 3`。
  void _drawDashedLine(Canvas canvas, Offset from, Offset to, Paint paint) {
    const double dash = 2;
    const double gap = 3;
    final double total = (to - from).distance;
    if (total <= 0) return;
    final double dx = (to.dx - from.dx) / total;
    final double dy = (to.dy - from.dy) / total;
    double drawn = 0;
    while (drawn < total) {
      final double seg = (drawn + dash).clamp(0.0, total) - drawn;
      final Offset a = Offset(from.dx + dx * drawn, from.dy + dy * drawn);
      final Offset b =
          Offset(from.dx + dx * (drawn + seg), from.dy + dy * (drawn + seg));
      canvas.drawLine(a, b, paint);
      drawn += dash + gap;
    }
  }

  void _drawSide(
    Canvas canvas,
    double plotH,
    List<AggBookLevel> rows,
    double Function(double) y,
    double Function(double) x,
    Color color,
  ) {
    final List<AggBookLevel> sorted = rows.toList()
      ..sort((AggBookLevel a, AggBookLevel b) => a.price.compareTo(b.price));
    final List<Offset> pts = sorted
        .map((AggBookLevel r) => Offset(x(r.price), y(r.total)))
        .toList();
    if (pts.isEmpty) return;

    final Path line = Path()..moveTo(pts.first.dx, pts.first.dy);
    for (int i = 1; i < pts.length; i++) {
      line.lineTo(pts[i].dx, pts[i].dy);
    }
    final Path fill = Path.from(line)
      ..lineTo(pts.last.dx, plotH)
      ..lineTo(pts.first.dx, plotH)
      ..close();

    canvas.drawPath(
      fill,
      Paint()
        ..color = color.withValues(alpha: 0.18)
        ..style = PaintingStyle.fill,
    );
    canvas.drawPath(
      line,
      Paint()
        ..color = color
        ..strokeWidth = 1.6
        ..style = PaintingStyle.stroke,
    );
  }

  @override
  bool shouldRepaint(_DepthPainter old) =>
      old.asks != asks ||
      old.bids != bids ||
      old.upColor != upColor ||
      old.downColor != downColor ||
      old.gridColor != gridColor ||
      old.padRight != padRight ||
      old.padBottom != padBottom;
}
