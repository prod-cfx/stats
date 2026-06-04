import 'package:flutter/material.dart';

import '../theme/theme_context.dart';
import '../theme/tokens.dart';

/// Compact cancel action used in AI wizard top bars.
class QzTopCancelButton extends StatelessWidget {
  const QzTopCancelButton({
    super.key,
    required this.label,
    required this.onTap,
  });

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.only(right: QzSpacing.xs),
      child: TextButton(
        key: const Key('ai-wizard-cancel'),
        onPressed: onTap,
        style: TextButton.styleFrom(
          minimumSize: const Size(0, 30),
          padding: const EdgeInsets.symmetric(horizontal: QzSpacing.md),
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          foregroundColor: c.textMid,
          backgroundColor: c.bgElev,
          side: BorderSide(color: c.border),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(QzRadii.input),
          ),
        ),
        child: Text(
          label,
          style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w500),
        ),
      ),
    );
  }
}
