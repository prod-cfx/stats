import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../data/models/whale_holding_models.dart';
import '../../../data/providers.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../widgets/whale_holding_card.dart';
import '../widgets/whale_trade_stats_sheet.dart';

/// 巨鲸动向 — 持仓 tab（issue #1790）。对齐设计稿 `WhaleHoldings`：
/// 币种 chip + 方向/盈亏筛选 + 更多排序 + 持仓明细卡列表。
/// mock 驱动（[whaleHoldingsProvider]），筛选与排序在本地态即时完成。
class WhaleHoldingsTab extends ConsumerStatefulWidget {
  const WhaleHoldingsTab({super.key});

  @override
  ConsumerState<WhaleHoldingsTab> createState() => _WhaleHoldingsTabState();
}

class _WhaleHoldingsTabState extends ConsumerState<WhaleHoldingsTab> {
  WhaleHoldingFilter _filter = const WhaleHoldingFilter();
  WhaleHoldingSort? _sort;

  void _cycleDir() {
    const List<WhaleHoldingDirFilter> order = <WhaleHoldingDirFilter>[
      WhaleHoldingDirFilter.all,
      WhaleHoldingDirFilter.long,
      WhaleHoldingDirFilter.short,
    ];
    final int next = (order.indexOf(_filter.dir) + 1) % order.length;
    setState(() => _filter = _filter.copyWith(dir: order[next]));
  }

  void _cyclePnl() {
    const List<WhaleHoldingPnlFilter> order = <WhaleHoldingPnlFilter>[
      WhaleHoldingPnlFilter.all,
      WhaleHoldingPnlFilter.profit,
      WhaleHoldingPnlFilter.loss,
    ];
    final int next = (order.indexOf(_filter.pnl) + 1) % order.length;
    setState(() => _filter = _filter.copyWith(pnl: order[next]));
  }

  void _selectCoin(String? coin) {
    setState(() => _filter = _filter.copyWith(coin: coin));
  }

  /// 点地址 → 详情页（按缩写地址路由，对齐设计稿 holdings → profile）。
  void _openProfile(WhaleHoldingPosition entry) {
    context.push('/whale/profile/${Uri.encodeComponent(entry.address)}');
  }

  /// 点趋势按钮 / 卡片 → 交易统计弹窗（复用 #1859 的 [WhaleTradeStatsSheet]）。
  void _openStats(WhaleHoldingPosition entry) {
    WhaleTradeStatsSheet.show(
      context,
      address: entry.address,
      stats: whaleHoldingTradeStats(entry),
    );
  }

  Future<void> _copyAddress(WhaleHoldingPosition entry) async {
    final AppLocalizations l10n = AppLocalizations.of(context);
    await Clipboard.setData(ClipboardData(text: entry.address));
    if (!mounted) return;
    ScaffoldMessenger.maybeOf(context)?.showSnackBar(
      SnackBar(
        content: Text(l10n.whaleLeaderCopied),
        duration: const Duration(seconds: 1),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final AsyncValue<List<WhaleHoldingPosition>> async =
        ref.watch(whaleHoldingsProvider);
    return async.when(
      loading: () => const Center(child: CircularProgressIndicator()),
      error: (Object e, StackTrace st) => Center(
        child: Text(
          l10n.whaleLoadError,
          style: TextStyle(color: c.textMid, fontSize: 13),
        ),
      ),
      data: (List<WhaleHoldingPosition> all) {
        final List<String> coins = whaleHoldingCoins(all);
        final List<WhaleHoldingPosition> rows =
            sortWhaleHoldings(filterWhaleHoldings(all, _filter), _sort);
        return ListView(
          padding: const EdgeInsets.only(bottom: QzSpacing.lg),
          children: <Widget>[
            _CoinChips(
              coins: coins,
              selected: _filter.coin,
              onSelect: _selectCoin,
            ),
            _FilterSortBar(
              filter: _filter,
              sort: _sort,
              onDir: _cycleDir,
              onPnl: _cyclePnl,
              onSort: (WhaleHoldingSort? s) => setState(() => _sort = s),
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
                    onOpen: () => _openProfile(e),
                    onCopy: () => _copyAddress(e),
                    onStats: () => _openStats(e),
                  ),
                ),
          ],
        );
      },
    );
  }
}

/// 币种筛选 chip 条（全部 + 各币种）。
class _CoinChips extends StatelessWidget {
  const _CoinChips({
    required this.coins,
    required this.selected,
    required this.onSelect,
  });

  final List<String> coins;
  final String? selected;
  final void Function(String?) onSelect;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.lg,
        vertical: QzSpacing.md,
      ),
      child: Row(
        children: <Widget>[
          _Chip(
            label: l10n.whaleHoldingsCoinAll,
            active: selected == null,
            onTap: () => onSelect(null),
          ),
          for (final String coin in coins)
            Padding(
              padding: const EdgeInsets.only(left: QzSpacing.sm),
              child: _Chip(
                label: coin,
                active: selected == coin,
                onTap: () => onSelect(coin),
              ),
            ),
        ],
      ),
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({
    required this.label,
    required this.active,
    required this.onTap,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        height: 28,
        padding: const EdgeInsets.symmetric(horizontal: QzSpacing.md),
        decoration: BoxDecoration(
          color: active ? c.accent : c.bgSoft,
          borderRadius: BorderRadius.circular(QzRadii.pill),
        ),
        alignment: Alignment.center,
        child: Text(
          label,
          style: TextStyle(
            color: active ? c.accentOn : c.textMid,
            fontSize: 12,
            fontWeight: active ? FontWeight.w600 : FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

/// 方向/盈亏 筛选（左）+ 更多排序（右）工具条。
class _FilterSortBar extends StatelessWidget {
  const _FilterSortBar({
    required this.filter,
    required this.sort,
    required this.onDir,
    required this.onPnl,
    required this.onSort,
  });

  final WhaleHoldingFilter filter;
  final WhaleHoldingSort? sort;
  final VoidCallback onDir;
  final VoidCallback onPnl;
  final void Function(WhaleHoldingSort?) onSort;

  String _dirLabel(AppLocalizations l10n) {
    switch (filter.dir) {
      case WhaleHoldingDirFilter.long:
        return l10n.whaleHoldingsDirLong;
      case WhaleHoldingDirFilter.short:
        return l10n.whaleHoldingsDirShort;
      case WhaleHoldingDirFilter.all:
        return l10n.whaleHoldingsFilterDir;
    }
  }

  String _pnlLabel(AppLocalizations l10n) {
    switch (filter.pnl) {
      case WhaleHoldingPnlFilter.profit:
        return l10n.whaleHoldingsPnlProfit;
      case WhaleHoldingPnlFilter.loss:
        return l10n.whaleHoldingsPnlLoss;
      case WhaleHoldingPnlFilter.all:
        return l10n.whaleHoldingsFilterPnl;
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        0,
        QzSpacing.lg,
        QzSpacing.md,
      ),
      child: Row(
        children: <Widget>[
          _FilterPill(
            key: const Key('whaleHoldingsDirFilter'),
            label: _dirLabel(l10n),
            active: filter.dir != WhaleHoldingDirFilter.all,
            onTap: onDir,
          ),
          const SizedBox(width: QzSpacing.sm),
          _FilterPill(
            key: const Key('whaleHoldingsPnlFilter'),
            label: _pnlLabel(l10n),
            active: filter.pnl != WhaleHoldingPnlFilter.all,
            onTap: onPnl,
          ),
          const Spacer(),
          _SortMenu(sort: sort, onSort: onSort),
        ],
      ),
    );
  }
}

class _FilterPill extends StatelessWidget {
  const _FilterPill({
    required this.label,
    required this.active,
    required this.onTap,
    super.key,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        height: 28,
        padding: const EdgeInsets.symmetric(horizontal: QzSpacing.md),
        decoration: BoxDecoration(
          color: active ? c.accentSoft : c.bgSoft,
          borderRadius: BorderRadius.circular(QzRadii.pill),
          border: Border.all(color: active ? c.accent : c.borderSoft),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(
              label,
              style: TextStyle(
                color: active ? c.accent : c.textMid,
                fontSize: 12,
                fontWeight: active ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
            const SizedBox(width: 2),
            Icon(
              Icons.arrow_drop_down,
              size: 16,
              color: active ? c.accent : c.textDim,
            ),
          ],
        ),
      ),
    );
  }
}

/// 更多排序入口：弹出菜单选择持仓价值 / 保证金 / 创建时间（降序，再点取消）。
class _SortMenu extends StatelessWidget {
  const _SortMenu({required this.sort, required this.onSort});

  final WhaleHoldingSort? sort;
  final void Function(WhaleHoldingSort?) onSort;

  String _label(AppLocalizations l10n, WhaleHoldingSortKey key) {
    switch (key) {
      case WhaleHoldingSortKey.value:
        return l10n.whaleHoldingsSortValue;
      case WhaleHoldingSortKey.margin:
        return l10n.whaleHoldingsSortMargin;
      case WhaleHoldingSortKey.time:
        return l10n.whaleHoldingsSortTime;
    }
  }

  void _onTap(WhaleHoldingSortKey key) {
    // 点击同字段在 降序→升序→取消 间循环；切换字段从降序开始。
    if (sort == null || sort!.key != key) {
      onSort(WhaleHoldingSort(key: key, dir: WhaleHoldingSortDir.desc));
    } else if (sort!.dir == WhaleHoldingSortDir.desc) {
      onSort(WhaleHoldingSort(key: key, dir: WhaleHoldingSortDir.asc));
    } else {
      onSort(null);
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final bool active = sort != null;
    return PopupMenuButton<WhaleHoldingSortKey>(
      tooltip: l10n.whaleSortLabel,
      onSelected: _onTap,
      itemBuilder: (BuildContext context) =>
          <PopupMenuEntry<WhaleHoldingSortKey>>[
        for (final WhaleHoldingSortKey key in WhaleHoldingSortKey.values)
          PopupMenuItem<WhaleHoldingSortKey>(
            value: key,
            child: Row(
              children: <Widget>[
                Expanded(child: Text(_label(l10n, key))),
                if (sort?.key == key)
                  Icon(
                    sort!.dir == WhaleHoldingSortDir.desc
                        ? Icons.arrow_downward
                        : Icons.arrow_upward,
                    size: 16,
                    color: c.accent,
                  ),
              ],
            ),
          ),
      ],
      child: Container(
        height: 28,
        padding: const EdgeInsets.symmetric(horizontal: QzSpacing.md),
        decoration: BoxDecoration(
          color: active ? c.accentSoft : c.bgSoft,
          borderRadius: BorderRadius.circular(QzRadii.pill),
          border: Border.all(color: active ? c.accent : c.borderSoft),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(
              Icons.swap_vert,
              size: 15,
              color: active ? c.accent : c.textMid,
            ),
            const SizedBox(width: 4),
            Text(
              l10n.whaleSortLabel,
              style: TextStyle(
                color: active ? c.accent : c.textMid,
                fontSize: 12,
                fontWeight: active ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        QzSpacing.xs,
        QzSpacing.lg,
        QzSpacing.sm,
      ),
      child: Row(
        children: <Widget>[
          Text(
            l10n.whaleHoldingsSectionTitle,
            style: TextStyle(
              color: c.textDim,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.4,
            ),
          ),
          const SizedBox(width: QzSpacing.sm),
          Expanded(child: Container(height: 1, color: c.borderSoft)),
          const SizedBox(width: QzSpacing.sm),
          Text(
            '$count',
            style: TextStyle(
              color: c.textMid,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}
