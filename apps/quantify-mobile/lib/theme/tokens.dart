import 'package:flutter/widgets.dart';

/// Border radius tokens (matches `design/project/tokens.css` `--r-*`).
class QzRadii {
  const QzRadii._();
  static const double card = 14;
  static const double input = 10;
  static const double pill = 999;
}

/// Spacing scale used by the mobile prototype
/// (4 / 6 / 8 / 12 / 16 / 22 / 24 px gaps).
class QzSpacing {
  const QzSpacing._();
  static const double xxs = 4;
  static const double xs = 6;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 22;
  static const double xxl = 24;
}

/// Status colors shared by light + pink themes.
/// Dark theme uses [QzStatusDark] (different brightness profile).
class QzStatus {
  const QzStatus._();
  static const Color ok = Color(0xFF16A36B);
  static const Color okSoft = Color(0xFFE7F6EE);
  static const Color warn = Color(0xFFD98008);
  static const Color warnSoft = Color(0xFFFDF2DF);
  static const Color danger = Color(0xFFDC4646);
  static const Color dangerSoft = Color(0xFFFCEAEA);
  static const Color info = Color(0xFF2A6FDB);
  static const Color infoSoft = Color(0xFFE7EFFB);
  static const Color marketUp = Color(0xFF16A36B);
  static const Color marketDown = Color(0xFFE5484D);
  /// Fixed cyan accent for perp margin-rate bar (design spec).
  static const Color cyan = Color(0xFF22D3EE);
  /// Fixed notification badge red (design spec, theme-invariant).
  static const Color badgeNotification = Color(0xFFE5484D);
}

/// Status colors for dark theme.
/// Soft variants are pre-baked with the alpha from tokens.css
/// (0.14 → 0x24, 0.16 → 0x29) to keep declarations `const` and avoid
/// the deprecated `withOpacity` API.
class QzStatusDark {
  const QzStatusDark._();
  static const Color ok = Color(0xFF34D399);
  static const Color okSoft = Color(0x2434D399);
  static const Color warn = Color(0xFFFBBF24);
  static const Color warnSoft = Color(0x24FBBF24);
  static const Color danger = Color(0xFFF87171);
  static const Color dangerSoft = Color(0x29F87171);
  static const Color info = Color(0xFF60A5FA);
  static const Color infoSoft = Color(0x2960A5FA);
  static const Color marketUp = Color(0xFF34D399);
  static const Color marketDown = Color(0xFFF87171);
}

/// Elevation shadows. Mobile uses sm / md / lg per background theme;
/// accent-tinted pop shadow lives on [QzColorScheme.accentPop].
class QzShadow {
  const QzShadow._();
  static const List<BoxShadow> lightSm = <BoxShadow>[
    BoxShadow(color: Color(0x0A0F1623), offset: Offset(0, 1), blurRadius: 2),
  ];
  static const List<BoxShadow> lightMd = <BoxShadow>[
    BoxShadow(color: Color(0x0F0F1623), offset: Offset(0, 4), blurRadius: 14),
  ];
  static const List<BoxShadow> lightLg = <BoxShadow>[
    BoxShadow(color: Color(0x1A0F1623), offset: Offset(0, 12), blurRadius: 40),
  ];

  static const List<BoxShadow> pinkSm = <BoxShadow>[
    BoxShadow(color: Color(0x0FAA3C6E), offset: Offset(0, 1), blurRadius: 2),
  ];
  static const List<BoxShadow> pinkMd = <BoxShadow>[
    BoxShadow(color: Color(0x14AA3C6E), offset: Offset(0, 4), blurRadius: 14),
  ];
  static const List<BoxShadow> pinkLg = <BoxShadow>[
    BoxShadow(color: Color(0x1FAA3C6E), offset: Offset(0, 12), blurRadius: 40),
  ];

  static const List<BoxShadow> darkSm = <BoxShadow>[
    BoxShadow(color: Color(0x66000000), offset: Offset(0, 1), blurRadius: 2),
  ];
  static const List<BoxShadow> darkMd = <BoxShadow>[
    BoxShadow(color: Color(0x4D000000), offset: Offset(0, 4), blurRadius: 14),
  ];
  static const List<BoxShadow> darkLg = <BoxShadow>[
    BoxShadow(color: Color(0x80000000), offset: Offset(0, 12), blurRadius: 40),
  ];
}

/// Animation curves & durations matching the web prototype.
///
/// - Generic surface motion (`standard` = `cubic-bezier(.32,.72,0,1)`, with
///   `short` 240 ms / `long` 360 ms) drives most chrome transitions.
/// - Bottom-sheet motion has its own tokens (`sheetPanel` =
///   `cubic-bezier(.2,.8,.2,1)`, `sheetPanelDuration` .26s, `sheetScrimDuration`
///   .18s) matching the design source for the whale/strategy/filter drawers.
class QzCurves {
  const QzCurves._();
  static const Cubic standard = Cubic(0.32, 0.72, 0.0, 1.0);
  static const Duration short = Duration(milliseconds: 240);
  static const Duration long = Duration(milliseconds: 360);

  /// Bottom-sheet panel slide-up curve, matching design `cubic-bezier(.2,.8,.2,1)`.
  static const Cubic sheetPanel = Cubic(0.2, 0.8, 0.2, 1.0);

  /// Bottom-sheet panel enter/exit duration, design `.26s`.
  static const Duration sheetPanelDuration = Duration(milliseconds: 260);

  /// Bottom-sheet scrim fade-in duration (design `.18s`); see QzSheet doc for
  /// the Flutter limitation that prevents applying it independently.
  static const Duration sheetScrimDuration = Duration(milliseconds: 180);
}

/// Bundled font families + platform fallbacks.
///
/// Design spec calls for Inter / JetBrains Mono / Noto Sans SC. We bundle the
/// Latin/mono faces ([sans] = Inter, [mono] = JetBrainsMono) because those are
/// the custom glyphs the design actually depends on. **Noto Sans SC is not
/// bundled**: the full CJK face is 16-17 MB and would roughly double the app
/// download; every target platform already ships a CJK font (iOS PingFang SC,
/// Android Noto CJK), and [sansFallback] steers Chinese glyph resolution to
/// them. Tracked as the documented tech-debt conclusion for #1798.
class QzFont {
  const QzFont._();

  /// Bundled primary sans family (Latin/UI). See [pubspec.yaml] `fonts:`.
  static const String sans = 'Inter';

  /// Bundled monospace family (numbers / code / UID).
  static const String mono = 'JetBrainsMono';

  /// Fallback chain after [sans] — primarily steers CJK glyph resolution to
  /// the platform-supplied Noto/PingFang faces.
  static const List<String> sansFallback = <String>[
    'PingFang SC',
    'Hiragino Sans GB',
    'Noto Sans SC',
    'Roboto',
  ];
  static const List<String> monoFallback = <String>[
    'Menlo',
    'RobotoMono',
    'monospace',
  ];
}
