import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/strategy_models.dart';
import '../../data/providers.dart';
import '../../data/repositories/strategy_repository.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_empty_state.dart';
import '../../widgets/qz_sheet.dart';
import '../../widgets/qz_spinner.dart';
import '../../widgets/qz_top_bar.dart';
import 'widgets/category_chip_bar.dart';
import 'widgets/featured_hero_card.dart';
import 'widgets/load_conversation_toast.dart';
import 'widgets/strategy_card_tile.dart';
import 'widgets/strategy_search_overlay.dart';
import 'widgets/strategy_sort_sheet.dart';

/// 策略广场（原型 m-screens-2 / issue #1565）。
///
/// 顶部：搜索栏 + 分类 chip 条 + 排序行 + 筛选 sheet
/// 中部：featured hero（仅当 category=all 且无 query 时显示） + 列表
/// 底部：分页 loading 指示
class StrategyHomePage extends ConsumerStatefulWidget {
  const StrategyHomePage({super.key});

  @override
  ConsumerState<StrategyHomePage> createState() => _StrategyHomePageState();
}

class _StrategyHomePageState extends ConsumerState<StrategyHomePage> {
  static const int _kPageSize = 10;

  final ScrollController _scrollCtrl = ScrollController();

  StrategyCategory _category = StrategyCategory.all;
  bool _favOnly = false;
  String _query = '';
  StrategySortKey _sort = StrategySortKey.hot;
  int _page = 1;
  bool _hasMore = true;
  bool _loading = true;
  bool _loadingMore = false;
  List<StrategyMarketItem> _items = <StrategyMarketItem>[];
  StrategyMarketItem? _featured;

  /// 载入对话 toast：与设计稿 `fireToast`(#1596) 一致。
  /// 显示约 700ms 后跳到 `/ai?loadStrategy=$id`，dispose / 重复点击需安全取消。
  String? _toast;
  Timer? _toastTimer;
  Timer? _navTimer;
  static const Duration _kLoadConversationDelay = Duration(milliseconds: 700);

  @override
  void initState() {
    super.initState();
    _scrollCtrl.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _reload();
      _loadFeatured();
    });
  }

  @override
  void dispose() {
    _scrollCtrl.removeListener(_onScroll);
    _scrollCtrl.dispose();
    _toastTimer?.cancel();
    _navTimer?.cancel();
    super.dispose();
  }

  /// 点击「载入对话」：显示 toast，~700ms 后跳转 `/ai?loadStrategy=$id`。
  /// 重复点击会取消上一次的 timer，避免叠加跳转；dispose 后所有 timer 安全取消。
  void _onLoadConversation(StrategyMarketItem item) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final String id = item.card.id;
    final String msg = l10n.strategyHomeLoadedToast(item.card.name);
    _toastTimer?.cancel();
    _navTimer?.cancel();
    setState(() => _toast = msg);
    // 在跳转前清掉 toast 文本，避免跨页残留；跳转交给独立 timer，并在
    // 触发前再次校验 mounted，防止 dispose 后还调 router。
    _toastTimer = Timer(const Duration(milliseconds: 2400), () {
      if (!mounted) return;
      setState(() => _toast = null);
    });
    _navTimer = Timer(_kLoadConversationDelay, () {
      if (!mounted) return;
      context.go('/ai?loadStrategy=$id');
    });
  }

  /// 点击「运行」（#1821）：toast「『名』已启动 · 进入实盘监控」，~700ms 后跳到
  /// 实盘监控 `/me/live`。复用 toast/nav timer，与「载入对话」同一取消语义，
  /// 避免叠加跳转；后端真实启动接口未就绪，此处先按设计稿做交互占位。
  void _onRun(StrategyMarketItem item) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final String msg = l10n.strategyHomeStartedToast(item.card.name);
    _toastTimer?.cancel();
    _navTimer?.cancel();
    setState(() => _toast = msg);
    _toastTimer = Timer(const Duration(milliseconds: 2400), () {
      if (!mounted) return;
      setState(() => _toast = null);
    });
    _navTimer = Timer(_kLoadConversationDelay, () {
      if (!mounted) return;
      context.go('/me/live');
    });
  }

  void _onScroll() {
    if (_loadingMore || !_hasMore) return;
    if (!_scrollCtrl.hasClients) return;
    final double pos = _scrollCtrl.position.pixels;
    final double max = _scrollCtrl.position.maxScrollExtent;
    if (pos >= max - 200) {
      _loadMore();
    }
  }

  Future<void> _loadFeatured() async {
    final StrategyRepository repo = ref.read(strategyRepositoryProvider);
    try {
      final StrategyMarketItem hero = await repo.getFeaturedHero();
      if (!mounted) return;
      setState(() => _featured = hero);
    } catch (e, st) {
      // featured 失败不影响主列表，但留可观测信号便于排查接入真实接口后的故障。
      debugPrint('[StrategyHome] loadFeatured failed: $e\n$st');
    }
  }

  Future<void> _reload() async {
    final StrategyRepository repo = ref.read(strategyRepositoryProvider);
    setState(() {
      _loading = true;
      _page = 1;
    });
    final StrategyMarketPage res = await repo.listMarket(
      page: 1,
      pageSize: _kPageSize,
      query: _query.isEmpty ? null : _query,
      category: _category,
    );
    if (!mounted) return;
    setState(() {
      _items = _applySort(res.items, _sort);
      _hasMore = res.hasMore;
      _loading = false;
    });
  }

  Future<void> _loadMore() async {
    if (_loadingMore || !_hasMore) return;
    setState(() => _loadingMore = true);
    final StrategyRepository repo = ref.read(strategyRepositoryProvider);
    final int next = _page + 1;
    final StrategyMarketPage res = await repo.listMarket(
      page: next,
      pageSize: _kPageSize,
      query: _query.isEmpty ? null : _query,
      category: _category,
    );
    if (!mounted) return;
    setState(() {
      _page = next;
      _items = _applySort(<StrategyMarketItem>[..._items, ...res.items], _sort);
      _hasMore = res.hasMore;
      _loadingMore = false;
    });
  }

  /// 在当前内存列表上排序，避免 repository 接口暴露 sortKey。
  ///
  /// hot=按 users 降序；cagr=按 cagr 降序；sharpe=按 sharpe 降序；
  /// mddLow=按 mdd 升序（值越大越接近 0，回撤越小）。
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

  void _onCategoryChanged(StrategyCategory c) {
    // 选分类即退出收藏视图（与「收藏」toggle 互斥）。
    if (c == _category && !_favOnly) return;
    setState(() {
      _favOnly = false;
      _category = c;
    });
    _reload();
  }

  /// 切换「收藏」视图。开启后列表仅显示已星标策略（在内存里过滤，不重拉接口），
  /// 与分类互斥——开收藏不改变 `_category`，但 [_listItems] 忽略分类、只看星标。
  void _onFavOnlyChanged(bool on) {
    if (on == _favOnly) return;
    setState(() => _favOnly = on);
  }

  void _onQueryChanged(String q) {
    setState(() => _query = q);
    _reload();
  }

  void _onSortChanged(StrategySortKey k) {
    if (k == _sort) return;
    setState(() {
      _sort = k;
      _items = _applySort(_items, k);
    });
  }

  Future<void> _openFilterSheet() async {
    final StrategySortFilterResult? res =
        await QzSheet.show<StrategySortFilterResult>(
      context: context,
      builder: (BuildContext ctx) => StrategySortSheet(
        initialCategory: _category,
        initialSort: _sort,
        resultCount: _items.length,
      ),
    );
    if (res == null || !mounted) return;
    final bool catChanged = res.category != _category;
    if (catChanged) {
      setState(() {
        _category = res.category;
        _sort = res.sort;
      });
      _reload();
    } else {
      setState(() {
        _category = res.category;
        _sort = res.sort;
        _items = _applySort(_items, _sort);
      });
    }
  }

  /// 打开全屏搜索 overlay（#1824）。overlay 自身负责 pop + 回调：
  /// 选策略 → push 详情；选标签 → 切分类（退出收藏视图）。
  Future<void> _openSearchOverlay() async {
    await Navigator.of(context).push<void>(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (BuildContext _) => StrategySearchOverlay(
          onOpenStrat: (String id) => context.push('/strategy/$id'),
          onPickTag: _onCategoryChanged,
          onApplyQuery: _onQueryChanged,
        ),
      ),
    );
  }

  /// featured hero 仅在「全部 + 无搜索 + 非收藏视图」时显示（设计稿 line 646）。
  bool get _showFeatured =>
      _featured != null &&
      !_favOnly &&
      _category == StrategyCategory.all &&
      _query.isEmpty;

  /// 列表渲染用的视图项。
  ///
  /// - 收藏视图（[_favOnly]）：仅保留 `favorites` 集合内的策略，忽略分类。
  /// - hero 卡显示时（[_showFeatured]）：剔除与 hero 同 id 的策略，避免同一张卡
  ///   同时出现在 hero 和列表里。
  ///
  /// 注意：仅在 [_showFeatured] 为 true 时访问 `_featured!`，依赖该 getter
  /// 内部已保证 `_featured != null`；如未来改 [_showFeatured] 实现，请同步检查这里。
  List<StrategyMarketItem> _computeListItems(Set<String> favorites) {
    Iterable<StrategyMarketItem> items = _items;
    if (_favOnly) {
      items = items.where(
        (StrategyMarketItem it) => favorites.contains(it.card.id),
      );
    }
    if (_showFeatured) {
      final String heroId = _featured!.card.id;
      items = items.where((StrategyMarketItem it) => it.card.id != heroId);
    }
    return items.toList(growable: false);
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final Set<String> favorites = ref.watch(strategyFavoritesProvider);
    final List<StrategyMarketItem> listItems = _computeListItems(favorites);
    return Scaffold(
      appBar: QzTopBar(
        title: l10n.strategyHomeTitle,
        subtitle: l10n.strategyHomeSubtitle,
        actions: <Widget>[
          _SearchButton(
            active: _query.isNotEmpty,
            tooltip: l10n.strategySearchButton,
            onPressed: _openSearchOverlay,
          ),
          IconButton(
            key: const Key('strategy-filter-btn'),
            tooltip: l10n.strategyHomeFilterButton,
            icon: const Icon(Icons.tune),
            onPressed: _openFilterSheet,
          ),
        ],
      ),
      body: Stack(
        children: <Widget>[
          Column(
            children: <Widget>[
          const SizedBox(height: QzSpacing.xs),
          CategoryChipBar(
            selected: _category,
            favOnly: _favOnly,
            onChanged: _onCategoryChanged,
            onFavOnlyChanged: _onFavOnlyChanged,
          ),
          _SortRow(
            sort: _sort,
            // 收藏视图下结果计数应反映过滤后的条数（含 hero 已剔除项）。
            resultCount: _favOnly ? listItems.length : _items.length,
            onChanged: _onSortChanged,
          ),
          const SizedBox(height: QzSpacing.xs),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _reload,
              child: _loading
                  ? const Center(child: QzSpinner())
                  : listItems.isEmpty && !_showFeatured
                      ? ListView(
                          // RefreshIndicator 要求可滚动 child
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: <Widget>[
                            const SizedBox(height: 80),
                            // 收藏视图为空时走专属空态（星标图标 + 引导 + CTA）；
                            // 其余情况沿用「暂无匹配策略」。
                            _favOnly
                                ? _FavoritesEmptyState(
                                    onBrowse: () => _onFavOnlyChanged(false),
                                  )
                                : QzEmptyState(title: l10n.strategyHomeEmpty),
                          ],
                        )
                      : Builder(builder: (BuildContext _) {
                          return ListView.builder(
                          controller: _scrollCtrl,
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.symmetric(
                              horizontal: QzSpacing.lg),
                          itemCount: listItems.length +
                              (_showFeatured ? 1 : 0) +
                              (_loadingMore ? 1 : 0),
                          itemBuilder: (BuildContext ctx, int rawI) {
                            int i = rawI;
                            if (_showFeatured) {
                              if (i == 0) {
                                return FeaturedHeroCard(
                                  key: const Key('strategy-featured-hero'),
                                  item: _featured!,
                                  onTap: () => context
                                      .push('/strategy/${_featured!.card.id}'),
                                );
                              }
                              i -= 1;
                            }
                            if (i >= listItems.length) {
                              return const Padding(
                                padding: EdgeInsets.symmetric(vertical: 16),
                                child: Center(child: QzSpinner()),
                              );
                            }
                            final StrategyMarketItem item = listItems[i];
                            final String id = item.card.id;
                            return StrategyCardTile(
                              key: Key('strategy-tile-$id'),
                              item: item,
                              starred: favorites.contains(id),
                              onToggleStar: () => ref
                                  .read(strategyFavoritesProvider.notifier)
                                  .toggle(id),
                              onTap: () => context.push('/strategy/$id'),
                              onLoadConversation: () =>
                                  _onLoadConversation(item),
                              onRun: () => _onRun(item),
                            );
                          },
                        );
                        }),
            ),
          ),
            ],
          ),
          if (_toast != null)
            Positioned(
              left: 0,
              right: 0,
              bottom: 24,
              child: Center(
                child: LoadConversationToast(
                  key: const Key('strategy-load-conversation-toast'),
                  text: _toast!,
                ),
              ),
            ),
        ],
      ),
      backgroundColor: c.bg,
    );
  }
}

/// 顶栏搜索按钮（设计稿 m-screens-2 line 566-577）。
///
/// 有 query 时呈激活态：accentSoft 圆底 + 右上红点 badge；否则普通图标按钮。
class _SearchButton extends StatelessWidget {
  const _SearchButton({
    required this.active,
    required this.tooltip,
    required this.onPressed,
  });

  final bool active;
  final String tooltip;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Widget icon = Icon(
      Icons.search,
      color: active ? c.accent : null,
    );
    return IconButton(
      key: const Key('strategy-search-btn'),
      tooltip: tooltip,
      onPressed: onPressed,
      icon: active
          ? Stack(
              clipBehavior: Clip.none,
              children: <Widget>[
                Container(
                  padding: const EdgeInsets.all(4),
                  decoration: BoxDecoration(
                    color: c.accentSoft,
                    shape: BoxShape.circle,
                  ),
                  child: icon,
                ),
                Positioned(
                  right: -1,
                  top: -1,
                  child: Container(
                    key: const Key('strategy-search-btn-dot'),
                    width: 8,
                    height: 8,
                    decoration: BoxDecoration(
                      color: c.statusDanger,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
              ],
            )
          : icon,
    );
  }
}

/// 收藏视图空态（设计稿 m-screens-2 line 712-740）：琥珀星标图标 +
/// 「还没有收藏的策略」+ 引导文案 + 「去策略广场看看」CTA。
class _FavoritesEmptyState extends StatelessWidget {
  const _FavoritesEmptyState({required this.onBrowse});

  final VoidCallback onBrowse;

  static const Color _amber = Color(0xFFF59E0B);

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Padding(
      key: const Key('strategy-fav-empty'),
      padding: const EdgeInsets.symmetric(horizontal: QzSpacing.xl),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          // 琥珀星标圆形徽标。
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: _amber.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.star_rounded,
              size: 26,
              color: _amber,
            ),
          ),
          const SizedBox(height: QzSpacing.lg),
          Text(
            l10n.strategyHomeFavEmptyTitle,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: c.text,
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: QzSpacing.xs),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 240),
            child: Text(
              l10n.strategyHomeFavEmptyHint,
              textAlign: TextAlign.center,
              style: TextStyle(
                color: c.textDim,
                fontSize: 13,
                height: 1.6,
              ),
            ),
          ),
          const SizedBox(height: QzSpacing.lg),
          FilledButton(
            key: const Key('strategy-fav-empty-cta'),
            onPressed: onBrowse,
            child: Text(l10n.strategyHomeFavEmptyCta),
          ),
        ],
      ),
    );
  }
}

/// 排序行（#1565）：标签 + 4 个 chip + 结果计数。
class _SortRow extends StatelessWidget {
  const _SortRow({
    required this.sort,
    required this.resultCount,
    required this.onChanged,
  });

  final StrategySortKey sort;
  final int resultCount;
  final ValueChanged<StrategySortKey> onChanged;

  String _label(BuildContext ctx, StrategySortKey k) {
    final AppLocalizations l10n = AppLocalizations.of(ctx);
    return switch (k) {
      StrategySortKey.hot => l10n.strategyHomeSortHot,
      StrategySortKey.cagr => l10n.strategyHomeSortReturn,
      StrategySortKey.sharpe => l10n.strategyHomeSortSharpe,
      StrategySortKey.mddLow => l10n.strategyHomeSortLowDrawdown,
    };
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          QzSpacing.lg, QzSpacing.xs, QzSpacing.lg, 0),
      child: Row(
        children: <Widget>[
          Text(
            l10n.strategyHomeSortLabel,
            style: TextStyle(color: c.textDim, fontSize: 11),
          ),
          const SizedBox(width: QzSpacing.xs),
          for (final StrategySortKey k in StrategySortKey.values) ...<Widget>[
            _SortChip(
              key: Key('strategy-sort-${k.name}'),
              label: _label(context, k),
              selected: k == sort,
              onTap: () => onChanged(k),
            ),
            const SizedBox(width: 2),
          ],
          const Spacer(),
          Text(
            l10n.strategyHomeResultCount(resultCount),
            style: TextStyle(
              color: c.textDim,
              fontSize: 11,
              fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}

class _SortChip extends StatelessWidget {
  const _SortChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(6),
        child: Container(
          padding:
              const EdgeInsets.symmetric(horizontal: QzSpacing.sm, vertical: 4),
          decoration: BoxDecoration(
            color: selected ? c.accentSoft : Colors.transparent,
            borderRadius: BorderRadius.circular(6),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Text(
                label,
                style: TextStyle(
                  color: selected ? c.accent : c.textDim,
                  fontSize: 11,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                ),
              ),
              if (selected) ...<Widget>[
                const SizedBox(width: 4),
                Icon(
                  Icons.keyboard_arrow_down,
                  size: 14,
                  color: c.accent,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
