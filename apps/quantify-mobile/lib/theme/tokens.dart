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

/// Animation curves & durations matching the web prototype
/// (`cubic-bezier(.32,.72,0,1)` plus 240 / 360 ms).
class QzCurves {
  const QzCurves._();
  static const Cubic standard = Cubic(0.32, 0.72, 0.0, 1.0);
  static const Duration short = Duration(milliseconds: 240);
  static const Duration long = Duration(milliseconds: 360);
}

/// Font family fallbacks. iOS uses PingFang SC + SF Pro automatically;
/// Android falls back to Roboto / Noto. We do not bundle custom fonts in
/// this PR; typography tokens (sizes / weights) land in a later PR.
class QzFont {
  const QzFont._();
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
