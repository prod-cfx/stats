import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'colors.dart';
import 'theme_persistence.dart';

/// Immutable theme selection (background × accent).
@immutable
class QzTheme {
  const QzTheme({required this.bg, required this.accent});
  final QzBg bg;
  final QzAccent accent;

  QzTheme copyWith({QzBg? bg, QzAccent? accent}) =>
      QzTheme(bg: bg ?? this.bg, accent: accent ?? this.accent);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is QzTheme && other.bg == bg && other.accent == accent);

  @override
  int get hashCode => Object.hash(bg, accent);

  static const QzTheme fallback =
      QzTheme(bg: QzBg.light, accent: QzAccent.violet);
}

/// Resolved [SharedPreferences] instance — overridden in `main()` after the
/// async load completes so notifier `build()` stays synchronous.
final Provider<SharedPreferences> sharedPreferencesProvider =
    Provider<SharedPreferences>((Ref ref) {
  throw UnimplementedError(
    'sharedPreferencesProvider must be overridden in main() with a resolved '
    'SharedPreferences instance.',
  );
});

final Provider<ThemePersistence> themePersistenceProvider =
    Provider<ThemePersistence>((Ref ref) {
  return ThemePersistence(ref.watch(sharedPreferencesProvider));
});

class ThemeNotifier extends Notifier<QzTheme> {
  @override
  QzTheme build() {
    final ThemePersistence p = ref.watch(themePersistenceProvider);
    return QzTheme(
      bg: p.readBg() ?? QzTheme.fallback.bg,
      accent: p.readAccent() ?? QzTheme.fallback.accent,
    );
  }

  Future<void> setBg(QzBg bg) async {
    final QzTheme previous = state;
    state = state.copyWith(bg: bg);
    try {
      await ref.read(themePersistenceProvider).writeBg(bg);
    } catch (_) {
      // Rollback to keep memory and disk consistent on persistence failure.
      state = previous;
      rethrow;
    }
  }

  Future<void> setAccent(QzAccent accent) async {
    final QzTheme previous = state;
    state = state.copyWith(accent: accent);
    try {
      await ref.read(themePersistenceProvider).writeAccent(accent);
    } catch (_) {
      state = previous;
      rethrow;
    }
  }
}

final NotifierProvider<ThemeNotifier, QzTheme> themeProvider =
    NotifierProvider<ThemeNotifier, QzTheme>(ThemeNotifier.new);
