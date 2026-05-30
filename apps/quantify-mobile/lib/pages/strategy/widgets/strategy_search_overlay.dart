import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../data/models/strategy_models.dart';
import '../../../data/providers.dart';
import '../../../data/repositories/strategy_repository.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_avatar.dart';

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

/// 单次联合搜索结果：作者聚合需要从策略命中里派生。
class _AuthorHit {
  const _AuthorHit({required this.name, required this.count});
  final String name;
  final int count;
}

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

  String _query = '';
  bool _loading = false;
  List<StrategyMarketItem> _stratHits = <StrategyMarketItem>[];
  List<_AuthorHit> _authorHits = <_AuthorHit>[];
  List<StrategyCategory> _tagHits = <StrategyCategory>[];
  List<StrategyMarketItem> _guess = <StrategyMarketItem>[];
  int _reqSeq = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _focus.requestFocus();
    });
    _loadGuess();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    _focus.dispose();
    super.dispose();
  }

  /// 「猜你想跟」：取在跟人数 Top3。mock listMarket 默认按 fixture 序返回，
  /// 这里拉一页后本地按 users 降序取前 3，与设计稿一致。
  Future<void> _loadGuess() async {
    final StrategyRepository repo = ref.read(strategyRepositoryProvider);
    final StrategyMarketPage page = await repo.listMarket(pageSize: 50);
    if (!mounted) return;
    final List<StrategyMarketItem> sorted = <StrategyMarketItem>[...page.items]
      ..sort((StrategyMarketItem a, StrategyMarketItem b) =>
          b.stats.users.compareTo(a.stats.users));
    setState(() => _guess = sorted.take(3).toList(growable: false));
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

  Future<void> _onChanged(String raw) async {
    final String q = raw.trim();
    setState(() => _query = raw);
    if (q.isEmpty) {
      setState(() {
        _loading = false;
        _stratHits = <StrategyMarketItem>[];
        _authorHits = <_AuthorHit>[];
        _tagHits = <StrategyCategory>[];
      });
      return;
    }
    final int seq = ++_reqSeq;
    setState(() => _loading = true);

    // 标签段：本地按分类 label 子串匹配（不依赖网络）。
    final AppLocalizations l10n = AppLocalizations.of(context);
    final String lower = q.toLowerCase();
    final List<StrategyCategory> tags = _categoryEntries(l10n)
        .where((({StrategyCategory key, String label}) e) =>
            e.label.toLowerCase().contains(lower))
        .map((({StrategyCategory key, String label}) e) => e.key)
        .toList(growable: false);

    // 策略 / 作者段：复用 listMarket 的 name/author/tags 过滤。
    final StrategyRepository repo = ref.read(strategyRepositoryProvider);
    final StrategyMarketPage page =
        await repo.listMarket(query: q, pageSize: 50);
    if (!mounted || seq != _reqSeq) return;

    final Map<String, int> authorCount = <String, int>{};
    for (final StrategyMarketItem it in page.items) {
      final String a = it.card.author;
      authorCount[a] = (authorCount[a] ?? 0) + 1;
    }
    final List<_AuthorHit> authors = authorCount.entries
        .where((MapEntry<String, int> e) =>
            e.key.toLowerCase().contains(lower))
        .map((MapEntry<String, int> e) =>
            _AuthorHit(name: e.key, count: e.value))
        .toList(growable: false);

    setState(() {
      _loading = false;
      _tagHits = tags;
      _authorHits = authors;
      _stratHits = page.items;
    });
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
    final bool hasQuery = _query.trim().isNotEmpty;
    return Scaffold(
      backgroundColor: c.bg,
      body: SafeArea(
        child: Column(
          children: <Widget>[
            _inputRow(context, l10n, c),
            Expanded(
              child: hasQuery
                  ? _resultsView(l10n, c)
                  : _emptyStateView(l10n, c),
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

  Widget _emptyStateView(AppLocalizations l10n, QzColorScheme c) {
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
        for (final StrategyMarketItem it in _guess) _stratRow(it, c),
      ],
    );
  }

  Widget _resultsView(AppLocalizations l10n, QzColorScheme c) {
    final bool noResults = !_loading &&
        _stratHits.isEmpty &&
        _authorHits.isEmpty &&
        _tagHits.isEmpty;
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
        if (_tagHits.isNotEmpty) ...<Widget>[
          _sectionLabel(l10n.strategySearchTagSection, c),
          Wrap(
            spacing: QzSpacing.sm,
            runSpacing: QzSpacing.sm,
            children: <Widget>[
              for (final StrategyCategory cat in _tagHits)
                _tagChip(cat, l10n, c),
            ],
          ),
        ],
        if (_authorHits.isNotEmpty) ...<Widget>[
          _sectionLabel(
            '${l10n.strategySearchAuthorSection} · ${_authorHits.length}',
            c,
          ),
          for (final _AuthorHit a in _authorHits) _authorRow(a, l10n, c),
        ],
        if (_stratHits.isNotEmpty) ...<Widget>[
          _sectionLabel(
            '${l10n.strategySearchStrategySection} · ${_stratHits.length}',
            c,
          ),
          for (final StrategyMarketItem it in _stratHits) _stratRow(it, c),
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

  Widget _tagChip(StrategyCategory cat, AppLocalizations l10n, QzColorScheme c) {
    final String label = switch (cat) {
      StrategyCategory.trend => l10n.strategyCategoryTrend,
      StrategyCategory.grid => l10n.strategyCategoryGrid,
      StrategyCategory.arbitrage => l10n.strategyCategoryArbitrage,
      StrategyCategory.reversal => l10n.strategyCategoryReversal,
      StrategyCategory.hedge => l10n.strategyCategoryHedge,
      StrategyCategory.highFreq => l10n.strategyCategoryHighFreq,
      StrategyCategory.all => l10n.commonAll,
    };
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

  Widget _authorRow(_AuthorHit a, AppLocalizations l10n, QzColorScheme c) {
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
              child: Text(a.name,
                  style: TextStyle(
                      color: c.text,
                      fontSize: 14,
                      fontWeight: FontWeight.w600)),
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

  Widget _stratRow(StrategyMarketItem item, QzColorScheme c) {
    final StrategyCard card = item.card;
    final bool up = card.pnlPercent >= 0;
    final String initial =
        card.name.isEmpty ? '?' : card.name.characters.first;
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
            QzAvatar(label: initial, size: 36),
            const SizedBox(width: QzSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Text(card.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                          color: c.text,
                          fontSize: 14,
                          fontWeight: FontWeight.w600)),
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
                      Text('${item.stats.users}',
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
}
