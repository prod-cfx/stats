import 'package:flutter/material.dart';

import '../theme/colors.dart';
import '../theme/theme_context.dart';
import '../theme/tokens.dart';

/// Initials avatar used by lists and headers.
///
/// Prototype `Av({sym, bg, size, mono})`. [monospace] swaps to the
/// monospace font fallback for token symbols where each glyph should align
/// (e.g. `BTC`, `ETH`).
class QzAvatar extends StatelessWidget {
  const QzAvatar({
    super.key,
    required this.label,
    this.backgroundColor,
    this.size = 32,
    this.monospace = false,
  }) : assert(size > 0, 'QzAvatar.size must be positive');

  final String label;
  final Color? backgroundColor;
  final double size;
  final bool monospace;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: backgroundColor ?? c.accent,
        shape: BoxShape.circle,
      ),
      alignment: Alignment.center,
      child: Text(
        label,
        style: TextStyle(
          color: c.accentOn,
          fontSize: (size * 0.42).roundToDouble(),
          fontWeight: FontWeight.w700,
          fontFamily: monospace ? QzFont.mono : null,
          fontFamilyFallback:
              monospace ? QzFont.monoFallback : QzFont.sansFallback,
          height: 1.0,
        ),
      ),
    );
  }
}
