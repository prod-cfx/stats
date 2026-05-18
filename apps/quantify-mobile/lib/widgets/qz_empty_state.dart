import 'package:flutter/material.dart';

import '../theme/colors.dart';
import '../theme/theme_context.dart';
import '../theme/tokens.dart';

/// Centered placeholder for "nothing here yet" surfaces.
///
/// All four fields except [title] are optional, so historical callers using
/// `QzEmptyState(title: ...)` (and optionally `icon`) continue to work
/// unchanged. The new [subtitle] and [action] slots are stacked underneath
/// the title only when supplied.
class QzEmptyState extends StatelessWidget {
  const QzEmptyState({
    super.key,
    required this.title,
    this.subtitle,
    this.icon,
    this.action,
  });

  final String title;
  final String? subtitle;
  final IconData? icon;
  final Widget? action;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          if (icon != null) ...<Widget>[
            Icon(icon, size: 48, color: c.textDim),
            const SizedBox(height: QzSpacing.lg),
          ],
          Text(
            title,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: c.textDim,
              fontSize: 16,
              fontWeight: FontWeight.w500,
            ),
          ),
          if (subtitle != null) ...<Widget>[
            const SizedBox(height: QzSpacing.xs),
            Text(
              subtitle!,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: c.textFaint,
                fontSize: 13,
              ),
            ),
          ],
          if (action != null) ...<Widget>[
            const SizedBox(height: QzSpacing.lg),
            action!,
          ],
        ],
      ),
    );
  }
}
