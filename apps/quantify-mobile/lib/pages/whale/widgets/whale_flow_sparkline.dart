import 'package:flutter/material.dart';

import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';

/// Mini area sparkline。21 个固定点，模拟"1H 净流入趋势"。
///
/// 与原型 `design/project/mobile/m-screens-4.jsx::FlowSpark` 1:1 还原。
class WhaleFlowSparkline extends StatelessWidget {
  const WhaleFlowSparkline({
    super.key,
    this.tone = 'up',
    this.width = 96,
    this.height = 28,
  });

  final String tone; // 'up' | 'dn'
  final double width;
  final double height;

  static const List<double> _points = <double>[
    0, 3, 2, 5, 4, 7, 6, 9, 11, 10, 14, 16, 15, 18, 22, 21, 24, 28, 30, 34, 38,
  ];

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color color = tone == 'dn' ? c.marketDown : c.marketUp;
    return SizedBox(
      width: width,
      height: height,
      child: CustomPaint(
        painter: _SparkPainter(points: _points, color: color),
      ),
    );
  }
}

class _SparkPainter extends CustomPainter {
  _SparkPainter({required this.points, required this.color});

  final List<double> points;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    if (points.isEmpty) return;
    final double maxVal = 38;
    final double step = size.width / (points.length - 1);
    final Path line = Path();
    for (int i = 0; i < points.length; i++) {
      final double x = i * step;
      final double y = size.height - (points[i] / maxVal) * size.height * 0.9 - 2;
      if (i == 0) {
        line.moveTo(x, y);
      } else {
        line.lineTo(x, y);
      }
    }
    final Path area = Path.from(line)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();

    final Paint fillPaint = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: <Color>[
          color.withValues(alpha: 0.28),
          color.withValues(alpha: 0),
        ],
      ).createShader(Offset.zero & size);
    canvas.drawPath(area, fillPaint);

    final Paint linePaint = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.4
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(line, linePaint);
  }

  @override
  bool shouldRepaint(covariant _SparkPainter old) =>
      old.color != color || old.points != points;
}
