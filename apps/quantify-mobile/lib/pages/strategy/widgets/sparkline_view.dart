import 'package:flutter/material.dart';

import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';

/// 占位 sparkline：把 [data] 归一化后画折线。
///
/// 不画 K 线、不渲染坐标轴；仅用于策略卡片的视觉提示。颜色读 `accent` token，
/// 跟随当前主题。data 长度 < 2 时退化为单点中线。
class SparklineView extends StatelessWidget {
  const SparklineView({
    super.key,
    required this.data,
    this.height = 24,
    this.strokeWidth = 1.5,
    this.showFill = false,
  });

  final List<double> data;
  final double height;
  final double strokeWidth;
  final bool showFill;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return SizedBox(
      height: height,
      width: double.infinity,
      child: CustomPaint(
        painter: _SparkPainter(
          data: data,
          color: c.accent,
          strokeWidth: strokeWidth,
          showFill: showFill,
        ),
      ),
    );
  }
}

class _SparkPainter extends CustomPainter {
  _SparkPainter({
    required this.data,
    required this.color,
    required this.strokeWidth,
    required this.showFill,
  });

  final List<double> data;
  final Color color;
  final double strokeWidth;
  final bool showFill;

  @override
  void paint(Canvas canvas, Size size) {
    if (data.isEmpty || size.width <= 0 || size.height <= 0) return;
    final Paint paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;
    if (data.length == 1) {
      final double y = size.height / 2;
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
    final Path path = Path();
    final Path fillPath = Path();
    for (int i = 0; i < data.length; i++) {
      final double x = (i / (data.length - 1)) * size.width;
      final double normalized = (data[i] - minV) / span;
      // 上界 0、下界 size.height — y 反向：值大画在上面
      final double y = size.height - normalized * size.height;
      if (i == 0) {
        path.moveTo(x, y);
        fillPath.moveTo(x, size.height);
        fillPath.lineTo(x, y);
      } else {
        path.lineTo(x, y);
        fillPath.lineTo(x, y);
      }
    }
    if (showFill) {
      fillPath.lineTo(size.width, size.height);
      fillPath.close();
      canvas.drawPath(
        fillPath,
        Paint()
          ..shader = LinearGradient(
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
            colors: <Color>[
              color.withValues(alpha: 0.18),
              color.withValues(alpha: 0.0),
            ],
          ).createShader(Offset.zero & size),
      );
    }
    canvas.drawPath(path, paint);
  }

  @override
  bool shouldRepaint(covariant _SparkPainter old) =>
      old.data != data ||
      old.color != color ||
      old.strokeWidth != strokeWidth ||
      old.showFill != showFill;
}
