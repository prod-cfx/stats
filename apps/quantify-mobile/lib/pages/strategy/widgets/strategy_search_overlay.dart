import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/models/strategy_models.dart';
import '../../../data/providers.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_avatar.dart';
import 'strategy_search_controller.dart';
import 'strategy_search_state.dart';

/// 热门搜索词（设计稿 m-screens-2 `STRAT_TRENDING`）。静态常驻，不随后端变化。
const List<String> _kTrending = <String>[
  '网格',
  '趋势跟踪',
  '资金费率套利',
  'BTC',
  '低回撤',
  '市场中性',
  'DCA 定投',
  '高频做市',
];

/// 策略广场全屏联合搜索 overlay（设计稿 `StratSearchOverlay` line 243-421）。
///
/// 空查询态：热门搜索 + 搜索历史（可清空）+ 「猜你想跟」Top3。
/// 有查询态：标签 / 作者 / 策略三段联合结果；无命中显示空结果文案。
///
/// 选中后自身先 `Navigator.pop`，再调用回调（避免回到广场页后的双 pop / mounted
/// 竞态）。标签段命中后回调 [onPickTag] 切分类；策略段命中回调 [onOpenStrat]。
class StrategySearchOverlay extends ConsumerStatefulWidget {
  const StrategySearchOverlay({
    super.key,
    required this.onOpenStrat,
    required this.onPickTag,
    required this.onApplyQuery,
  });

  /// 选中策略：参数为策略 id。overlay 已自行 pop。
  final ValueChanged<String> onOpenStrat;

  /// 选中标签：参数为对应分类。overlay 已自行 pop。
  final ValueChanged<StrategyCategory> onPickTag;

  /// 提交自由文本搜索（键盘回车）：把查询词应用到广场列表。overlay 已自行 pop。
  final ValueChanged<String> onApplyQuery;

  @override
  ConsumerState<StrategySearchOverlay> createState() =>
      _StrategySearchOverlayState();
}

class _StrategySearchOverlayState
    extends ConsumerState<StrategySearchOverlay> {
  final TextEditingController _ctrl = TextEditingController();
  final FocusNode _focus = FocusNode();

  // 纯 UI 本地态：输入框文本（驱动 hasQuery 切换 + 清空按钮）。取数命中改由
  // [strategySearchControllerProvider] 提供。
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

  /// 分类 label 列表（用于「标签」段联合匹配，排除「全部」）。
  List<({StrategyCategory key, String label})> _categoryEntries(
    AppLocalizations l10n,
  ) {
    return <({StrategyCategory key, String label})>[
      (key: StrategyCategory.trend, label: l10n.strategyCategoryTrend),
      (key: StrategyCategory.grid, label: l10n.strategyCategoryGrid),
      (key: StrategyCategory.arbitrage, label: l10n.strategyCategoryArbitrage),
      (key: StrategyCategory.reversal, label: l10n.strategyCategoryReversal),
      (key: StrategyCategory.hedge, label: l10n.strategyCategoryHedge),
      (key: StrategyCategory.highFreq, label: l10n.strategyCategoryHighFreq),
    ];
  }

  void _onChanged(String raw) {
    setState(() => _query = raw);
    final String q = raw.trim();

    // 标签段：本地按分类 label 子串匹配（依赖 l10n，留 widget）；其余取数下沉 controller。
    final List<StrategyCategory> tags;
    if (q.isEmpty) {
      tags = <StrategyCategory>[];
    } else {
      final AppLocalizations l10n = AppLocalizations.of(context);
      final String lower = q.toLowerCase();
      tags = _categoryEntries(l10n)
          .where((({StrategyCategory key, String label}) e) =>
              e.label.toLowerCase().contains(lower))
          .map((({StrategyCategory key, String label}) e) => e.key)
          .toList(growable: false);
    }
    ref.read(strategySearchControllerProvider.notifier).search(q, tags);
  }

  void _setQuery(String term) {
    _ctrl.text = term;
    _ctrl.selection =
        TextSelection.collapsed(offset: term.length);
    _focus.requestFocus();
    _onChanged(term);
  }

  void _clearInput() {
    _ctrl.clear();
    _focus.requestFocus();
    _onChanged('');
  }

  void _pickStrategy(StrategyMarketItem item) {
    ref.read(strategySearchHistoryProvider.notifier).push(_query);
    Navigator.of(context).pop();
    widget.onOpenStrat(item.card.id);
  }

  void _pickTag(StrategyCategory cat, String label) {
    ref.read(strategySearchHistoryProvider.notifier).push(label);
    Navigator.of(context).pop();
    widget.onPickTag(cat);
  }

  /// 键盘提交：把自由文本应用到广场列表，记录历史并关闭。
  void _applyQuery(String raw) {
    final String q = raw.trim();
    if (q.isEmpty) return;
    ref.read(strategySearchHistoryProvider.notifier).push(q);
    Navigator.of(context).pop();
    widget.onApplyQuery(q);
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final StrategySearchState st = ref.watch(strategySearchControllerProvider);
    final bool hasQuery = _query.trim().isNotEmpty;
    return Scaffold(
      backgroundColor: c.bg,
      body: SafeArea(
        child: Column(
          children: <Widget>[
            _inputRow(context, l10n, c),
            Expanded(
              child: hasQuery
                  ? _resultsView(st, l10n, c)
                  : _emptyStateView(st, l10n, c),
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
          QzSpacing.lg, QzSpacing.sm, QzSpacing.lg, QzSpacing.sm),
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
                      key: const Key('strategy-search-input'),
                      controller: _ctrl,
                      focusNode: _focus,
                      onChanged: _onChanged,
                      onSubmitted: _applyQuery,
                      textInputAction: TextInputAction.search,
                      cursorColor: c.accent,
                      style: TextStyle(color: c.text, fontSize: 13),
                      decoration: InputDecoration(
                        border: InputBorder.none,
                        isCollapsed: true,
                        hintText: l10n.strategyHomeSearchHint,
                        hintStyle:
                            TextStyle(color: c.textDim, fontSize: 13),
                      ),
                    ),
                  ),
                  if (_query.isNotEmpty)
                    GestureDetector(
                      key: const Key('strategy-search-clear-input'),
                      onTap: _clearInput,
                      child: Icon(Icons.cancel,
                          size: 16, color: c.textDim),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(width: QzSpacing.md),
          TextButton(
            key: const Key('strategy-search-cancel'),
            onPressed: () => Navigator.of(context).pop(),
            child: Text(l10n.commonCancel,
                style: TextStyle(color: c.textMid, fontSize: 13)),
          ),
        ],
      ),
    );
  }

  Widget _emptyStateView(
    StrategySearchState st,
    AppLocalizations l10n,
    QzColorScheme c,
  ) {
    final List<String> history = ref.watch(strategySearchHistoryProvider);
    return ListView(
      padding: const EdgeInsets.fromLTRB(
          QzSpacing.lg, QzSpacing.xs, QzSpacing.lg, QzSpacing.xl),
      children: <Widget>[
        _sectionLabel(l10n.strategySearchTrendingLabel, c),
        Wrap(
          spacing: QzSpacing.sm,
          runSpacing: QzSpacing.sm,
          children: <Widget>[
            for (final String t in _kTrending)
              _termChip(t, c, onTap: () => _setQuery(t)),
          ],
        ),
        if (history.isNotEmpty) ...<Widget>[
          _sectionLabel(
            l10n.strategySearchHistoryLabel,
            c,
            trailing: GestureDetector(
              key: const Key('strategy-search-clear-history'),
              onTap: () =>
                  ref.read(strategySearchHistoryProvider.notifier).clear(),
              child: Tooltip(
                message: l10n.strategySearchClearHistory,
                child: Icon(Icons.delete_outline,
                    size: 16, color: c.textDim),
              ),
            ),
          ),
          Wrap(
            spacing: QzSpacing.sm,
            runSpacing: QzSpacing.sm,
            children: <Widget>[
              for (final String t in history)
                _termChip(t, c, onTap: () => _setQuery(t)),
            ],
          ),
        ],
        _sectionLabel(l10n.strategySearchGuessLabel, c),
        for (final StrategyMarketItem it in st.guess) _stratRow(it, l10n, c),
      ],
    );
  }

  Widget _resultsView(
    StrategySearchState st,
    AppLocalizations l10n,
    QzColorScheme c,
  ) {
    final bool noResults = !st.loading &&
        st.stratHits.isEmpty &&
        st.authorHits.isEmpty &&
        st.tagHits.isEmpty;
    if (noResults) {
      return Center(
        key: const Key('strategy-search-no-results'),
        child: Padding(
          padding: const EdgeInsets.all(QzSpacing.xl),
          child: Text(
            l10n.strategySearchNoResults(_query.trim()),
            textAlign: TextAlign.center,
            style: TextStyle(color: c.textDim, fontSize: 14),
          ),
        ),
      );
    }
    return ListView(
      padding: const EdgeInsets.fromLTRB(
          QzSpacing.lg, QzSpacing.xs, QzSpacing.lg, QzSpacing.xl),
      children: <Widget>[
        if (st.tagHits.isNotEmpty) ...<Widget>[
          _sectionLabel(l10n.strategySearchTagSection, c),
          Wrap(
            spacing: QzSpacing.sm,
            runSpacing: QzSpacing.sm,
            children: <Widget>[
              for (final StrategyCategory cat in st.tagHits)
                _tagChip(cat, l10n, c),
            ],
          ),
        ],
        if (st.authorHits.isNotEmpty) ...<Widget>[
          _sectionLabel(
            '${l10n.strategySearchAuthorSection} · ${st.authorHits.length}',
            c,
          ),
          for (final AuthorHit a in st.authorHits) _authorRow(a, l10n, c),
        ],
        if (st.stratHits.isNotEmpty) ...<Widget>[
          _sectionLabel(
            '${l10n.strategySearchStrategySection} · ${st.stratHits.length}',
            c,
          ),
          for (final StrategyMarketItem it in st.stratHits)
            _stratRow(it, l10n, c),
        ],
      ],
    );
  }

  Widget _sectionLabel(String text, QzColorScheme c, {Widget? trailing}) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(0, QzSpacing.lg, 0, QzSpacing.sm),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: <Widget>[
          Text(
            text.toUpperCase(),
            style: TextStyle(
              color: c.textDim,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.4,
            ),
          ),
          ?trailing,
        ],
      ),
    );
  }

  Widget _termChip(String label, QzColorScheme c, {required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: c.bgElev,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(label,
            style: TextStyle(
                color: c.textMid, fontSize: 13, fontWeight: FontWeight.w500)),
      ),
    );
  }

  String _categoryLabel(StrategyCategory cat, AppLocalizations l10n) =>
      switch (cat) {
        StrategyCategory.trend => l10n.strategyCategoryTrend,
        StrategyCategory.grid => l10n.strategyCategoryGrid,
        StrategyCategory.arbitrage => l10n.strategyCategoryArbitrage,
        StrategyCategory.reversal => l10n.strategyCategoryReversal,
        StrategyCategory.hedge => l10n.strategyCategoryHedge,
        StrategyCategory.highFreq => l10n.strategyCategoryHighFreq,
        StrategyCategory.all => l10n.commonAll,
      };

  Widget _tagChip(StrategyCategory cat, AppLocalizations l10n, QzColorScheme c) {
    final String label = _categoryLabel(cat, l10n);
    return GestureDetector(
      key: Key('strategy-search-tag-${cat.name}'),
      onTap: () => _pickTag(cat, label),
      child: Container(
        padding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
        decoration: BoxDecoration(
          color: c.accentSoft,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          l10n.strategySearchTagChip(label),
          style: TextStyle(
              color: c.accent, fontSize: 13, fontWeight: FontWeight.w500),
        ),
      ),
    );
  }

  Widget _authorRow(AuthorHit a, AppLocalizations l10n, QzColorScheme c) {
    final String initial = a.name.isEmpty ? '?' : a.name.characters.first;
    return GestureDetector(
      key: Key('strategy-search-author-${a.name}'),
      behavior: HitTestBehavior.opaque,
      onTap: () => _setQuery(a.name),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: QzSpacing.sm),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: c.borderSoft)),
        ),
        child: Row(
          children: <Widget>[
            QzAvatar(label: initial, size: 32),
            const SizedBox(width: QzSpacing.sm),
            Expanded(
              child: Row(
                children: <Widget>[
                  Flexible(
                    child: Text(a.name,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                            color: c.text,
                            fontSize: 14,
                            fontWeight: FontWeight.w600)),
                  ),
                  if (a.verified) ...<Widget>[
                    const SizedBox(width: 5),
                    Icon(Icons.verified,
                        key: Key('strategy-search-author-verified-${a.name}'),
                        size: 13,
                        color: c.accent),
                  ],
                ],
              ),
            ),
            Text(
              l10n.strategySearchAuthorCount(a.count),
              style: TextStyle(color: c.textDim, fontSize: 11),
            ),
          ],
        ),
      ),
    );
  }

  Widget _stratRow(
      StrategyMarketItem item, AppLocalizations l10n, QzColorScheme c) {
    final StrategyCard card = item.card;
    final bool up = item.stats.cagr >= 0;
    final int winPct = (item.stats.winRate * 100).round();
    return GestureDetector(
      key: Key('strategy-search-strat-${card.id}'),
      behavior: HitTestBehavior.opaque,
      onTap: () => _pickStrategy(item),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: QzSpacing.sm),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: c.borderSoft)),
        ),
        child: Row(
          children: <Widget>[
            QzAvatar(label: card.symbol, size: 36, monospace: true),
            const SizedBox(width: QzSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Flexible(
                        child: Text(card.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                                color: c.text,
                                fontSize: 14,
                                fontWeight: FontWeight.w600)),
                      ),
                      const SizedBox(width: 6),
                      _stratTagChip(card.category, l10n, c),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: <Widget>[
                      Text(
                        'CAGR ${up ? '+' : ''}'
                        '${item.stats.cagr.toStringAsFixed(1)}%',
                        style: TextStyle(
                            color: up ? c.marketUp : c.marketDown,
                            fontSize: 11,
                            fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(width: QzSpacing.md),
                      Text(l10n.strategySearchStratWinRate(winPct),
                          style:
                              TextStyle(color: c.textDim, fontSize: 11)),
                      const SizedBox(width: QzSpacing.md),
                      Text(l10n.strategySearchStratFollow(item.stats.users),
                          style:
                              TextStyle(color: c.textDim, fontSize: 11)),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// 策略行名字旁的类型标签 chip（设计稿 `StratRow` 紫 pill）。
  Widget _stratTagChip(
      StrategyCategory cat, AppLocalizations l10n, QzColorScheme c) {
    return Container(
      key: Key('strategy-search-strat-tag-${cat.name}'),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
      decoration: BoxDecoration(
        color: c.accentSoft,
        borderRadius: BorderRadius.circular(5),
      ),
      child: Text(
        _categoryLabel(cat, l10n),
        style: TextStyle(
            color: c.accent, fontSize: 10, fontWeight: FontWeight.w600),
      ),
    );
  }
}
