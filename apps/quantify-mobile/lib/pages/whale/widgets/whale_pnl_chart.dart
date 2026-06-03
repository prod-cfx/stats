import 'package:flutter/material.dart';

import '../../../data/models/whale_profile_models.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 基本信息 tab 的 P&L 曲线图（设计稿 `WhaleProfileDetail` P&L chart `:760`）。
///
/// area + line + 横向虚线网格 + 右侧 Y 轴标签（单位 K）。坐标映射对齐设计：
/// 纵轴 top=400 / span=700（400K..-300K），消费 [WhalePnlPoint]（x:0..276）。
/// 末点正负决定 up/dn 配色。空数据降级为占位文案。
class WhalePnlChart extends StatelessWidget {
  const WhalePnlChart({super.key, required this.points, this.totalDisplay});

  final List<WhalePnlPoint> points;

  /// 折线图顶部总盈亏金额展示串（设计稿 `:768`，例如 '$ -172.51K'）。
  /// 为空时不渲染顶部数值。
  final String? totalDisplay;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    if (points.isEmpty) {
      return SizedBox(
        height: 140,
        child: Center(
          child: Text('—', style: TextStyle(color: c.textFaint, fontSize: 12)),
        ),
      );
    }
    final bool down = points.last.valueK < 0;
    final Color tone = down ? c.marketDown : c.marketUp;
    final String? total = totalDisplay;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        if (total != null) ...<Widget>[
          Text(
            total,
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: tone,
              fontFamily: QzFont.mono,
              fontFamilyFallback: QzFont.monoFallback,
            ),
          ),
          const SizedBox(height: QzSpacing.sm),
        ],
        _ChartBody(points: points, tone: tone, scheme: c),
      ],
    );
  }
}

/// 折线图主体（曲线 + 网格 + Y 轴刻度），高度固定 140。
class _ChartBody extends StatelessWidget {
  const _ChartBody({
    required this.points,
    required this.tone,
    required this.scheme,
  });
  final List<WhalePnlPoint> points;
  final Color tone;
  final QzColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = scheme;
    return SizedBox(
      height: 140,
      child: LayoutBuilder(
        builder: (BuildContext context, BoxConstraints constraints) {
          const double labelWidth = 30;
          return Stack(
            children: <Widget>[
              Positioned(
                left: 0,
                right: labelWidth,
                top: 0,
                bottom: 0,
                child: CustomPaint(
                  painter: _PnlPainter(
                    points: points,
                    line: tone,
                    grid: c.borderSoft,
                    axis: c.border,
                  ),
                ),
              ),
              _AxisLabels(color: c.textFaint, height: constraints.maxHeight),
            ],
          );
        },
      ),
    );
  }
}

/// 右侧 Y 轴刻度（与网格线对齐）。
class _AxisLabels extends StatelessWidget {
  const _AxisLabels({required this.color, required this.height});
  final Color color;
  final double height;

  static const List<int> _ticks = <int>[
    400,
    300,
    200,
    100,
    0,
    -100,
    -200,
    -300,
  ];
  static const double _top = 400;
  static const double _span = 700;

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: <Widget>[
        for (final int t in _ticks)
          Positioned(
            right: 0,
            top: (((_top - t) / _span) * height) - 5,
            width: 30,
            child: Text(
              t == 0 ? '0' : '${t}K',
              textAlign: TextAlign.right,
              style: TextStyle(
                color: color,
                fontSize: 9,
                fontFamily: QzFont.mono,
                fontFamilyFallback: QzFont.monoFallback,
              ),
            ),
          ),
      ],
    );
  }
}

class _PnlPainter extends CustomPainter {
  _PnlPainter({
    required this.points,
    required this.line,
    required this.grid,
    required this.axis,
  });

  final List<WhalePnlPoint> points;
  final Color line;
  final Color grid;
  final Color axis;

  static const double _top = 400; // 纵轴顶
  static const double _span = 700; // 400K .. -300K
  static const double _maxX = 276; // 横轴满量程（设计坐标系）

  double _y(double valueK, double h) => ((_top - valueK) / _span) * h;

  @override
  void paint(Canvas canvas, Size size) {
    // 横向虚线网格（与右侧刻度同步）。
    const List<double> ticks = <double>[
      400,
      300,
      200,
      100,
      0,
      -100,
      -200,
      -300,
    ];
    for (final double v in ticks) {
      final double y = _y(v, size.height);
      final Paint g = Paint()
        ..color = v == 0 ? axis : grid
        ..strokeWidth = 1;
      _dashedLine(canvas, Offset(0, y), Offset(size.width, y), g);
    }

    final Path linePath = Path();
    for (int i = 0; i < points.length; i++) {
      final double x = (points[i].x / _maxX) * size.width;
      final double y = _y(points[i].valueK, size.height);
      if (i == 0) {
        linePath.moveTo(x, y);
      } else {
        linePath.lineTo(x, y);
      }
    }

    final Path area = Path.from(linePath)
      ..lineTo(size.width, size.height)
      ..lineTo(0, size.height)
      ..close();

    final Paint fill = Paint()
      ..shader = LinearGradient(
        begin: Alignment.topCenter,
        end: Alignment.bottomCenter,
        colors: <Color>[
          line.withValues(alpha: 0.22),
          line.withValues(alpha: 0),
        ],
      ).createShader(Offset.zero & size);
    canvas.drawPath(area, fill);

    final Paint stroke = Paint()
      ..color = line
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round
      ..strokeJoin = StrokeJoin.round;
    canvas.drawPath(linePath, stroke);
  }

  void _dashedLine(Canvas canvas, Offset from, Offset to, Paint paint) {
    const double dash = 3, gap = 3;
    final double total = (to - from).distance;
    final double dx = (to.dx - from.dx) / total;
    double drawn = 0;
    while (drawn < total) {
      final double end = (drawn + dash).clamp(0, total);
      canvas.drawLine(
        Offset(from.dx + dx * drawn, from.dy),
        Offset(from.dx + dx * end, from.dy),
        paint,
      );
      drawn += dash + gap;
    }
  }

  @override
  bool shouldRepaint(_PnlPainter old) =>
      old.points != points || old.line != line;
}
