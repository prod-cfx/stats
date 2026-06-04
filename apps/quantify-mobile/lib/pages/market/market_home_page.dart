import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/ticker_models.dart';
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
    final List<String> updated = await Navigator.of(
          context,
          rootNavigator: true,
        ).push<List<String>>(
          MaterialPageRoute<List<String>>(
            fullscreenDialog: true,
            builder: (_) => _MarketSearchRoute(
              tickers: s.tickers,
              history: s.searchHistory,
              onSelectTicker: (Ticker ticker) =>
                  context.push('/market/${ticker.symbol}'),
            ),
          ),
        ) ??
        s.searchHistory;
    ref.read(marketHomeControllerProvider.notifier).setSearchHistory(updated);
  }

  /// 按当前 tab 过滤/排序行情列表。
  ///
  /// Tab 语义：
  /// - watchlist：仅命中收藏集合 [favorites]（来自 `marketFavoritesProvider`）的条目；
  /// - spot/perp：按 `Ticker.kind` 过滤；
  /// - gainers：按 24H 涨幅降序（仅展示涨幅 > 0）；
  /// - losers：按 24H 跌幅升序（仅展示跌幅 < 0）。
  /// 搜索已迁出为全屏路由，本屏列表不再内联过滤。
  List<Ticker> _visibleTickers(
    MarketTab tab,
    List<Ticker> tickers,
    Set<String> favorites,
  ) {
    switch (tab) {
      case MarketTab.watchlist:
        return tickers
            .where((Ticker t) => favorites.contains(t.symbol))
            .toList();
      case MarketTab.spot:
        return tickers
            .where((Ticker t) => t.kind == MarketKind.spot)
            .toList();
      case MarketTab.perp:
        return tickers
            .where((Ticker t) => t.kind == MarketKind.perp)
            .toList();
      case MarketTab.gainers:
        return tickers.where((Ticker t) => t.changePercent > 0).toList()
          ..sort(
            (Ticker a, Ticker b) => b.changePercent.compareTo(a.changePercent),
          );
      case MarketTab.losers:
        return tickers.where((Ticker t) => t.changePercent < 0).toList()
          ..sort(
            (Ticker a, Ticker b) => a.changePercent.compareTo(b.changePercent),
          );
    }
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
    final List<Ticker> visible = _visibleTickers(s.tab, s.tickers, favorites);

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
                  child: Builder(
                    builder: (BuildContext context) {
                      if (s.loading) return const Center(child: QzSpinner());
                      if (s.error != null) {
                        return QzEmptyState(title: l10n.marketHomeLoadError);
                      }
                      if (visible.isEmpty) {
                        final String title = s.tab == MarketTab.watchlist
                            ? l10n.marketHomeWatchlistEmpty
                            : l10n.marketHomeEmpty;
                        return QzEmptyState(title: title);
                      }
                      return ListView.separated(
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
                            nameSuffix: s.tab == MarketTab.perp ? '永续' : null,
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
}

/// 行情数据全屏搜索路由（设计稿 `SearchOverlay`:m-screens-3.jsx:1052 —— `inset:0`
/// 全屏覆盖，盖住 `行情数据/多空比/...` 整条 header）。对齐兄弟屏
/// [CoinStockSearchOverlay]：`Scaffold` + `SafeArea` 而非 body 内 `Positioned.fill`
/// + 62 魔数（旧实现把设计稿的状态栏留白照搬进 body，留下 tab 与输入框间空白）。
///
/// query / history 均在本路由内部管理；选中条目先记入历史再 pop 回上层跳详情，
/// 取消/返回时通过 `pop(history)` 把最新历史回传 [MarketHomeBody]。
class _MarketSearchRoute extends ConsumerStatefulWidget {
  const _MarketSearchRoute({
    required this.tickers,
    required this.history,
    required this.onSelectTicker,
  });

  final List<Ticker> tickers;
  final List<String> history;
  final ValueChanged<Ticker> onSelectTicker;

  @override
  ConsumerState<_MarketSearchRoute> createState() => _MarketSearchRouteState();
}

class _MarketSearchRouteState extends ConsumerState<_MarketSearchRoute> {
  final TextEditingController _ctrl = TextEditingController();
  late List<String> _history;

  @override
  void initState() {
    super.initState();
    _history = List<String>.from(widget.history);
    _ctrl.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  /// 归一化搜索词（大写、去首尾空格）。
  String get _query => _ctrl.text.trim().toUpperCase();

  List<Ticker> get _results {
    if (_query.isEmpty) return const <Ticker>[];
    return widget.tickers
        .where((Ticker t) => _matches(t, _query))
        .toList();
  }

  /// 热门搜索 = 24H 绝对涨跌幅前 6（与旧实现 `_trendingTickers` 一致）。
  List<Ticker> get _trending {
    return (widget.tickers.toList()..sort(
          (Ticker a, Ticker b) =>
              b.changePercent.abs().compareTo(a.changePercent.abs()),
        ))
        .take(6)
        .toList();
  }

  bool _matches(Ticker ticker, String query) {
    final String q = query.trim().toUpperCase();
    if (q.isEmpty) return true;
    return ticker.symbol.toUpperCase().contains(q) ||
        _tickerBase(ticker.symbol).toUpperCase().contains(q) ||
        _tickerName(ticker.symbol).toUpperCase().contains(q);
  }

  void _recordHistory(String symbol) {
    final String base = _tickerBase(symbol);
    setState(() {
      _history = <String>[
        base,
        ..._history.where((String item) => item != base),
      ].take(12).toList();
    });
  }

  void _toggleFavorite(String symbol) =>
      ref.read(marketFavoritesProvider.notifier).toggle(symbol);

  void _selectTicker(Ticker ticker) {
    _recordHistory(ticker.symbol);
    Navigator.of(context).pop(_history);
    widget.onSelectTicker(ticker);
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final bool hasQuery = _query.isNotEmpty;
    return Scaffold(
      key: const Key('market-search-overlay'),
      backgroundColor: c.bg,
      body: SafeArea(
        child: Column(
          children: <Widget>[
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
              child: Row(
                children: <Widget>[
                  Expanded(
                    child: Container(
                      height: 38,
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: c.bgInput,
                        border: Border.all(color: c.border),
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Row(
                        children: <Widget>[
                          Icon(Icons.search, size: 16, color: c.textMid),
                          const SizedBox(width: 8),
                          Expanded(
                            child: TextField(
                              key: const Key('market-search-field'),
                              controller: _ctrl,
                              autofocus: true,
                              textCapitalization: TextCapitalization.characters,
                              style: TextStyle(color: c.text, fontSize: 13),
                              decoration: InputDecoration(
                                filled: false,
                                border: InputBorder.none,
                                isCollapsed: true,
                                hintText: '搜索',
                                hintStyle: TextStyle(
                                  color: c.textDim,
                                  fontSize: 13,
                                ),
                              ),
                            ),
                          ),
                          if (hasQuery)
                            GestureDetector(
                              key: const Key('market-search-clear-query'),
                              onTap: () => _ctrl.clear(),
                              child: Container(
                                width: 16,
                                height: 16,
                                alignment: Alignment.center,
                                decoration: BoxDecoration(
                                  color: c.border,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  '×',
                                  style: TextStyle(
                                    color: c.bg,
                                    fontSize: 11,
                                    height: 1,
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  TextButton(
                    key: const Key('market-search-cancel'),
                    onPressed: () => Navigator.of(context).pop(_history),
                    style: TextButton.styleFrom(
                      padding: const EdgeInsets.symmetric(horizontal: 2),
                      minimumSize: const Size(34, 30),
                      tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                    ),
                    child: Text(
                      '取消',
                      style: TextStyle(
                        color: c.textMid,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                children: hasQuery
                    ? _buildResults(context)
                    : _buildEmptyQuery(context),
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildResults(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final List<Ticker> results = _results;
    if (results.isEmpty) {
      return <Widget>[
        Padding(
          key: const Key('market-search-empty'),
          padding: const EdgeInsets.symmetric(vertical: 44, horizontal: 16),
          child: Center(
            child: Text(
              '无匹配币种',
              style: TextStyle(color: c.textDim, fontSize: 13),
            ),
          ),
        ),
      ];
    }
    final Set<String> favorites = ref.watch(marketFavoritesProvider);
    return <Widget>[
      for (final Ticker ticker in results)
        _MarketSearchRow(
          ticker: ticker,
          favorite: favorites.contains(ticker.symbol),
          onToggleFavorite: () => _toggleFavorite(ticker.symbol),
          onTap: () => _selectTicker(ticker),
        ),
    ];
  }

  List<Widget> _buildEmptyQuery(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final List<Ticker> trending = _trending;
    final Set<String> favorites = ref.watch(marketFavoritesProvider);
    return <Widget>[
      if (_history.isNotEmpty) ...<Widget>[
        Row(
          children: <Widget>[
            Expanded(
              child: Text(
                '搜索历史',
                style: TextStyle(
                  color: c.text,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            IconButton(
              key: const Key('market-search-clear-history'),
              onPressed: () => setState(() => _history = <String>[]),
              iconSize: 16,
              visualDensity: VisualDensity.compact,
              padding: const EdgeInsets.all(4),
              constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
              icon: Icon(Icons.delete_outline, color: c.textDim),
              tooltip: '清空搜索历史',
            ),
          ],
        ),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: <Widget>[
            for (final String item in _history)
              GestureDetector(
                onTap: () {
                  _ctrl.text = item;
                  _ctrl.selection = TextSelection.collapsed(
                    offset: item.length,
                  );
                },
                child: Container(
                  constraints: const BoxConstraints(minWidth: 56),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 16,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color: c.bgElev,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    item,
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      color: c.textMid,
                      fontSize: 13,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ),
          ],
        ),
      ],
      Padding(
        padding: EdgeInsets.only(top: _history.isEmpty ? 6 : 20, bottom: 4),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: <Widget>[
            Text(
              '热门搜索',
              style: TextStyle(
                color: c.text,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(width: 8),
            Text('· 24H 异动', style: TextStyle(color: c.textDim, fontSize: 11)),
          ],
        ),
      ),
      for (int i = 0; i < trending.length; i++)
        _MarketSearchRow(
          key: Key('market-search-hot-$i'),
          ticker: trending[i],
          rank: i + 1,
          favorite: favorites.contains(trending[i].symbol),
          onToggleFavorite: () => _toggleFavorite(trending[i].symbol),
          onTap: () => _selectTicker(trending[i]),
        ),
    ];
  }
}

class _MarketSearchRow extends StatelessWidget {
  const _MarketSearchRow({
    super.key,
    required this.ticker,
    required this.onTap,
    required this.favorite,
    required this.onToggleFavorite,
    this.rank,
  });

  final Ticker ticker;
  final int? rank;
  final VoidCallback onTap;
  final bool favorite;
  final VoidCallback onToggleFavorite;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final String base = _tickerBase(ticker.symbol);
    final String quote = _tickerQuote(ticker.symbol);
    final Color changeColor = ticker.changePercent >= 0
        ? c.marketUp
        : c.marketDown;
    return InkWell(
      key: Key('market-search-result-${ticker.symbol}'),
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 11, horizontal: 4),
        child: Row(
          children: <Widget>[
            if (rank != null)
              SizedBox(
                width: 18,
                child: Text(
                  '$rank',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    color: rank! <= 3 ? const Color(0xFF7C5CFF) : c.textDim,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    fontFamily: QzFont.mono,
                    fontFamilyFallback: QzFont.monoFallback,
                  ),
                ),
              ),
            if (rank != null) const SizedBox(width: 11),
            QzAvatar(
              label: base.isEmpty ? '?' : base.substring(0, 1),
              size: 30,
              monospace: true,
              backgroundColor: tickerAssetTone(base),
            ),
            const SizedBox(width: 11),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  RichText(
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    text: TextSpan(
                      style: TextStyle(
                        color: c.text,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                      children: <InlineSpan>[
                        TextSpan(text: base),
                        if (quote.isNotEmpty)
                          TextSpan(
                            text: ' / $quote',
                            style: TextStyle(
                              color: c.textDim,
                              fontSize: 10,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 1),
                  Text(
                    _tickerName(ticker.symbol),
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: c.textDim, fontSize: 11),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 10),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: <Widget>[
                Text(
                  _formatPrice(ticker.price),
                  style: TextStyle(
                    color: c.text,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    fontFamily: QzFont.mono,
                    fontFamilyFallback: QzFont.monoFallback,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  _formatChange(ticker.changePercent),
                  style: TextStyle(
                    color: changeColor,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    fontFamily: QzFont.mono,
                    fontFamilyFallback: QzFont.monoFallback,
                  ),
                ),
              ],
            ),
            const SizedBox(width: 8),
            GestureDetector(
              key: Key('market-search-star-${ticker.symbol}'),
              behavior: HitTestBehavior.opaque,
              onTap: onToggleFavorite,
              child: Padding(
                padding: const EdgeInsets.all(4),
                child: Icon(
                  favorite ? Icons.star : Icons.star_border,
                  color: favorite ? const Color(0xFFF0B90B) : c.textDim,
                  size: 19,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

const List<String> _kKnownQuotes = <String>[
  'USDT',
  'USDC',
  'USD',
  'BUSD',
  'BTC',
  'ETH',
  'DAI',
  'TUSD',
];

const Map<String, String> _kTickerNames = <String, String>{
  'BTC': 'Bitcoin',
  'ETH': 'Ethereum',
  'SOL': 'Solana',
  'BNB': 'BNB',
  'XRP': 'XRP',
  'DOGE': 'Dogecoin',
  'ADA': 'Cardano',
  'AVAX': 'Avalanche',
  'AAVE': 'Aave',
  'ATOM': 'Cosmos',
  'BCH': 'Bitcoin Cash',
  'DOT': 'Polkadot',
  'ETC': 'Ethereum Classic',
  'FIL': 'Filecoin',
  'LINK': 'Chainlink',
  'LTC': 'Litecoin',
  'MATIC': 'Polygon',
  'NEAR': 'NEAR Protocol',
  'OP': 'Optimism',
  'PEPE': 'Pepe',
  'SHIB': 'Shiba Inu',
  'SUI': 'Sui',
  'TRX': 'TRON',
  'UNI': 'Uniswap',
  'WLD': 'Worldcoin',
  'XLM': 'Stellar',
};

String _tickerBase(String symbol) {
  for (final String quote in _kKnownQuotes) {
    if (symbol.length > quote.length && symbol.endsWith(quote)) {
      return symbol.substring(0, symbol.length - quote.length);
    }
  }
  return symbol;
}

String _tickerQuote(String symbol) {
  for (final String quote in _kKnownQuotes) {
    if (symbol.length > quote.length && symbol.endsWith(quote)) {
      return quote;
    }
  }
  return '';
}

String _tickerName(String symbol) {
  final String base = _tickerBase(symbol).toUpperCase();
  return _kTickerNames[base] ?? base;
}

String _formatPrice(double value) {
  final String fixed = value.toStringAsFixed(2);
  final List<String> parts = fixed.split('.');
  final String whole = parts.first;
  final StringBuffer buffer = StringBuffer();
  for (int i = 0; i < whole.length; i++) {
    if (i > 0 && (whole.length - i) % 3 == 0) buffer.write(',');
    buffer.write(whole[i]);
  }
  return '${buffer.toString()}.${parts[1]}';
}

String _formatChange(double value) {
  final String sign = value > 0 ? '+' : '';
  return '$sign${value.toStringAsFixed(2)}%';
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
          padding: const EdgeInsets.only(bottom: 6),
          margin: const EdgeInsets.only(right: 18),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: selected ? c.text : Colors.transparent,
                width: 2,
              ),
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: selected ? c.text : c.textDim,
              fontSize: 13,
              fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
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
    final TextStyle style = TextStyle(
      color: c.textDim,
      fontSize: 11,
      fontWeight: FontWeight.w500,
    );
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
