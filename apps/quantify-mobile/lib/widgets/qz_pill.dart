import 'package:flutter/material.dart';

import '../theme/colors.dart';
import '../theme/theme_context.dart';
import '../theme/tokens.dart';

/// Single-purpose label pill — pure display, no icon, fully rounded.
///
/// Use [QzChip] when a leading icon or one of the semantic tones (ok/warn/...)
/// is needed; [QzPill] is the simplest label primitive and defaults to the
/// accent tint.
class QzPill extends StatelessWidget {
  const QzPill({
    super.key,
    required this.label,
    this.background,
    this.foreground,
  });

  final String label;
  final Color? background;
  final Color? foreground;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      height: 22,
      padding: const EdgeInsets.symmetric(horizontal: QzSpacing.sm),
      decoration: BoxDecoration(
        color: background ?? c.accentSoft,
        borderRadius: BorderRadius.circular(QzRadii.pill),
      ),
      child: Align(
        widthFactor: 1,
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            color: foreground ?? c.accent,
            fontSize: 11,
            fontWeight: FontWeight.w500,
            height: 1.0,
          ),
        ),
      ),
    );
  }
}
