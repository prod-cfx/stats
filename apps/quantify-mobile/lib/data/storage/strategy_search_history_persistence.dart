import 'package:shared_preferences/shared_preferences.dart';

/// 策略广场搜索历史持久化（SharedPreferences StringList）。
///
/// 与 [StrategyFavoritesPersistence] 同模式，单 key `qz.strategy.searchHistory`。
/// 用有序 `List<String>`（最近在前）维护，最多保留 [kMax] 条。
class StrategySearchHistoryPersistence {
  StrategySearchHistoryPersistence(this._prefs);

  static const String kKey = 'qz.strategy.searchHistory';
  static const int kMax = 10;

  final SharedPreferences _prefs;

  List<String> read() {
    final List<String>? raw = _prefs.getStringList(kKey);
    if (raw == null || raw.isEmpty) return const <String>[];
    return raw;
  }

  Future<void> write(List<String> terms) =>
      _prefs.setStringList(kKey, terms);
}
