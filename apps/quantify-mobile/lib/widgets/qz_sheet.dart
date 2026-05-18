import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../theme/colors.dart';
import '../theme/theme_context.dart';
import '../theme/tokens.dart';

/// Bottom modal sheet primitive. Wraps [showModalBottomSheet] with the
/// design-system look (16dp top radius, `bgElev` surface, `scrim` barrier,
/// 40×4 drag handle).
///
/// Note: the prototype targets a 360 ms cubic-bezier (`QzCurves.long` +
/// `QzCurves.standard`). Honoring that exactly would require an external
/// `AnimationController` driven by a [TickerProvider], which a static method
/// cannot obtain. We accept Flutter's default modal-sheet timing here and
/// leave the exact-curve port to a follow-up issue.
///
/// Known limitation: the [QzColorScheme] used for chrome (background, drag
/// handle, scrim) is captured at [show] time. If the user toggles the app
/// theme while the sheet is open, the chrome will not repaint — only the
/// caller's [builder] content rebuilds via its own context. Close+reopen
/// after a theme change to refresh chrome.
class QzSheet {
  const QzSheet._();

  static Future<T?> show<T>({
    required BuildContext context,
    required WidgetBuilder builder,
    bool isDismissible = true,
    bool isScrollControlled = true,
  }) {
    final QzColorScheme c = context.qzScheme;
    return showModalBottomSheet<T>(
      context: context,
      isDismissible: isDismissible,
      isScrollControlled: isScrollControlled,
      backgroundColor: c.bgElev,
      barrierColor: c.scrim,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (BuildContext ctx) {
        final double keyboardInset = MediaQuery.viewInsetsOf(ctx).bottom;
        return SafeArea(
          top: false,
          child: Padding(
            padding: EdgeInsets.only(
              // When a soft keyboard appears the modal sheet shifts up but
              // its bottom padding needs to absorb the inset so a TextField
              // inside [builder] is not clipped.
              bottom: math.max(QzSpacing.lg.toDouble(), keyboardInset),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                const SizedBox(height: QzSpacing.sm),
                _DragHandle(scheme: c),
                const SizedBox(height: QzSpacing.md),
                Flexible(child: builder(ctx)),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _DragHandle extends StatelessWidget {
  const _DragHandle({required this.scheme});

  final QzColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 40,
      height: 4,
      decoration: BoxDecoration(
        color: scheme.borderStrong,
        borderRadius: BorderRadius.circular(QzRadii.pill),
      ),
    );
  }
}
