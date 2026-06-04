import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../data/providers.dart';
import '../../../domain/models/whale_leader_models.dart';
import '../../../domain/use_cases/whale_leader_use_cases.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_toast.dart';
import '../widgets/whale_leader_card.dart';
import '../widgets/whale_sort_bar.dart';
import '../widgets/whale_top_slideshow.dart';
import '../widgets/whale_trade_stats_sheet.dart';
import 'whale_discover_tab_controller.dart';

/// 巨鲸动向 — 发现 tab（issue #1789 / 三件套迁移 #2183）。对齐设计稿
/// `WhaleDiscoverNew`：top3 轮播 hero + 排序条（胜率/总值/盈亏）+ 巨鲸列表卡
/// （AI 标签）。mock 驱动（[whaleLeaderboardProvider]），排序态收敛进
/// [whaleDiscoverTabControllerProvider]，widget 退化为纯消费层。
class WhaleDiscoverTab extends ConsumerWidget {
  const WhaleDiscoverTab({super.key});

  void _openProfile(BuildContext context, WhaleLeaderEntry entry) {
    context.push('/whale/profile/${Uri.encodeComponent(entry.id)}');
  }

  /// 点卡片 / 趋势按钮 → 交易统计弹窗（复用 #1859 的 [WhaleTradeStatsSheet]）。
  void _openStats(BuildContext context, WhaleLeaderEntry entry) {
    WhaleTradeStatsSheet.show(
      context,
      address: entry.id,
      stats: whaleLeaderTradeStats(entry),
      avatarGlyph: entry.avatarText,
      avatarColorHex: entry.avatarBgHex,
    );
  }

  Future<void> _copyAddress(BuildContext context, WhaleLeaderEntry entry) async {
    final AppLocalizations l10n = AppLocalizations.of(context);
    await Clipboard.setData(ClipboardData(text: entry.id));
    if (!context.mounted) return;
    QzToast.show(context, l10n.whaleLeaderCopied);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final WhaleLeaderSort? sort = ref
        .watch(whaleDiscoverTabControllerProvider)
        .sort;
    final AsyncValue<List<WhaleLeaderEntry>> async = ref.watch(
      whaleLeaderboardProvider,
    );
    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (Object e, StackTrace st) => Center(
        child: Text(
          l10n.whaleLoadError,
          style: TextStyle(color: c.textMid, fontSize: 13),
        ),
      ),
      data: (List<WhaleLeaderEntry> entries) {
        final List<WhaleLeaderEntry> top3 = topWhaleLeaders(entries);
        final List<WhaleLeaderEntry> sorted = sortWhaleLeaders(entries, sort);
        return ListView(
          padding: const EdgeInsets.only(bottom: 100),
          children: <Widget>[
            Padding(
              padding: const EdgeInsets.fromLTRB(
                QzSpacing.lg,
                QzSpacing.md,
                QzSpacing.lg,
                QzSpacing.sm,
              ),
              child: Text(
                l10n.whaleDiscoverSubtitle,
                style: TextStyle(color: c.textMid, fontSize: 12.5),
              ),
            ),
            WhaleTopSlideshow(
              top3: top3,
              onOpen: (WhaleLeaderEntry e) => _openProfile(context, e),
              onStats: (WhaleLeaderEntry e) => _openStats(context, e),
              onCopy: (WhaleLeaderEntry e) => _copyAddress(context, e),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(
                QzSpacing.lg,
                QzSpacing.md,
                QzSpacing.lg,
                0,
              ),
              child: Divider(height: 1, color: c.borderSoft),
            ),
            WhaleSortBar(
              sort: sort,
              onChanged: (WhaleLeaderSort? s) => ref
                  .read(whaleDiscoverTabControllerProvider.notifier)
                  .setSort(s),
            ),
            for (final WhaleLeaderEntry e in sorted)
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  QzSpacing.lg,
                  0,
                  QzSpacing.lg,
                  QzSpacing.sm,
                ),
                child: WhaleLeaderCard(
                  entry: e,
                  onOpen: () => _openProfile(context, e),
                  onStats: () => _openStats(context, e),
                  onCopy: () => _copyAddress(context, e),
                ),
              ),
          ],
        );
      },
    );
  }
}
