part of 'market_home_page.dart';

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
