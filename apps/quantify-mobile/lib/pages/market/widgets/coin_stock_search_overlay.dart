import 'package:flutter/material.dart';

import '../../../data/models/coin_stock_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 币股全屏搜索 overlay（设计稿 `SearchOverlay` 用法:2044）。
///
/// 空查询态：热门标的 chips（取前 8 条 sym）。有查询态：按 `sym+cn+ex` 子串
/// 匹配渲染结果行（首字母头像 + 代码 + 公司名 + 股价），无命中显示空态。
/// 选中结果先 pop 自身，再回调 [onOpenStock]；点热门 chip 直接打开标的；
/// 键盘提交把当前查询通过 [onApplyQuery] 应用到列表。
class CoinStockSearchOverlay extends StatefulWidget {
  const CoinStockSearchOverlay({
    super.key,
    required this.stocks,
    required this.onOpenStock,
    required this.onApplyQuery,
  });

  final List<CoinStock> stocks;
  final ValueChanged<CoinStock> onOpenStock;
  final ValueChanged<String> onApplyQuery;

  @override
  State<CoinStockSearchOverlay> createState() => _CoinStockSearchOverlayState();
}

class _CoinStockSearchOverlayState extends State<CoinStockSearchOverlay> {
  final TextEditingController _ctrl = TextEditingController();
  final FocusNode _focus = FocusNode();
  String _query = '';
  late List<String> _history;

  @override
  void initState() {
    super.initState();
    _history = _hot.take(3).toList(growable: true);
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

  /// 热门标的 = 数据集前 8 条股票代码（设计稿 `hot=CSTOCK_ROWS.slice(0,8)`:2048）。
  List<String> get _hot =>
      widget.stocks.take(8).map((CoinStock r) => r.sym).toList(growable: false);

  bool _match(CoinStock r, String q) =>
      '${r.sym}${r.cn}${r.ex}'.toLowerCase().contains(q);

  List<CoinStock> get _hits {
    final String q = _query.trim().toLowerCase();
    if (q.isEmpty) return const <CoinStock>[];
    return widget.stocks
        .where((CoinStock r) => _match(r, q))
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

  CoinStock? _stockBySym(String sym) {
    final String value = sym.trim().toLowerCase();
    for (final CoinStock r in widget.stocks) {
      if (r.sym.toLowerCase() == value) return r;
    }
    return null;
  }

  void _pick(CoinStock r) {
    _remember(r.sym);
    Navigator.of(context).pop();
    widget.onOpenStock(r);
  }

  void _apply(String raw) {
    _remember(raw);
    Navigator.of(context).pop();
    widget.onApplyQuery(raw.trim());
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
            Expanded(
              child: hasQuery ? _results(l10n, c) : _hotTargets(l10n, c),
            ),
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
                      key: const Key('coin-stock-search-input'),
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
                        hintText: l10n.coinStockSearchHint,
                        hintStyle: TextStyle(color: c.textDim, fontSize: 13),
                      ),
                    ),
                  ),
                  if (_query.isNotEmpty)
                    GestureDetector(
                      key: const Key('coin-stock-search-clear-input'),
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
            key: const Key('coin-stock-search-cancel'),
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

  Widget _hotTargets(AppLocalizations l10n, QzColorScheme c) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        QzSpacing.lg,
        QzSpacing.lg,
        QzSpacing.xl,
      ),
      children: <Widget>[
        Text(
          l10n.coinStockSearchHotLabel.toUpperCase(),
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
            for (final String t in _hot)
              _chip(c, t, key: Key('coin-stock-search-hot-$t')),
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
                key: const Key('coin-stock-search-clear-history'),
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
                _chip(c, t, key: Key('coin-stock-search-history-$t')),
            ],
          ),
        ],
      ],
    );
  }

  Widget _chip(QzColorScheme c, String term, {required Key key}) {
    return GestureDetector(
      key: key,
      onTap: () {
        final CoinStock? stock = _stockBySym(term);
        if (stock == null) {
          _setQuery(term);
          return;
        }
        _pick(stock);
      },
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
    final List<CoinStock> hits = _hits;
    if (hits.isEmpty) {
      return Center(
        key: const Key('coin-stock-search-empty'),
        child: Padding(
          padding: const EdgeInsets.all(QzSpacing.xl),
          child: Text(
            l10n.coinStockSearchEmpty,
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

  Widget _resultRow(CoinStock r, QzColorScheme c) {
    final Color coinC = coinColor(r.coin);
    return GestureDetector(
      key: Key('coin-stock-search-result-${r.sym}'),
      behavior: HitTestBehavior.opaque,
      onTap: () => _pick(r),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: QzSpacing.md),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: c.borderSoft)),
        ),
        child: Row(
          children: <Widget>[
            Container(
              key: Key('coin-stock-search-avatar-${r.sym}'),
              width: 28,
              height: 28,
              alignment: Alignment.center,
              decoration: BoxDecoration(color: coinC, shape: BoxShape.circle),
              child: Text(
                r.sym.substring(0, 1),
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
                key: Key('coin-stock-search-title-sub-${r.sym}'),
                TextSpan(
                  children: <InlineSpan>[
                    TextSpan(text: r.sym),
                    TextSpan(
                      text: ' ${r.cn}',
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
            const SizedBox(width: QzSpacing.sm),
            Text(
              r.px,
              style: TextStyle(
                color: c.text,
                fontSize: 13,
                fontWeight: FontWeight.w600,
                fontFamily: QzFont.mono,
                fontFamilyFallback: QzFont.monoFallback,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
