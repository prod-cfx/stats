part of 'whale_holdings_tab.dart';
// ignore_for_file: unused_element

/// 币种全屏搜索：空查询展示热门 + 历史，点 chip / 结果直接返回币种。
class _CoinSearchSheet {
  const _CoinSearchSheet._();

  static Future<String?> show({
    required BuildContext context,
    required List<String> coins,
  }) {
    return Navigator.of(context, rootNavigator: true).push<String>(
      MaterialPageRoute<String>(
        fullscreenDialog: true,
        builder: (BuildContext ctx) => _CoinSearchBody(coins: coins),
      ),
    );
  }
}

class _CoinSearchBody extends StatefulWidget {
  const _CoinSearchBody({required this.coins});

  final List<String> coins;

  @override
  State<_CoinSearchBody> createState() => _CoinSearchBodyState();
}

class _CoinSearchBodyState extends State<_CoinSearchBody> {
  final TextEditingController _controller = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  String _query = '';
  late List<String> _history = widget.coins.take(3).toList(growable: true);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _focusNode.requestFocus();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  List<String> get _results {
    final String q = _query.trim().toLowerCase();
    if (q.isEmpty) return const <String>[];
    return widget.coins
        .where((String c) => c.toLowerCase().contains(q))
        .toList(growable: false);
  }

  void _pick(String coin) {
    setState(() {
      _history = <String>[
        coin,
        ..._history.where((String item) => item != coin),
      ].take(12).toList(growable: true);
    });
    Navigator.of(context).pop(coin);
  }

  void _submit(String raw) {
    final List<String> results = _results;
    if (results.isEmpty) return;
    _pick(results.first);
  }

  void _clearQuery() {
    _controller.clear();
    setState(() => _query = '');
    _focusNode.requestFocus();
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final bool hasQuery = _query.trim().isNotEmpty;
    return Scaffold(
      backgroundColor: c.bg,
      body: SafeArea(
        child: Column(
          children: <Widget>[
            _inputRow(l10n, c),
            Expanded(
              child: hasQuery ? _resultList(l10n, c) : _hotCoins(l10n, c),
            ),
          ],
        ),
      ),
    );
  }

  Widget _inputRow(AppLocalizations l10n, QzColorScheme c) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        QzSpacing.sm,
        QzSpacing.lg,
        QzSpacing.sm,
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Container(
              height: 38,
              padding: const EdgeInsets.symmetric(horizontal: QzSpacing.md),
              decoration: BoxDecoration(
                color: c.bgInput,
                border: Border.all(color: c.border),
                borderRadius: BorderRadius.circular(QzRadii.pill),
              ),
              child: Row(
                children: <Widget>[
                  Icon(Icons.search, size: 16, color: c.textMid),
                  const SizedBox(width: QzSpacing.sm),
                  Expanded(
                    child: TextField(
                      key: const Key('whaleHoldingsCoinSearchInput'),
                      controller: _controller,
                      focusNode: _focusNode,
                      onChanged: (String v) => setState(() => _query = v),
                      onSubmitted: _submit,
                      textInputAction: TextInputAction.search,
                      cursorColor: c.accent,
                      style: TextStyle(color: c.text, fontSize: 13),
                      decoration: InputDecoration(
                        filled: false,
                        border: InputBorder.none,
                        isCollapsed: true,
                        hintText: l10n.whaleHoldingsCoinSearchHint,
                        hintStyle: TextStyle(color: c.textDim, fontSize: 13),
                      ),
                    ),
                  ),
                  if (_query.isNotEmpty)
                    GestureDetector(
                      key: const Key('whaleHoldingsCoinSearchClearInput'),
                      onTap: _clearQuery,
                      child: Container(
                        width: 16,
                        height: 16,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: c.border,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(Icons.close, size: 11, color: c.bg),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(width: QzSpacing.md),
          TextButton(
            key: const Key('whaleHoldingsCoinSearchCancel'),
            onPressed: () => Navigator.of(context).pop(),
            child: Text(
              l10n.commonCancel,
              style: TextStyle(color: c.textMid, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }

  Widget _hotCoins(AppLocalizations l10n, QzColorScheme c) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        QzSpacing.xs,
        QzSpacing.lg,
        QzSpacing.xl,
      ),
      children: <Widget>[
        Text(
          l10n.aggCoinSearchHot.toUpperCase(),
          style: TextStyle(
            color: c.textDim,
            fontSize: 11,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.4,
          ),
        ),
        const SizedBox(height: QzSpacing.md),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: <Widget>[
            for (final String coin in widget.coins)
              _CoinSearchChip(
                key: Key('whaleHoldingsCoinSearchHot_$coin'),
                label: coin,
                onTap: () => _pick(coin),
              ),
          ],
        ),
        if (_history.isNotEmpty) ...<Widget>[
          const SizedBox(height: 26),
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  l10n.strategySearchHistoryLabel.toUpperCase(),
                  style: TextStyle(
                    color: c.textDim,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.4,
                  ),
                ),
              ),
              IconButton(
                key: const Key('whaleHoldingsCoinSearchClearHistory'),
                onPressed: () => setState(() => _history = <String>[]),
                icon: Icon(Icons.delete_outline, size: 16, color: c.textDim),
                tooltip: l10n.strategySearchClearHistory,
                padding: const EdgeInsets.all(4),
                constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.md),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: <Widget>[
              for (final String coin in _history)
                _CoinSearchChip(
                  key: Key('whaleHoldingsCoinSearchHistory_$coin'),
                  label: coin,
                  onTap: () => _pick(coin),
                ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _resultList(AppLocalizations l10n, QzColorScheme c) {
    final List<String> results = _results;
    if (results.isEmpty) {
      return Center(
        key: const Key('whaleHoldingsCoinSearchEmpty'),
        child: Text(
          l10n.whaleHoldingsCoinSearchEmpty,
          style: TextStyle(color: c.textDim, fontSize: 13),
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        QzSpacing.xs,
        QzSpacing.lg,
        QzSpacing.xl,
      ),
      itemCount: results.length,
      itemBuilder: (BuildContext ctx, int i) {
        final String coin = results[i];
        return _CoinSearchResultRow(
          key: Key('whaleHoldingsCoinSearchResult_$coin'),
          coin: coin,
          onTap: () => _pick(coin),
        );
      },
    );
  }
}

class _CoinSearchChip extends StatelessWidget {
  const _CoinSearchChip({super.key, required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(minWidth: 62),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
        decoration: BoxDecoration(
          color: c.bgElev,
          borderRadius: BorderRadius.circular(QzRadii.pill),
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: c.textMid,
            fontSize: 13,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

class _CoinSearchResultRow extends StatelessWidget {
  const _CoinSearchResultRow({
    super.key,
    required this.coin,
    required this.onTap,
  });

  final String coin;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: QzSpacing.md),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: c.borderSoft)),
        ),
        child: Row(
          children: <Widget>[
            Container(
              width: 28,
              height: 28,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: c.accent,
                shape: BoxShape.circle,
              ),
              child: Text(
                coin.substring(0, 1),
                style: TextStyle(
                  color: c.accentOn,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text.rich(
                TextSpan(
                  children: <InlineSpan>[
                    TextSpan(text: coin),
                    TextSpan(
                      text: ' / USDT',
                      style: TextStyle(
                        color: c.textDim,
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: c.text,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        QzSpacing.xs,
        QzSpacing.lg,
        QzSpacing.sm,
      ),
      child: Row(
        children: <Widget>[
          Text(
            l10n.whaleHoldingsSectionTitle,
            style: TextStyle(
              color: c.textDim,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.4,
            ),
          ),
          const SizedBox(width: QzSpacing.sm),
          Expanded(child: Container(height: 1, color: c.borderSoft)),
          const SizedBox(width: QzSpacing.sm),
          Text(
            '$count',
            style: TextStyle(
              color: c.textMid,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
