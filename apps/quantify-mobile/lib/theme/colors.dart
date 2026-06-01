import 'package:flutter/material.dart';

import 'tokens.dart';

/// Background theme variants.
enum QzBg { light, pink, dark }

/// Accent color variants. The picked accent applies on top of any [QzBg].
enum QzAccent { violet, cyan, amber }

/// Resolved color tokens for a given (bg, accent) combination.
/// 1:1 mapping with `design/project/tokens.css` CSS variables.
@immutable
class QzColorScheme {
  const QzColorScheme({
    required this.bg,
    required this.bgElev,
    required this.bgSoft,
    required this.bgInput,
    required this.text,
    required this.textMid,
    required this.textDim,
    required this.textFaint,
    required this.border,
    required this.borderSoft,
    required this.borderStrong,
    required this.accent,
    required this.accent2,
    required this.accentGrad,
    required this.accentSoft,
    required this.accentRing,
    required this.accentShadow,
    required this.accentPop,
    required this.accentOn,
    required this.tabBlur,
    required this.scrim,
    required this.brightness,
    required this.statusOk,
    required this.statusWarn,
    required this.statusDanger,
    required this.statusInfo,
    required this.marketUp,
    required this.marketDown,
    required this.badgeNotification,
  });

  final Color bg;
  final Color bgElev;
  final Color bgSoft;
  final Color bgInput;
  final Color text;
  final Color textMid;
  final Color textDim;
  final Color textFaint;
  final Color border;
  final Color borderSoft;
  final Color borderStrong;
  final Color accent;
  final Color accent2;
  final LinearGradient accentGrad;
  final Color accentSoft;
  final Color accentRing;
  final BoxShadow accentShadow;
  final BoxShadow accentPop;
  final Color accentOn;
  final Color tabBlur;
  final Color scrim;
  final Brightness brightness;
  final Color statusOk;
  final Color statusWarn;
  final Color statusDanger;
  final Color statusInfo;
  final Color marketUp;
  final Color marketDown;

  /// 通知 badge 固定红，设计稿 theme-invariant（不随 bg/accent 变化）。
  final Color badgeNotification;
}

class _BgPalette {
  const _BgPalette({
    required this.bg,
    required this.bgElev,
    required this.bgSoft,
    required this.bgInput,
    required this.text,
    required this.textMid,
    required this.textDim,
    required this.textFaint,
    required this.border,
    required this.borderSoft,
    required this.borderStrong,
    required this.tabBlur,
    required this.scrim,
    required this.brightness,
  });
  final Color bg;
  final Color bgElev;
  final Color bgSoft;
  final Color bgInput;
  final Color text;
  final Color textMid;
  final Color textDim;
  final Color textFaint;
  final Color border;
  final Color borderSoft;
  final Color borderStrong;
  final Color tabBlur;
  final Color scrim;
  final Brightness brightness;
}

const _BgPalette _light = _BgPalette(
  bg: Color(0xFFF4F5F8),
  bgElev: Color(0xFFFFFFFF),
  bgSoft: Color(0xFFF8F9FC),
  bgInput: Color(0xFFFFFFFF),
  text: Color(0xFF0F1623),
  textMid: Color(0xFF4C5566),
  textDim: Color(0xFF8A93A6),
  textFaint: Color(0xFFB2B9C7),
  border: Color(0xFFE6E8EE),
  borderSoft: Color(0xFFEFF1F5),
  borderStrong: Color(0xFFD7DBE4),
  tabBlur: Color(0xC7FFFFFF), // rgba(255,255,255,0.78) → 0.78*255≈199=0xC7
  scrim: Color(0x730F1623), // rgba(15,22,35,0.45) → 0.45*255≈115=0x73
  brightness: Brightness.light,
);

const _BgPalette _pink = _BgPalette(
  bg: Color(0xFFFFF1F5),
  bgElev: Color(0xFFFFFFFF),
  bgSoft: Color(0xFFFCE6EE),
  bgInput: Color(0xFFFFFFFF),
  text: Color(0xFF2A0F1F),
  textMid: Color(0xFF5B3D4C),
  textDim: Color(0xFF998088),
  textFaint: Color(0xFFC6AEB7),
  border: Color(0xFFF4D8E3),
  borderSoft: Color(0xFFFBE6EE),
  borderStrong: Color(0xFFE9BFCF),
  tabBlur: Color(0xD9FFF1F5), // 0.85 → 217 = 0xD9
  scrim: Color(0x80501428), // 0.5 → 128 = 0x80
  brightness: Brightness.light,
);

const _BgPalette _dark = _BgPalette(
  bg: Color(0xFF0F0B22),
  bgElev: Color(0xFF1A1530),
  bgSoft: Color(0xFF15112A),
  bgInput: Color(0xFF1F1A38),
  text: Color(0xFFF5F4FB),
  textMid: Color(0xFFBAB4D0),
  textDim: Color(0xFF7C7793),
  textFaint: Color(0xFF555070),
  border: Color(0xFF2A2542),
  borderSoft: Color(0xFF221E38),
  borderStrong: Color(0xFF3A3553),
  tabBlur: Color(0xC71A1530), // 0.78 → 0xC7
  scrim: Color(0x99000000), // 0.6 → 153 = 0x99
  brightness: Brightness.dark,
);

_BgPalette _bgPalette(QzBg bg) {
  switch (bg) {
    case QzBg.light:
      return _light;
    case QzBg.pink:
      return _pink;
    case QzBg.dark:
      return _dark;
  }
}

class _AccentPalette {
  const _AccentPalette({
    required this.accent,
    required this.accent2,
    required this.gradStart,
    required this.gradEnd,
    required this.softLight,
    // The base color used to build dark-theme accent-soft via alpha overlay.
    // Per tokens.css the chosen base differs per accent:
    //   violet → accent (#7C5CFF, rgba(124,92,255,0.18))
    //   cyan   → accent2 (#22D3EE, rgba(34,211,238,0.18))
    //   amber  → accent2 (#F59E0B, rgba(245,158,11,0.20))
    required this.softDarkBase,
    required this.softDarkAlpha,
    required this.ringAlpha,
    required this.shadowAlpha,
    required this.popAlpha,
  });
  final Color accent;
  final Color accent2;
  final Color gradStart;
  final Color gradEnd;
  final Color softLight;
  final Color softDarkBase;
  final double softDarkAlpha;
  final double ringAlpha;
  final double shadowAlpha;
  final double popAlpha;
}

const _AccentPalette _violet = _AccentPalette(
  accent: Color(0xFF7C5CFF),
  accent2: Color(0xFF9B7BFF),
  gradStart: Color(0xFFA78BFA),
  gradEnd: Color(0xFF7C3AED),
  softLight: Color(0xFFF2EEFF),
  softDarkBase: Color(0xFF7C5CFF), // tokens.css uses accent for violet dark-soft
  softDarkAlpha: 0.18,
  ringAlpha: 0.22,
  shadowAlpha: 0.28,
  popAlpha: 0.20,
);

const _AccentPalette _cyan = _AccentPalette(
  accent: Color(0xFF06B6D4),
  accent2: Color(0xFF22D3EE),
  gradStart: Color(0xFF67E8F9),
  gradEnd: Color(0xFF0891B2),
  softLight: Color(0xFFE0F7FB),
  softDarkBase: Color(0xFF22D3EE), // accent2
  softDarkAlpha: 0.18,
  ringAlpha: 0.22,
  shadowAlpha: 0.32,
  popAlpha: 0.22,
);

const _AccentPalette _amber = _AccentPalette(
  accent: Color(0xFFD97706),
  accent2: Color(0xFFF59E0B),
  gradStart: Color(0xFFFBBF24),
  gradEnd: Color(0xFFD97706),
  softLight: Color(0xFFFEF3C7),
  softDarkBase: Color(0xFFF59E0B), // accent2
  softDarkAlpha: 0.20,
  ringAlpha: 0.22,
  shadowAlpha: 0.32,
  popAlpha: 0.22,
);

_AccentPalette _accentPalette(QzAccent a) {
  switch (a) {
    case QzAccent.violet:
      return _violet;
    case QzAccent.cyan:
      return _cyan;
    case QzAccent.amber:
      return _amber;
  }
}

/// Centralized alpha application — keeps every translucent token off the
/// deprecated `withOpacity` API (Flutter 3.27+).
Color _alpha(Color base, double a) => base.withValues(alpha: a);

QzColorScheme qzColors(QzBg bg, QzAccent accent) {
  final _BgPalette b = _bgPalette(bg);
  final _AccentPalette a = _accentPalette(accent);
  final bool isDark = b.brightness == Brightness.dark;
  // Dark theme uses an alpha overlay over a per-accent base; light/pink keep
  // the literal soft color from tokens.css.
  final Color soft = isDark ? _alpha(a.softDarkBase, a.softDarkAlpha) : a.softLight;
  return QzColorScheme(
    bg: b.bg,
    bgElev: b.bgElev,
    bgSoft: b.bgSoft,
    bgInput: b.bgInput,
    text: b.text,
    textMid: b.textMid,
    textDim: b.textDim,
    textFaint: b.textFaint,
    border: b.border,
    borderSoft: b.borderSoft,
    borderStrong: b.borderStrong,
    accent: a.accent,
    accent2: a.accent2,
    accentGrad: LinearGradient(
      begin: Alignment.topCenter,
      end: Alignment.bottomCenter,
      colors: <Color>[a.gradStart, a.gradEnd],
    ),
    accentSoft: soft,
    accentRing: _alpha(a.accent, a.ringAlpha),
    accentShadow: BoxShadow(
      color: _alpha(a.accent, a.shadowAlpha),
      offset: const Offset(0, 4),
      blurRadius: 14,
    ),
    accentPop: BoxShadow(
      color: _alpha(a.accent, a.popAlpha),
      offset: const Offset(0, 16),
      blurRadius: 48,
    ),
    accentOn: const Color(0xFFFFFFFF),
    tabBlur: b.tabBlur,
    scrim: b.scrim,
    brightness: b.brightness,
    statusOk: isDark ? QzStatusDark.ok : QzStatus.ok,
    statusWarn: isDark ? QzStatusDark.warn : QzStatus.warn,
    statusDanger: isDark ? QzStatusDark.danger : QzStatus.danger,
    statusInfo: isDark ? QzStatusDark.info : QzStatus.info,
    marketUp: isDark ? QzStatusDark.marketUp : QzStatus.marketUp,
    marketDown: isDark ? QzStatusDark.marketDown : QzStatus.marketDown,
    badgeNotification: QzStatus.badgeNotification,
  );
}
