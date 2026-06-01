import 'package:flutter/material.dart';

/// 呼吸脉冲圆点（对齐设计稿 `mw-pulse` 动画：`m-screens-4.jsx:488`）。
///
/// 实心圆点外层叠加一圈向外扩散并淡出的光环（对应 CSS `box-shadow`
/// `0 0 0 0 → 0 0 0 6px transparent`，1.6s 无限循环）。无障碍上视为装饰，
/// 由父级文案（如 `LIVE`）承担语义。
///
/// 注意：动画为无限循环，含本 widget 的测试树不要用 `pumpAndSettle()`
/// （永不 settle），改用固定步长 `pump(Duration)`。
class QzPulseDot extends StatefulWidget {
  const QzPulseDot({
    super.key,
    required this.color,
    this.size = 6,
    this.ringSpread = 6,
    this.period = const Duration(milliseconds: 1600),
  });

  /// 圆点与光环颜色。
  final Color color;

  /// 实心圆点直径。
  final double size;

  /// 光环相对圆点边缘的最大扩散半径（对应 CSS 的 `6px` spread）。
  final double ringSpread;

  /// 单次脉冲周期。
  final Duration period;

  @override
  State<QzPulseDot> createState() => _QzPulseDotState();
}

class _QzPulseDotState extends State<QzPulseDot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: widget.period,
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // 光环占位：圆点 + 两侧各 ringSpread。
    final double extent = widget.size + widget.ringSpread * 2;
    return SizedBox(
      width: extent,
      height: extent,
      child: Center(
        child: AnimatedBuilder(
          animation: _controller,
          builder: (BuildContext context, Widget? child) {
            return CustomPaint(
              size: Size(extent, extent),
              painter: _PulsePainter(
                progress: _controller.value,
                color: widget.color,
                dotRadius: widget.size / 2,
                maxSpread: widget.ringSpread,
              ),
            );
          },
        ),
      ),
    );
  }
}

class _PulsePainter extends CustomPainter {
  _PulsePainter({
    required this.progress,
    required this.color,
    required this.dotRadius,
    required this.maxSpread,
  });

  /// 动画进度 0..1。
  final double progress;
  final Color color;
  final double dotRadius;
  final double maxSpread;

  @override
  void paint(Canvas canvas, Size size) {
    final Offset center = Offset(size.width / 2, size.height / 2);

    // 光环：0→70% 扩散到 maxSpread 并淡出，70%→100% 静默（对齐 keyframes）。
    final double ringT = (progress / 0.7).clamp(0.0, 1.0);
    if (progress < 0.7) {
      final double ringRadius = dotRadius + maxSpread * ringT;
      final double opacity = (1 - ringT) * 0.45;
      final Paint ring = Paint()..color = color.withValues(alpha: opacity);
      canvas.drawCircle(center, ringRadius, ring);
    }

    // 实心圆点（始终不透明）。
    final Paint dot = Paint()..color = color;
    canvas.drawCircle(center, dotRadius, dot);
  }

  @override
  bool shouldRepaint(_PulsePainter old) =>
      old.progress != progress ||
      old.color != color ||
      old.dotRadius != dotRadius ||
      old.maxSpread != maxSpread;
}
