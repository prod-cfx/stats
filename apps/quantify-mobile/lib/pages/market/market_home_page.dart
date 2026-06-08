import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/ticker_models.dart';
import '../../data/models/trade_models.dart' show splitSymbolAssets;
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_avatar.dart';
import '../../widgets/qz_empty_state.dart';
import '../../widgets/qz_spinner.dart';
import '../../data/providers.dart' show marketFavoritesProvider;
import 'market_home_controller.dart';
import 'market_home_state.dart';
import 'widgets/ticker_row.dart'
    show
        TickerRow,
        kTickerRowNameFlex,
        kTickerRowPriceFlex,
        kTickerRowChangeFlex,
        tickerAssetTone;
part 'market_home_page.search.part.dart';
part 'market_home_page.rows.part.dart';

/// 行情列表主体（搜索 + 5 个二级 tab + 列表），无 Scaffold / 顶栏 / 铃铛。
///
/// issue #1561 起步为 standalone 页；issue #1851 抽出本主体；issue #1852 起
/// 行情数据屏统一由「数据」hub（`DataHubPage`）的 [DataHubHeader] 承载标题/铃铛，
/// 不再有独立 `QzTopBar` 标题层——本主体只渲染搜索 + 二级 tab + 列表。
/// 5 个二级 tab：自选 / 现货 / 合约 / 涨幅榜 / 跌幅榜，默认选中「自选」（#1600）。
/// 页面级状态（tab/tickers/loading/error/searchHistory）由 [MarketHomeController]
/// 持有（issue #2184）。
class MarketHomeBody extends ConsumerWidget {
  const MarketHomeBody({super.key});

  /// 打开全屏搜索路由（对齐设计稿 `SearchOverlay` 全屏覆盖 + 兄弟屏
  /// [CoinStockSearchOverlay] 范式）。搜索词/结果均在路由内部管理，
  /// 选中条目先记入历史再 pop，回到本屏跳详情。历史经路由回填 controller。
  Future<void> _openSearch(
    BuildContext context,
    WidgetRef ref,
    MarketHomeState s,
  ) async {
    final List<String> updated =
        await Navigator.of(context, rootNavigator: true).push<List<String>>(
          MaterialPageRoute<List<String>>(
            fullscreenDialog: true,
            builder: (_) => _MarketSearchRoute(
              tickers: s.tickers,
              history: s.searchHistory,
              onSelectTicker: (Ticker ticker) =>
                  context.push(_marketDetailPath(ticker.symbol)),
            ),
          ),
        ) ??
        s.searchHistory;
    ref.read(marketHomeControllerProvider.notifier).setSearchHistory(updated);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;

    final MarketHomeState s = ref.watch(marketHomeControllerProvider);
    final List<({MarketTab tab, String label})> tabs =
        <({MarketTab tab, String label})>[
          (tab: MarketTab.watchlist, label: l10n.marketHomeTabWatchlist),
          (tab: MarketTab.spot, label: l10n.marketHomeTabSpot),
          (tab: MarketTab.perp, label: l10n.marketHomeTabPerp),
          (tab: MarketTab.gainers, label: l10n.marketHomeTabGainers),
          (tab: MarketTab.losers, label: l10n.marketHomeTabLosers),
        ];
    final Set<String> favorites = ref.watch(marketFavoritesProvider);
    final List<Ticker> visible = ref
        .read(marketHomeControllerProvider.notifier)
        .visibleTickers(favorites);

    return Column(
      children: <Widget>[
        Container(
          decoration: BoxDecoration(color: c.bg),
          padding: const EdgeInsets.fromLTRB(QzSpacing.lg, 8, QzSpacing.sm, 0),
          child: Row(
            children: <Widget>[
              Expanded(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: <Widget>[
                      for (final ({MarketTab tab, String label}) item in tabs)
                        _SubTab(
                          key: Key('market-tab-${item.tab.name}'),
                          label: item.label,
                          selected: s.tab == item.tab,
                          onTap: () => ref
                              .read(marketHomeControllerProvider.notifier)
                              .selectTab(item.tab),
                        ),
                    ],
                  ),
                ),
              ),
              IconButton(
                key: const Key('market-search-toggle'),
                onPressed: () => _openSearch(context, ref, s),
                iconSize: 18,
                visualDensity: VisualDensity.compact,
                padding: const EdgeInsets.all(QzSpacing.sm),
                constraints: const BoxConstraints(minWidth: 30, minHeight: 30),
                icon: Icon(Icons.search, color: c.textMid),
                tooltip: l10n.marketHomeSearchTooltip,
              ),
            ],
          ),
        ),
        Expanded(
          child: Container(
            color: c.bgElev,
            child: Column(
              children: <Widget>[
                if (!s.loading && s.error == null)
                  _ColumnHeader(
                    name: l10n.marketHomeColumnName,
                    price: l10n.marketHomeColumnPrice,
                    change: _columnChangeLabel(l10n, s.tab),
                  ),
                Expanded(
                  child: _MarketTickerList(state: s, visible: visible),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  String _columnChangeLabel(AppLocalizations l10n, MarketTab tab) {
    switch (tab) {
      case MarketTab.gainers:
        return '24H 涨幅';
      case MarketTab.losers:
        return '24H 跌幅';
      case MarketTab.watchlist:
      case MarketTab.spot:
      case MarketTab.perp:
        return l10n.marketHomeColumnChange;
    }
  }

  String _marketDetailPath(String symbol) {
    final (String base, _) = splitSymbolAssets(symbol);
    return '/market/${Uri.encodeComponent(base.isEmpty ? symbol : base)}';
  }
}

class _MarketTickerList extends ConsumerWidget {
  const _MarketTickerList({required this.state, required this.visible});

  final MarketHomeState state;
  final List<Ticker> visible;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return RefreshIndicator(
      onRefresh: () =>
          ref.read(marketHomeControllerProvider.notifier).refresh(),
      child: _buildChild(context, l10n, c),
    );
  }

  Widget _buildChild(
    BuildContext context,
    AppLocalizations l10n,
    QzColorScheme c,
  ) {
    if (state.loading) return const Center(child: QzSpinner());
    if (state.error != null) {
      return _ScrollableEmptyState(title: l10n.marketHomeLoadError);
    }
    if (visible.isEmpty) {
      final String title = state.tab == MarketTab.watchlist
          ? l10n.marketHomeWatchlistEmpty
          : l10n.marketHomeEmpty;
      return _ScrollableEmptyState(title: title);
    }
    return ListView.separated(
      physics: const AlwaysScrollableScrollPhysics(),
      // 不继承 MediaQuery 顶部 inset（刘海/状态栏），否则
      // 列头与首行间被注入空白（issue: 行情列表顶部留白 #2122）。
      // 底部留白对齐策略广场，避免 shell 透明底栏盖住最后一行。
      padding: const EdgeInsets.only(bottom: 100),
      itemCount: visible.length,
      separatorBuilder: (BuildContext context, int index) =>
          Divider(height: 1, color: c.borderSoft),
      itemBuilder: (BuildContext context, int index) {
        final Ticker ticker = visible[index];
        return TickerRow(
          key: Key('ticker-row-${ticker.symbol}'),
          ticker: ticker,
          nameSuffix: state.tab == MarketTab.perp ? '永续' : null,
          onTap: () => context.push(_marketDetailPath(ticker.symbol)),
        );
      },
    );
  }

  String _marketDetailPath(String symbol) {
    final (String base, _) = splitSymbolAssets(symbol);
    return '/market/${Uri.encodeComponent(base.isEmpty ? symbol : base)}';
  }
}

class _ScrollableEmptyState extends StatelessWidget {
  const _ScrollableEmptyState({required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.only(bottom: 100),
      children: <Widget>[
        SizedBox(
          height: MediaQuery.sizeOf(context).height * 0.5,
          child: QzEmptyState(title: title),
        ),
      ],
    );
  }
}
