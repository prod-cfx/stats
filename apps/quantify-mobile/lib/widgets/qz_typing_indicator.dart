import 'package:flutter/material.dart';

import '../theme/colors.dart';
import '../theme/theme_context.dart';
import '../theme/tokens.dart';

/// Assistant 3 点跳动「正在输入」指示器（#1557）。
///
/// 与 `QzChatBubble` 并列使用 — 在 streaming 开始前的 200ms 思考窗口里
/// 出现在最后一条气泡的位置；当 reply 首个 token 到达后由调用方移除。
///
/// 动画语义对齐原型 `@keyframes qfDot`：每点 1s 一个循环，第 0/1/2 点
/// 之间各错开 150ms；峰值上跳 3px、透明度 0.25 → 1.0。
class QzTypingIndicator extends StatefulWidget {
  const QzTypingIndicator({super.key});

  @override
  State<QzTypingIndicator> createState() => _QzTypingIndicatorState();
}

class _QzTypingIndicatorState extends State<QzTypingIndicator>
    with SingleTickerProviderStateMixin {
  late final AnimationController _ctrl = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1000),
  )..repeat();

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Align(
      alignment: Alignment.centerLeft,
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: QzSpacing.md,
          vertical: QzSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: c.bgSoft,
          border: Border.all(color: c.border),
          borderRadius: BorderRadius.circular(QzRadii.card),
        ),
        child: AnimatedBuilder(
          animation: _ctrl,
          builder: (BuildContext ctx, Widget? _) {
            return Row(
              key: const Key('ai-typing-indicator'),
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                _Dot(t: _ctrl.value, phase: 0.0, color: c.textDim),
                const SizedBox(width: 5),
                _Dot(t: _ctrl.value, phase: 0.15, color: c.textDim),
                const SizedBox(width: 5),
                _Dot(t: _ctrl.value, phase: 0.30, color: c.textDim),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _Dot extends StatelessWidget {
  const _Dot({required this.t, required this.phase, required this.color});

  final double t;
  final double phase;
  final Color color;

  @override
  Widget build(BuildContext context) {
    // 把循环值偏移 phase 后映射到 0..1，再走 ease-in-out 三段曲线：
    // 0..0.4 升 → 0.4..0.8 降 → 0.8..1 平。
    double v = (t - phase) % 1.0;
    if (v < 0) v += 1.0;
    double opacity;
    double dy;
    if (v < 0.4) {
      final double p = v / 0.4;
      opacity = 0.25 + (1.0 - 0.25) * p;
      dy = -3.0 * p;
    } else if (v < 0.8) {
      final double p = (v - 0.4) / 0.4;
      opacity = 1.0 - (1.0 - 0.25) * p;
      dy = -3.0 * (1.0 - p);
    } else {
      opacity = 0.25;
      dy = 0.0;
    }
    return Transform.translate(
      offset: Offset(0, dy),
      child: Opacity(
        opacity: opacity,
        child: Container(
          width: 6,
          height: 6,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(3),
          ),
        ),
      ),
    );
  }
}
