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
import '../../widgets/qz_chip.dart';
import '../../widgets/qz_spinner.dart';
import '../../widgets/qz_toast.dart';
import 'widgets/whale_chart_filter_sheet.dart';
import 'widgets/whale_detail_rows.dart';
import 'widgets/whale_detail_sort.dart';
import 'widgets/whale_perp_summary_card.dart';
import 'widgets/whale_pnl_chart.dart';
import 'widgets/whale_stat_cards.dart';
import 'widgets/whale_trade_stats_sheet.dart';
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
            height: 56,
            child: Row(
              children: <Widget>[
                IconButton(
                  icon: const Icon(Icons.arrow_back_ios_new, size: 20),
                  color: c.text,
                  onPressed: onBack,
                  tooltip: 'Back',
                ),
                _TierAvatar(seed: address, tagTone: tagTone),
                const SizedBox(width: QzSpacing.sm),
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
                IconButton(
                  icon: const Icon(Icons.copy, size: 18),
                  color: c.textMid,
                  tooltip: l10n.whaleProfileCopyTooltip,
                  onPressed: onCopy,
                ),
                _WatchButton(label: l10n.whaleProfileWatch, onTap: onWatch),
                const SizedBox(width: QzSpacing.xs),
                IconButton(
                  icon: const Icon(Icons.refresh, size: 18),
                  color: c.textMid,
                  tooltip: l10n.whaleProfileRefreshTooltip,
                  onPressed: onRefresh,
                ),
                const SizedBox(width: QzSpacing.sm),
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
    final String body = s.startsWith('0x') && s.length >= 4 ? s.substring(2) : s;
    final String picked = body.length >= 2 ? body.substring(0, 2) : body;
    return picked.toUpperCase();
  }
}

/// 绿底「一键监控」按钮（设计稿 violet 实底胶囊，jsx:659-665）。
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
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
        ),
      ),
      child: Text(
        label,
        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600),
      ),
    );
  }
}

QzChipTone _chipTone(String tone) {
  switch (tone) {
    case 'accent':
      return QzChipTone.accent;
    case 'info':
      return QzChipTone.info;
    case 'warn':
      return QzChipTone.warn;
    default:
      return QzChipTone.neutral;
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
          _Hero(profile: profile),
          _TabBar(profile: profile),
          Expanded(
            child: TabBarView(
              children: <Widget>[
                _BasicTab(profile: profile),
                _SpotTab(items: profile.spotHoldings, empty: l10n.whaleProfileEmptySpot),
                _PerpTab(items: profile.perpHoldings, empty: l10n.whaleProfileEmptyPerp),
                _OrderTab(items: profile.openOrders, empty: l10n.whaleProfileEmptyOrders),
                _TradeTab(items: profile.recentTrades, empty: l10n.whaleProfileEmptyTrades),
                _HistTab(items: profile.histOrders, empty: l10n.whaleProfileEmptyHistory),
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
        labelStyle: const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w700),
        unselectedLabelStyle:
            const TextStyle(fontSize: 12.5, fontWeight: FontWeight.w500),
        tabs: <Widget>[
          _CountTab(index: 0, label: l10n.whaleProfileTabBasic),
          _CountTab(index: 1, label: l10n.whaleProfileTabSpot, count: profile.spotHoldings.length),
          _CountTab(index: 2, label: l10n.whaleProfileTabPerp, count: profile.perpHoldings.length),
          _CountTab(index: 3, label: l10n.whaleProfileTabOrders, count: profile.openOrders.length),
          _CountTab(index: 4, label: l10n.whaleProfileTabTrades, count: profile.recentTrades.length),
          _CountTab(index: 5, label: l10n.whaleProfileTabHistory, count: profile.histOrders.length),
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
class _BasicTab extends StatefulWidget {
  const _BasicTab({required this.profile});
  final WhaleProfile profile;

  @override
  State<_BasicTab> createState() => _BasicTabState();
}

class _BasicTabState extends State<_BasicTab> {
  late String _period;
  late String _scope;
  late String _metric;
  bool _initialized = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    // 仅首次初始化，避免依赖变化（主题/locale 重建）重置用户已选的 pill。
    if (_initialized) return;
    _initialized = true;
    final AppLocalizations l10n = AppLocalizations.of(context);
    // 初值对齐设计稿默认（1周 / 仅永续合约 / 总盈亏）。
    _period = l10n.whaleProfilePeriodWeek;
    _scope = l10n.whaleProfileScopePerpOnly;
    _metric = l10n.whaleProfileMetricTotalPnl;
  }

  Future<void> _pickPeriod(AppLocalizations l10n) async {
    final String? next = await WhaleChartFilterSheet.show(
      context,
      title: l10n.whaleProfilePillPeriodTitle,
      options: <String>[
        l10n.whaleProfilePeriodDay,
        l10n.whaleProfilePeriodWeek,
        l10n.whaleProfilePeriodMonth,
        l10n.whaleProfilePeriodAll,
      ],
      value: _period,
    );
    if (next != null && mounted) setState(() => _period = next);
  }

  Future<void> _pickScope(AppLocalizations l10n) async {
    final String? next = await WhaleChartFilterSheet.show(
      context,
      title: l10n.whaleProfilePillScopeTitle,
      options: <String>[
        l10n.whaleProfileScopePerpOnly,
        l10n.whaleProfileScopePerpSpot,
      ],
      value: _scope,
    );
    if (next != null && mounted) setState(() => _scope = next);
  }

  Future<void> _pickMetric(AppLocalizations l10n) async {
    final String? next = await WhaleChartFilterSheet.show(
      context,
      title: l10n.whaleProfilePillMetricTitle,
      options: <String>[
        l10n.whaleProfileMetricTotalPnl,
        l10n.whaleProfileMetricAccountValue,
      ],
      value: _metric,
    );
    if (next != null && mounted) setState(() => _metric = next);
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final WhaleProfile profile = widget.profile;
    return ListView(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 40),
      children: <Widget>[
        Container(
          padding: const EdgeInsets.all(QzSpacing.lg),
          decoration: BoxDecoration(
            color: c.bgElev,
            border: Border.all(color: c.borderSoft),
            borderRadius: BorderRadius.circular(12),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                l10n.whaleProfilePnlChartTitle(_period, _scope),
                style: TextStyle(fontSize: 12, color: c.textMid),
              ),
              const SizedBox(height: QzSpacing.sm),
              Wrap(
                spacing: QzSpacing.xs,
                runSpacing: QzSpacing.xs,
                children: <Widget>[
                  _FilterPill(text: _period, onTap: () => _pickPeriod(l10n)),
                  _FilterPill(text: _scope, onTap: () => _pickScope(l10n)),
                  _FilterPill(
                    text: _metric,
                    accent: true,
                    onTap: () => _pickMetric(l10n),
                  ),
                ],
              ),
              const SizedBox(height: QzSpacing.md),
              WhalePnlChart(
                points: profile.pnlCurve,
                totalDisplay: profile.pnlTotalDisplay,
              ),
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
    this.accent = false,
  });
  final String text;
  final VoidCallback onTap;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(8),
      child: Container(
        height: 28,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: accent ? c.accent : c.bgElev,
          border: Border.all(color: accent ? c.accent : c.border),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(
              text,
              style: TextStyle(
                fontSize: 11,
                fontWeight: accent ? FontWeight.w600 : FontWeight.w500,
                color: accent ? c.accentOn : c.text,
              ),
            ),
            const SizedBox(width: 2),
            Icon(
              Icons.keyboard_arrow_down,
              size: 14,
              color: accent ? c.accentOn : c.textMid,
            ),
          ],
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

/// 通用排序/筛选明细 tab。左/右列头三态排序 + 币种筛选 +（可选）更多排序。
class _SortableTab<T> extends StatefulWidget {
  const _SortableTab({
    required this.items,
    required this.empty,
    required this.symOf,
    required this.leftKeys,
    required this.rightKeys,
    required this.rowBuilder,
    this.filterLabel,
    this.moreSortKeys = const <Never>[],
  });

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

  @override
  State<_SortableTab<T>> createState() => _SortableTabState<T>();
}

class _SortableTabState<T> extends State<_SortableTab<T>> {
  WhaleSortState _sort = const WhaleSortState();
  String _coin = '';
  bool _coinInit = false;

  List<_SortKey<T>> get _allKeys =>
      <_SortKey<T>>[...widget.leftKeys, ...widget.rightKeys, ...widget.moreSortKeys];

  _SortKey<T>? _keyOf(String? k) {
    if (k == null) return null;
    for (final _SortKey<T> sk in _allKeys) {
      if (sk.key == k) return sk;
    }
    return null;
  }

  List<({int idx, T item})> _process() {
    final String all = AppLocalizations.of(context).whaleProfileFilterAll;
    final List<({int idx, T item})> indexed = <({int idx, T item})>[
      for (int i = 0; i < widget.items.length; i++)
        (idx: i, item: widget.items[i]),
    ];
    final List<({int idx, T item})> filtered = _coin == all
        ? indexed
        : indexed.where((e) => widget.symOf(e.item) == _coin).toList();
    final _SortKey<T>? sk = _keyOf(_sort.key);
    if (sk == null || _sort.dir == null) return filtered;
    final List<({int idx, T item})> sorted = <({int idx, T item})>[...filtered];
    // time 列（numOf==null）用行原始索引；其余用数值取值。
    double v(({int idx, T item}) e) =>
        sk.numOf == null ? -e.idx.toDouble() : sk.numOf!(e.item);
    sorted.sort((a, b) => v(a).compareTo(v(b)));
    if (_sort.dir == WhaleSortDir.desc) {
      return sorted.reversed.toList();
    }
    return sorted;
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    if (!_coinInit) {
      _coin = l10n.whaleProfileFilterAll;
      _coinInit = true;
    }
    final List<({int idx, T item})> rows = _process();
    final List<String> coinOptions = <String>[
      l10n.whaleProfileFilterAll,
      ...<String>{for (final T it in widget.items) widget.symOf(it)},
    ];
    return Column(
      children: <Widget>[
        _Toolbar(
          leftKeys: widget.leftKeys,
          rightKeys: widget.rightKeys,
          sort: _sort,
          onSort: (String k) => setState(() => _sort = _sort.cycle(k)),
          coin: _coin,
          coinOptions: coinOptions,
          filterLabel: widget.filterLabel,
          onCoin: (String c) => setState(() => _coin = c),
          moreSortKeys: widget.moreSortKeys,
          onMoreSort: (WhaleSortState s) => setState(() => _sort = s),
        ),
        Expanded(
          child: rows.isEmpty
              ? WhaleDetailEmpty(text: widget.empty)
              : ListView(
                  padding: EdgeInsets.zero,
                  children: <Widget>[
                    for (final ({int idx, T item}) e in rows)
                      widget.rowBuilder(e.item),
                  ],
                ),
        ),
      ],
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
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 11),
      child: Row(
        children: <Widget>[
          for (final _SortKey<T> sk in leftKeys) ...<Widget>[
            WhaleSortLabel(
              label: sk.label,
              dir: _dirOf(sk.key),
              onTap: () => onSort(sk.key),
            ),
            const SizedBox(width: 16),
          ],
          const Spacer(),
          for (final _SortKey<T> sk in rightKeys) ...<Widget>[
            WhaleSortLabel(
              label: sk.label,
              dir: _dirOf(sk.key),
              onTap: () => onSort(sk.key),
            ),
            const SizedBox(width: 16),
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
      items: items,
      empty: empty,
      symOf: (WhaleSpotHolding h) => h.sym,
      filterLabel: l10n.whaleProfileFilterLabel,
      leftKeys: <_SortKey<WhaleSpotHolding>>[
        _SortKey<WhaleSpotHolding>('value', l10n.whaleProfileSortValue,
            numOf: (h) => h.valueN),
        _SortKey<WhaleSpotHolding>('amount', l10n.whaleProfileSortAmount,
            numOf: (h) => whaleSortNum(h.qtyDisplay)),
      ],
      rightKeys: <_SortKey<WhaleSpotHolding>>[
        _SortKey<WhaleSpotHolding>('price', l10n.whaleProfileColPrice,
            right: true, numOf: (h) => whaleSortNum(h.priceDisplay)),
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
      items: items,
      empty: empty,
      symOf: (WhalePerpHolding h) => h.sym,
      leftKeys: <_SortKey<WhalePerpHolding>>[
        _SortKey<WhalePerpHolding>('value', l10n.whaleProfileColPosValue,
            numOf: (h) => h.valueN),
        _SortKey<WhalePerpHolding>('pnl', l10n.whaleProfileColUnrealized,
            numOf: (h) => h.pnlN),
      ],
      rightKeys: const <_SortKey<WhalePerpHolding>>[],
      moreSortKeys: <_SortKey<WhalePerpHolding>>[
        _SortKey<WhalePerpHolding>('entry', l10n.whaleProfileColEntry,
            numOf: (h) => whaleSortNum(h.entryDisplay)),
        _SortKey<WhalePerpHolding>('mark', l10n.whaleProfileColMark,
            numOf: (h) => whaleSortNum(h.markDisplay)),
        _SortKey<WhalePerpHolding>('liq', l10n.whaleProfileColLiq,
            numOf: (h) => whaleSortNum(h.liqDisplay)),
        _SortKey<WhalePerpHolding>('margin', l10n.whaleProfileColMargin,
            numOf: (h) => whaleSortNum(h.marginDisplay)),
        _SortKey<WhalePerpHolding>('funding', l10n.whaleProfileColFunding,
            numOf: (h) => h.fundingN),
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
      items: items,
      empty: empty,
      symOf: (WhaleOpenOrder o) => o.sym,
      leftKeys: <_SortKey<WhaleOpenOrder>>[
        _SortKey<WhaleOpenOrder>('time', l10n.whaleProfileColTime),
        _SortKey<WhaleOpenOrder>('value', l10n.whaleProfileColValue,
            numOf: (o) => whaleSortNum(o.valueDisplay)),
      ],
      rightKeys: <_SortKey<WhaleOpenOrder>>[
        _SortKey<WhaleOpenOrder>('qty', l10n.whaleProfileColQty,
            right: true, numOf: (o) => whaleSortNum(o.qtyDisplay)),
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
      items: items,
      empty: empty,
      symOf: (WhaleRecentTrade t) => t.sym,
      leftKeys: <_SortKey<WhaleRecentTrade>>[
        _SortKey<WhaleRecentTrade>('time', l10n.whaleProfileColTime),
        _SortKey<WhaleRecentTrade>('qty', l10n.whaleProfileColQty,
            numOf: (t) => whaleSortNum(t.qtyDisplay)),
      ],
      rightKeys: const <_SortKey<WhaleRecentTrade>>[],
      moreSortKeys: <_SortKey<WhaleRecentTrade>>[
        _SortKey<WhaleRecentTrade>('price', l10n.whaleProfileColPrice,
            numOf: (t) => whaleSortNum(t.priceDisplay)),
        _SortKey<WhaleRecentTrade>('pnl', l10n.whaleProfileColClosedPnl,
            numOf: (t) => t.pnlN),
        _SortKey<WhaleRecentTrade>('fee', l10n.whaleProfileColFee,
            numOf: (t) => whaleSortNum(t.feeDisplay)),
        _SortKey<WhaleRecentTrade>('start', l10n.whaleProfileColStart,
            numOf: (t) => whaleSortNum(t.startDisplay)),
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
      items: items,
      empty: empty,
      symOf: (WhaleHistOrder o) => o.sym,
      leftKeys: <_SortKey<WhaleHistOrder>>[
        _SortKey<WhaleHistOrder>('time', l10n.whaleProfileColTime),
        _SortKey<WhaleHistOrder>('qty', l10n.whaleProfileColQty,
            numOf: (o) => whaleSortNum(o.qtyDisplay)),
      ],
      rightKeys: <_SortKey<WhaleHistOrder>>[
        _SortKey<WhaleHistOrder>('price', l10n.whaleProfileColPrice,
            right: true, numOf: (o) => whaleSortNum(o.priceDisplay)),
      ],
      rowBuilder: (WhaleHistOrder o) => WhaleHistRow(o: o),
    );
  }
}

class _Hero extends StatelessWidget {
  const _Hero({required this.profile});
  final WhaleProfile profile;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Container(
      margin: const EdgeInsets.fromLTRB(12, 12, 12, 0),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              QzChip(label: profile.tag, tone: _chipTone(profile.tagTone)),
              const SizedBox(width: QzSpacing.sm),
              Expanded(
                child: Text(
                  '${l10n.whaleProfileAssetSummaryPrefix}${profile.assetSummary}',
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: c.textDim, fontSize: 11),
                ),
              ),
              // 「交易统计」由卡片触发（设计稿不放 header），避免成为死代码。
              TextButton(
                onPressed: () => WhaleTradeStatsSheet.show(
                  context,
                  address: profile.address,
                  stats: profile.stats,
                ),
                style: TextButton.styleFrom(
                  foregroundColor: c.accent,
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  minimumSize: const Size(0, 28),
                ),
                child: Text(
                  l10n.whaleTradeStatsTitle,
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.md),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              Text(
                l10n.whaleProfileHoldingsValueLabel,
                style: TextStyle(color: c.textDim, fontSize: 12),
              ),
              Text(
                profile.holdingsValueDisplay,
                style: TextStyle(
                  color: c.text,
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.3,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
