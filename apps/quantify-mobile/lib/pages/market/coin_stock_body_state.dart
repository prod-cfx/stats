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

bool _matchCoinTab(CoinStock r, CoinTab tab) {
  switch (tab) {
    case CoinTab.all:
      return true;
    case CoinTab.btc:
      return r.coin == 'BTC';
    case CoinTab.eth:
      return r.coin == 'ETH';
    case CoinTab.other:
      return r.coin != 'BTC' && r.coin != 'ETH';
  }
}

/// 按 tab + 搜索词过滤、再按 [CoinStockState.sort]/[CoinStockState.dir] 排序的
/// 展示行（#2192：从 `CoinStockBody.build` 上移到 ViewModel 层纯派生）。
///
/// `dir == null` 保持原序。入参均为概念数据 + 页面态，不依赖 BuildContext。
List<CoinStock> coinStockShown(List<CoinStock> stocks, CoinStockState s) {
  final String q = s.filter.trim().toLowerCase();
  final List<CoinStock> filtered = stocks
      .where((CoinStock r) => _matchCoinTab(r, s.tab))
      .where(
        (CoinStock r) =>
            q.isEmpty || '${r.sym}${r.cn}${r.ex}'.toLowerCase().contains(q),
      )
      .toList();
  if (s.dir == null) return filtered; // 不排序，保持原始顺序
  filtered.sort((CoinStock a, CoinStock b) {
    final double va = s.sort.valueOf(a);
    final double vb = s.sort.valueOf(b);
    return s.dir == SortDir.desc ? vb.compareTo(va) : va.compareTo(vb);
  });
  return filtered;
}
