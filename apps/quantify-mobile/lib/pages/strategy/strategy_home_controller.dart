import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/providers/notifier_lifecycle.dart';
import '../../data/models/strategy_models.dart';
import '../../data/providers.dart';
import '../../data/repositories/strategy_repository.dart';
import 'strategy_home_state.dart';
import 'widgets/strategy_sort_sheet.dart' show StrategySortKey;

/// 策略广场页控制器（issue #2185 三件套）。
///
/// 承载分页（`reload`/`loadMore`）、筛选/排序、featured 加载、toast/导航 timer。
/// 导航 `context.go` 留 widget：到点写 [StrategyHomeState.pendingNav]，widget
/// `ref.listen` 消费后调 [consumeNav]。timer 由 controller 持有，`ref.onDispose`
/// 统一取消，杜绝 dispose 后触达 `state =`。
class StrategyHomeController extends Notifier<StrategyHomeState> {
  static const int kPageSize = 10;
  static const Duration kNavDelay = Duration(milliseconds: 700);
  static const Duration kToastDuration = Duration(milliseconds: 2400);

  final NotifierLifecycle _life = NotifierLifecycle();

  Timer? _toastTimer;
  Timer? _navTimer;

  bool get mounted => _life.mounted;

  StrategyRepository get _repo => ref.read(strategyRepositoryProvider);

  @override
  StrategyHomeState build() {
    _life.attach(ref);
    ref.onDispose(() {
      _toastTimer?.cancel();
      _navTimer?.cancel();
    });
    return const StrategyHomeState();
  }

  // ── 列表加载 ──────────────────────────────────────────────

  /// 重置回第 1 页并拉取首页（category/query/sort 变更或下拉刷新调用）。
  Future<void> reload() async {
    state = state.copyWith(loading: true, page: 1);
    final StrategyMarketPage res = await _repo.listMarket(
      page: 1,
      pageSize: kPageSize,
      query: state.query.isEmpty ? null : state.query,
      category: state.category,
    );
    if (!mounted) return;
    state = state.copyWith(
      items: _applySort(res.items, state.sort),
      hasMore: res.hasMore,
      loading: false,
    );
  }

  /// 翻下一页。短路条件：正在翻页 / 已到底（与原 `_loadMore` 一致）。
  Future<void> loadMore() async {
    if (state.loadingMore || !state.hasMore) return;
    state = state.copyWith(loadingMore: true);
    final int next = state.page + 1;
    final StrategyMarketPage res = await _repo.listMarket(
      page: next,
      pageSize: kPageSize,
      query: state.query.isEmpty ? null : state.query,
      category: state.category,
    );
    if (!mounted) return;
    state = state.copyWith(
      page: next,
      items: _applySort(
        <StrategyMarketItem>[...state.items, ...res.items],
        state.sort,
      ),
      hasMore: res.hasMore,
      loadingMore: false,
    );
  }

  Future<void> loadFeatured() async {
    try {
      final StrategyMarketItem hero = await _repo.getFeaturedHero();
      if (!mounted) return;
      state = state.copyWith(featured: hero);
    } catch (e, st) {
      // featured 失败不影响主列表，留可观测信号便于排查真实接口故障。
      debugPrint('[StrategyHome] loadFeatured failed: $e\n$st');
    }
  }

  /// 在当前内存列表上排序，避免 repository 暴露 sortKey。
  /// hot=users 降；cagr=cagr 降；sharpe=sharpe 降；mddLow=maxDrawdown 升序近 0。
  List<StrategyMarketItem> _applySort(
    List<StrategyMarketItem> items,
    StrategySortKey k,
  ) {
    final List<StrategyMarketItem> sorted = <StrategyMarketItem>[...items];
    sorted.sort((StrategyMarketItem a, StrategyMarketItem b) {
      return switch (k) {
        StrategySortKey.hot => b.stats.users.compareTo(a.stats.users),
        StrategySortKey.cagr => b.stats.cagr.compareTo(a.stats.cagr),
        StrategySortKey.sharpe => b.stats.sharpe.compareTo(a.stats.sharpe),
        StrategySortKey.mddLow =>
          b.stats.maxDrawdown.compareTo(a.stats.maxDrawdown),
      };
    });
    return sorted;
  }

  // ── 筛选 / 排序 ──────────────────────────────────────────

  /// 选分类即退出收藏视图（与「收藏」toggle 互斥），并重拉。
  void setCategory(StrategyCategory c) {
    if (c == state.category && !state.favOnly) return;
    state = state.copyWith(favOnly: false, category: c);
    reload();
  }

  /// 切换收藏视图：仅改 flag，列表在 widget 内按 favorites 过滤，不重拉。
  void setFavOnly(bool on) {
    if (on == state.favOnly) return;
    state = state.copyWith(favOnly: on);
  }

  void setQuery(String q) {
    state = state.copyWith(query: q);
    reload();
  }

  /// 改排序：内存重排现有 items，不重拉。
  void setSort(StrategySortKey k) {
    if (k == state.sort) return;
    state = state.copyWith(sort: k, items: _applySort(state.items, k));
  }

  void setFilterSheetOpen(bool open) {
    state = state.copyWith(filterSheetOpen: open);
  }

  // ── toast / 导航 ─────────────────────────────────────────

  /// 显示 [message] toast + 700ms 后请求跳转 [route]。
  /// 重复触发取消上一次 timer，避免叠加跳转。
  void fireToastAndNav({required String message, required String route}) {
    _toastTimer?.cancel();
    _navTimer?.cancel();
    state = state.copyWith(toast: message);
    _toastTimer = Timer(kToastDuration, () {
      if (!mounted) return;
      state = state.copyWith(toast: null);
    });
    _navTimer = Timer(kNavDelay, () {
      if (!mounted) return;
      state = state.copyWith(pendingNav: route);
    });
  }

  void consumeNav() {
    state = state.copyWith(pendingNav: null);
  }
}

final strategyHomeControllerProvider =
    NotifierProvider.autoDispose<
      StrategyHomeController,
      StrategyHomeState
    >(StrategyHomeController.new);
