import 'package:flutter/material.dart';

import '../theme/colors.dart';
import '../theme/theme_context.dart';
import '../theme/tokens.dart';

/// Elevated card surface — `bgElev` background, hairline border, 14px radius.
///
/// Direct port of the mobile prototype `Card({children, p='16px'})` primitive
/// (`design/project/mobile/m-shell.jsx:246`). Wrap with [InkWell] only when
/// [onTap] is supplied so static cards don't pick up ripple side-effects.
class QzCard extends StatelessWidget {
  const QzCard({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(QzSpacing.lg),
    this.onTap,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final BorderRadius radius = BorderRadius.circular(QzRadii.card);
    final Widget surface = Container(
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.border),
        borderRadius: radius,
      ),
      padding: padding,
      child: child,
    );
    if (onTap == null) {
      return surface;
    }
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: radius,
        child: surface,
      ),
    );
  }
}
