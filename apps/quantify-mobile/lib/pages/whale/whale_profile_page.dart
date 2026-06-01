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
import 'widgets/whale_chart_filter_sheet.dart';
import 'widgets/whale_detail_rows.dart';
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
    ScaffoldMessenger.maybeOf(context)?.showSnackBar(
      SnackBar(
        content: Text(l10n.whaleProfileCopied),
        duration: const Duration(seconds: 1),
      ),
    );
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
                _ListTab(
                  count: profile.spotHoldings.length,
                  empty: l10n.whaleProfileEmptySpot,
                  rows: <Widget>[
                    for (final WhaleSpotHolding h in profile.spotHoldings)
                      WhaleSpotRow(h: h),
                  ],
                ),
                _ListTab(
                  count: profile.perpHoldings.length,
                  empty: l10n.whaleProfileEmptyPerp,
                  rows: <Widget>[
                    for (final WhalePerpHolding h in profile.perpHoldings)
                      WhalePerpRow(h: h),
                  ],
                ),
                _ListTab(
                  count: profile.openOrders.length,
                  empty: l10n.whaleProfileEmptyOrders,
                  rows: <Widget>[
                    for (final WhaleOpenOrder o in profile.openOrders)
                      WhaleOrderRow(o: o),
                  ],
                ),
                _ListTab(
                  count: profile.recentTrades.length,
                  empty: l10n.whaleProfileEmptyTrades,
                  rows: <Widget>[
                    for (final WhaleRecentTrade t in profile.recentTrades)
                      WhaleTradeRow(t: t),
                  ],
                ),
                _ListTab(
                  count: profile.histOrders.length,
                  empty: l10n.whaleProfileEmptyHistory,
                  rows: <Widget>[
                    for (final WhaleHistOrder o in profile.histOrders)
                      WhaleHistRow(o: o),
                  ],
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

/// 明细列表 tab（空 list 显示空态）。
class _ListTab extends StatelessWidget {
  const _ListTab({
    required this.count,
    required this.empty,
    required this.rows,
  });
  final int count;
  final String empty;
  final List<Widget> rows;

  @override
  Widget build(BuildContext context) {
    if (count == 0) return WhaleDetailEmpty(text: empty);
    return ListView(padding: EdgeInsets.zero, children: rows);
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
