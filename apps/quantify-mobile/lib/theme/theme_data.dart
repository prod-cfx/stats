import 'package:flutter/material.dart';

import 'colors.dart';
import 'theme_notifier.dart';
import 'tokens.dart';

/// Exposes the full [QzColorScheme] (including non-Material tokens like
/// `accentGrad`, `accentRing`, `accentPop`) via `Theme.of(context)`.
@immutable
class QzColorSchemeExt extends ThemeExtension<QzColorSchemeExt> {
  const QzColorSchemeExt(this.scheme);

  final QzColorScheme scheme;

  @override
  QzColorSchemeExt copyWith({QzColorScheme? scheme}) =>
      QzColorSchemeExt(scheme ?? this.scheme);

  /// Theme switches are instantaneous (no implicit animation) so we snap to
  /// `other` past the halfway mark. Returning the target keeps callers from
  /// observing interpolated alpha values that could clash with token contracts.
  @override
  QzColorSchemeExt lerp(ThemeExtension<QzColorSchemeExt>? other, double t) {
    if (other is! QzColorSchemeExt) return this;
    return t < 0.5 ? this : other;
  }
}

ThemeData buildQzThemeData(QzTheme theme) {
  final QzColorScheme c = qzColors(theme.bg, theme.accent);
  final ColorScheme scheme = ColorScheme(
    brightness: c.brightness,
    primary: c.accent,
    onPrimary: c.accentOn,
    secondary: c.accent2,
    onSecondary: c.accentOn,
    surface: c.bgElev,
    onSurface: c.text,
    error: c.statusDanger,
    onError: c.accentOn,
  );

  return ThemeData(
    useMaterial3: true,
    brightness: c.brightness,
    colorScheme: scheme,
    scaffoldBackgroundColor: c.bg,
    canvasColor: c.bg,
    dividerColor: c.border,
    // Primary face = bundled Inter (design spec). The fallback list steers
    // CJK glyph resolution to the platform-supplied Noto/PingFang faces, since
    // Inter carries no CJK glyphs (Noto Sans SC intentionally not bundled —
    // see QzFont docs / #1798).
    fontFamily: QzFont.sans,
    fontFamilyFallback: QzFont.sansFallback,
    extensions: <ThemeExtension<dynamic>>[QzColorSchemeExt(c)],
    cardTheme: CardThemeData(
      color: c.bgElev,
      elevation: 0,
      margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: c.bgInput,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(QzRadii.input),
        borderSide: BorderSide(color: c.border),
      ),
    ),
  );
}
