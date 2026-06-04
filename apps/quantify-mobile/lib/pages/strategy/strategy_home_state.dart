import 'package:flutter/foundation.dart';

import '../../data/models/strategy_models.dart';
import 'widgets/strategy_sort_sheet.dart' show StrategySortKey;

/// 策略广场页页面态（issue #2185 三件套）。
///
/// 承载筛选/排序/分页 + featured + toast/导航 的全部页面级可变态。
/// 模态局部态（筛选 sheet 的 `_sheetCategory`/`_sheetSort`/`_sheetResultCount`
/// ValueNotifier）按 issue 边界保留在 widget，不并入此处。
/// `pendingNav` 留给 widget `ref.listen` 消费，把 `context.go` 副作用留在 widget。
@immutable
class StrategyHomeState {
  const StrategyHomeState({
    this.category = StrategyCategory.all,
    this.favOnly = false,
    this.query = '',
    this.sort = StrategySortKey.hot,
    this.page = 1,
    this.hasMore = true,
    this.loading = true,
    this.loadingMore = false,
    this.filterSheetOpen = false,
    this.items = const <StrategyMarketItem>[],
    this.featured,
    this.toast,
    this.pendingNav,
  });

  final StrategyCategory category;
  final bool favOnly;
  final String query;
  final StrategySortKey sort;
  final int page;
  final bool hasMore;
  final bool loading;
  final bool loadingMore;
  final bool filterSheetOpen;
  final List<StrategyMarketItem> items;
  final StrategyMarketItem? featured;
  final String? toast;
  final String? pendingNav;

  /// 可空字段（`featured`/`toast`/`pendingNav`）用 [_unset] 哨兵区分「不改动」
  /// 与「显式置 null」。
  StrategyHomeState copyWith({
    StrategyCategory? category,
    bool? favOnly,
    String? query,
    StrategySortKey? sort,
    int? page,
    bool? hasMore,
    bool? loading,
    bool? loadingMore,
    bool? filterSheetOpen,
    List<StrategyMarketItem>? items,
    Object? featured = _unset,
    Object? toast = _unset,
    Object? pendingNav = _unset,
  }) {
    return StrategyHomeState(
      category: category ?? this.category,
      favOnly: favOnly ?? this.favOnly,
      query: query ?? this.query,
      sort: sort ?? this.sort,
      page: page ?? this.page,
      hasMore: hasMore ?? this.hasMore,
      loading: loading ?? this.loading,
      loadingMore: loadingMore ?? this.loadingMore,
      filterSheetOpen: filterSheetOpen ?? this.filterSheetOpen,
      items: items ?? this.items,
      featured: identical(featured, _unset)
          ? this.featured
          : featured as StrategyMarketItem?,
      toast: identical(toast, _unset) ? this.toast : toast as String?,
      pendingNav: identical(pendingNav, _unset)
          ? this.pendingNav
          : pendingNav as String?,
    );
  }

  static const Object _unset = Object();
}
