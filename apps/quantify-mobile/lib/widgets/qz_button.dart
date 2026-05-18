import 'package:flutter/material.dart';

import '../theme/colors.dart';
import '../theme/theme_context.dart';
import '../theme/tokens.dart';
import 'qz_spinner.dart';

/// Visual variant for [QzButton].
///
/// Direct port of the mobile prototype (`design/project/mobile/m-screens-4.jsx`
/// lines 298-304): `primary` is intentionally an inverse (dark-on-light)
/// button, `ghost` is a transparent outline, and `accent` carries the
/// brand-color gradient. Do not rename `primary` to match Material's
/// "elevated" semantics — the design language deliberately differs.
enum QzButtonVariant { primary, ghost, accent }

/// Foundational action button shared by all qz_* screens.
class QzButton extends StatelessWidget {
  const QzButton({
    super.key,
    required this.label,
    this.variant = QzButtonVariant.primary,
    this.onPressed,
    this.loading = false,
    this.leading,
    this.expanded = false,
  });

  final String label;
  final QzButtonVariant variant;
  final VoidCallback? onPressed;
  final bool loading;
  final Widget? leading;
  final bool expanded;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final bool disabled = loading || onPressed == null;

    final Color fg;
    final Decoration decoration;
    switch (variant) {
      case QzButtonVariant.primary:
        fg = c.bgElev;
        decoration = BoxDecoration(
          color: c.text,
          borderRadius: BorderRadius.circular(QzRadii.input),
        );
        break;
      case QzButtonVariant.ghost:
        fg = c.text;
        decoration = BoxDecoration(
          color: Colors.transparent,
          border: Border.all(color: c.border),
          borderRadius: BorderRadius.circular(QzRadii.input),
        );
        break;
      case QzButtonVariant.accent:
        fg = c.accentOn;
        decoration = BoxDecoration(
          gradient: c.accentGrad,
          borderRadius: BorderRadius.circular(QzRadii.input),
        );
        break;
    }

    Widget content = loading
        ? QzSpinner(size: 16, color: fg)
        : Row(
            mainAxisSize:
                expanded ? MainAxisSize.max : MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: <Widget>[
              if (leading != null) ...<Widget>[
                IconTheme(
                  data: IconThemeData(color: fg, size: 18),
                  child: leading!,
                ),
                const SizedBox(width: QzSpacing.sm),
              ],
              Text(
                label,
                style: TextStyle(
                  color: fg,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          );
    // Keep [expanded] honored even when [loading] swaps the row for a
    // spinner — otherwise the button collapses to ~16dp and becomes visually
    // indistinguishable from `expanded: false`.
    if (expanded) {
      content = SizedBox(
        width: double.infinity,
        child: Center(child: content),
      );
    }

    return Opacity(
      opacity: disabled ? 0.6 : 1,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: disabled ? null : onPressed,
          borderRadius: BorderRadius.circular(QzRadii.input),
          child: Container(
            height: 44,
            padding: const EdgeInsets.symmetric(horizontal: QzSpacing.lg),
            decoration: decoration,
            child: Center(child: content),
          ),
        ),
      ),
    );
  }
}
