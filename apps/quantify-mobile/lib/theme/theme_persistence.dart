import 'package:shared_preferences/shared_preferences.dart';

import 'colors.dart';

/// Thin wrapper over [SharedPreferences] for QzTheme persistence keys.
/// Unknown stored values (older builds or external mutation) are treated as
/// `null` so the notifier's single fallback path stays authoritative.
class ThemePersistence {
  ThemePersistence(this._prefs);

  static const String kBg = 'qz.theme.bg';
  static const String kAccent = 'qz.theme.accent';

  final SharedPreferences _prefs;

  QzBg? readBg() {
    final String? raw = _prefs.getString(kBg);
    if (raw == null) return null;
    for (final QzBg e in QzBg.values) {
      if (e.name == raw) return e;
    }
    return null;
  }

  QzAccent? readAccent() {
    final String? raw = _prefs.getString(kAccent);
    if (raw == null) return null;
    for (final QzAccent e in QzAccent.values) {
      if (e.name == raw) return e;
    }
    return null;
  }

  Future<void> writeBg(QzBg bg) => _prefs.setString(kBg, bg.name);
  Future<void> writeAccent(QzAccent a) => _prefs.setString(kAccent, a.name);
}
