import 'package:flutter/material.dart';

import '../theme/colors.dart';
import '../theme/theme_context.dart';
import '../theme/tokens.dart';

/// Centered placeholder used while real pages land in later PRs.
///
/// Renders [title] (and optional [icon]) using the active [QzColorScheme]'s
/// dim text token so the empty surface clearly reads as "not implemented yet"
/// without looking broken.
class QzEmptyState extends StatelessWidget {
  const QzEmptyState({
    super.key,
    required this.title,
    this.icon,
  });

  final String title;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          if (icon != null) ...<Widget>[
            Icon(icon, size: 48, color: c.textDim),
            const SizedBox(height: QzSpacing.md),
          ],
          Text(
            title,
            style: TextStyle(
              color: c.textDim,
              fontSize: 16,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }
}
