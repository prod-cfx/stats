import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../data/models/whale_leader_models.dart';
import '../../../data/providers.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../widgets/whale_leader_card.dart';
import '../widgets/whale_sort_bar.dart';
import '../widgets/whale_top_slideshow.dart';

/// 巨鲸动向 — 发现 tab（issue #1789）。对齐设计稿 `WhaleDiscoverNew`：
/// top3 轮播 hero + 排序条（胜率/总值/盈亏）+ 巨鲸列表卡（AI 标签）。
/// mock 驱动（[whaleLeaderboardProvider]），排序在本地态完成。
class WhaleDiscoverTab extends ConsumerStatefulWidget {
  const WhaleDiscoverTab({super.key});

  @override
  ConsumerState<WhaleDiscoverTab> createState() => _WhaleDiscoverTabState();
}

class _WhaleDiscoverTabState extends ConsumerState<WhaleDiscoverTab> {
  WhaleLeaderSort? _sort = const WhaleLeaderSort(
    key: WhaleLeaderSortKey.winRate,
    dir: WhaleLeaderSortDir.desc,
  );

  void _openProfile(WhaleLeaderEntry entry) {
    context.push('/whale/profile/${Uri.encodeComponent(entry.id)}');
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final AsyncValue<List<WhaleLeaderEntry>> async =
        ref.watch(whaleLeaderboardProvider);
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
        final List<WhaleLeaderEntry> sorted = sortWhaleLeaders(entries, _sort);
        return ListView(
          padding: const EdgeInsets.only(bottom: QzSpacing.lg),
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
            WhaleTopSlideshow(top3: top3, onTap: _openProfile),
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
              sort: _sort,
              onChanged: (WhaleLeaderSort? s) => setState(() => _sort = s),
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
                  onTap: () => _openProfile(e),
                ),
              ),
          ],
        );
      },
    );
  }
}
