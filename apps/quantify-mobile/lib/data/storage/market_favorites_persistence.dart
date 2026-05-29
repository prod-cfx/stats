import 'package:shared_preferences/shared_preferences.dart';

/// 已收藏（自选）行情 symbol 持久化（SharedPreferences StringList）。
///
/// 与 [StrategyFavoritesPersistence] 同模式，单 key
/// `qz.market.favorites`；用 `Set<String>` 维护唯一性。真实账号 watchlist
/// 接入（#1682）后此类会被替换为后端读写。
class MarketFavoritesPersistence {
  MarketFavoritesPersistence(this._prefs);

  static const String kKey = 'qz.market.favorites';

  final SharedPreferences _prefs;

  /// 读取已持久化的自选集合。
  ///
  /// 返回 `null` 表示「键从未写盘」（首次启动），由上层决定是否填充默认种子；
  /// 返回空集表示「用户已显式清空」，不应被种子覆盖。两者语义必须区分，
  /// 否则用户清空的自选会在重启后复活（never break userspace）。
  Set<String>? read() {
    final List<String>? raw = _prefs.getStringList(kKey);
    if (raw == null) return null;
    return raw.toSet();
  }

  Future<void> write(Set<String> symbols) =>
      _prefs.setStringList(kKey, symbols.toList(growable: false));
}
