import 'package:flutter/material.dart';

import '../theme/colors.dart';
import '../theme/theme_context.dart';

/// Small circular loading indicator sized for inline use (buttons, list rows).
///
/// Defaults to the active accent color so spinners track theme changes without
/// callers having to pass a color explicitly.
class QzSpinner extends StatelessWidget {
  const QzSpinner({
    super.key,
    this.size = 16,
    this.color,
  }) : assert(size > 0, 'QzSpinner.size must be positive');

  final double size;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color resolved = color ?? c.accent;
    return SizedBox(
      width: size,
      height: size,
      child: CircularProgressIndicator(
        strokeWidth: 2,
        valueColor: AlwaysStoppedAnimation<Color>(resolved),
      ),
    );
  }
}
