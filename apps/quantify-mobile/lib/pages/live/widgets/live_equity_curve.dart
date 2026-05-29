import 'package:flutter/material.dart';

import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';

/// 实盘策略详情 hero 权益曲线（#1752）。
///
/// 对齐设计稿 `LsDetailCurve`：3 条横向网格虚线 + 折线 + 渐变填充 + 末点圆点。
/// 输入 [points] 为原始权益序列，内部按 min/max 归一化绘制；颜色随 [up] 切换
/// 涨/跌色（来自 `QzColorScheme.marketUp/marketDown`）。
class LiveEquityCurve extends StatelessWidget {
  const LiveEquityCurve({
    super.key,
    required this.points,
    required this.up,
    this.height = 120,
  });

  final List<double> points;
  final bool up;
  final double height;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return SizedBox(
      height: height,
      width: double.infinity,
      child: CustomPaint(
        painter: _CurvePainter(
          points: points,
          color: up ? c.marketUp : c.marketDown,
          gridColor: c.borderSoft,
          dotBorder: c.bgElev,
        ),
      ),
    );
  }
}

class _CurvePainter extends CustomPainter {
  _CurvePainter({
    required this.points,
    required this.color,
    required this.gridColor,
    required this.dotBorder,
  });

  final List<double> points;
  final Color color;
  final Color gridColor;
  final Color dotBorder;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.length < 2) return;
    const double pad = 6;
    final double w = size.width;
    final double h = size.height;
    final double minV = points.reduce((double a, double b) => a < b ? a : b);
    final double maxV = points.reduce((double a, double b) => a > b ? a : b);
    final double span = (maxV - minV) == 0 ? 1 : (maxV - minV);

    // 网格虚线（3 条）。
    final Paint gridPaint = Paint()
      ..color = gridColor
      ..strokeWidth = 1;
    for (final double f in <double>[0.25, 0.5, 0.75]) {
      final double y = h * f;
      _dashedLine(canvas, Offset(pad, y), Offset(w - pad, y), gridPaint);
    }

    final List<Offset> pts = <Offset>[];
    for (int i = 0; i < points.length; i++) {
      final double x = (i / (points.length - 1)) * (w - 12) + pad;
      final double y = (1 - (points[i] - minV) / span) * (h - 20) + 10;
      pts.add(Offset(x, y));
    }

    final Path line = Path()..moveTo(pts.first.dx, pts.first.dy);
    for (final Offset p in pts.skip(1)) {
      line.lineTo(p.dx, p.dy);
    }

    // 渐变填充。
    final Path fill = Path.from(line)
      ..lineTo(pts.last.dx, h - pad)
      ..lineTo(pts.first.dx, h - pad)
      ..close();
    final Paint fillPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: <Color>[
          color.withValues(alpha: 0.22),
          color.withValues(alpha: 0),
        ],
      ).createShader(Rect.fromLTWH(0, 0, w, h));
    canvas.drawPath(fill, fillPaint);

    canvas.drawPath(
      line,
      Paint()
        ..color = color
        ..strokeWidth = 1.8
        ..style = PaintingStyle.stroke,
    );

    // 末点圆点 + 白描边。
    canvas.drawCircle(pts.last, 4, Paint()..color = color);
    canvas.drawCircle(
      pts.last,
      4,
      Paint()
        ..color = dotBorder
        ..strokeWidth = 2
        ..style = PaintingStyle.stroke,
    );
  }

  void _dashedLine(Canvas canvas, Offset from, Offset to, Paint paint) {
    const double dash = 2;
    const double gap = 4;
    final double total = (to - from).distance;
    final Offset dir = (to - from) / total;
    double drawn = 0;
    while (drawn < total) {
      final double end = (drawn + dash).clamp(0, total).toDouble();
      canvas.drawLine(from + dir * drawn, from + dir * end, paint);
      drawn += dash + gap;
    }
  }

  @override
  bool shouldRepaint(_CurvePainter old) =>
      old.points != points || old.color != color;
}
