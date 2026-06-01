import 'package:flutter/material.dart';

import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';

/// 列表卡微型权益曲线（#1975）。
///
/// 对齐设计稿 `LsSpark`（jsx:1106，88×36）：折线 + 顶部渐变填充 + 末点圆点，
/// 无网格线（与详情页 `LiveEquityCurve` 的差异点）。颜色随 [up] 切换涨/跌色。
/// [points] 为归一化前的原始权益序列，内部按 min/max 归一化绘制；点数 < 2 时
/// 不绘制（留空白占位，保持布局稳定）。
class LiveSparkline extends StatelessWidget {
  const LiveSparkline({
    super.key,
    required this.points,
    required this.up,
    this.width = 88,
    this.height = 36,
  });

  final List<double> points;
  final bool up;
  final double width;
  final double height;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return SizedBox(
      width: width,
      height: height,
      child: CustomPaint(
        painter: _SparkPainter(
          points: points,
          color: up ? c.marketUp : c.marketDown,
          dotBorder: c.bgElev,
        ),
      ),
    );
  }
}

class _SparkPainter extends CustomPainter {
  _SparkPainter({
    required this.points,
    required this.color,
    required this.dotBorder,
  });

  final List<double> points;
  final Color color;
  final Color dotBorder;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.length < 2) return;
    final double w = size.width;
    final double h = size.height;
    final double minV = points.reduce((double a, double b) => a < b ? a : b);
    final double maxV = points.reduce((double a, double b) => a > b ? a : b);
    final double span = (maxV - minV) == 0 ? 1 : (maxV - minV);

    final List<Offset> pts = <Offset>[];
    for (int i = 0; i < points.length; i++) {
      final double x = (i / (points.length - 1)) * (w - 2) + 1;
      final double y = (1 - (points[i] - minV) / span) * (h - 6) + 3;
      pts.add(Offset(x, y));
    }

    final Path line = Path()..moveTo(pts.first.dx, pts.first.dy);
    for (final Offset p in pts.skip(1)) {
      line.lineTo(p.dx, p.dy);
    }

    // 顶部渐变填充。
    final Path fill = Path.from(line)
      ..lineTo(pts.last.dx, h - 3)
      ..lineTo(pts.first.dx, h - 3)
      ..close();
    canvas.drawPath(
      fill,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: <Color>[
            color.withValues(alpha: 0.22),
            color.withValues(alpha: 0),
          ],
        ).createShader(Rect.fromLTWH(0, 0, w, h)),
    );

    canvas.drawPath(
      line,
      Paint()
        ..color = color
        ..strokeWidth = 1.4
        ..style = PaintingStyle.stroke,
    );

    // 末点圆点 + 描边。
    canvas.drawCircle(pts.last, 2.5, Paint()..color = color);
    canvas.drawCircle(
      pts.last,
      2.5,
      Paint()
        ..color = dotBorder
        ..strokeWidth = 1.2
        ..style = PaintingStyle.stroke,
    );
  }

  @override
  bool shouldRepaint(_SparkPainter old) =>
      old.points != points || old.color != color;
}
