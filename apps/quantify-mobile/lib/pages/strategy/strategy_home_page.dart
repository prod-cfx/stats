import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/strategy_models.dart';
import '../../data/providers.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_empty_state.dart';
import '../../widgets/qz_spinner.dart';
import '../../widgets/qz_top_bar.dart';
import 'strategy_home_controller.dart';
import 'strategy_home_state.dart';
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
///   列表容器对齐设计稿 padding '10px 16px 100px'；分页加载保留业务逻辑，
///   底部仅以轻量 spinner 占位，不破坏设计稿布局。
class StrategyHomePage extends ConsumerStatefulWidget {
  const StrategyHomePage({super.key});

  @override
  ConsumerState<StrategyHomePage> createState() => _StrategyHomePageState();
}

class _StrategyHomePageState extends ConsumerState<StrategyHomePage> {
  final ScrollController _scrollCtrl = ScrollController();

  /// sheet 实时联动通道（#2128）：sheet 在 modal route 内，无法随父页面重绘，
  /// 故用 [ValueNotifier] 把选中类型/排序/结果数推给 sheet。属模态局部态，按
  /// issue #2185 边界保留在 widget，不并入页面 controller。
  final ValueNotifier<StrategyCategory> _sheetCategory =
      ValueNotifier<StrategyCategory>(StrategyCategory.all);
  final ValueNotifier<StrategySortKey> _sheetSort =
      ValueNotifier<StrategySortKey>(StrategySortKey.hot);
  final ValueNotifier<int> _sheetResultCount = ValueNotifier<int>(0);

  StrategyHomeController get _ctrl =>
      ref.read(strategyHomeControllerProvider.notifier);

  @override
  void initState() {
    super.initState();
    _scrollCtrl.addListener(_onScroll);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _ctrl.reload();
      _ctrl.loadFeatured();
    });
  }

  @override
  void dispose() {
    _scrollCtrl.removeListener(_onScroll);
    _scrollCtrl.dispose();
    _sheetCategory.dispose();
    _sheetSort.dispose();
    _sheetResultCount.dispose();
    super.dispose();
  }

  /// 点击「载入对话」：toast → 700ms → `/ai?loadStrategy=$id`。toast 文案在此
  /// 解析（依赖 l10n），timer/导航请求由 controller 持有。
  void _onLoadConversation(StrategyMarketItem item) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    _ctrl.fireToastAndNav(
      message: l10n.strategyHomeLoadedToast(item.card.name),
      route: '/ai?loadStrategy=${item.card.id}',
    );
  }

  /// 点击「运行」（#1821）：toast「『名』已启动 · 进入实盘监控」，~700ms 后跳
  /// 实盘监控 `/me/live`。
  void _onRun(StrategyMarketItem item) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    _ctrl.fireToastAndNav(
      message: l10n.strategyHomeStartedToast(item.card.name),
      route: '/me/live',
    );
  }

  void _onScroll() {
    final StrategyHomeState s = ref.read(strategyHomeControllerProvider);
    if (s.loadingMore || !s.hasMore) return;
    if (!_scrollCtrl.hasClients) return;
    final double pos = _scrollCtrl.position.pixels;
    final double max = _scrollCtrl.position.maxScrollExtent;
    if (pos >= max - 200) {
      _ctrl.loadMore();
    }
  }

  void _onCategoryChanged(StrategyCategory c) {
    _ctrl.setCategory(c);
    _sheetCategory.value = c;
  }

  void _onFavOnlyChanged(bool on) {
    _ctrl.setFavOnly(on);
  }

  void _onQueryChanged(String q) {
    _ctrl.setQuery(q);
  }

  void _onSortChanged(StrategySortKey k) {
    _ctrl.setSort(k);
    _sheetSort.value = k;
  }

  /// 打开「筛选 & 排序」sheet（#2128）。受控 sheet：点击类型/排序即时回调，
  /// 复用 [_onCategoryChanged]/[_onSortChanged] 更新页面状态，列表与结果数实时
  /// 变化；sheet 选中态/计数由 [_sheetCategory]/[_sheetSort]/[_sheetResultCount]
  /// 实时注入。「查看 N 个结果」只负责关闭 sheet。
  Future<void> _openFilterSheet() async {
    final StrategyHomeState s = ref.read(strategyHomeControllerProvider);
    // 打开时把当前真值同步给 sheet 三通道，防止任何遗漏的状态分支造成初始态漂移。
    // 收藏视图忽略分类，故类型选中态归一到 all，避免 pill 高亮某类与实际过滤不符。
    _sheetCategory.value = s.favOnly ? StrategyCategory.all : s.category;
    _sheetSort.value = s.sort;
    _sheetResultCount.value = strategyResultCount(
      s,
      ref.read(strategyFavoritesProvider),
    );
    _ctrl.setFilterSheetOpen(true);
    await StrategySortSheet.show(
      context: context,
      category: _sheetCategory,
      sort: _sheetSort,
      resultCount: _sheetResultCount,
      // sheet 内选类型：退出收藏视图（与列表 chip 同语义），重拉并实时刷新列表。
      onCategoryChanged: _onCategoryChanged,
      onSortChanged: _onSortChanged,
    );
    if (mounted) _ctrl.setFilterSheetOpen(false);
  }

  /// 打开全屏搜索 overlay（#1824）。overlay 自身负责 pop + 回调：
  /// 选策略 → push 详情；选标签 → 切分类（退出收藏视图）。
  Future<void> _openSearchOverlay() async {
    await Navigator.of(context, rootNavigator: true).push<void>(
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

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final Set<String> favorites = ref.watch(strategyFavoritesProvider);
    final StrategyHomeState s = ref.watch(strategyHomeControllerProvider);
    // 导航副作用留 widget：controller 到点写 pendingNav，这里消费并跳转。
    ref.listen<StrategyHomeState>(strategyHomeControllerProvider,
        (StrategyHomeState? prev, StrategyHomeState next) {
      final String? route = next.pendingNav;
      if (route != null) {
        _ctrl.consumeNav();
        context.go(route);
      }
    });
    final List<StrategyMarketItem> listItems = strategyListItems(s, favorites);
    // 收藏视图下结果计数应反映过滤后的条数（含 hero 已剔除项）。
    final int resultCount = strategyResultCount(s, favorites);
    final bool showFeatured = strategyShowFeatured(s);
    // 把实时计数推给已打开的 sheet（#2128）；仅 sheet 打开时调度，避免 sheet 关闭
    // 时高频 rebuild（滚动分页 / 收藏切换）无意义排回调。post-frame 避免 build 内
    // 改 notifier 触发同帧重入。
    if (s.filterSheetOpen) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _sheetResultCount.value = resultCount;
      });
    }
    return Scaffold(
      appBar: QzTopBar(
        compact: true,
        title: l10n.strategyHomeTitle,
        subtitle: l10n.strategyHomeSubtitle,
        actions: <Widget>[
          Padding(
            padding: const EdgeInsets.only(right: QzSpacing.sm),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                _SearchButton(
                  active: s.query.isNotEmpty,
                  tooltip: l10n.strategySearchButton,
                  onPressed: _openSearchOverlay,
                ),
                const SizedBox(width: QzSpacing.sm),
                _FilterButton(
                  active: s.filterSheetOpen,
                  tooltip: l10n.strategyHomeFilterButton,
                  onPressed: _openFilterSheet,
                ),
              ],
            ),
          ),
        ],
      ),
      body: Stack(
        children: <Widget>[
          Column(
            children: <Widget>[
          const SizedBox(height: QzSpacing.xs),
          CategoryChipBar(
            selected: s.category,
            favOnly: s.favOnly,
            onChanged: _onCategoryChanged,
            onFavOnlyChanged: _onFavOnlyChanged,
          ),
          _SortRow(
            sort: s.sort,
            resultCount: resultCount,
            onChanged: _onSortChanged,
          ),
          const SizedBox(height: QzSpacing.xs),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _ctrl.reload,
              child: s.loading
                  ? const Center(child: QzSpinner())
                  : listItems.isEmpty && !showFeatured
                      ? ListView(
                          // RefreshIndicator 要求可滚动 child
                          physics: const AlwaysScrollableScrollPhysics(),
                          children: <Widget>[
                            const SizedBox(height: 80),
                            // 收藏视图为空时走专属空态（星标图标 + 引导 + CTA）；
                            // 其余情况沿用「暂无匹配策略」。
                            s.favOnly
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
                          // 设计稿 m-screens-2:644 列表容器 padding '10px 16px 100px'：
                          // 顶 10、左右 16、底 100（为底部导航/sticky 区留白）。
                          padding: const EdgeInsets.fromLTRB(
                              QzSpacing.lg, 10, QzSpacing.lg, 100),
                          itemCount: listItems.length +
                              (showFeatured ? 1 : 0) +
                              (s.loadingMore ? 1 : 0),
                          itemBuilder: (BuildContext ctx, int rawI) {
                            int i = rawI;
                            if (showFeatured) {
                              if (i == 0) {
                                return FeaturedHeroCard(
                                  key: const Key('strategy-featured-hero'),
                                  item: s.featured!,
                                  onTap: () => context
                                      .push('/strategy/${s.featured!.card.id}'),
                                );
                              }
                              i -= 1;
                            }
                            if (i >= listItems.length) {
                              // 分页 loading：设计稿列表区无底部 spinner，故收敛为
                              // 不破坏布局的轻量占位——小尺寸、低高度，落在底部留白内，
                              // 仍保留分页业务逻辑（_loadMore）。
                              return const Padding(
                                padding: EdgeInsets.only(top: QzSpacing.sm),
                                child: Center(child: QzSpinner(size: 18)),
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
          if (s.toast != null)
            Positioned(
              left: 0,
              right: 0,
              bottom: 24,
              child: Center(
                child: LoadConversationToast(
                  key: const Key('strategy-load-conversation-toast'),
                  text: s.toast!,
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
    return Tooltip(
      key: const Key('strategy-search-btn'),
      message: tooltip,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onPressed,
        child: SizedBox(
          // 设计稿 m-screens-2:566 操作按钮 36×36 圆形。
          width: 36,
          height: 36,
          child: Stack(
            children: <Widget>[
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: active ? c.accentSoft : Colors.transparent,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
              Center(
                child: Icon(
                  Icons.search,
                  size: 20,
                  color: active ? c.accent : c.textMid,
                ),
              ),
              if (active)
                Positioned(
                  // 设计稿 m-screens-2:584 红点 7×7，定位 top:6 right:6。
                  right: 6,
                  top: 6,
                  child: Container(
                    key: const Key('strategy-search-btn-dot'),
                    width: 7,
                    height: 7,
                    decoration: BoxDecoration(
                      color: c.accent,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 顶部「筛选 & 排序」按钮（设计稿 m-screens-2:578-583）。
///
/// 图标样式对齐「实盘策略」顶部排序入口：使用 tune 线性滑杆图标，
/// 不使用漏斗图标。
class _FilterButton extends StatelessWidget {
  const _FilterButton({
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
    return Tooltip(
      key: const Key('strategy-filter-btn'),
      message: tooltip,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onPressed,
        child: SizedBox(
          // 设计稿操作按钮统一 36×36 圆形、图标 20。
          width: 36,
          height: 36,
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: active ? c.accentSoft : Colors.transparent,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Icon(
                Icons.tune,
                size: 20,
                color: active ? c.accent : c.textMid,
              ),
            ),
          ),
        ),
      ),
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
        child: SizedBox(
          height: 24,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10),
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
                    size: 10,
                    color: c.accent,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
