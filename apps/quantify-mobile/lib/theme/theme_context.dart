import 'package:flutter/material.dart';

import 'colors.dart';
import 'theme_data.dart';

/// Convenience accessor for the resolved [QzColorScheme] living inside
/// [ThemeData.extensions].
///
/// Throws a descriptive [StateError] when [QzColorSchemeExt] has not been
/// registered (e.g. a widget rendered without `MaterialApp` + `buildQzThemeData`),
/// so the failure mode is obvious instead of an opaque `null check` on a
/// bang operator.
extension QzThemeContext on BuildContext {
  QzColorScheme get qzScheme {
    final QzColorSchemeExt? ext = Theme.of(this).extension<QzColorSchemeExt>();
    if (ext == null) {
      throw StateError(
        'QzColorSchemeExt is not registered in ThemeData.extensions. '
        'Wrap the widget tree with MaterialApp(theme: buildQzThemeData(...)) '
        'before accessing context.qzScheme.',
      );
    }
    return ext.scheme;
  }
}
