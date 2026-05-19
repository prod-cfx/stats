import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'colors.dart';
import 'theme_persistence.dart';

/// Immutable theme selection (background × accent + behavior toggles).
@immutable
class QzTheme {
  const QzTheme({
    required this.bg,
    required this.accent,
    this.autoFollowSystem = false,
    this.reduceMotion = false,
  });
  final QzBg bg;
  final QzAccent accent;

  /// 「自动跟随系统」开关：仅持久化，UI 联动 / 系统 theme 切换由后续 issue
  /// 在 `App` 顶层挂监听后接通；当前仅作为偏好持久化。
  final bool autoFollowSystem;

  /// 「减少动画」开关：调用方在路由 / 弹层动画时长可读此 flag 缩短 / 关闭。
  final bool reduceMotion;

  QzTheme copyWith({
    QzBg? bg,
    QzAccent? accent,
    bool? autoFollowSystem,
    bool? reduceMotion,
  }) =>
      QzTheme(
        bg: bg ?? this.bg,
        accent: accent ?? this.accent,
        autoFollowSystem: autoFollowSystem ?? this.autoFollowSystem,
        reduceMotion: reduceMotion ?? this.reduceMotion,
      );

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is QzTheme &&
          other.bg == bg &&
          other.accent == accent &&
          other.autoFollowSystem == autoFollowSystem &&
          other.reduceMotion == reduceMotion);

  @override
  int get hashCode =>
      Object.hash(bg, accent, autoFollowSystem, reduceMotion);

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
      autoFollowSystem: p.readAutoFollowSystem() ??
          QzTheme.fallback.autoFollowSystem,
      reduceMotion: p.readReduceMotion() ?? QzTheme.fallback.reduceMotion,
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

  Future<void> setAutoFollowSystem(bool v) async {
    final QzTheme previous = state;
    state = state.copyWith(autoFollowSystem: v);
    try {
      await ref.read(themePersistenceProvider).writeAutoFollowSystem(v);
    } catch (_) {
      state = previous;
      rethrow;
    }
  }

  Future<void> setReduceMotion(bool v) async {
    final QzTheme previous = state;
    state = state.copyWith(reduceMotion: v);
    try {
      await ref.read(themePersistenceProvider).writeReduceMotion(v);
    } catch (_) {
      state = previous;
      rethrow;
    }
  }
}

final NotifierProvider<ThemeNotifier, QzTheme> themeProvider =
    NotifierProvider<ThemeNotifier, QzTheme>(ThemeNotifier.new);
