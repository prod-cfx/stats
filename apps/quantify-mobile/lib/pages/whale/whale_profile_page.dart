import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../data/models/whale_profile_models.dart';
import '../../data/providers.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_spinner.dart';
import '../../widgets/qz_toast.dart';
import 'whale_profile_basic_tab_controller.dart';
import 'whale_profile_basic_tab_state.dart';
import 'whale_profile_sortable_tab_controller.dart';
import 'whale_profile_sortable_tab_state.dart';
import 'widgets/whale_chart_filter_sheet.dart';
import 'widgets/whale_detail_rows.dart';
import 'widgets/whale_detail_sort.dart';
import 'widgets/whale_perp_summary_card.dart';
import 'widgets/whale_pnl_chart.dart';
import 'widgets/whale_stat_cards.dart';
import 'widgets/whale_watch_rule_sheet.dart';

/// 巨鲸地址详情页（#1791，`/whale/profile/:address`）。
///
/// 对齐设计稿 `WhaleProfileDetail`（`m-screens-whale-discover.jsx:617`）的
/// 6 tab 重型详情：基本信息（P&L 图 + 4 stat 卡 + 永续总价值明细）/ 现货 /
/// 永续 / 挂单 / 成交 / 历史。消费 #1858 落地的明细数据模型 + fixtures。
/// 交易统计弹窗（#1859/#1866）入口保留为 topbar 按钮，避免成为死代码。
/// 数据由 mock 驱动，真实读路径依赖 #1682。
class WhaleProfilePage extends ConsumerWidget {
  const WhaleProfilePage({super.key, required this.address});

  final String address;

  Future<void> _copyAddress(BuildContext context, AppLocalizations l10n) async {
    await Clipboard.setData(ClipboardData(text: address));
    if (!context.mounted) return;
    QzToast.show(context, l10n.whaleProfileCopied);
  }

  // 「一键监控」入口：复用现有 watch 规则流程（#1791 watch tab 同款 sheet）。
  Future<void> _openWatch(BuildContext context) async {
    await WhaleWatchRuleSheet.show(context);
  }

  // 「刷新」入口：失效 profile provider 触发详情数据重载。
  void _refresh(WidgetRef ref) {
    ref.invalidate(whaleProfileProvider(address));
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final AsyncValue<WhaleProfile> profile = ref.watch(
      whaleProfileProvider(address),
    );

    Widget header({String? tagTone}) => _ProfileHeader(
      address: address,
      tagTone: tagTone,
      onBack: () => context.pop(),
      onCopy: () => _copyAddress(context, l10n),
      onWatch: () => _openWatch(context),
      onRefresh: () => _refresh(ref),
    );

    return Scaffold(
      backgroundColor: c.bg,
      body: profile.when(
        loading: () => Column(
          children: <Widget>[
            header(),
            const Expanded(child: Center(child: QzSpinner())),
          ],
        ),
        error: (Object e, StackTrace _) => Column(
          children: <Widget>[
            header(),
            Expanded(
              child: Center(
                child: Text(
                  l10n.whaleProfileLoadError,
                  style: TextStyle(color: c.statusDanger),
                ),
              ),
            ),
          ],
        ),
        data: (WhaleProfile p) => _Detail(
          profile: p,
          header: header(tagTone: p.tagTone),
        ),
      ),
    );
  }
}

/// 详情页单条 header bar（设计稿 `WhaleProfileDetail` header，jsx:639-676）：
/// 返回 + tier 配色圆形 avatar + 地址(mono) + 复制 + 一键监控 + 刷新。
class _ProfileHeader extends StatelessWidget implements PreferredSizeWidget {
  const _ProfileHeader({
    required this.address,
    required this.onBack,
    required this.onCopy,
    required this.onWatch,
    required this.onRefresh,
    this.tagTone,
  });

  final String address;
  final String? tagTone;
  final VoidCallback onBack;
  final VoidCallback onCopy;
  final VoidCallback onWatch;
  final VoidCallback onRefresh;

  @override
  Size get preferredSize => const Size.fromHeight(56);

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Material(
      color: c.bgElev,
      child: Container(
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: c.borderSoft)),
        ),
        child: SafeArea(
          top: true,
          bottom: false,
          child: SizedBox(
            height: 44,
            child: Row(
              children: <Widget>[
                const SizedBox(width: 14),
                SizedBox(
                  width: 32,
                  height: 32,
                  child: IconButton(
                    padding: EdgeInsets.zero,
                    icon: const Icon(Icons.arrow_back_ios_new, size: 18),
                    color: c.text,
                    onPressed: onBack,
                    tooltip: 'Back',
                  ),
                ),
                const SizedBox(width: 10),
                _TierAvatar(seed: address, tagTone: tagTone),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    address,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: c.text,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      fontFeatures: const <FontFeature>[
                        FontFeature.tabularFigures(),
                      ],
                    ),
                  ),
                ),
                SizedBox(
                  width: 30,
                  height: 30,
                  child: IconButton(
                    padding: EdgeInsets.zero,
                    icon: const Icon(Icons.copy, size: 15),
                    color: c.textMid,
                    tooltip: l10n.whaleProfileCopyTooltip,
                    onPressed: onCopy,
                  ),
                ),
                const SizedBox(width: 8),
                _WatchButton(label: l10n.whaleProfileWatch, onTap: onWatch),
                const SizedBox(width: 8),
                SizedBox(
                  width: 30,
                  height: 30,
                  child: IconButton(
                    padding: EdgeInsets.zero,
                    icon: const Icon(Icons.refresh, size: 14),
                    color: c.textMid,
                    tooltip: l10n.whaleProfileRefreshTooltip,
                    onPressed: onRefresh,
                    style: IconButton.styleFrom(
                      backgroundColor: c.bgElev,
                      shape: RoundedRectangleBorder(
                        side: BorderSide(color: c.border),
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 14),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// tier 配色圆形 avatar：色相取自地址 hash，glyph 取地址首段字符。
/// tagTone 命中语义色时优先使用语义色（accent/info/warn）。
class _TierAvatar extends StatelessWidget {
  const _TierAvatar({required this.seed, this.tagTone});
  final String seed;
  final String? tagTone;

  static const double _size = 32;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color bg = switch (tagTone) {
      'accent' => c.accent,
      'info' => c.statusInfo,
      'warn' => c.statusWarn,
      _ => HSLColor.fromAHSL(
        1,
        (seed.codeUnits.fold<int>(0, (int a, int b) => a + b) * 17) % 360,
        0.55,
        0.62,
      ).toColor(),
    };
    final String glyph = _glyph(seed);
    return Container(
      width: _size,
      height: _size,
      decoration: BoxDecoration(color: bg, shape: BoxShape.circle),
      alignment: Alignment.center,
      child: Text(
        glyph,
        style: const TextStyle(
          color: Color(0xFFFFFFFF),
          fontSize: 12,
          fontWeight: FontWeight.w700,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  // 取地址 '0x' 之后的两位字符（无则回退首两位），与设计稿 av 短标一致。
  String _glyph(String s) {
    final String body = s.startsWith('0x') && s.length >= 4
        ? s.substring(2)
        : s;
    final String picked = body.length >= 2 ? body.substring(0, 2) : body;
    return picked.toUpperCase();
  }
}

/// 「一键监控」按钮（设计稿 violet soft 背景，jsx:659-665）。
class _WatchButton extends StatelessWidget {
  const _WatchButton({required this.label, required this.onTap});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return TextButton(
      onPressed: onTap,
      style: TextButton.styleFrom(
        backgroundColor: c.accentSoft,
        foregroundColor: c.accent,
        minimumSize: const Size(0, 30),
        padding: const EdgeInsets.symmetric(horizontal: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
      child: Text(
        label,
        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
      ),
    );
  }
}

class _Detail extends StatelessWidget {
  const _Detail({required this.profile, required this.header});
  final WhaleProfile profile;
  final Widget header;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return DefaultTabController(
      length: 6,
      child: Column(
        children: <Widget>[
          header,
          _TabBar(profile: profile),
          Expanded(
            child: TabBarView(
              children: <Widget>[
                _BasicTab(profile: profile),
                _SpotTab(
                  items: profile.spotHoldings,
                  empty: l10n.whaleProfileEmptySpot,
                ),
                _PerpTab(
                  items: profile.perpHoldings,
                  empty: l10n.whaleProfileEmptyPerp,
                ),
                _OrderTab(
                  items: profile.openOrders,
                  empty: l10n.whaleProfileEmptyOrders,
                ),
                _TradeTab(
                  items: profile.recentTrades,
                  empty: l10n.whaleProfileEmptyTrades,
                ),
                _HistTab(
                  items: profile.histOrders,
                  empty: l10n.whaleProfileEmptyHistory,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TabBar extends StatelessWidget {
  const _TabBar({required this.profile});
  final WhaleProfile profile;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Container(
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border(bottom: BorderSide(color: c.borderSoft)),
      ),
      child: TabBar(
        isScrollable: true,
        tabAlignment: TabAlignment.start,
        labelColor: c.accent,
        unselectedLabelColor: c.textMid,
        indicatorColor: c.accent,
        indicatorSize: TabBarIndicatorSize.label,
        dividerColor: Colors.transparent,
        labelStyle: const TextStyle(
          fontSize: 12.5,
          fontWeight: FontWeight.w700,
        ),
        unselectedLabelStyle: const TextStyle(
          fontSize: 12.5,
          fontWeight: FontWeight.w500,
        ),
        tabs: <Widget>[
          _CountTab(index: 0, label: l10n.whaleProfileTabBasic),
          _CountTab(
            index: 1,
            label: l10n.whaleProfileTabSpot,
            count: profile.spotHoldings.length,
          ),
          _CountTab(
            index: 2,
            label: l10n.whaleProfileTabPerp,
            count: profile.perpHoldings.length,
          ),
          _CountTab(
            index: 3,
            label: l10n.whaleProfileTabOrders,
            count: profile.openOrders.length,
          ),
          _CountTab(
            index: 4,
            label: l10n.whaleProfileTabTrades,
            count: profile.recentTrades.length,
          ),
          _CountTab(
            index: 5,
            label: l10n.whaleProfileTabHistory,
            count: profile.histOrders.length,
          ),
        ],
      ),
    );
  }
}

/// Tab label + 独立计数 chip（设计稿 jsx:745-750）：计数为单独 mono 小字，
/// inactive 灰、active 紫；count 为 0 时不渲染。
class _CountTab extends StatelessWidget {
  const _CountTab({required this.index, required this.label, this.count = 0});
  final int index;
  final String label;
  final int count;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final TabController controller = DefaultTabController.of(context);
    return Tab(
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Text(label),
          if (count > 0) ...<Widget>[
            const SizedBox(width: 4),
            AnimatedBuilder(
              animation: controller.animation!,
              builder: (BuildContext context, Widget? _) {
                final bool active = controller.index == index;
                return Text(
                  '$count',
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.w600,
                    color: active ? c.accent : c.textFaint,
                    fontFamily: QzFont.mono,
                    fontFamilyFallback: QzFont.monoFallback,
                  ),
                );
              },
            ),
          ],
        ],
      ),
    );
  }
}

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

/// 现货持仓：价值/金额 排序 + 价格 排序 + 筛选。
class _SpotTab extends StatelessWidget {
  const _SpotTab({required this.items, required this.empty});
  final List<WhaleSpotHolding> items;
  final String empty;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return _SortableTab<WhaleSpotHolding>(
      tabId: 'spot',
      items: items,
      empty: empty,
      symOf: (WhaleSpotHolding h) => h.sym,
      filterLabel: l10n.whaleProfileFilterLabel,
      leftKeys: <_SortKey<WhaleSpotHolding>>[
        _SortKey<WhaleSpotHolding>(
          'value',
          l10n.whaleProfileSortValue,
          numOf: (h) => h.valueN,
        ),
        _SortKey<WhaleSpotHolding>(
          'amount',
          l10n.whaleProfileSortAmount,
          numOf: (h) => whaleSortNum(h.qtyDisplay),
        ),
      ],
      rightKeys: <_SortKey<WhaleSpotHolding>>[
        _SortKey<WhaleSpotHolding>(
          'price',
          l10n.whaleProfileColPrice,
          right: true,
          numOf: (h) => whaleSortNum(h.priceDisplay),
        ),
      ],
      rowBuilder: (WhaleSpotHolding h) => WhaleSpotRow(h: h),
    );
  }
}

/// 永续合约持仓：持仓价值/未实现盈亏 排序 + 筛选 + 更多排序。
class _PerpTab extends StatelessWidget {
  const _PerpTab({required this.items, required this.empty});
  final List<WhalePerpHolding> items;
  final String empty;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return _SortableTab<WhalePerpHolding>(
      tabId: 'perp',
      items: items,
      empty: empty,
      symOf: (WhalePerpHolding h) => h.sym,
      leftKeys: <_SortKey<WhalePerpHolding>>[
        _SortKey<WhalePerpHolding>(
          'value',
          l10n.whaleProfileColPosValue,
          numOf: (h) => h.valueN,
        ),
        _SortKey<WhalePerpHolding>(
          'pnl',
          l10n.whaleProfileColUnrealized,
          numOf: (h) => h.pnlN,
        ),
      ],
      rightKeys: const <_SortKey<WhalePerpHolding>>[],
      moreSortKeys: <_SortKey<WhalePerpHolding>>[
        _SortKey<WhalePerpHolding>(
          'entry',
          l10n.whaleProfileColEntry,
          numOf: (h) => whaleSortNum(h.entryDisplay),
        ),
        _SortKey<WhalePerpHolding>(
          'mark',
          l10n.whaleProfileColMark,
          numOf: (h) => whaleSortNum(h.markDisplay),
        ),
        _SortKey<WhalePerpHolding>(
          'liq',
          l10n.whaleProfileColLiq,
          numOf: (h) => whaleSortNum(h.liqDisplay),
        ),
        _SortKey<WhalePerpHolding>(
          'margin',
          l10n.whaleProfileColMargin,
          numOf: (h) => whaleSortNum(h.marginDisplay),
        ),
        _SortKey<WhalePerpHolding>(
          'funding',
          l10n.whaleProfileColFunding,
          numOf: (h) => h.fundingN,
        ),
      ],
      rowBuilder: (WhalePerpHolding h) => WhalePerpRow(h: h),
    );
  }
}

/// 挂单：时间/价值 排序 + 数量 排序 + 筛选。
class _OrderTab extends StatelessWidget {
  const _OrderTab({required this.items, required this.empty});
  final List<WhaleOpenOrder> items;
  final String empty;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return _SortableTab<WhaleOpenOrder>(
      tabId: 'order',
      items: items,
      empty: empty,
      symOf: (WhaleOpenOrder o) => o.sym,
      leftKeys: <_SortKey<WhaleOpenOrder>>[
        _SortKey<WhaleOpenOrder>('time', l10n.whaleProfileColTime),
        _SortKey<WhaleOpenOrder>(
          'value',
          l10n.whaleProfileColValue,
          numOf: (o) => whaleSortNum(o.valueDisplay),
        ),
      ],
      rightKeys: <_SortKey<WhaleOpenOrder>>[
        _SortKey<WhaleOpenOrder>(
          'qty',
          l10n.whaleProfileColQty,
          right: true,
          numOf: (o) => whaleSortNum(o.qtyDisplay),
        ),
      ],
      rowBuilder: (WhaleOpenOrder o) => WhaleOrderRow(o: o),
    );
  }
}

/// 最近成交：时间/数量 排序 + 筛选 + 更多排序。
class _TradeTab extends StatelessWidget {
  const _TradeTab({required this.items, required this.empty});
  final List<WhaleRecentTrade> items;
  final String empty;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return _SortableTab<WhaleRecentTrade>(
      tabId: 'trade',
      items: items,
      empty: empty,
      symOf: (WhaleRecentTrade t) => t.sym,
      leftKeys: <_SortKey<WhaleRecentTrade>>[
        _SortKey<WhaleRecentTrade>('time', l10n.whaleProfileColTime),
        _SortKey<WhaleRecentTrade>(
          'qty',
          l10n.whaleProfileColQty,
          numOf: (t) => whaleSortNum(t.qtyDisplay),
        ),
      ],
      rightKeys: const <_SortKey<WhaleRecentTrade>>[],
      moreSortKeys: <_SortKey<WhaleRecentTrade>>[
        _SortKey<WhaleRecentTrade>(
          'price',
          l10n.whaleProfileColPrice,
          numOf: (t) => whaleSortNum(t.priceDisplay),
        ),
        _SortKey<WhaleRecentTrade>(
          'pnl',
          l10n.whaleProfileColClosedPnl,
          numOf: (t) => t.pnlN,
        ),
        _SortKey<WhaleRecentTrade>(
          'fee',
          l10n.whaleProfileColFee,
          numOf: (t) => whaleSortNum(t.feeDisplay),
        ),
        _SortKey<WhaleRecentTrade>(
          'start',
          l10n.whaleProfileColStart,
          numOf: (t) => whaleSortNum(t.startDisplay),
        ),
      ],
      rowBuilder: (WhaleRecentTrade t) => WhaleTradeRow(t: t),
    );
  }
}

/// 历史委托：时间/数量 排序 + 价格 排序 + 筛选。
class _HistTab extends StatelessWidget {
  const _HistTab({required this.items, required this.empty});
  final List<WhaleHistOrder> items;
  final String empty;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return _SortableTab<WhaleHistOrder>(
      tabId: 'hist',
      items: items,
      empty: empty,
      symOf: (WhaleHistOrder o) => o.sym,
      leftKeys: <_SortKey<WhaleHistOrder>>[
        _SortKey<WhaleHistOrder>('time', l10n.whaleProfileColTime),
        _SortKey<WhaleHistOrder>(
          'qty',
          l10n.whaleProfileColQty,
          numOf: (o) => whaleSortNum(o.qtyDisplay),
        ),
      ],
      rightKeys: <_SortKey<WhaleHistOrder>>[
        _SortKey<WhaleHistOrder>(
          'price',
          l10n.whaleProfileColPrice,
          right: true,
          numOf: (o) => whaleSortNum(o.priceDisplay),
        ),
      ],
      rowBuilder: (WhaleHistOrder o) => WhaleHistRow(o: o),
    );
  }
}
