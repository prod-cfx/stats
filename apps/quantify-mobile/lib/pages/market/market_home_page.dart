import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/mock/fixtures/whale_extras.dart';
import '../../data/models/ticker_models.dart';
import '../../data/models/whale_extra_models.dart';
import '../../data/providers.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_empty_state.dart';
import '../../widgets/qz_notification_bell.dart';
import '../../widgets/qz_spinner.dart';
import '../../widgets/qz_top_bar.dart';
import '../whale/widgets/whale_notification_sheet.dart';
import 'widgets/ticker_row.dart'
    show TickerRow, kTickerRowNameFlex, kTickerRowPriceFlex, kTickerRowChangeFlex;

enum _MarketTab { watchlist, spot, perp, gainers, losers }

/// 行情列表首页（issue #1561）。
///
/// QzTopBar + 通知铃铛（复用 #1560 的 WhaleNotificationSheet 数据/弹层），
/// 通知铃铛为 36x36 圆形描边样式（issue #1597 对齐设计稿 ScreenTickers）。
/// tab 行右侧搜索 IconButton 可展开行内搜索框（push 布局，不遮挡列表）。
/// 5 个二级 tab：自选 / 现货 / 合约 / 涨幅榜 / 跌幅榜，默认选中「自选」（#1600）。
class MarketHomePage extends ConsumerStatefulWidget {
  const MarketHomePage({super.key});

  @override
  ConsumerState<MarketHomePage> createState() => _MarketHomePageState();
}

class _MarketHomePageState extends ConsumerState<MarketHomePage> {
  // 默认选中「自选」，对齐设计稿 ScreenTickers（issue #1600）。
  _MarketTab _tab = _MarketTab.watchlist;
  List<Ticker> _tickers = <Ticker>[];
  bool _loading = true;
  Object? _error;

  bool _searchOpen = false;
  final TextEditingController _searchCtrl = TextEditingController();

  late List<WhaleNotification> _notifications;

  @override
  void initState() {
    super.initState();
    _notifications = List<WhaleNotification>.of(mockWhaleNotifications);
    _searchCtrl.addListener(_onSearchChanged);
    _load();
  }

  @override
  void dispose() {
    _searchCtrl
      ..removeListener(_onSearchChanged)
      ..dispose();
    super.dispose();
  }

  /// 搜索输入触发重 build。controller.text 已是真值来源，不再镜像到字段，避免双重状态。
  void _onSearchChanged() => setState(() {});

  /// 归一化后的搜索词（大写、去首尾空格）。
  String get _searchQuery => _searchCtrl.text.trim().toUpperCase();

  Future<void> _load() async {
    final repo = ref.read(tickerRepositoryProvider);
    try {
      final List<Ticker> tickers = await repo.listTickers();
      if (!mounted) return;
      setState(() {
        _tickers = tickers;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  int get _unreadCount =>
      _notifications.where((WhaleNotification n) => n.unread).length;

  Future<void> _openNotifications() async {
    final WhaleNotificationSheetResult? result =
        await WhaleNotificationSheet.show(
      context,
      notifications: _notifications,
    );
    if (!mounted || result == null) return;
    setState(() => _notifications = result.notifications);
  }

  void _toggleSearch() {
    setState(() {
      _searchOpen = !_searchOpen;
      if (!_searchOpen) {
        // clear() 会触发 _onSearchChanged listener，自动重 build；这里只切 _searchOpen。
        _searchCtrl.clear();
      }
    });
  }

  /// 按当前 tab + 搜索词过滤/排序行情列表。
  ///
  /// Tab 语义：
  /// - watchlist：仅命中收藏集合 [favorites]（来自 `marketFavoritesProvider`）的条目；
  /// - spot/perp：按 `Ticker.kind` 过滤；
  /// - gainers：按 24H 涨幅降序（仅展示涨幅 > 0）；
  /// - losers：按 24H 跌幅升序（仅展示跌幅 < 0）。
  /// 搜索仅在 symbol 上做包含匹配，大小写无关。
  List<Ticker> _visibleTickers(Set<String> favorites) {
    Iterable<Ticker> base;
    switch (_tab) {
      case _MarketTab.watchlist:
        base = _tickers.where((Ticker t) => favorites.contains(t.symbol));
        break;
      case _MarketTab.spot:
        base = _tickers.where((Ticker t) => t.kind == MarketKind.spot);
        break;
      case _MarketTab.perp:
        base = _tickers.where((Ticker t) => t.kind == MarketKind.perp);
        break;
      case _MarketTab.gainers:
        final List<Ticker> g = _tickers
            .where((Ticker t) => t.changePercent > 0)
            .toList()
          ..sort((Ticker a, Ticker b) =>
              b.changePercent.compareTo(a.changePercent));
        base = g;
        break;
      case _MarketTab.losers:
        final List<Ticker> l = _tickers
            .where((Ticker t) => t.changePercent < 0)
            .toList()
          ..sort((Ticker a, Ticker b) =>
              a.changePercent.compareTo(b.changePercent));
        base = l;
        break;
    }
    if (_searchQuery.isEmpty) return base.toList();
    return base
        .where((Ticker t) => t.symbol.contains(_searchQuery))
        .toList();
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;

    final List<({_MarketTab tab, String label})> tabs =
        <({_MarketTab tab, String label})>[
      (tab: _MarketTab.watchlist, label: l10n.marketHomeTabWatchlist),
      (tab: _MarketTab.spot, label: l10n.marketHomeTabSpot),
      (tab: _MarketTab.perp, label: l10n.marketHomeTabPerp),
      (tab: _MarketTab.gainers, label: l10n.marketHomeTabGainers),
      (tab: _MarketTab.losers, label: l10n.marketHomeTabLosers),
    ];
    final Set<String> favorites = ref.watch(marketFavoritesProvider);
    final List<Ticker> visible = _visibleTickers(favorites);

    return Scaffold(
      backgroundColor: c.bg,
      appBar: QzTopBar(
        title: l10n.marketHomeTitle,
        actions: <Widget>[
          QzNotificationBell(
            iconKey: const Key('market-notification-bell'),
            unread: _unreadCount,
            onTap: _openNotifications,
            tooltip: l10n.marketHomeNotificationTooltip,
            circular: true,
          ),
          const SizedBox(width: QzSpacing.md),
        ],
      ),
      body: Column(
        children: <Widget>[
          if (_searchOpen)
            Padding(
              padding: const EdgeInsets.fromLTRB(
                QzSpacing.lg,
                QzSpacing.sm,
                QzSpacing.lg,
                QzSpacing.sm,
              ),
              child: Container(
                height: 40,
                padding: const EdgeInsets.symmetric(horizontal: QzSpacing.md),
                decoration: BoxDecoration(
                  color: c.bgElev,
                  border: Border.all(color: c.border),
                  borderRadius: BorderRadius.circular(QzRadii.input),
                ),
                child: Row(
                  children: <Widget>[
                    Icon(Icons.search, size: 16, color: c.textDim),
                    const SizedBox(width: QzSpacing.sm),
                    Expanded(
                      child: Semantics(
                        label: l10n.marketHomeSearchPlaceholder,
                        textField: true,
                        child: TextField(
                          key: const Key('market-search-field'),
                          controller: _searchCtrl,
                          autofocus: true,
                          textCapitalization: TextCapitalization.characters,
                          style: TextStyle(color: c.text, fontSize: 13),
                          decoration: InputDecoration(
                            border: InputBorder.none,
                            isCollapsed: true,
                            hintText: l10n.marketHomeSearchPlaceholder,
                            hintStyle:
                                TextStyle(color: c.textDim, fontSize: 13),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          Container(
            decoration: BoxDecoration(
              color: c.bgElev,
              border: Border(bottom: BorderSide(color: c.borderSoft)),
            ),
            padding:
                const EdgeInsets.fromLTRB(QzSpacing.lg, 4, QzSpacing.sm, 0),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: SingleChildScrollView(
                    scrollDirection: Axis.horizontal,
                    child: Row(
                      children: <Widget>[
                        for (final ({_MarketTab tab, String label}) item
                            in tabs)
                          _SubTab(
                            key: Key('market-tab-${item.tab.name}'),
                            label: item.label,
                            selected: _tab == item.tab,
                            onTap: () => setState(() => _tab = item.tab),
                          ),
                      ],
                    ),
                  ),
                ),
                IconButton(
                  key: const Key('market-search-toggle'),
                  onPressed: _toggleSearch,
                  iconSize: 18,
                  visualDensity: VisualDensity.compact,
                  padding: const EdgeInsets.all(QzSpacing.sm),
                  constraints: const BoxConstraints(
                    minWidth: 30,
                    minHeight: 30,
                  ),
                  icon: Icon(
                    _searchOpen ? Icons.close : Icons.search,
                    color: _searchOpen ? c.text : c.textMid,
                  ),
                  tooltip: _searchOpen
                      ? l10n.marketHomeSearchClose
                      : l10n.marketHomeSearchTooltip,
                ),
              ],
            ),
          ),
          Expanded(
            child: Container(
              color: c.bgElev,
              child: Column(
                children: <Widget>[
                  if (!_loading && _error == null)
                    _ColumnHeader(
                      name: l10n.marketHomeColumnName,
                      price: l10n.marketHomeColumnPrice,
                      change: l10n.marketHomeColumnChange,
                    ),
                  Expanded(
                    child: Builder(
                      builder: (BuildContext context) {
                        if (_loading) return const Center(child: QzSpinner());
                        if (_error != null) {
                          return QzEmptyState(title: l10n.marketHomeLoadError);
                        }
                        if (visible.isEmpty) {
                          final String title = _searchQuery.isNotEmpty
                              ? l10n.marketHomeSearchEmpty
                              : (_tab == _MarketTab.watchlist
                                  ? l10n.marketHomeWatchlistEmpty
                                  : l10n.marketHomeEmpty);
                          return QzEmptyState(title: title);
                        }
                        return ListView.separated(
                          itemCount: visible.length,
                          separatorBuilder:
                              (BuildContext context, int index) =>
                                  Divider(height: 1, color: c.borderSoft),
                          itemBuilder: (BuildContext context, int index) {
                            final Ticker ticker = visible[index];
                            return TickerRow(
                              key: Key('ticker-row-${ticker.symbol}'),
                              ticker: ticker,
                              onTap: () =>
                                  context.push('/market/${ticker.symbol}'),
                            );
                          },
                        );
                      },
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SubTab extends StatelessWidget {
  const _SubTab({
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
    return Semantics(
      label: label,
      button: true,
      selected: selected,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          margin: const EdgeInsets.only(right: 20),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: selected ? c.accent : Colors.transparent,
                width: 2,
              ),
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: selected ? c.text : c.textMid,
              fontSize: 13,
              fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}

class _ColumnHeader extends StatelessWidget {
  const _ColumnHeader({
    required this.name,
    required this.price,
    required this.change,
  });

  final String name;
  final String price;
  final String change;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final TextStyle style =
        TextStyle(color: c.textDim, fontSize: 11, fontWeight: FontWeight.w500);
    return Container(
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border(bottom: BorderSide(color: c.borderSoft)),
      ),
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.lg,
        vertical: 10,
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            flex: kTickerRowNameFlex,
            child: Text(name, style: style),
          ),
          Expanded(
            flex: kTickerRowPriceFlex,
            child: Text(price, style: style, textAlign: TextAlign.right),
          ),
          Expanded(
            flex: kTickerRowChangeFlex,
            child: Text(change, style: style, textAlign: TextAlign.right),
          ),
        ],
      ),
    );
  }
}

