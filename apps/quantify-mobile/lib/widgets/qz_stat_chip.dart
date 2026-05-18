import 'package:flutter/material.dart';

import '../theme/colors.dart';
import '../theme/theme_context.dart';
import '../theme/tokens.dart';

/// Market-quote delta chip. Positive values use `marketUp`, negative values
/// use `marketDown`, zero uses the neutral palette.
///
/// Color direction: tokens.css fixes `marketUp` = green (#16A36B) and
/// `marketDown` = red (#E5484D) — i.e. *green up, red down* (Western
/// convention). This is deliberate per #1503 and inherited unchanged.
///
/// [value] is expressed as a fraction (e.g. `0.0123` → "+1.23%").
class QzStatChip extends StatelessWidget {
  const QzStatChip({
    super.key,
    required this.value,
    this.showSign = true,
    this.decimals = 2,
  }) : assert(
          decimals >= 0 && decimals <= 20,
          'QzStatChip.decimals must satisfy 0 <= decimals <= 20',
        );

  final double value;
  final bool showSign;
  final int decimals;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    // NaN/Infinity inputs come from real-world data (e.g. div-by-zero in
    // change-rate calculation). Render an explicit "--" placeholder rather
    // than letting `toStringAsFixed` emit "NaN%" / "Infinity%".
    if (!value.isFinite) {
      return _placeholder(c);
    }
    final ({Color bg, Color fg}) palette;
    if (value > 0) {
      palette = (bg: c.marketUp.withValues(alpha: 0.14), fg: c.marketUp);
    } else if (value < 0) {
      palette = (
        bg: c.marketDown.withValues(alpha: 0.14),
        fg: c.marketDown,
      );
    } else {
      palette = (bg: c.bgSoft, fg: c.textMid);
    }

    final String formatted = (value.abs() * 100).toStringAsFixed(decimals);
    final String sign = !showSign || value == 0
        ? ''
        : value > 0
            ? '+'
            : '-';
    final String text = '$sign$formatted%';

    return Container(
      height: 22,
      padding: const EdgeInsets.symmetric(horizontal: QzSpacing.sm),
      decoration: BoxDecoration(
        color: palette.bg,
        borderRadius: BorderRadius.circular(QzRadii.pill),
      ),
      alignment: Alignment.center,
      child: Text(
        text,
        style: TextStyle(
          color: palette.fg,
          fontSize: 11,
          fontWeight: FontWeight.w600,
          fontFamilyFallback: QzFont.monoFallback,
          height: 1.0,
        ),
      ),
    );
  }

  Widget _placeholder(QzColorScheme c) {
    return Container(
      height: 22,
      padding: const EdgeInsets.symmetric(horizontal: QzSpacing.sm),
      decoration: BoxDecoration(
        color: c.bgSoft,
        borderRadius: BorderRadius.circular(QzRadii.pill),
      ),
      alignment: Alignment.center,
      child: Text(
        '--',
        style: TextStyle(
          color: c.textDim,
          fontSize: 11,
          fontWeight: FontWeight.w600,
          height: 1.0,
        ),
      ),
    );
  }
}
