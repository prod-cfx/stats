import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/ticker_models.dart';
import '../../data/providers.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_avatar.dart';
import '../../widgets/qz_empty_state.dart';
import '../../widgets/qz_spinner.dart';
import 'widgets/ticker_row.dart'
    show
        TickerRow,
        kTickerRowNameFlex,
        kTickerRowPriceFlex,
        kTickerRowChangeFlex,
        tickerAssetTone;

enum _MarketTab { watchlist, spot, perp, gainers, losers }

/// 行情列表主体（搜索 + 5 个二级 tab + 列表），无 Scaffold / 顶栏 / 铃铛。
///
/// issue #1561 起步为 standalone 页；issue #1851 抽出本主体；issue #1852 起
/// 行情数据屏统一由「数据」hub（`DataHubPage`）的 [DataHubHeader] 承载标题/铃铛，
/// 不再有独立 `QzTopBar` 标题层——本主体只渲染搜索 + 二级 tab + 列表。
/// 5 个二级 tab：自选 / 现货 / 合约 / 涨幅榜 / 跌幅榜，默认选中「自选」（#1600）。
class MarketHomeBody extends ConsumerStatefulWidget {
  const MarketHomeBody({super.key});

  @override
  ConsumerState<MarketHomeBody> createState() => _MarketHomeBodyState();
}

class _MarketHomeBodyState extends ConsumerState<MarketHomeBody> {
  // 默认选中「自选」，对齐设计稿 ScreenTickers（issue #1600）。
  _MarketTab _tab = _MarketTab.watchlist;
  List<Ticker> _tickers = <Ticker>[];
  bool _loading = true;
  Object? _error;

  bool _searchOpen = false;
  final TextEditingController _searchCtrl = TextEditingController();
  List<String> _searchHistory = <String>['BTC', 'ETH', 'SOL'];

  @override
  void initState() {
    super.initState();
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

  void _openSearch() {
    setState(() {
      _searchOpen = true;
      _searchCtrl.clear();
    });
  }

  void _closeSearch() {
    setState(() {
      _searchOpen = false;
      _searchCtrl.clear();
    });
  }

  void _clearSearchQuery() => _searchCtrl.clear();

  void _recordSearchHistory(String symbol) {
    final String base = _tickerBase(symbol);
    setState(() {
      _searchHistory = <String>[
        base,
        ..._searchHistory.where((String item) => item != base),
      ].take(12).toList();
    });
  }

  void _selectSearchHistory(String query) => _searchCtrl.text = query;

  void _clearSearchHistory() => setState(() => _searchHistory = <String>[]);

  /// 按当前 tab + 搜索词过滤/排序行情列表。
  ///
  /// Tab 语义：
  /// - watchlist：仅命中收藏集合 [favorites]（来自 `marketFavoritesProvider`）的条目；
  /// - spot/perp：按 `Ticker.kind` 过滤；
  /// - gainers：按 24H 涨幅降序（仅展示涨幅 > 0）；
  /// - losers：按 24H 跌幅升序（仅展示跌幅 < 0）。
  /// 搜索按 symbol/base/name 包含匹配，大小写无关。
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
        final List<Ticker> g =
            _tickers.where((Ticker t) => t.changePercent > 0).toList()..sort(
              (Ticker a, Ticker b) =>
                  b.changePercent.compareTo(a.changePercent),
            );
        base = g;
        break;
      case _MarketTab.losers:
        final List<Ticker> l =
            _tickers.where((Ticker t) => t.changePercent < 0).toList()..sort(
              (Ticker a, Ticker b) =>
                  a.changePercent.compareTo(b.changePercent),
            );
        base = l;
        break;
    }
    if (_searchQuery.isEmpty) return base.toList();
    return base.where((Ticker t) => _matchesTicker(t, _searchQuery)).toList();
  }

  List<Ticker> _searchResults() {
    if (_searchQuery.isEmpty) return <Ticker>[];
    return _tickers
        .where((Ticker t) => _matchesTicker(t, _searchQuery))
        .toList();
  }

  List<Ticker> _trendingTickers() {
    return (_tickers.toList()..sort(
          (Ticker a, Ticker b) =>
              b.changePercent.abs().compareTo(a.changePercent.abs()),
        ))
        .take(6)
        .toList();
  }

  bool _matchesTicker(Ticker ticker, String query) {
    final String q = query.trim().toUpperCase();
    if (q.isEmpty) return true;
    return ticker.symbol.toUpperCase().contains(q) ||
        _tickerBase(ticker.symbol).toUpperCase().contains(q) ||
        _tickerName(ticker.symbol).toUpperCase().contains(q);
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

    return Stack(
      children: <Widget>[
        Column(
          children: <Widget>[
            Container(
              decoration: BoxDecoration(color: c.bg),
              padding: const EdgeInsets.fromLTRB(
                QzSpacing.lg,
                8,
                QzSpacing.sm,
                0,
              ),
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
                    onPressed: _openSearch,
                    iconSize: 18,
                    visualDensity: VisualDensity.compact,
                    padding: const EdgeInsets.all(QzSpacing.sm),
                    constraints: const BoxConstraints(
                      minWidth: 30,
                      minHeight: 30,
                    ),
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
                    if (!_loading && _error == null)
                      _ColumnHeader(
                        name: l10n.marketHomeColumnName,
                        price: l10n.marketHomeColumnPrice,
                        change: _columnChangeLabel(l10n),
                      ),
                    Expanded(
                      child: Builder(
                        builder: (BuildContext context) {
                          if (_loading) return const Center(child: QzSpinner());
                          if (_error != null) {
                            return QzEmptyState(
                              title: l10n.marketHomeLoadError,
                            );
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
        if (_searchOpen)
          _SearchOverlay(
            controller: _searchCtrl,
            query: _searchQuery,
            history: _searchHistory,
            trending: _trendingTickers(),
            results: _searchResults(),
            onCancel: _closeSearch,
            onClearQuery: _clearSearchQuery,
            onClearHistory: _clearSearchHistory,
            onSelectHistory: _selectSearchHistory,
            onSelectTicker: (Ticker ticker) {
              _recordSearchHistory(ticker.symbol);
              _closeSearch();
              context.push('/market/${ticker.symbol}');
            },
          ),
      ],
    );
  }

  String _columnChangeLabel(AppLocalizations l10n) {
    switch (_tab) {
      case _MarketTab.gainers:
        return '24H 涨幅';
      case _MarketTab.losers:
        return '24H 跌幅';
      case _MarketTab.watchlist:
      case _MarketTab.spot:
      case _MarketTab.perp:
        return l10n.marketHomeColumnChange;
    }
  }
}

class _SearchOverlay extends StatelessWidget {
  const _SearchOverlay({
    required this.controller,
    required this.query,
    required this.history,
    required this.trending,
    required this.results,
    required this.onCancel,
    required this.onClearQuery,
    required this.onClearHistory,
    required this.onSelectHistory,
    required this.onSelectTicker,
  });

  final TextEditingController controller;
  final String query;
  final List<String> history;
  final List<Ticker> trending;
  final List<Ticker> results;
  final VoidCallback onCancel;
  final VoidCallback onClearQuery;
  final VoidCallback onClearHistory;
  final ValueChanged<String> onSelectHistory;
  final ValueChanged<Ticker> onSelectTicker;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final bool hasQuery = query.isNotEmpty;
    return Positioned.fill(
      key: const Key('market-search-overlay'),
      child: Material(
        color: c.bg,
        child: Column(
          children: <Widget>[
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 62, 16, 8),
              child: Row(
                children: <Widget>[
                  Expanded(
                    child: Container(
                      height: 38,
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: c.bgSoft,
                        borderRadius: BorderRadius.circular(999),
                      ),
                      child: Row(
                        children: <Widget>[
                          Icon(Icons.search, size: 16, color: c.textMid),
                          const SizedBox(width: 8),
                          Expanded(
                            child: TextField(
                              key: const Key('market-search-field'),
                              controller: controller,
                              autofocus: true,
                              textCapitalization: TextCapitalization.characters,
                              style: TextStyle(color: c.text, fontSize: 13),
                              decoration: InputDecoration(
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
                              onTap: onClearQuery,
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
                    onPressed: onCancel,
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
    if (results.isEmpty) {
      return <Widget>[
        Padding(
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
    return <Widget>[
      for (final Ticker ticker in results)
        _MarketSearchRow(ticker: ticker, onTap: () => onSelectTicker(ticker)),
    ];
  }

  List<Widget> _buildEmptyQuery(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return <Widget>[
      if (history.isNotEmpty) ...<Widget>[
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
              onPressed: onClearHistory,
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
            for (final String item in history)
              GestureDetector(
                onTap: () => onSelectHistory(item),
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
        padding: EdgeInsets.only(top: history.isEmpty ? 6 : 20, bottom: 4),
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
          ticker: trending[i],
          rank: i + 1,
          onTap: () => onSelectTicker(trending[i]),
        ),
    ];
  }
}

class _MarketSearchRow extends StatelessWidget {
  const _MarketSearchRow({
    required this.ticker,
    required this.onTap,
    this.rank,
  });

  final Ticker ticker;
  final int? rank;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final String base = _tickerBase(ticker.symbol);
    final String quote = _tickerQuote(ticker.symbol);
    final Color changeColor = ticker.changePercent >= 0
        ? c.marketUp
        : c.marketDown;
    return InkWell(
      key: Key('market-search-row-${ticker.symbol}'),
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
