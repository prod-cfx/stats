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
import '../../widgets/qz_top_bar.dart';
import 'widgets/whale_detail_rows.dart';
import 'widgets/whale_perp_summary_card.dart';
import 'widgets/whale_pnl_chart.dart';
import 'widgets/whale_stat_cards.dart';
import 'widgets/whale_trade_stats_sheet.dart';

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

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final AsyncValue<WhaleProfile> profile = ref.watch(
      whaleProfileProvider(address),
    );

    return Scaffold(
      backgroundColor: c.bg,
      body: profile.when(
        loading: () => _Frame(
          address: address,
          l10n: l10n,
          child: const Expanded(child: Center(child: QzSpinner())),
        ),
        error: (Object e, StackTrace _) => _Frame(
          address: address,
          l10n: l10n,
          child: Expanded(
            child: Center(
              child: Text(
                l10n.whaleProfileLoadError,
                style: TextStyle(color: c.statusDanger),
              ),
            ),
          ),
        ),
        data: (WhaleProfile p) => _Detail(
          profile: p,
          onCopy: () => _copyAddress(context, l10n),
        ),
      ),
    );
  }
}

/// loading/error 共用骨架（topbar + 占位）。
class _Frame extends StatelessWidget {
  const _Frame({
    required this.address,
    required this.l10n,
    required this.child,
  });
  final String address;
  final AppLocalizations l10n;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: <Widget>[
        QzTopBar(
          title: l10n.whaleProfileTitle,
          subtitle: address,
          onBack: () => context.pop(),
        ),
        child,
      ],
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
  const _Detail({required this.profile, required this.onCopy});
  final WhaleProfile profile;
  final VoidCallback onCopy;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return DefaultTabController(
      length: 6,
      child: Column(
        children: <Widget>[
          QzTopBar(
            title: l10n.whaleProfileTitle,
            subtitle: profile.address,
            onBack: () => context.pop(),
            actions: <Widget>[
              TextButton(
                onPressed: () => WhaleTradeStatsSheet.show(
                  context,
                  address: profile.address,
                  stats: profile.stats,
                ),
                child: Text(
                  l10n.whaleTradeStatsTitle,
                  style: TextStyle(
                    color: c.accent,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              IconButton(
                icon: const Icon(Icons.copy, size: 18),
                color: c.textMid,
                tooltip: l10n.whaleProfileCopyTooltip,
                onPressed: onCopy,
              ),
            ],
          ),
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
          Tab(text: l10n.whaleProfileTabBasic),
          Tab(text: _withCount(l10n.whaleProfileTabSpot, profile.spotHoldings.length)),
          Tab(text: _withCount(l10n.whaleProfileTabPerp, profile.perpHoldings.length)),
          Tab(text: _withCount(l10n.whaleProfileTabOrders, profile.openOrders.length)),
          Tab(text: _withCount(l10n.whaleProfileTabTrades, profile.recentTrades.length)),
          Tab(text: _withCount(l10n.whaleProfileTabHistory, profile.histOrders.length)),
        ],
      ),
    );
  }

  String _withCount(String label, int n) => n > 0 ? '$label $n' : label;
}

/// 基本信息 tab：P&L 图（含静态 pill 行）+ 4 stat 卡 + 永续总价值明细。
class _BasicTab extends StatelessWidget {
  const _BasicTab({required this.profile});
  final WhaleProfile profile;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
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
                l10n.whaleProfilePnlChartTitle(
                  l10n.whaleProfilePeriodWeek,
                  l10n.whaleProfileScopePerpOnly,
                ),
                style: TextStyle(fontSize: 12, color: c.textMid),
              ),
              const SizedBox(height: QzSpacing.sm),
              Wrap(
                spacing: QzSpacing.xs,
                runSpacing: QzSpacing.xs,
                children: <Widget>[
                  _StaticPill(text: l10n.whaleProfilePeriodWeek),
                  _StaticPill(text: l10n.whaleProfileScopePerpOnly),
                  _StaticPill(text: l10n.whaleProfileMetricTotalPnl, accent: true),
                ],
              ),
              const SizedBox(height: QzSpacing.md),
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

/// 静态 pill（图表参数当前值展示，不可交互——mock 阶段切换无意义）。
class _StaticPill extends StatelessWidget {
  const _StaticPill({required this.text, this.accent = false});
  final String text;
  final bool accent;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      height: 28,
      padding: const EdgeInsets.symmetric(horizontal: 10),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: accent ? c.accent : c.bgElev,
        border: Border.all(color: accent ? c.accent : c.border),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 11,
          fontWeight: accent ? FontWeight.w600 : FontWeight.w500,
          color: accent ? c.accentOn : c.text,
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
              Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  color: c.accentSoft,
                  borderRadius: BorderRadius.circular(10),
                ),
                alignment: Alignment.center,
                child: Icon(
                  Icons.account_balance_wallet,
                  size: 20,
                  color: c.accent,
                ),
              ),
              const SizedBox(width: QzSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Row(
                      children: <Widget>[
                        Flexible(
                          child: Text(
                            profile.address,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              color: c.text,
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ),
                        const SizedBox(width: QzSpacing.sm),
                        QzChip(
                          label: profile.tag,
                          tone: _chipTone(profile.tagTone),
                        ),
                      ],
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${l10n.whaleProfileAssetSummaryPrefix}${profile.assetSummary}',
                      style: TextStyle(color: c.textDim, fontSize: 11),
                    ),
                  ],
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
