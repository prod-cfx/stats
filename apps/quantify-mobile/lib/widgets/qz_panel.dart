import 'package:flutter/material.dart';

import '../theme/colors.dart';
import '../theme/theme_context.dart';
import '../theme/tokens.dart';

/// Nested sub-surface — `bgSoft` background, no border, 14px radius.
///
/// Distinct from [QzCard]: panels are designed to sit *inside* a card to
/// group related rows, so the lack of border + softer fill prevents nested
/// boxes from competing visually.
class QzPanel extends StatelessWidget {
  const QzPanel({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(QzSpacing.md),
  });

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      decoration: BoxDecoration(
        color: c.bgSoft,
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      padding: padding,
      child: child,
    );
  }
}
