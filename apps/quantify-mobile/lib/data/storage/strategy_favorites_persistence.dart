import 'package:shared_preferences/shared_preferences.dart';

/// 已收藏（星标）策略 id 持久化（SharedPreferences StringList）。
///
/// 与 [StrategySubscriptionPersistence] 同模式，单 key
/// `qz.strategy.favorites`；用 `Set<String>` 维护唯一性。
class StrategyFavoritesPersistence {
  StrategyFavoritesPersistence(this._prefs);

  static const String kKey = 'qz.strategy.favorites';

  final SharedPreferences _prefs;

  Set<String> read() {
    final List<String>? raw = _prefs.getStringList(kKey);
    if (raw == null || raw.isEmpty) return <String>{};
    return raw.toSet();
  }

  Future<void> write(Set<String> ids) =>
      _prefs.setStringList(kKey, ids.toList(growable: false));
}
