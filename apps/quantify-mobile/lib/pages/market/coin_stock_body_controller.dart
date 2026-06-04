import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/notifier_lifecycle.dart';
import '../../data/models/coin_stock_models.dart';
import 'coin_stock_body_state.dart';

/// 币股子屏控制器（issue #2184）。纯同步：切 tab / 设搜索词 / 改排序。
class CoinStockController extends Notifier<CoinStockState> {
  final NotifierLifecycle _life = NotifierLifecycle();

  bool get mounted => _life.mounted;

  @override
  CoinStockState build() {
    _life.attach(ref);
    return const CoinStockState();
  }

  void selectTab(CoinTab tab) {
    state = state.copyWith(tab: tab);
  }

  void setFilter(String filter) {
    state = state.copyWith(filter: filter);
  }

  /// 设排序键 + 方向。`dir == null` 表示不排序，经 State `_unset` 哨兵置空。
  void setSort(CoinStockSort sort, SortDir? dir) {
    state = state.copyWith(sort: sort, dir: dir);
  }
}

final coinStockControllerProvider =
    NotifierProvider.autoDispose<CoinStockController, CoinStockState>(
      CoinStockController.new,
    );
