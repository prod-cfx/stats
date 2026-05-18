import 'package:flutter/material.dart';

import '../theme/colors.dart';
import '../theme/theme_context.dart';
import '../theme/tokens.dart';

/// Search input field. Default leading icon is a magnifying glass; callers
/// can override either decoration slot.
class QzSearchBar extends StatelessWidget {
  const QzSearchBar({
    super.key,
    this.controller,
    this.hint = 'Search',
    this.onChanged,
    this.onSubmitted,
    this.leading,
    this.trailing,
  });

  final TextEditingController? controller;
  final String hint;
  final ValueChanged<String>? onChanged;
  final ValueChanged<String>? onSubmitted;
  final Widget? leading;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      height: 40,
      decoration: BoxDecoration(
        color: c.bgInput,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(QzRadii.input),
      ),
      padding: const EdgeInsets.symmetric(horizontal: QzSpacing.md),
      child: Row(
        children: <Widget>[
          IconTheme(
            data: IconThemeData(color: c.textDim, size: 18),
            child: leading ?? const Icon(Icons.search),
          ),
          const SizedBox(width: QzSpacing.sm),
          Expanded(
            child: TextField(
              controller: controller,
              onChanged: onChanged,
              onSubmitted: onSubmitted,
              textInputAction: TextInputAction.search,
              cursorColor: c.accent,
              style: TextStyle(color: c.text, fontSize: 14),
              decoration: InputDecoration(
                border: InputBorder.none,
                isCollapsed: true,
                hintText: hint,
                hintStyle: TextStyle(color: c.textDim, fontSize: 14),
              ),
            ),
          ),
          if (trailing != null) ...<Widget>[
            const SizedBox(width: QzSpacing.sm),
            IconTheme(
              data: IconThemeData(color: c.textDim, size: 18),
              child: trailing!,
            ),
          ],
        ],
      ),
    );
  }
}
