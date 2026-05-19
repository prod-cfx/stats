import 'package:flutter/material.dart';

import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';

/// 真实 equity 曲线（#1565）。
///
/// CustomPaint 折线 + 顶下渐变填充 + 起末水平参考线。值域基于输入 [data]
/// 自适应；用 `accent` token 着色保证主题切换。
///
/// 与 [SparklineView] 的区别：
///   - 高度更大（默认 140），用于详情页核心展示
///   - 渲染填充面 + 起点参考线
class EquityCurveView extends StatelessWidget {
  const EquityCurveView({
    super.key,
    required this.data,
    this.height = 140,
    this.strokeWidth = 1.6,
  });

  final List<double> data;
  final double height;
  final double strokeWidth;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    // 判断趋势：终值 >= 起值 视为上行
    final bool up = data.length >= 2 ? data.last >= data.first : true;
    final Color stroke = up ? c.marketUp : c.marketDown;
    return SizedBox(
      height: height,
      width: double.infinity,
      child: CustomPaint(
        painter: _EquityPainter(
          data: data,
          stroke: stroke,
          strokeWidth: strokeWidth,
          gridColor: c.borderSoft,
        ),
      ),
    );
  }
}

class _EquityPainter extends CustomPainter {
  _EquityPainter({
    required this.data,
    required this.stroke,
    required this.strokeWidth,
    required this.gridColor,
  });

  final List<double> data;
  final Color stroke;
  final double strokeWidth;
  final Color gridColor;

  @override
  void paint(Canvas canvas, Size size) {
    if (data.isEmpty || size.width <= 0 || size.height <= 0) return;

    // 1. grid（水平 3 条虚线）
    final Paint gridPaint = Paint()
      ..color = gridColor
      ..strokeWidth = 0.6
      ..style = PaintingStyle.stroke;
    for (final double r in <double>[0.25, 0.5, 0.75]) {
      final double y = size.height * r;
      _drawDashed(canvas, Offset(0, y), Offset(size.width, y), gridPaint);
    }

    // 2. data path
    if (data.length == 1) {
      final double y = size.height / 2;
      final Paint paint = Paint()
        ..color = stroke
        ..strokeWidth = strokeWidth
        ..style = PaintingStyle.stroke;
      canvas.drawLine(Offset(0, y), Offset(size.width, y), paint);
      return;
    }
    double minV = data.first;
    double maxV = data.first;
    for (final double v in data) {
      if (v < minV) minV = v;
      if (v > maxV) maxV = v;
    }
    final double span = (maxV - minV).abs() < 1e-9 ? 1 : (maxV - minV);
    final Path linePath = Path();
    final Path fillPath = Path();
    for (int i = 0; i < data.length; i++) {
      final double x = (i / (data.length - 1)) * size.width;
      final double normalized = (data[i] - minV) / span;
      final double y = size.height - normalized * (size.height - 8) - 4;
      if (i == 0) {
        linePath.moveTo(x, y);
        fillPath.moveTo(x, size.height);
        fillPath.lineTo(x, y);
      } else {
        linePath.lineTo(x, y);
        fillPath.lineTo(x, y);
      }
    }
    fillPath.lineTo(size.width, size.height);
    fillPath.close();

    canvas.drawPath(
      fillPath,
      Paint()
        ..shader = LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: <Color>[
            stroke.withValues(alpha: 0.28),
            stroke.withValues(alpha: 0.0),
          ],
        ).createShader(Offset.zero & size),
    );
    canvas.drawPath(
      linePath,
      Paint()
        ..color = stroke
        ..strokeWidth = strokeWidth
        ..style = PaintingStyle.stroke
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
  }

  /// 仅供水平 / 垂直线段使用（grid 线）。`total` 用曼哈顿距离，
  /// 在斜线场景下虚线密度会失真——如需复用到任意角度，应改用欧氏距离
  /// `sqrt(dx*dx + dy*dy)`。
  void _drawDashed(Canvas canvas, Offset a, Offset b, Paint paint) {
    const double dash = 4;
    const double gap = 4;
    final double dx = b.dx - a.dx;
    final double dy = b.dy - a.dy;
    final double total = (dx.abs() + dy.abs());
    if (total <= 0) return;
    double traveled = 0;
    while (traveled < total) {
      final double t1 = traveled / total;
      final double t2 = ((traveled + dash).clamp(0, total)) / total;
      canvas.drawLine(
        Offset(a.dx + dx * t1, a.dy + dy * t1),
        Offset(a.dx + dx * t2, a.dy + dy * t2),
        paint,
      );
      traveled += dash + gap;
    }
  }

  @override
  bool shouldRepaint(covariant _EquityPainter old) =>
      old.data != data ||
      old.stroke != stroke ||
      old.strokeWidth != strokeWidth ||
      old.gridColor != gridColor;
}
