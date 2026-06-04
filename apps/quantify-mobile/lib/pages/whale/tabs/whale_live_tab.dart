import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../data/models/whale_models.dart';
import '../../../data/providers.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_empty_state.dart';
import '../../../widgets/qz_spinner.dart';
import '../widgets/qz_whale_row.dart';
import '../widgets/whale_trade_stats_sheet.dart';
import 'whale_live_tab_controller.dart';
import 'whale_live_tab_state.dart';
part 'whale_live_tab.rows.part.dart';
part 'whale_live_tab.search.part.dart';

/// 巨鲸动向 — 实时 tab body（issue #1560 / 三件套迁移 #2183，原 [`WhaleFeedPage`]
/// 拆分而来）。
///
/// 与原 page 行为一致：history `listRecent(limit: 30)` + watchFeed 推流 +
/// 700ms 高亮 + symbol/amount filter；新增顶部 hero 卡 + 时间分组渲染。
/// 加载/推流/倒计时/筛选/排序态收敛进 [whaleLiveTabControllerProvider]，流订阅
/// 与倒计时由 controller `ref.onDispose` 取消；widget 退化为消费层（仅
/// `_CoinSearchOverlayState` 保留 setState）。
///
/// 时间分组规则：以可见条目 index 三等分到 now/15m/1h 三组，不依赖
/// fixture timestamp（mock 数据时间戳写死 2024-05，与真实墙钟差距过大会
/// 把所有条目都归到「更早」分组，从而让 feed 看上去为空）。详见 plan
/// `docs/superpowers/plans/2026-05-19-whale-4tabs-notif.md` Critic C2。
class WhaleLiveTab extends ConsumerWidget {
  const WhaleLiveTab({super.key});

  static const List<String> _symbolFilterKeys = <String>[
    '',
    'BTC',
    'ETH',
    'SOL',
    'HYPE',
    'XRP',
    'DOGE',
    'BNB',
    'PEPE',
    'WIF',
    'ARB',
    'OP',
  ];

  Future<void> _openCoinSearch(BuildContext context, WidgetRef ref) async {
    final String? picked = await showGeneralDialog<String>(
      context: context,
      useRootNavigator: true,
      barrierDismissible: true,
      barrierLabel: '搜索币种',
      barrierColor: Colors.transparent,
      transitionDuration: QzCurves.short,
      pageBuilder:
          (
            BuildContext context,
            Animation<double> animation,
            Animation<double> secondaryAnimation,
          ) => _CoinSearchOverlay(
            coins: _symbolFilterKeys.where((String s) => s.isNotEmpty).toList(),
          ),
      transitionBuilder:
          (
            BuildContext context,
            Animation<double> animation,
            Animation<double> secondaryAnimation,
            Widget child,
          ) => FadeTransition(opacity: animation, child: child),
    );
    if (picked == null) return;
    ref.read(whaleLiveTabControllerProvider.notifier).setSymbolFilter(picked);
  }

  String _eventAddress(WhaleEvent event) => event.address ?? event.fromLabel;

  void _openProfile(BuildContext context, WhaleEvent event) {
    final String address = _eventAddress(event);
    context.push('/whale/profile/${Uri.encodeComponent(address)}');
  }

  Future<void> _openStats(
    BuildContext context,
    WidgetRef ref,
    WhaleEvent event,
  ) async {
    final String address = _eventAddress(event);
    try {
      final profile = await ref
          .read(whaleProfileRepositoryProvider)
          .getProfile(address);
      if (!context.mounted) return;
      await WhaleTradeStatsSheet.show(
        context,
        address: address,
        stats: profile.stats,
      );
    } catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.maybeOf(context)?.showSnackBar(
        SnackBar(
          content: Text(error.toString()),
          duration: const Duration(seconds: 1),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final WhaleLiveTabState st = ref.watch(whaleLiveTabControllerProvider);
    final List<WhaleLiveFeedItem> visible = st.items
        .where((WhaleLiveFeedItem it) => _passesFilter(it.event, st.symbolFilter))
        .toList();

    if (st.loading) {
      return const Center(child: QzSpinner());
    }
    if (st.error != null) {
      return QzEmptyState(
        title: l10n.commonLoadError,
        subtitle: st.error!.message,
      );
    }

    return ColoredBox(
      color: c.bg,
      child: ListView(
        padding: const EdgeInsets.only(bottom: 100),
        children: <Widget>[
          _buildFilterBar(context, ref, c, l10n, st.symbolFilter),
          _buildActionRow(context, ref, c, l10n, st),
          const SizedBox(height: QzSpacing.sm),
          if (st.winSort == WhaleLiveWinSort.none)
            ..._buildGroupedFeed(context, ref, visible, l10n, c)
          else
            ..._buildSortedFeed(context, ref, visible, l10n, c, st.winSort),
          Padding(
            padding: const EdgeInsets.fromLTRB(
              QzSpacing.lg,
              QzSpacing.md,
              QzSpacing.lg,
              QzSpacing.lg,
            ),
            child: _AddWatchButton(label: l10n.whaleAddWatchAddress),
          ),
        ],
      ),
    );
  }

  static bool _passesFilter(WhaleEvent e, String filter) {
    if (filter.isEmpty) return true;
    return e.symbol.startsWith(filter);
  }

  /// issue #1983：胜率排序 toggle，循环 none → desc → asc → none，
  /// 对齐设计稿 `m-screens-4.jsx:595`。
  Widget _buildActionRow(
    BuildContext context,
    WidgetRef ref,
    QzColorScheme c,
    AppLocalizations l10n,
    WhaleLiveTabState st,
  ) {
    return Container(
      width: double.infinity,
      color: c.bgElev,
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 10),
      child: Row(
        children: <Widget>[
          _buildCoinPushButton(context, c, l10n),
          const SizedBox(width: 8),
          _buildWinSortButton(ref, c, l10n, st.winSort),
          const Spacer(),
          _CountdownBadge(tick: st.tick),
        ],
      ),
    );
  }

  Widget _buildCoinPushButton(
    BuildContext context,
    QzColorScheme c,
    AppLocalizations l10n,
  ) {
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () {
        ScaffoldMessenger.maybeOf(context)?.showSnackBar(
          SnackBar(
            content: Text(l10n.whaleLiveCoinPushDone),
            duration: const Duration(seconds: 1),
          ),
        );
      },
      child: Container(
        height: 30,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: BoxDecoration(
          color: c.accent,
          borderRadius: BorderRadius.circular(15),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(Icons.notifications_none, size: 13, color: c.accentOn),
            const SizedBox(width: 6),
            Text(
              l10n.whaleLiveCoinPush,
              style: TextStyle(
                color: c.accentOn,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }

  /// issue #1983：胜率排序按钮，激活态高亮 + 方向图标，aria/tooltip 反映当前状态。
  Widget _buildWinSortButton(
    WidgetRef ref,
    QzColorScheme c,
    AppLocalizations l10n,
    WhaleLiveWinSort winSort,
  ) {
    final bool active = winSort != WhaleLiveWinSort.none;
    final String hint = switch (winSort) {
      WhaleLiveWinSort.none => l10n.whaleLiveWinSortNone,
      WhaleLiveWinSort.desc => l10n.whaleLiveWinSortDesc,
      WhaleLiveWinSort.asc => l10n.whaleLiveWinSortAsc,
    };
    final IconData icon = switch (winSort) {
      WhaleLiveWinSort.none => Icons.swap_vert,
      WhaleLiveWinSort.desc => Icons.arrow_downward,
      WhaleLiveWinSort.asc => Icons.arrow_upward,
    };
    return Tooltip(
      message: hint,
      child: OutlinedButton.icon(
        onPressed: () =>
            ref.read(whaleLiveTabControllerProvider.notifier).cycleWinSort(),
        icon: Icon(icon, size: 14, semanticLabel: hint),
        label: Text(
          l10n.whaleLiveWinSort,
          style: const TextStyle(fontSize: 12),
        ),
        style: OutlinedButton.styleFrom(
          foregroundColor: active ? c.accent : c.textMid,
          backgroundColor: active ? c.accentSoft : null,
          side: BorderSide(color: active ? c.accent : c.borderSoft),
          padding: const EdgeInsets.symmetric(horizontal: 12),
          minimumSize: const Size(0, 30),
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(15),
          ),
        ),
      ),
    );
  }

  /// issue #1983：胜率排序激活时按 winRate 扁平展示（不再按时间分组），
  /// 对齐设计稿 `m-screens-4.jsx:705` 的排序模式。
  List<Widget> _buildSortedFeed(
    BuildContext context,
    WidgetRef ref,
    List<WhaleLiveFeedItem> visible,
    AppLocalizations l10n,
    QzColorScheme c,
    WhaleLiveWinSort winSort,
  ) {
    if (visible.isEmpty) {
      return <Widget>[
        Padding(
          padding: const EdgeInsets.symmetric(vertical: QzSpacing.xl),
          child: QzEmptyState(title: l10n.whaleLiveFeedEmpty),
        ),
      ];
    }
    final List<WhaleLiveFeedItem> sorted = <WhaleLiveFeedItem>[...visible]
      ..sort(
        (WhaleLiveFeedItem a, WhaleLiveFeedItem b) =>
            winSort == WhaleLiveWinSort.desc
            ? b.event.winRate.compareTo(a.event.winRate)
            : a.event.winRate.compareTo(b.event.winRate),
      );
    final String label = winSort == WhaleLiveWinSort.desc
        ? l10n.whaleLiveWinSortDesc
        : l10n.whaleLiveWinSortAsc;
    final DateTime now = DateTime.now();
    return <Widget>[
      _GroupHeader(label: label, count: sorted.length),
      for (final WhaleLiveFeedItem item in sorted)
        QzWhaleRow(
          key: ValueKey<String>(item.event.id),
          event: item.event,
          highlight: item.highlight,
          now: now,
          displayTimestamp: now,
          onOpen: () => _openProfile(context, item.event),
          onStats: () => _openStats(context, ref, item.event),
        ),
    ];
  }

  /// 单行 filter strip = 资产 chips · LIVE。阈值已迁出为独立输入行（issue #1986），
  /// 故此处仅保留币种 chips + LIVE pulse；资产 chips 横向滚动避免窄屏溢出。
  Widget _buildFilterBar(
    BuildContext context,
    WidgetRef ref,
    QzColorScheme c,
    AppLocalizations l10n,
    String symbolFilter,
  ) {
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(color: c.bgElev),
      child: Stack(
        children: <Widget>[
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.fromLTRB(12, 10, 44, 10),
            child: Row(
              children: <Widget>[
                for (final String s in _symbolFilterKeys) ...<Widget>[
                  _CoinChip(
                    label: s.isEmpty ? l10n.commonAll : s,
                    selected: symbolFilter == s,
                    onTap: () => ref
                        .read(whaleLiveTabControllerProvider.notifier)
                        .setSymbolFilter(s),
                  ),
                  const SizedBox(width: QzSpacing.xxs),
                ],
              ],
            ),
          ),
          Positioned(
            top: 0,
            right: 0,
            bottom: 0,
            child: DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.centerLeft,
                  end: Alignment.centerRight,
                  colors: <Color>[
                    c.bgElev.withValues(alpha: 0),
                    c.bgElev,
                    c.bgElev,
                  ],
                  stops: const <double>[0, 0.4, 1],
                ),
              ),
              child: Padding(
                padding: const EdgeInsets.only(left: 18, right: 8),
                child: Center(
                  child: IconButton(
                    tooltip: '搜索币种',
                    onPressed: () => _openCoinSearch(context, ref),
                    icon: const Icon(Icons.search, size: 17),
                    color: c.textMid,
                    style: IconButton.styleFrom(
                      backgroundColor: c.bgElev,
                      fixedSize: const Size(32, 32),
                      minimumSize: const Size(32, 32),
                      padding: EdgeInsets.zero,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildGroupedFeed(
    BuildContext context,
    WidgetRef ref,
    List<WhaleLiveFeedItem> visible,
    AppLocalizations l10n,
    QzColorScheme c,
  ) {
    if (visible.isEmpty) {
      return <Widget>[
        Padding(
          padding: const EdgeInsets.symmetric(vertical: QzSpacing.xl),
          child: QzEmptyState(title: l10n.whaleLiveFeedEmpty),
        ),
      ];
    }
    // 把可见条目按 index 三等分到 now / 15m / 1h 三组。
    final int n = visible.length;
    final int thirdA = (n / 3).ceil();
    final int thirdB = (2 * n / 3).ceil();
    final List<WhaleLiveFeedItem> groupNow = visible.sublist(0, thirdA);
    final List<WhaleLiveFeedItem> group15 = visible.sublist(thirdA, thirdB);
    final List<WhaleLiveFeedItem> group1h = visible.sublist(thirdB);

    final DateTime now = DateTime.now();
    final List<Widget> result = <Widget>[];

    // 派生 displayTimestamp：与分组语义对齐，解决 issue #1602
    // mock fixture timestamp 写死 2024-05 导致行内显示 `731 天前` 的穿帮。
    // - groupNow （最近 5 分钟）：now - i*30s （0~5min）
    // - group15  （15 分钟内）：  now - (5min + i*60s) （5~15min）
    // - group1h  （过去 1 小时）：now - (15min + i*5min) （15~60min）
    DateTime displayFor(String groupKey, int index) {
      switch (groupKey) {
        case 'now':
          return now.subtract(Duration(seconds: 30 * index));
        case '15m':
          return now.subtract(
            Duration(minutes: 5) + Duration(seconds: 60 * index),
          );
        case '1h':
        default:
          return now.subtract(
            Duration(minutes: 15) + Duration(minutes: 5 * index),
          );
      }
    }

    void appendGroup(
      String label,
      String groupKey,
      List<WhaleLiveFeedItem> rows,
    ) {
      if (rows.isEmpty) return;
      result.add(_GroupHeader(label: label, count: rows.length));
      for (int i = 0; i < rows.length; i++) {
        final WhaleLiveFeedItem item = rows[i];
        result.add(
          QzWhaleRow(
            key: ValueKey<String>(item.event.id),
            event: item.event,
            highlight: item.highlight,
            now: now,
            displayTimestamp: displayFor(groupKey, i),
            onOpen: () => _openProfile(context, item.event),
            onStats: () => _openStats(context, ref, item.event),
          ),
        );
      }
    }

    appendGroup(l10n.whaleGroupNow, 'now', groupNow);
    appendGroup(l10n.whaleGroup15m, '15m', group15);
    appendGroup(l10n.whaleGroup1h, '1h', group1h);
    return result;
  }
}

