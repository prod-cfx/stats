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

/// featured hero 仅在「全部分类 + 无搜索 + 非收藏视图」时显示（设计稿 line 646）。
/// #2192：从 `StrategyHomePage` 上移的纯判定。
bool strategyShowFeatured(StrategyHomeState s) =>
    s.featured != null &&
    !s.favOnly &&
    s.category == StrategyCategory.all &&
    s.query.isEmpty;

/// 列表渲染用视图项（#2192：从 View 上移的纯派生）。
///
/// - 收藏视图（`favOnly`）：仅保留 [favorites] 内的策略，忽略分类。
/// - hero 卡显示时：剔除与 hero 同 id 的策略，避免同卡同时出现在 hero 和列表。
List<StrategyMarketItem> strategyListItems(
  StrategyHomeState s,
  Set<String> favorites,
) {
  Iterable<StrategyMarketItem> items = s.items;
  if (s.favOnly) {
    items = items.where(
      (StrategyMarketItem it) => favorites.contains(it.card.id),
    );
  }
  if (strategyShowFeatured(s)) {
    final String heroId = s.featured!.card.id;
    items = items.where((StrategyMarketItem it) => it.card.id != heroId);
  }
  return items.toList(growable: false);
}

/// 「查看 N 个结果」计数真值（#2128 / #2192：从 View 上移）。
/// 收藏视图反映过滤后条数（含 hero 已剔除项），否则为全量条数。
int strategyResultCount(StrategyHomeState s, Set<String> favorites) =>
    s.favOnly ? strategyListItems(s, favorites).length : s.items.length;
