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
/// Visual variant of [QzStatChip].
///
/// * [QzStatChipVariant.soft] — 浅色背景 + 彩色文字（默认；兼容历史使用方）。
/// * [QzStatChipVariant.solid] — 实心红/绿色背景 + 白色文字（行情列表设计稿）。
enum QzStatChipVariant { soft, solid }

/// [value] is expressed as a fraction (e.g. `0.0123` → "+1.23%").
class QzStatChip extends StatelessWidget {
  const QzStatChip({
    super.key,
    required this.value,
    this.showSign = true,
    this.decimals = 2,
    this.variant = QzStatChipVariant.soft,
    this.minWidth,
    this.height,
    this.radius,
  }) : assert(
         decimals >= 0 && decimals <= 20,
         'QzStatChip.decimals must satisfy 0 <= decimals <= 20',
       );

  final double value;
  final bool showSign;
  final int decimals;
  final QzStatChipVariant variant;
  final double? minWidth;
  final double? height;
  final double? radius;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final bool solid = variant == QzStatChipVariant.solid;
    final double h = height ?? (solid ? 28 : 22);
    final double r = radius ?? (solid ? 6 : QzRadii.pill);
    // NaN/Infinity inputs come from real-world data (e.g. div-by-zero in
    // change-rate calculation). Render an explicit "--" placeholder rather
    // than letting `toStringAsFixed` emit "NaN%" / "Infinity%".
    if (!value.isFinite) {
      return _placeholder(c, h, r);
    }
    final ({Color bg, Color fg}) palette;
    if (solid) {
      if (value > 0) {
        palette = (bg: c.marketUp, fg: Colors.white);
      } else if (value < 0) {
        palette = (bg: c.marketDown, fg: Colors.white);
      } else {
        palette = (bg: c.bgSoft, fg: c.textMid);
      }
    } else {
      if (value > 0) {
        palette = (bg: c.marketUp.withValues(alpha: 0.14), fg: c.marketUp);
      } else if (value < 0) {
        palette = (bg: c.marketDown.withValues(alpha: 0.14), fg: c.marketDown);
      } else {
        palette = (bg: c.bgSoft, fg: c.textMid);
      }
    }

    final String formatted = (value.abs() * 100).toStringAsFixed(decimals);
    final String sign = !showSign || value == 0
        ? ''
        : value > 0
        ? '+'
        : '-';
    final String text = '$sign$formatted%';

    return Container(
      height: h,
      constraints: minWidth != null
          ? BoxConstraints(minWidth: minWidth!)
          : null,
      padding: EdgeInsets.symmetric(horizontal: solid ? 10 : QzSpacing.sm),
      decoration: BoxDecoration(
        color: palette.bg,
        borderRadius: BorderRadius.circular(r),
      ),
      child: Align(
        widthFactor: 1,
        alignment: Alignment.center,
        child: Text(
          text,
          style: TextStyle(
            color: palette.fg,
            fontSize: solid ? 13 : 11,
            fontWeight: FontWeight.w600,
            fontFamily: QzFont.mono,
            fontFamilyFallback: QzFont.monoFallback,
            height: 1.0,
          ),
        ),
      ),
    );
  }

  Widget _placeholder(QzColorScheme c, double h, double r) {
    return Container(
      height: h,
      constraints: minWidth != null
          ? BoxConstraints(minWidth: minWidth!)
          : null,
      padding: EdgeInsets.symmetric(
        horizontal: variant == QzStatChipVariant.solid ? 10 : QzSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: c.bgSoft,
        borderRadius: BorderRadius.circular(r),
      ),
      child: Align(
        widthFactor: 1,
        alignment: Alignment.center,
        child: Text(
          '--',
          style: TextStyle(
            color: c.textDim,
            fontSize: variant == QzStatChipVariant.solid ? 13 : 11,
            fontWeight: FontWeight.w600,
            height: 1.0,
          ),
        ),
      ),
    );
  }
}
