import 'package:flutter/material.dart';

import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';

class LongShortBar extends StatelessWidget {
  const LongShortBar({
    super.key,
    required this.longRatio,
    required this.shortRatio,
    this.height = 32,
    this.radius = 6,
    this.precision = 2,
  });

  final double longRatio;
  final double shortRatio;
  final double height;
  final double radius;
  final int precision;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    // Sanitize：任一侧 NaN/Infinity → 双侧统一回退到中性 0.5/0.5；
    // 否则 clamp 到 [0,1] 再按总和归一化。总和为 0 时也回退中性。
    final bool bothFinite = longRatio.isFinite && shortRatio.isFinite;
    final double l = bothFinite ? longRatio.clamp(0.0, 1.0) : 0.5;
    final double s = bothFinite ? shortRatio.clamp(0.0, 1.0) : 0.5;
    final double total = l + s;
    final double ln = total > 0 ? l / total : 0.5;
    final double sn = total > 0 ? s / total : 0.5;
    final int longFlex = (ln * 1000).round().clamp(1, 999);
    final int shortFlex = (sn * 1000).round().clamp(1, 999);
    return ClipRRect(
      borderRadius: BorderRadius.circular(radius),
      child: SizedBox(
        height: height,
        child: Row(
          children: <Widget>[
            Expanded(
              flex: longFlex,
              child: _Segment(
                color: c.marketUp,
                text: '${(ln * 100).toStringAsFixed(precision)}%',
              ),
            ),
            Expanded(
              flex: shortFlex,
              child: _Segment(
                color: c.marketDown,
                text: '${(sn * 100).toStringAsFixed(precision)}%',
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Segment extends StatelessWidget {
  const _Segment({required this.color, required this.text});

  final Color color;
  final String text;

  @override
  Widget build(BuildContext context) {
    return Container(
      color: color,
      alignment: Alignment.center,
      child: Text(
        text,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 12,
          fontWeight: FontWeight.w700,
          height: 1,
        ),
      ),
    );
  }
}
