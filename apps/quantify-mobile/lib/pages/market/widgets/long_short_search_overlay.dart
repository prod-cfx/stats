import 'package:flutter/material.dart';

import '../../../data/models/coin_stock_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 多空比币种全屏搜索 overlay（设计稿 `LSCoinTabs` 的搜索按钮 → `SearchOverlay`
/// m-shell.jsx:264 / m-screens-3.jsx:1000）。
///
/// 空查询态：热门币种 chips（全量 [symbols]）+ 搜索历史。有查询态：按币种代码
/// 子串匹配渲染结果行（首字母头像 + 代码 + `/ USDT`），无命中显示空态。选中结果
/// 先 pop 自身再回传 symbol；点 chip 回填查询；键盘提交以当前查询的首条命中应用。
class LongShortSearchOverlay extends StatefulWidget {
  const LongShortSearchOverlay({super.key, required this.symbols});

  /// 候选合约 symbol（如 `BTCUSDT`）。展示与匹配均以去掉 `USDT` 的币种代码进行。
  final List<String> symbols;

  @override
  State<LongShortSearchOverlay> createState() => _LongShortSearchOverlayState();
}

class _LongShortSearchOverlayState extends State<LongShortSearchOverlay> {
  final TextEditingController _ctrl = TextEditingController();
  final FocusNode _focus = FocusNode();
  String _query = '';
  late List<String> _history;

  @override
  void initState() {
    super.initState();
    _history = _coins.take(3).toList(growable: true);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _focus.requestFocus();
    });
  }

  @override
  void dispose() {
    _ctrl.dispose();
    _focus.dispose();
    super.dispose();
  }

  /// 币种代码（去 `USDT`），用于展示、热门与匹配；保留与 [widget.symbols] 同序。
  List<String> get _coins =>
      widget.symbols.map(_coinOf).toList(growable: false);

  String _coinOf(String symbol) => symbol.replaceAll('USDT', '');

  List<String> get _hits {
    final String q = _query.trim().toLowerCase();
    if (q.isEmpty) return const <String>[];
    return _coins
        .where((String coin) => coin.toLowerCase().contains(q))
        .take(20)
        .toList(growable: false);
  }

  void _setQuery(String term) {
    _ctrl.text = term;
    _ctrl.selection = TextSelection.collapsed(offset: term.length);
    _focus.requestFocus();
    setState(() => _query = term);
  }

  void _remember(String term) {
    final String value = term.trim();
    if (value.isEmpty) return;
    setState(() {
      _history = <String>[
        value,
        ..._history.where((String old) => old != value),
      ].take(12).toList(growable: true);
    });
  }

  /// 回传选中币种对应的 symbol；同代码取 [widget.symbols] 首条，缺省回退 `<coin>USDT`。
  void _pick(String coin) {
    _remember(coin);
    final String symbol = widget.symbols.firstWhere(
      (String s) => _coinOf(s) == coin,
      orElse: () => '${coin}USDT',
    );
    Navigator.of(context).pop(symbol);
  }

  /// 键盘提交：以当前查询的首条命中应用；无命中则忽略并保持 overlay。
  void _apply(String raw) {
    final List<String> hits = _hits;
    if (hits.isEmpty) return;
    _pick(hits.first);
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
            _inputRow(context, l10n, c),
            Expanded(child: hasQuery ? _results(l10n, c) : _hotCoins(l10n, c)),
          ],
        ),
      ),
    );
  }

  Widget _inputRow(
    BuildContext context,
    AppLocalizations l10n,
    QzColorScheme c,
  ) {
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
              decoration: BoxDecoration(
                color: c.bgInput,
                border: Border.all(color: c.border),
                borderRadius: BorderRadius.circular(999),
              ),
              padding: const EdgeInsets.symmetric(horizontal: QzSpacing.md),
              child: Row(
                children: <Widget>[
                  Icon(Icons.search, size: 16, color: c.textDim),
                  const SizedBox(width: QzSpacing.sm),
                  Expanded(
                    child: TextField(
                      key: const Key('long-short-search-input'),
                      controller: _ctrl,
                      focusNode: _focus,
                      onChanged: (String v) => setState(() => _query = v),
                      onSubmitted: _apply,
                      textInputAction: TextInputAction.search,
                      cursorColor: c.accent,
                      style: TextStyle(color: c.text, fontSize: 13),
                      decoration: InputDecoration(
                        filled: false,
                        border: InputBorder.none,
                        isCollapsed: true,
                        hintText: l10n.aggCoinSearchHint,
                        hintStyle: TextStyle(color: c.textDim, fontSize: 13),
                      ),
                    ),
                  ),
                  if (_query.isNotEmpty)
                    GestureDetector(
                      key: const Key('long-short-search-clear-input'),
                      onTap: () => _setQuery(''),
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
            key: const Key('long-short-search-cancel'),
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
        QzSpacing.lg,
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
            for (final String t in _coins)
              _chip(c, t, key: Key('long-short-search-hot-$t')),
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
                key: const Key('long-short-search-clear-history'),
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
              for (final String t in _history)
                _chip(c, t, key: Key('long-short-search-history-$t')),
            ],
          ),
        ],
      ],
    );
  }

  Widget _chip(QzColorScheme c, String term, {required Key key}) {
    return GestureDetector(
      key: key,
      onTap: () => _pick(term),
      child: Container(
        constraints: const BoxConstraints(minWidth: 62),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
        decoration: BoxDecoration(
          color: c.bgElev,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          term,
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

  Widget _results(AppLocalizations l10n, QzColorScheme c) {
    final List<String> hits = _hits;
    if (hits.isEmpty) {
      return Center(
        key: const Key('long-short-search-empty'),
        child: Padding(
          padding: const EdgeInsets.all(QzSpacing.xl),
          child: Text(
            l10n.aggCoinSearchEmpty,
            textAlign: TextAlign.center,
            style: TextStyle(color: c.textDim, fontSize: 14),
          ),
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
      itemCount: hits.length,
      itemBuilder: (BuildContext ctx, int i) => _resultRow(hits[i], c),
    );
  }

  Widget _resultRow(String coin, QzColorScheme c) {
    return GestureDetector(
      key: Key('long-short-search-result-$coin'),
      behavior: HitTestBehavior.opaque,
      onTap: () => _pick(coin),
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
                color: coinColor(coin),
                shape: BoxShape.circle,
              ),
              child: Text(
                coin.substring(0, 1),
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ),
            const SizedBox(width: QzSpacing.sm + 2),
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
