part of 'whale_live_tab.dart';
// ignore_for_file: unused_element

class _CoinSearchOverlay extends StatefulWidget {
  const _CoinSearchOverlay({required this.coins});

  final List<String> coins;

  @override
  State<_CoinSearchOverlay> createState() => _CoinSearchOverlayState();
}

class _CoinSearchOverlayState extends State<_CoinSearchOverlay> {
  final TextEditingController _controller = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  late List<String> _history = widget.coins.take(3).toList();
  String _query = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback(
      (_) => _focusNode.requestFocus(),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  void _pick(String coin) {
    setState(() {
      _history = <String>[
        coin,
        ..._history.where((String item) => item != coin),
      ].take(12).toList();
    });
    Navigator.of(context).pop(coin);
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final EdgeInsets safe = MediaQuery.paddingOf(context);
    final String q = _query.trim();
    final List<String> results = widget.coins
        .where((String coin) => coin.toLowerCase().contains(q.toLowerCase()))
        .toList();
    return Material(
      color: c.bg,
      child: Column(
        children: <Widget>[
          Padding(
            padding: EdgeInsets.fromLTRB(16, safe.top + 18, 16, 8),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: Container(
                    height: 38,
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(
                      color: c.bgInput,
                      border: Border.all(color: c.border),
                      borderRadius: BorderRadius.circular(QzRadii.pill),
                    ),
                    child: Row(
                      children: <Widget>[
                        Icon(Icons.search, size: 16, color: c.textMid),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextField(
                            controller: _controller,
                            focusNode: _focusNode,
                            onChanged: (String value) =>
                                setState(() => _query = value),
                            cursorColor: c.accent,
                            decoration: const InputDecoration(
                              filled: false,
                              hintText: '搜索币种',
                              border: InputBorder.none,
                              isDense: true,
                              contentPadding: EdgeInsets.zero,
                            ),
                            style: TextStyle(color: c.text, fontSize: 13),
                          ),
                        ),
                        if (_query.isNotEmpty)
                          GestureDetector(
                            behavior: HitTestBehavior.opaque,
                            onTap: () {
                              _controller.clear();
                              setState(() => _query = '');
                              _focusNode.requestFocus();
                            },
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
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onTap: () => Navigator.of(context).pop(),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 2,
                      vertical: 8,
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
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
              children: q.isNotEmpty
                  ? <Widget>[
                      if (results.isEmpty)
                        Padding(
                          padding: const EdgeInsets.symmetric(
                            vertical: 44,
                            horizontal: 16,
                          ),
                          child: Text(
                            '无匹配币种',
                            textAlign: TextAlign.center,
                            style: TextStyle(color: c.textDim, fontSize: 13),
                          ),
                        )
                      else
                        for (final String coin in results)
                          _SearchResultRow(
                            coin: coin,
                            color: _coinColor(coin, c),
                            onTap: () => _pick(coin),
                          ),
                    ]
                  : <Widget>[
                      _SearchSectionTitle(label: '热门币种'),
                      Wrap(
                        spacing: 10,
                        runSpacing: 10,
                        children: <Widget>[
                          for (final String coin in widget.coins)
                            _SearchChip(label: coin, onTap: () => _pick(coin)),
                        ],
                      ),
                      if (_history.isNotEmpty) ...<Widget>[
                        const SizedBox(height: 26),
                        Row(
                          children: <Widget>[
                            const Expanded(
                              child: _SearchSectionTitle(label: '搜索历史'),
                            ),
                            IconButton(
                              tooltip: '清空搜索历史',
                              onPressed: () =>
                                  setState(() => _history = <String>[]),
                              icon: Icon(
                                Icons.delete_outline,
                                size: 16,
                                color: c.textDim,
                              ),
                              padding: const EdgeInsets.all(4),
                              constraints: const BoxConstraints.tightFor(
                                width: 28,
                                height: 28,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Wrap(
                          spacing: 10,
                          runSpacing: 10,
                          children: <Widget>[
                            for (final String coin in _history)
                              _SearchChip(
                                label: coin,
                                onTap: () => _pick(coin),
                              ),
                          ],
                        ),
                      ],
                    ],
            ),
          ),
        ],
      ),
    );
  }

  Color _coinColor(String coin, QzColorScheme c) {
    return switch (coin) {
      'BTC' => const Color(0xFFF7931A),
      'ETH' => const Color(0xFF627EEA),
      'SOL' => const Color(0xFF9945FF),
      'HYPE' => const Color(0xFF16C783),
      'XRP' => const Color(0xFF23292F),
      'DOGE' => const Color(0xFFC2A633),
      'BNB' => const Color(0xFFF0B90B),
      'PEPE' => const Color(0xFF3D8E41),
      'WIF' => const Color(0xFFC8A06B),
      'ARB' => const Color(0xFF28A0F0),
      'OP' => const Color(0xFFFF0420),
      _ => c.accent,
    };
  }
}

class _SearchSectionTitle extends StatelessWidget {
  const _SearchSectionTitle({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Text(
        label.toUpperCase(),
        style: TextStyle(
          color: c.textDim,
          fontSize: 11,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.4,
        ),
      ),
    );
  }
}

class _SearchChip extends StatelessWidget {
  const _SearchChip({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: ConstrainedBox(
        constraints: const BoxConstraints(minWidth: 62, minHeight: 30),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: c.bgElev,
            borderRadius: BorderRadius.circular(QzRadii.pill),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
            child: Center(
              widthFactor: 1,
              heightFactor: 1,
              child: Text(
                label,
                style: TextStyle(
                  color: c.textMid,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SearchResultRow extends StatelessWidget {
  const _SearchResultRow({
    required this.coin,
    required this.color,
    required this.onTap,
  });

  final String coin;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 10),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: c.borderSoft)),
        ),
        child: Row(
          children: <Widget>[
            Container(
              width: 28,
              height: 28,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: color, shape: BoxShape.circle),
              child: Text(
                coin.characters.first,
                style: const TextStyle(
                  color: Colors.white,
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

class _AddWatchButton extends StatelessWidget {
  const _AddWatchButton({required this.label});
  final String label;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return SizedBox(
      width: double.infinity,
      height: 44,
      child: OutlinedButton.icon(
        onPressed: () {},
        icon: Icon(Icons.add, size: 18, color: c.textMid),
        label: Text(label, style: TextStyle(color: c.textMid, fontSize: 13)),
        style: OutlinedButton.styleFrom(
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          side: BorderSide(color: c.border),
        ),
      ),
    );
  }
}
