part of 'whale_profile_page.dart';
// ignore_for_file: unused_element

/// 基本信息 tab：P&L 图（顶部金额 + 可交互 pill 行 + 底部抽屉）
/// + 4 stat 卡 + 永续总价值明细（issue #1906）。
///
/// 三个 pill（时间范围 / 统计范围 / 指标）点击弹底部抽屉切换，选择后回填
/// pill 文案并刷新图表标题。真实数据刷新依赖 #1682；mock 阶段仅切换文案与
/// 顶部金额展示。
/// 基本信息 tab（三件套迁移 #2183）：period/scope/metric pill 态收敛进
/// [whaleProfileBasicTabControllerProvider]，widget 退化为消费层。pill 默认
/// 文案（1周 / 仅永续合约 / 总盈亏）由 widget 渲染时只读回退，用户在 sheet
/// 选中后才写回 controller。
class _BasicTab extends ConsumerWidget {
  const _BasicTab({required this.profile});
  final WhaleProfile profile;

  Future<void> _pickPeriod(
    BuildContext context,
    WidgetRef ref,
    AppLocalizations l10n,
    String current,
  ) async {
    final String? next = await WhaleChartFilterSheet.show(
      context,
      title: l10n.whaleProfilePillPeriodTitle,
      options: <String>[
        l10n.whaleProfilePeriodDay,
        l10n.whaleProfilePeriodWeek,
        l10n.whaleProfilePeriodMonth,
        l10n.whaleProfilePeriodAll,
      ],
      value: current,
    );
    if (next != null) {
      ref.read(whaleProfileBasicTabControllerProvider.notifier).setPeriod(next);
    }
  }

  Future<void> _pickScope(
    BuildContext context,
    WidgetRef ref,
    AppLocalizations l10n,
    String current,
  ) async {
    final String? next = await WhaleChartFilterSheet.show(
      context,
      title: l10n.whaleProfilePillScopeTitle,
      options: <String>[
        l10n.whaleProfileScopePerpOnly,
        l10n.whaleProfileScopePerpSpot,
      ],
      value: current,
    );
    if (next != null) {
      ref.read(whaleProfileBasicTabControllerProvider.notifier).setScope(next);
    }
  }

  Future<void> _pickMetric(
    BuildContext context,
    WidgetRef ref,
    AppLocalizations l10n,
    String current,
  ) async {
    final String? next = await WhaleChartFilterSheet.show(
      context,
      title: l10n.whaleProfilePillMetricTitle,
      options: <String>[
        l10n.whaleProfileMetricTotalPnl,
        l10n.whaleProfileMetricAccountValue,
      ],
      value: current,
    );
    if (next != null) {
      ref.read(whaleProfileBasicTabControllerProvider.notifier).setMetric(next);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final WhaleProfileBasicTabState st = ref.watch(
      whaleProfileBasicTabControllerProvider,
    );
    // 只读回退：用户未改动时用设计稿默认文案，不写回 provider。
    final String period = st.period ?? l10n.whaleProfilePeriodWeek;
    final String scope = st.scope ?? l10n.whaleProfileScopePerpOnly;
    final String metric = st.metric ?? l10n.whaleProfileMetricTotalPnl;
    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 40),
      children: <Widget>[
        Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: c.bgElev,
            border: Border.all(color: c.borderSoft),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                l10n.whaleProfilePnlChartTitle(period, scope),
                style: TextStyle(fontSize: 12, color: c.textMid),
              ),
              const SizedBox(height: 4),
              Text(
                profile.pnlTotalDisplay ?? r'$ -172.51K',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: c.marketDown,
                  fontFamily: QzFont.mono,
                  fontFamilyFallback: QzFont.monoFallback,
                ),
              ),
              const SizedBox(height: QzSpacing.sm),
              Wrap(
                spacing: 6,
                runSpacing: QzSpacing.xs,
                children: <Widget>[
                  _FilterPill(
                    text: period,
                    minWidth: 64,
                    onTap: () => _pickPeriod(context, ref, l10n, period),
                  ),
                  _FilterPill(
                    text: scope,
                    minWidth: 94,
                    onTap: () => _pickScope(context, ref, l10n, scope),
                  ),
                  _FilterPill(
                    text: metric,
                    minWidth: 78,
                    accent: true,
                    onTap: () => _pickMetric(context, ref, l10n, metric),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              WhalePnlChart(points: profile.pnlCurve),
            ],
          ),
        ),
        const SizedBox(height: QzSpacing.md),
        if (profile.statCards != null)
          WhaleStatCards(cards: profile.statCards!, stats: profile.stats),
        if (profile.perpSummary != null) ...<Widget>[
          const SizedBox(height: QzSpacing.md),
          WhalePerpSummaryCard(summary: profile.perpSummary!),
        ],
      ],
    );
  }
}

/// 可交互 pill（点击弹底部抽屉切换图表参数，issue #1906）。
class _FilterPill extends StatelessWidget {
  const _FilterPill({
    required this.text,
    required this.onTap,
    required this.minWidth,
    this.accent = false,
  });
  final String text;
  final VoidCallback onTap;
  final double minWidth;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: ConstrainedBox(
        constraints: BoxConstraints(minWidth: minWidth, minHeight: 28),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: accent ? c.accent : c.bgElev,
            gradient: accent
                ? LinearGradient(
                    colors: <Color>[c.accent.withValues(alpha: 0.78), c.accent],
                  )
                : null,
            border: Border.all(color: accent ? c.accent : c.border),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                Text(
                  text,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: accent ? FontWeight.w600 : FontWeight.w500,
                    color: accent ? c.accentOn : c.text,
                  ),
                ),
                const SizedBox(width: 5),
                Icon(
                  Icons.keyboard_arrow_down,
                  size: 10,
                  color: accent ? c.accentOn : c.textMid,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// 明细 tab 排序/筛选脚手架（#1908）。
///
/// 设计稿 `TabBody`（jsx:1163）：工具条（左侧 sort label / 右侧 sort label +
/// 币种筛选 [+ 更多排序]）+ 排序/筛选后的行。各 tab 通过泛型注入：取 sym、
/// 列头排序键、数值取值（time 用行索引）、更多排序指标、行构建。
typedef _SymOf<T> = String Function(T item);
typedef _RowBuilder<T> = Widget Function(T item);

/// 列头排序键定义：(key, label, 是否右对齐, 数值取值或 null=用索引(time))。
class _SortKey<T> {
  const _SortKey(this.key, this.label, {this.right = false, this.numOf});
  final String key;
  final String label;
  final bool right;

  /// null 表示 time 列——用行原始索引排序（fixture 已按时间倒序）。
  final double Function(T item)? numOf;
}

/// 在 [allKeys] 中按 key 解析排序列定义（#2192：从 `_SortableTab._keyOf` 上移）。
_SortKey<T>? _whaleProfileSortKeyOf<T>(List<_SortKey<T>> allKeys, String? k) {
  if (k == null) return null;
  for (final _SortKey<T> sk in allKeys) {
    if (sk.key == k) return sk;
  }
  return null;
}

/// 按币种筛选 + 排序派生明细行（#2192：从 `_SortableTab._process` 上移的纯派生）。
///
/// 保留原行为：`coin == all` 不筛；排序键缺失或 `dir == null` 仅返回筛选结果；
/// time 列（`numOf == null`）按行原始索引排序。返回带原索引的行，供渲染消费。
List<({int idx, T item})> _whaleProfileSortableRows<T>({
  required List<T> items,
  required List<_SortKey<T>> allKeys,
  required _SymOf<T> symOf,
  required WhaleSortState sort,
  required String coin,
  required String all,
}) {
  final List<({int idx, T item})> indexed = <({int idx, T item})>[
    for (int i = 0; i < items.length; i++) (idx: i, item: items[i]),
  ];
  final List<({int idx, T item})> filtered = coin == all
      ? indexed
      : indexed.where((({int idx, T item}) e) => symOf(e.item) == coin).toList();
  final _SortKey<T>? sk = _whaleProfileSortKeyOf(allKeys, sort.key);
  if (sk == null || sort.dir == null) return filtered;
  final List<({int idx, T item})> sorted = <({int idx, T item})>[...filtered];
  // time 列（numOf==null）用行原始索引；其余用数值取值。
  double v(({int idx, T item}) e) =>
      sk.numOf == null ? -e.idx.toDouble() : sk.numOf!(e.item);
  sorted.sort((({int idx, T item}) a, ({int idx, T item}) b) =>
      v(a).compareTo(v(b)));
  if (sort.dir == WhaleSortDir.desc) {
    return sorted.reversed.toList();
  }
  return sorted;
}

/// 通用排序/筛选明细 tab（三件套迁移 #2183）。排序/币种态收敛进
/// [whaleProfileSortableTabControllerProvider]，按 [tabId] 区分 5 个明细 tab
/// 各自独立实例。币种默认「全部」由 widget 渲染时只读回退，不写回 provider。
/// 泛型排序/筛选派生上移为顶层纯函数 [_whaleProfileSortableRows]（#2192），
/// widget 仅取用。
class _SortableTab<T> extends ConsumerWidget {
  const _SortableTab({
    required this.tabId,
    required this.items,
    required this.empty,
    required this.symOf,
    required this.leftKeys,
    required this.rightKeys,
    required this.rowBuilder,
    this.filterLabel,
    this.moreSortKeys = const <Never>[],
  });

  /// family key：区分 spot/perp/order/trade/hist，保证各 tab 态互不串扰。
  final String tabId;
  final List<T> items;
  final String empty;
  final _SymOf<T> symOf;
  final List<_SortKey<T>> leftKeys;
  final List<_SortKey<T>> rightKeys;
  final _RowBuilder<T> rowBuilder;

  /// 现货 tab 用「筛选」，其余用默认「币种筛选」。
  final String? filterLabel;

  /// 更多排序指标（同 `_SortKey`，列头不展示）；空表示该 tab 无更多排序。
  final List<_SortKey<T>> moreSortKeys;

  List<_SortKey<T>> get _allKeys => <_SortKey<T>>[
    ...leftKeys,
    ...rightKeys,
    ...moreSortKeys,
  ];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final String all = l10n.whaleProfileFilterAll;
    final WhaleProfileSortableTabState st = ref.watch(
      whaleProfileSortableTabControllerProvider(tabId),
    );
    final WhaleSortState sort = st.sort;
    // 只读回退：未选时用「全部」，不写回 provider。
    final String coin = st.coin ?? all;
    final List<({int idx, T item})> rows = _whaleProfileSortableRows<T>(
      items: items,
      allKeys: _allKeys,
      symOf: symOf,
      sort: sort,
      coin: coin,
      all: all,
    );
    final List<String> coinOptions = <String>[
      all,
      ...<String>{for (final T it in items) symOf(it)},
    ];
    final QzColorScheme c = context.qzScheme;
    return ColoredBox(
      color: c.bg,
      child: Column(
        children: <Widget>[
          ColoredBox(
            color: c.bgElev,
            child: _Toolbar(
              leftKeys: leftKeys,
              rightKeys: rightKeys,
              sort: sort,
              onSort: (String k) => ref
                  .read(
                    whaleProfileSortableTabControllerProvider(tabId).notifier,
                  )
                  .cycleSort(k),
              coin: coin,
              coinOptions: coinOptions,
              filterLabel: filterLabel,
              onCoin: (String picked) => ref
                  .read(
                    whaleProfileSortableTabControllerProvider(tabId).notifier,
                  )
                  .selectCoin(picked),
              moreSortKeys: moreSortKeys,
              onMoreSort: (WhaleSortState s) => ref
                  .read(
                    whaleProfileSortableTabControllerProvider(tabId).notifier,
                  )
                  .setSort(s),
            ),
          ),
          Expanded(
            child: ColoredBox(
              color: c.bgElev,
              child: rows.isEmpty
                  ? WhaleDetailEmpty(text: empty)
                  : ListView(
                      padding: EdgeInsets.zero,
                      children: <Widget>[
                        for (final ({int idx, T item}) e in rows)
                          rowBuilder(e.item),
                      ],
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

/// 工具条：左侧 sort label · spacer · 右侧 sort label + 币种筛选 [+ 更多排序]。
class _Toolbar<T> extends StatelessWidget {
  const _Toolbar({
    required this.leftKeys,
    required this.rightKeys,
    required this.sort,
    required this.onSort,
    required this.coin,
    required this.coinOptions,
    required this.onCoin,
    required this.moreSortKeys,
    required this.onMoreSort,
    this.filterLabel,
  });

  final List<_SortKey<T>> leftKeys;
  final List<_SortKey<T>> rightKeys;
  final WhaleSortState sort;
  final ValueChanged<String> onSort;
  final String coin;
  final List<String> coinOptions;
  final ValueChanged<String> onCoin;
  final List<_SortKey<T>> moreSortKeys;
  final ValueChanged<WhaleSortState> onMoreSort;
  final String? filterLabel;

  WhaleSortDir? _dirOf(String k) => sort.key == k ? sort.dir : null;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border(bottom: BorderSide(color: c.borderSoft)),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 12),
      child: Row(
        children: <Widget>[
          for (final _SortKey<T> sk in leftKeys) ...<Widget>[
            WhaleSortLabel(
              label: sk.label,
              dir: _dirOf(sk.key),
              onTap: () => onSort(sk.key),
            ),
            const SizedBox(width: 30),
          ],
          const Spacer(),
          for (final _SortKey<T> sk in rightKeys) ...<Widget>[
            WhaleSortLabel(
              label: sk.label,
              dir: _dirOf(sk.key),
              onTap: () => onSort(sk.key),
            ),
            const SizedBox(width: 30),
          ],
          WhaleCoinFilterTrigger(
            value: coin,
            options: coinOptions,
            onChanged: onCoin,
            label: filterLabel,
          ),
          if (moreSortKeys.isNotEmpty) ...<Widget>[
            const SizedBox(width: 16),
            WhaleMoreSortTrigger(
              sort: sort,
              metrics: <({String key, String label})>[
                for (final _SortKey<T> sk in moreSortKeys)
                  (key: sk.key, label: sk.label),
              ],
              onChanged: onMoreSort,
            ),
          ],
        ],
      ),
    );
  }
}
