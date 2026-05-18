import 'package:shared_preferences/shared_preferences.dart';

/// 已订阅策略 id 持久化（SharedPreferences StringList）。
///
/// 存为单 key `qz.strategy.subscriptions`；上层模型用 `Set<String>` 维护
/// 唯一性，读写边界负责 List↔Set 转换，避免上层散落去重逻辑。
class StrategySubscriptionPersistence {
  StrategySubscriptionPersistence(this._prefs);

  static const String kKey = 'qz.strategy.subscriptions';

  final SharedPreferences _prefs;

  Set<String> read() {
    final List<String>? raw = _prefs.getStringList(kKey);
    if (raw == null || raw.isEmpty) return <String>{};
    return raw.toSet();
  }

  Future<void> write(Set<String> ids) =>
      _prefs.setStringList(kKey, ids.toList(growable: false));
}
