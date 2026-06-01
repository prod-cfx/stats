import 'package:flutter/material.dart';

import '../../../data/models/pred_market_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 热门话题（设计稿 `hot=[...]`:1684）。符号/标的常量，不随语言变化。
const List<String> kPredHotTopics = <String>[
  'BTC',
  'XRP',
  'SOL',
  'ETH',
  'CZ',
  '美联储',
];

/// 预测市场全屏搜索 overlay（设计稿 `SearchOverlay` 用法:1679）。
///
/// 空查询态：热门话题 chips。有查询态：按 question 子串匹配渲染结果行，
/// 无命中显示空态文案。选中结果先 pop 自身，再回调 [onOpenMarket]；点热门
/// chip 回填查询。键盘提交把当前查询通过 [onApplyQuery] 应用到网格。
class PredMarketSearchOverlay extends StatefulWidget {
  const PredMarketSearchOverlay({
    super.key,
    required this.markets,
    required this.onOpenMarket,
    required this.onApplyQuery,
  });

  final List<PredMarket> markets;
  final ValueChanged<PredMarket> onOpenMarket;
  final ValueChanged<String> onApplyQuery;

  @override
  State<PredMarketSearchOverlay> createState() =>
      _PredMarketSearchOverlayState();
}

class _PredMarketSearchOverlayState extends State<PredMarketSearchOverlay> {
  final TextEditingController _ctrl = TextEditingController();
  final FocusNode _focus = FocusNode();
  String _query = '';

  @override
  void initState() {
    super.initState();
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

  List<PredMarket> get _hits {
    final String q = _query.trim().toLowerCase();
    if (q.isEmpty) return const <PredMarket>[];
    return widget.markets
        .where((PredMarket m) => m.question.toLowerCase().contains(q))
        .take(20)
        .toList(growable: false);
  }

  void _setQuery(String term) {
    _ctrl.text = term;
    _ctrl.selection = TextSelection.collapsed(offset: term.length);
    _focus.requestFocus();
    setState(() => _query = term);
  }

  void _pick(PredMarket m) {
    Navigator.of(context).pop();
    widget.onOpenMarket(m);
  }

  void _apply(String raw) {
    final String q = raw.trim();
    Navigator.of(context).pop();
    widget.onApplyQuery(q);
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
            Expanded(child: hasQuery ? _results(l10n, c) : _hotTopics(l10n, c)),
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
                      key: const Key('pred-search-input'),
                      controller: _ctrl,
                      focusNode: _focus,
                      onChanged: (String v) => setState(() => _query = v),
                      onSubmitted: _apply,
                      textInputAction: TextInputAction.search,
                      cursorColor: c.accent,
                      style: TextStyle(color: c.text, fontSize: 13),
                      decoration: InputDecoration(
                        border: InputBorder.none,
                        isCollapsed: true,
                        hintText: l10n.predMarketSearchHint,
                        hintStyle: TextStyle(color: c.textDim, fontSize: 13),
                      ),
                    ),
                  ),
                  if (_query.isNotEmpty)
                    GestureDetector(
                      key: const Key('pred-search-clear-input'),
                      onTap: () => _setQuery(''),
                      child: Icon(Icons.cancel, size: 16, color: c.textDim),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(width: QzSpacing.md),
          TextButton(
            key: const Key('pred-search-cancel'),
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

  Widget _hotTopics(AppLocalizations l10n, QzColorScheme c) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        QzSpacing.lg,
        QzSpacing.lg,
        QzSpacing.xl,
      ),
      children: <Widget>[
        Text(
          l10n.predMarketSearchHotLabel,
          style: TextStyle(
            color: c.textDim,
            fontSize: 11,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: QzSpacing.sm),
        Wrap(
          spacing: QzSpacing.sm,
          runSpacing: QzSpacing.sm,
          children: <Widget>[
            for (final String t in kPredHotTopics)
              GestureDetector(
                key: Key('pred-search-hot-$t'),
                onTap: () => _setQuery(t),
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 7,
                  ),
                  decoration: BoxDecoration(
                    color: c.bgElev,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    t,
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
    );
  }

  Widget _results(AppLocalizations l10n, QzColorScheme c) {
    final List<PredMarket> hits = _hits;
    if (hits.isEmpty) {
      return Center(
        key: const Key('pred-search-empty'),
        child: Padding(
          padding: const EdgeInsets.all(QzSpacing.xl),
          child: Text(
            l10n.predMarketEmpty,
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

  Widget _resultRow(PredMarket m, QzColorScheme c) {
    return GestureDetector(
      key: Key('pred-search-result-${m.id}'),
      behavior: HitTestBehavior.opaque,
      onTap: () => _pick(m),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: QzSpacing.md),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: c.borderSoft)),
        ),
        child: Row(
          children: <Widget>[
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: m.color,
                borderRadius: BorderRadius.circular(8),
              ),
              alignment: Alignment.center,
              child: Icon(predIconData(m.icon), size: 16, color: Colors.white),
            ),
            const SizedBox(width: QzSpacing.sm + 2),
            Expanded(
              child: Text(
                m.question,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(color: c.text, fontSize: 13, height: 1.4),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
