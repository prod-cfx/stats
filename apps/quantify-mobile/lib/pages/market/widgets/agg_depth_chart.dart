import 'package:flutter/material.dart';

import '../../../data/models/agg_orders_models.dart';

/// 累计深度图（设计稿 `DepthChart`:862）。
///
/// bids 绿色填充 + 描边（左半 / 高累计→近 mid 低累计），asks 红色填充 + 描边
/// （右半），叠加水平网格线。X 轴价格升序，Y 轴累计数量。
class AggDepthChart extends StatelessWidget {
  const AggDepthChart({
    super.key,
    required this.asks,
    required this.bids,
    required this.upColor,
    required this.downColor,
    required this.gridColor,
  });

  final List<AggBookLevel> asks;
  final List<AggBookLevel> bids;
  final Color upColor;
  final Color downColor;
  final Color gridColor;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 140,
      width: double.infinity,
      child: CustomPaint(
        painter: _DepthPainter(
          asks: asks,
          bids: bids,
          upColor: upColor,
          downColor: downColor,
          gridColor: gridColor,
        ),
      ),
    );
  }
}

class _DepthPainter extends CustomPainter {
  _DepthPainter({
    required this.asks,
    required this.bids,
    required this.upColor,
    required this.downColor,
    required this.gridColor,
  });

  final List<AggBookLevel> asks;
  final List<AggBookLevel> bids;
  final Color upColor;
  final Color downColor;
  final Color gridColor;

  @override
  void paint(Canvas canvas, Size size) {
    if (asks.isEmpty || bids.isEmpty) return;
    final List<double> prices = <double>[
      ...asks.map((AggBookLevel r) => r.price),
      ...bids.map((AggBookLevel r) => r.price),
    ];
    final double minP = prices.reduce((double a, double b) => a < b ? a : b);
    final double maxP = prices.reduce((double a, double b) => a > b ? a : b);
    final double maxCum = <double>[
      asks.isEmpty ? 0 : asks.first.total,
      bids.isEmpty ? 0 : bids.last.total,
    ].reduce((double a, double b) => a > b ? a : b);
    if (maxP <= minP || maxCum <= 0) return;

    final double padBottom = 4;
    final double usableH = size.height - padBottom;
    double x(double p) => (p - minP) / (maxP - minP) * size.width;
    double y(double v) => size.height - padBottom - (v / maxCum) * usableH;

    // grid
    final Paint grid = Paint()
      ..color = gridColor
      ..strokeWidth = 0.6;
    for (final double t in <double>[0, 0.25, 0.5, 0.75, 1]) {
      final double yy = y(t * maxCum);
      canvas.drawLine(Offset(0, yy), Offset(size.width, yy), grid);
    }

    _drawSide(canvas, size, bids.toList(), y, x, upColor, ascByPrice: true);
    _drawSide(canvas, size, asks.reversed.toList(), y, x, downColor,
        ascByPrice: false);
  }

  void _drawSide(
    Canvas canvas,
    Size size,
    List<AggBookLevel> rows,
    double Function(double) y,
    double Function(double) x,
    Color color, {
    required bool ascByPrice,
  }) {
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
      ..lineTo(pts.last.dx, size.height - 4)
      ..lineTo(pts.first.dx, size.height - 4)
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
      old.gridColor != gridColor;
}
