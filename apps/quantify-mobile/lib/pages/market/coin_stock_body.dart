import 'package:flutter/material.dart';

import '../../data/mock/fixtures/coin_stocks.dart';
import '../../data/models/coin_stock_models.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import 'widgets/coin_stock_card.dart';
import 'widgets/coin_stock_detail_sheet.dart';
import 'widgets/coin_stock_search_overlay.dart';
import 'widgets/coin_stock_sort_sheet.dart';

/// 币股类型 tab（设计稿 `CSTOCK_TABS`:1844）。
enum _CoinTab { all, btc, eth, other }

/// 币股 hub 子屏（设计稿 `ScreenCoinStocks`:1909）。
///
/// 无 Scaffold / header（由 [DataHubPage] 提供）。类型 tab（全部/BTC/ETH/其他）
/// + 搜索 icon（弹全屏 [CoinStockSearchOverlay]）+ 排序按钮（弹
/// [CoinStockSortSheet]）+ 公司卡列表 + 搜索/过滤空态。点击卡片弹
/// [CoinStockDetailSheet]。
class CoinStockBody extends StatefulWidget {
  const CoinStockBody({super.key, this.stocks = kCoinStocks});

  /// 数据源（默认 mock fixtures，测试可注入）。
  final List<CoinStock> stocks;

  @override
  State<CoinStockBody> createState() => _CoinStockBodyState();
}

class _CoinStockBodyState extends State<CoinStockBody> {
  _CoinTab _tab = _CoinTab.all;
  String _filter = '';
  CoinStockSort _sort = CoinStockSort.mcap;
  SortDir? _dir = SortDir.desc;

  bool _matchTab(CoinStock r) {
    switch (_tab) {
      case _CoinTab.all:
        return true;
      case _CoinTab.btc:
        return r.coin == 'BTC';
      case _CoinTab.eth:
        return r.coin == 'ETH';
      case _CoinTab.other:
        return r.coin != 'BTC' && r.coin != 'ETH';
    }
  }

  List<CoinStock> get _shown {
    final String q = _filter.trim().toLowerCase();
    final List<CoinStock> filtered = widget.stocks
        .where(_matchTab)
        .where(
          (CoinStock r) =>
              q.isEmpty || '${r.sym}${r.cn}${r.ex}'.toLowerCase().contains(q),
        )
        .toList();
    if (_dir == null) return filtered; // 不排序，保持原始顺序
    filtered.sort((CoinStock a, CoinStock b) {
      final double va = _sort.valueOf(a);
      final double vb = _sort.valueOf(b);
      return _dir == SortDir.desc ? vb.compareTo(va) : va.compareTo(vb);
    });
    return filtered;
  }

  Future<void> _openSearch() async {
    await Navigator.of(context, rootNavigator: true).push<void>(
      MaterialPageRoute<void>(
        fullscreenDialog: true,
        builder: (_) => CoinStockSearchOverlay(
          stocks: widget.stocks,
          onApplyQuery: (String q) {
            if (mounted) setState(() => _filter = q);
          },
          onOpenStock: _openDetail,
        ),
      ),
    );
  }

  Future<void> _openSort() async {
    final CoinStockSortResult? result = await CoinStockSortSheet.show(
      context,
      sort: _sort,
      dir: _dir,
      resultCount: _shown.length,
    );
    if (!mounted || result == null) return;
    setState(() {
      _sort = result.sort;
      _dir = result.dir;
    });
  }

  void _openDetail(CoinStock r) {
    if (!mounted) return;
    CoinStockDetailSheet.show(context, r);
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<CoinStock> shown = _shown;
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
            child: _controls(c, l10n),
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
                      16,
                    ),
                    itemCount: shown.length,
                    separatorBuilder: (_, _) =>
                        const SizedBox(height: QzSpacing.sm),
                    itemBuilder: (BuildContext ctx, int i) => CoinStockCard(
                      stock: shown[i],
                      onTap: () => _openDetail(shown[i]),
                    ),
                  ),
          ),
        ],
      ),
    );
  }

  Widget _controls(QzColorScheme c, AppLocalizations l10n) {
    return Row(
      children: <Widget>[
        Expanded(
          child: Stack(
            key: const Key('coin-stock-tabs-search-stack'),
            children: <Widget>[
              Padding(
                padding: const EdgeInsets.only(right: 36),
                child: _tabs(c, l10n),
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
                  child: _searchButton(c),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: QzSpacing.xs),
        _sortButton(c, l10n),
      ],
    );
  }

  Widget _tabs(QzColorScheme c, AppLocalizations l10n) {
    final List<(_CoinTab, String)> tabs = <(_CoinTab, String)>[
      (_CoinTab.all, l10n.coinStockTabAll),
      (_CoinTab.btc, 'BTC'),
      (_CoinTab.eth, 'ETH'),
      (_CoinTab.other, l10n.coinStockTabOther),
    ];
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: <Widget>[
          for (final (_CoinTab, String) t in tabs) ...<Widget>[
            _tabButton(c, t.$1, t.$2),
            const SizedBox(width: 2),
          ],
        ],
      ),
    );
  }

  Widget _tabButton(QzColorScheme c, _CoinTab tab, String label) {
    final bool on = _tab == tab;
    return GestureDetector(
      key: Key('coin-stock-tab-${tab.name}'),
      onTap: () => setState(() => _tab = tab),
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

  Widget _searchButton(QzColorScheme c) {
    return GestureDetector(
      key: const Key('coin-stock-search-button'),
      onTap: _openSearch,
      child: SizedBox(
        width: 32,
        height: 32,
        child: Icon(Icons.search, size: 16, color: c.textMid),
      ),
    );
  }

  Widget _sortButton(QzColorScheme c, AppLocalizations l10n) {
    final String arrow = _dir == SortDir.desc
        ? '↓'
        : _dir == SortDir.asc
        ? '↑'
        : '↕';
    return GestureDetector(
      key: const Key('coin-stock-sort-button'),
      onTap: _openSort,
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
              _sortLabel(l10n, _sort),
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
                color: _dir != null ? c.accent : c.textDim,
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
