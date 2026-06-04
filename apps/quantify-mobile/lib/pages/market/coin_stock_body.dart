import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/mock/fixtures/coin_stocks.dart';
import '../../data/models/coin_stock_models.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import 'coin_stock_body_controller.dart';
import 'coin_stock_body_state.dart';
import 'widgets/coin_stock_card.dart';
import 'widgets/coin_stock_detail_sheet.dart';
import 'widgets/coin_stock_search_overlay.dart';
import 'widgets/coin_stock_sort_sheet.dart';

/// 币股 hub 子屏（设计稿 `ScreenCoinStocks`:1909）。
///
/// 无 Scaffold / header（由 [DataHubPage] 提供）。类型 tab（全部/BTC/ETH/其他）
/// + 搜索 icon（弹全屏 [CoinStockSearchOverlay]）+ 排序按钮（弹
/// [CoinStockSortSheet]）+ 公司卡列表 + 搜索/过滤空态。点击卡片弹
/// [CoinStockDetailSheet]。页面级 tab/filter/sort/dir 由 [CoinStockController]
/// 持有（issue #2184）。
class CoinStockBody extends ConsumerWidget {
  const CoinStockBody({super.key, this.stocks = kCoinStocks});

  /// 数据源（默认 mock fixtures，测试可注入）。
  final List<CoinStock> stocks;

  bool _matchTab(CoinStock r, CoinTab tab) {
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

  List<CoinStock> _shownFor(CoinStockState s) {
    final String q = s.filter.trim().toLowerCase();
    final List<CoinStock> filtered = stocks
        .where((CoinStock r) => _matchTab(r, s.tab))
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

  Future<void> _openSearch(BuildContext context, WidgetRef ref) async {
    await Navigator.of(context, rootNavigator: true).push<void>(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (_) => CoinStockSearchOverlay(
          stocks: stocks,
          onApplyQuery: (String q) =>
              ref.read(coinStockControllerProvider.notifier).setFilter(q),
          onOpenStock: (CoinStock r) => _openDetail(context, r),
        ),
      ),
    );
  }

  Future<void> _openSort(
    BuildContext context,
    WidgetRef ref,
    CoinStockState s,
  ) async {
    final CoinStockSortResult? result = await CoinStockSortSheet.show(
      context,
      sort: s.sort,
      dir: s.dir,
      resultCount: _shownFor(s).length,
    );
    if (result == null) return;
    ref
        .read(coinStockControllerProvider.notifier)
        .setSort(result.sort, result.dir);
  }

  void _openDetail(BuildContext context, CoinStock r) {
    CoinStockDetailSheet.show(context, r);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final CoinStockState s = ref.watch(coinStockControllerProvider);
    final List<CoinStock> shown = _shownFor(s);
    return ColoredBox(
      color: c.bg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.fromLTRB(
              QzSpacing.lg,
              QzSpacing.md,
              QzSpacing.lg,
              QzSpacing.sm,
            ),
            child: _controls(context, ref, c, l10n, s),
          ),
          Expanded(
            child: shown.isEmpty
                ? Center(
                    key: const Key('coin-stock-empty'),
                    child: Text(
                      l10n.coinStockEmpty,
                      style: TextStyle(color: c.textDim, fontSize: 13),
                    ),
                  )
                : ListView.separated(
                    key: const Key('coin-stock-list'),
                    padding: const EdgeInsets.fromLTRB(
                      QzSpacing.lg,
                      QzSpacing.xxs,
                      QzSpacing.lg,
                      100,
                    ),
                    itemCount: shown.length,
                    separatorBuilder: (_, _) =>
                        const SizedBox(height: QzSpacing.sm),
                    itemBuilder: (BuildContext ctx, int i) => CoinStockCard(
                      stock: shown[i],
                      onTap: () => _openDetail(context, shown[i]),
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _controls(
    BuildContext context,
    WidgetRef ref,
    QzColorScheme c,
    AppLocalizations l10n,
    CoinStockState s,
  ) {
    return Row(
      children: <Widget>[
        Expanded(
          child: Stack(
            key: const Key('coin-stock-tabs-search-stack'),
            children: <Widget>[
              Padding(
                padding: const EdgeInsets.only(right: 36),
                child: _tabs(ref, c, l10n, s.tab),
              ),
              Positioned(
                right: 0,
                top: 0,
                bottom: 0,
                width: 52,
                child: Container(
                  key: const Key('coin-stock-tabs-fade-search'),
                  alignment: Alignment.centerRight,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: <Color>[c.bg.withValues(alpha: 0), c.bg],
                    ),
                  ),
                  child: _searchButton(context, ref, c),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: QzSpacing.xs),
        _sortButton(context, ref, c, l10n, s),
      ],
    );
  }

  Widget _tabs(
    WidgetRef ref,
    QzColorScheme c,
    AppLocalizations l10n,
    CoinTab current,
  ) {
    final List<(CoinTab, String)> tabs = <(CoinTab, String)>[
      (CoinTab.all, l10n.coinStockTabAll),
      (CoinTab.btc, 'BTC'),
      (CoinTab.eth, 'ETH'),
      (CoinTab.other, l10n.coinStockTabOther),
    ];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: <Widget>[
          for (final (CoinTab, String) t in tabs) ...<Widget>[
            _tabButton(ref, c, t.$1, t.$2, current),
            const SizedBox(width: 2),
          ],
        ],
      ),
    );
  }

  Widget _tabButton(
    WidgetRef ref,
    QzColorScheme c,
    CoinTab tab,
    String label,
    CoinTab current,
  ) {
    final bool on = current == tab;
    return GestureDetector(
      key: Key('coin-stock-tab-${tab.name}'),
      onTap: () =>
          ref.read(coinStockControllerProvider.notifier).selectTab(tab),
      child: Container(
        height: 30,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: on ? c.accentSoft : Colors.transparent,
          border: Border.all(color: on ? c.accent : Colors.transparent),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: on ? FontWeight.w700 : FontWeight.w500,
            color: on ? c.accent : c.textMid,
          ),
        ),
      ),
    );
  }

  Widget _searchButton(BuildContext context, WidgetRef ref, QzColorScheme c) {
    return GestureDetector(
      key: const Key('coin-stock-search-button'),
      onTap: () => _openSearch(context, ref),
      child: SizedBox(
        width: 32,
        height: 32,
        child: Icon(Icons.search, size: 16, color: c.textMid),
      ),
    );
  }

  Widget _sortButton(
    BuildContext context,
    WidgetRef ref,
    QzColorScheme c,
    AppLocalizations l10n,
    CoinStockState s,
  ) {
    final String arrow = s.dir == SortDir.desc
        ? '↓'
        : s.dir == SortDir.asc
        ? '↑'
        : '↕';
    return GestureDetector(
      key: const Key('coin-stock-sort-button'),
      onTap: () => _openSort(context, ref, s),
      child: Container(
        height: 30,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          color: c.bgElev,
          border: Border.all(color: c.border),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(
              l10n.coinStockSortBy,
              style: TextStyle(fontSize: 11, color: c.textDim),
            ),
            const SizedBox(width: 4),
            Text(
              _sortLabel(l10n, s.sort),
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: c.text,
              ),
            ),
            const SizedBox(width: 5),
            Text(
              arrow,
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: s.dir != null ? c.accent : c.textDim,
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _sortLabel(AppLocalizations l10n, CoinStockSort s) {
    switch (s) {
      case CoinStockSort.mcap:
        return l10n.coinStockStatMcap;
      case CoinStockSort.holdV:
        return l10n.coinStockStatHoldValue;
      case CoinStockSort.holdQ:
        return l10n.coinStockStatHoldQty;
      case CoinStockSort.px:
        return l10n.coinStockSortPrice;
      case CoinStockSort.mnav:
        return l10n.coinStockStatMnav;
      case CoinStockSort.ch:
        return l10n.coinStockSortChange;
    }
  }
}
