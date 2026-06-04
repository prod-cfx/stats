import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../data/providers.dart';
import '../../../domain/models/whale_holding_models.dart';
import '../../../domain/use_cases/whale_holding_use_cases.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_sheet.dart';
import '../widgets/whale_holding_card.dart';
import '../widgets/whale_trade_stats_sheet.dart';
import 'whale_holdings_tab_controller.dart';
import 'whale_holdings_tab_state.dart';
part 'whale_holdings_tab.filter.part.dart';
part 'whale_holdings_tab.sort.part.dart';
part 'whale_holdings_tab.search.part.dart';

/// 巨鲸动向 — 持仓 tab（issue #1790 / 工具条对齐 #1981 / 三件套迁移 #2182）。
/// 对齐设计稿 `WhaleHoldings`：币种 chip（含搜索） + 方向/盈亏下拉筛选 + 更多
/// 排序抽屉 + 持仓明细卡列表。mock 驱动（[whaleHoldingsProvider]）；筛选/排序态
/// 收敛进 [whaleHoldingsTabControllerProvider]，widget 退化为纯消费层。
class WhaleHoldingsTab extends ConsumerWidget {
  const WhaleHoldingsTab({super.key});

  Future<void> _openDirFilter(
    BuildContext context,
    WidgetRef ref,
    WhaleHoldingFilter filter,
  ) async {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final WhaleHoldingDirFilter? picked =
        await _FilterSheet.show<WhaleHoldingDirFilter>(
          context: context,
          title: l10n.whaleHoldingsFilterDirTitle,
          current: filter.dir,
          options: <_FilterOption<WhaleHoldingDirFilter>>[
            _FilterOption<WhaleHoldingDirFilter>(
              WhaleHoldingDirFilter.all,
              l10n.whaleHoldingsDirAll,
            ),
            _FilterOption<WhaleHoldingDirFilter>(
              WhaleHoldingDirFilter.long,
              l10n.whaleHoldingsDirLong,
            ),
            _FilterOption<WhaleHoldingDirFilter>(
              WhaleHoldingDirFilter.short,
              l10n.whaleHoldingsDirShort,
            ),
          ],
        );
    if (picked == null) return;
    ref.read(whaleHoldingsTabControllerProvider.notifier).setDir(picked);
  }

  Future<void> _openPnlFilter(
    BuildContext context,
    WidgetRef ref,
    WhaleHoldingFilter filter,
  ) async {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final WhaleHoldingPnlFilter? picked =
        await _FilterSheet.show<WhaleHoldingPnlFilter>(
          context: context,
          title: l10n.whaleHoldingsFilterPnlTitle,
          current: filter.pnl,
          options: <_FilterOption<WhaleHoldingPnlFilter>>[
            _FilterOption<WhaleHoldingPnlFilter>(
              WhaleHoldingPnlFilter.all,
              l10n.whaleHoldingsPnlAll,
            ),
            _FilterOption<WhaleHoldingPnlFilter>(
              WhaleHoldingPnlFilter.profit,
              l10n.whaleHoldingsPnlProfit,
            ),
            _FilterOption<WhaleHoldingPnlFilter>(
              WhaleHoldingPnlFilter.loss,
              l10n.whaleHoldingsPnlLoss,
            ),
          ],
        );
    if (picked == null) return;
    ref.read(whaleHoldingsTabControllerProvider.notifier).setPnl(picked);
  }

  Future<void> _openSort(
    BuildContext context,
    WidgetRef ref,
    WhaleHoldingSort? current,
  ) async {
    final _SortResult? result = await _SortSheet.show(
      context: context,
      current: current,
    );
    // 「完成」回传 _SortResult（其 sort 可能为 null 表示不排序）；点遮罩取消
    // 返回 null，保持原排序态。
    if (result == null) return;
    ref.read(whaleHoldingsTabControllerProvider.notifier).setSort(result.sort);
  }

  /// 点地址 → 详情页（按缩写地址路由，对齐设计稿 holdings → profile）。
  void _openProfile(BuildContext context, WhaleHoldingPosition entry) {
    context.push('/whale/profile/${Uri.encodeComponent(entry.address)}');
  }

  /// 点趋势按钮 / 卡片 → 交易统计弹窗（复用 #1859 的 [WhaleTradeStatsSheet]）。
  void _openStats(BuildContext context, WhaleHoldingPosition entry) {
    WhaleTradeStatsSheet.show(
      context,
      address: entry.address,
      stats: whaleHoldingTradeStats(entry),
    );
  }

  Future<void> _copyAddress(
    BuildContext context,
    WhaleHoldingPosition entry,
  ) async {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final ScaffoldMessengerState? messenger = ScaffoldMessenger.maybeOf(
      context,
    );
    await Clipboard.setData(ClipboardData(text: entry.address));
    messenger?.showSnackBar(
      SnackBar(
        content: Text(l10n.whaleLeaderCopied),
        duration: const Duration(seconds: 1),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final WhaleHoldingsTabState s = ref.watch(
      whaleHoldingsTabControllerProvider,
    );
    final AsyncValue<List<WhaleHoldingPosition>> async = ref.watch(
      whaleHoldingsProvider,
    );
    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (Object e, StackTrace st) => Center(
        child: Text(
          l10n.whaleLoadError,
          style: TextStyle(color: c.textMid, fontSize: 13),
        ),
      ),
      data: (List<WhaleHoldingPosition> all) {
        final WhaleHoldingsView view = deriveWhaleHoldingsView(
          all,
          s.filter,
          s.sort,
        );
        final List<String> coins = view.coins;
        final List<WhaleHoldingPosition> rows = view.rows;
        return ListView(
          padding: const EdgeInsets.only(bottom: 100),
          children: <Widget>[
            _CoinChips(
              coins: coins,
              selected: s.filter.coin,
              onSelect: (String? coin) => ref
                  .read(whaleHoldingsTabControllerProvider.notifier)
                  .selectCoin(coin),
            ),
            _FilterSortBar(
              filter: s.filter,
              sort: s.sort,
              onDir: () => _openDirFilter(context, ref, s.filter),
              onPnl: () => _openPnlFilter(context, ref, s.filter),
              onSort: () => _openSort(context, ref, s.sort),
            ),
            _SectionHeader(count: rows.length),
            if (rows.isEmpty)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 40),
                child: Center(
                  child: Text(
                    l10n.whaleHoldingsEmpty,
                    style: TextStyle(color: c.textDim, fontSize: 12),
                  ),
                ),
              )
            else
              for (final WhaleHoldingPosition e in rows)
                Padding(
                  padding: const EdgeInsets.fromLTRB(
                    QzSpacing.lg,
                    0,
                    QzSpacing.lg,
                    QzSpacing.sm,
                  ),
                  child: WhaleHoldingCard(
                    entry: e,
                    onOpen: () => _openProfile(context, e),
                    onCopy: () => _copyAddress(context, e),
                    onStats: () => _openStats(context, e),
                  ),
                ),
          ],
        );
      },
    );
  }
}

