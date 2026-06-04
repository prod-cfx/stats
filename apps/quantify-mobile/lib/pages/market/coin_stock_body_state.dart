import 'package:flutter/foundation.dart';

import '../../data/models/coin_stock_models.dart';

/// 币股类型 tab（设计稿 `CSTOCK_TABS`:1844，issue #2184）。
enum CoinTab { all, btc, eth, other }

/// 币股子屏不可变页面态：类型 [tab] / 搜索词 [filter] / 排序键 [sort] /
/// 排序方向 [dir]（null = 不排序，保持原序）。
@immutable
class CoinStockState {
  const CoinStockState({
    this.tab = CoinTab.all,
    this.filter = '',
    this.sort = CoinStockSort.mcap,
    this.dir = SortDir.desc,
  });

  final CoinTab tab;
  final String filter;
  final CoinStockSort sort;

  /// null 表示不排序。
  final SortDir? dir;

  /// `dir` 用 [_unset] 哨兵区分「不改动」与「显式置 null（不排序）」。
  CoinStockState copyWith({
    CoinTab? tab,
    String? filter,
    CoinStockSort? sort,
    Object? dir = _unset,
  }) {
    return CoinStockState(
      tab: tab ?? this.tab,
      filter: filter ?? this.filter,
      sort: sort ?? this.sort,
      dir: identical(dir, _unset) ? this.dir : dir as SortDir?,
    );
  }

  static const Object _unset = Object();
}
