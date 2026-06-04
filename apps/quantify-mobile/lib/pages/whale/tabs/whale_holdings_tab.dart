import 'dart:math' as math;

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
import '../../../widgets/qz_sheet.dart';
import '../widgets/whale_holding_card.dart';
import '../widgets/whale_trade_stats_sheet.dart';

/// 巨鲸动向 — 持仓 tab（issue #1790 / 工具条对齐 #1981）。对齐设计稿
/// `WhaleHoldings`：币种 chip（含搜索） + 方向/盈亏下拉筛选 + 更多排序抽屉 +
/// 持仓明细卡列表。mock 驱动（[whaleHoldingsProvider]），筛选与排序在本地态
/// 即时完成。
class WhaleHoldingsTab extends ConsumerStatefulWidget {
  const WhaleHoldingsTab({super.key});

  @override
  ConsumerState<WhaleHoldingsTab> createState() => _WhaleHoldingsTabState();
}

class _WhaleHoldingsTabState extends ConsumerState<WhaleHoldingsTab> {
  WhaleHoldingFilter _filter = const WhaleHoldingFilter();
  WhaleHoldingSort? _sort;

  void _selectCoin(String? coin) {
    setState(() => _filter = _filter.copyWith(coin: coin));
  }

  Future<void> _openDirFilter() async {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final WhaleHoldingDirFilter? picked =
        await _FilterSheet.show<WhaleHoldingDirFilter>(
          context: context,
          title: l10n.whaleHoldingsFilterDirTitle,
          current: _filter.dir,
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
    setState(() => _filter = _filter.copyWith(dir: picked));
  }

  Future<void> _openPnlFilter() async {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final WhaleHoldingPnlFilter? picked =
        await _FilterSheet.show<WhaleHoldingPnlFilter>(
          context: context,
          title: l10n.whaleHoldingsFilterPnlTitle,
          current: _filter.pnl,
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
    setState(() => _filter = _filter.copyWith(pnl: picked));
  }

  Future<void> _openSort() async {
    final _SortResult? result = await _SortSheet.show(
      context: context,
      current: _sort,
    );
    // 「完成」回传 _SortResult（其 sort 可能为 null 表示不排序）；点遮罩取消
    // 返回 null，保持原排序态。
    if (result == null) return;
    setState(() => _sort = result.sort);
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
        final List<String> coins = whaleHoldingCoins(all);
        final List<WhaleHoldingPosition> rows = sortWhaleHoldings(
          filterWhaleHoldings(all, _filter),
          _sort,
        );
        return ListView(
          padding: const EdgeInsets.only(bottom: 100),
          children: <Widget>[
            _CoinChips(
              coins: coins,
              selected: _filter.coin,
              onSelect: _selectCoin,
            ),
            _FilterSortBar(
              filter: _filter,
              sort: _sort,
              onDir: _openDirFilter,
              onPnl: _openPnlFilter,
              onSort: _openSort,
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

/// 币种筛选 chip 条（全部 + 各币种），右侧渐隐叠加搜索按钮。
class _CoinChips extends StatelessWidget {
  const _CoinChips({
    required this.coins,
    required this.selected,
    required this.onSelect,
  });

  final List<String> coins;
  final String? selected;
  final void Function(String?) onSelect;

  Future<void> _openSearch(BuildContext context) async {
    final String? picked = await _CoinSearchSheet.show(
      context: context,
      coins: coins,
    );
    if (picked != null) onSelect(picked);
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Stack(
      children: <Widget>[
        SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          padding: const EdgeInsets.fromLTRB(
            QzSpacing.lg,
            QzSpacing.md,
            // 右侧留出搜索按钮 + 渐隐区域的空间，避免末尾 chip 被遮挡。
            44,
            QzSpacing.md,
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
        ),
        Positioned(
          top: 0,
          right: 0,
          bottom: 0,
          child: Row(
            children: <Widget>[
              // 渐隐：让滚动内容在搜索按钮左侧自然淡出。
              IgnorePointer(
                child: Container(
                  width: 24,
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      begin: Alignment.centerLeft,
                      end: Alignment.centerRight,
                      colors: <Color>[c.bg.withValues(alpha: 0), c.bg],
                    ),
                  ),
                ),
              ),
              Container(
                color: c.bg,
                padding: const EdgeInsets.only(right: QzSpacing.sm),
                alignment: Alignment.center,
                child: IconButton(
                  key: const Key('whaleHoldingsCoinSearch'),
                  tooltip: l10n.whaleHoldingsCoinSearchTooltip,
                  visualDensity: VisualDensity.compact,
                  iconSize: 18,
                  constraints: const BoxConstraints(
                    minWidth: 32,
                    minHeight: 32,
                  ),
                  padding: EdgeInsets.zero,
                  icon: Icon(Icons.search, color: c.textMid),
                  onPressed: () => _openSearch(context),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _Chip extends StatelessWidget {
  const _Chip({required this.label, required this.active, required this.onTap});

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
        child: Align(
          widthFactor: 1,
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
      ),
    );
  }
}

/// 方向/盈亏 下拉筛选（左）+ 更多排序（右）工具条。
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
  final VoidCallback onSort;

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
          _FilterLabel(
            key: const Key('whaleHoldingsDirFilter'),
            label: _dirLabel(l10n),
            active: filter.dir != WhaleHoldingDirFilter.all,
            onTap: onDir,
          ),
          const SizedBox(width: QzSpacing.lg),
          _FilterLabel(
            key: const Key('whaleHoldingsPnlFilter'),
            label: _pnlLabel(l10n),
            active: filter.pnl != WhaleHoldingPnlFilter.all,
            onTap: onPnl,
          ),
          const Spacer(),
          _FilterLabel(
            key: const Key('whaleHoldingsMoreSort'),
            label: l10n.whaleHoldingsMoreSort,
            active: sort != null,
            onTap: onSort,
          ),
        ],
      ),
    );
  }
}

/// 内联下拉筛选标签：点击打开底部抽屉；选中非默认值时高亮。
class _FilterLabel extends StatelessWidget {
  const _FilterLabel({
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
            Icons.keyboard_arrow_down,
            size: 16,
            color: active ? c.accent : c.textDim,
          ),
        ],
      ),
    );
  }
}

/// 单选筛选项：值 + 展示文案。
class _FilterOption<T> {
  const _FilterOption(this.value, this.label);

  final T value;
  final String label;
}

/// 方向/盈亏 单选底部抽屉。返回所选值；取消（点遮罩）返回 null。
class _FilterSheet {
  const _FilterSheet._();

  static Future<T?> show<T>({
    required BuildContext context,
    required String title,
    required T current,
    required List<_FilterOption<T>> options,
  }) {
    return QzSheet.show<T>(
      context: context,
      useRootNavigator: true,
      builder: (BuildContext ctx) {
        final QzColorScheme c = ctx.qzScheme;
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Padding(
              padding: const EdgeInsets.fromLTRB(
                QzSpacing.lg,
                0,
                QzSpacing.lg,
                QzSpacing.sm,
              ),
              child: Text(
                title,
                style: TextStyle(
                  color: c.text,
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            for (final _FilterOption<T> o in options)
              _FilterOptionRow<T>(
                option: o,
                selected: o.value == current,
                onTap: () => Navigator.of(ctx).pop(o.value),
              ),
          ],
        );
      },
    );
  }
}

class _FilterOptionRow<T> extends StatelessWidget {
  const _FilterOptionRow({
    required this.option,
    required this.selected,
    required this.onTap,
  });

  final _FilterOption<T> option;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: QzSpacing.lg,
          vertical: QzSpacing.md,
        ),
        child: Row(
          children: <Widget>[
            Expanded(
              child: Text(
                option.label,
                style: TextStyle(
                  color: selected ? c.accent : c.text,
                  fontSize: 14,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                ),
              ),
            ),
            if (selected) Icon(Icons.check, size: 18, color: c.accent),
          ],
        ),
      ),
    );
  }
}

/// 排序抽屉「完成」回传值。[sort] 为 null 表示选择了「不排序」；点遮罩取消
/// 时 sheet 返回 null（而非 [_SortResult]），调用方据此区分取消与不排序。
class _SortResult {
  const _SortResult(this.sort);

  final WhaleHoldingSort? sort;
}

/// 更多排序底部抽屉：指标三选一 + 排序方式三选一（升序/降序/不排序）。
class _SortSheet {
  const _SortSheet._();

  static Future<_SortResult?> show({
    required BuildContext context,
    required WhaleHoldingSort? current,
  }) {
    final QzColorScheme c = context.qzScheme;
    return showModalBottomSheet<_SortResult>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: c.bgElev,
      barrierColor: c.scrim,
      sheetAnimationStyle: const AnimationStyle(
        curve: QzCurves.sheetPanel,
        duration: QzCurves.sheetPanelDuration,
        reverseCurve: QzCurves.sheetPanel,
        reverseDuration: QzCurves.sheetPanelDuration,
      ),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (BuildContext ctx) {
        final QzColorScheme sheetColors = ctx.qzScheme;
        final double keyboardInset = MediaQuery.viewInsetsOf(ctx).bottom;
        return SafeArea(
          top: false,
          child: Padding(
            padding: EdgeInsets.only(bottom: math.max(28, keyboardInset)),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                const SizedBox(height: 10),
                Container(
                  width: 42,
                  height: 4,
                  decoration: BoxDecoration(
                    color: sheetColors.borderStrong,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
                const SizedBox(height: 14),
                _SortSheetBody(current: current),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _SortSheetBody extends StatefulWidget {
  const _SortSheetBody({required this.current});

  final WhaleHoldingSort? current;

  @override
  State<_SortSheetBody> createState() => _SortSheetBodyState();
}

class _SortSheetBodyState extends State<_SortSheetBody> {
  late WhaleHoldingSortKey _key;
  // null 表示「不排序」。
  late WhaleHoldingSortDir? _dir;

  @override
  void initState() {
    super.initState();
    _key = widget.current?.key ?? WhaleHoldingSortKey.value;
    _dir = widget.current?.dir;
  }

  String _keyLabel(AppLocalizations l10n, WhaleHoldingSortKey key) {
    switch (key) {
      case WhaleHoldingSortKey.value:
        return l10n.whaleHoldingsSortValue;
      case WhaleHoldingSortKey.margin:
        return l10n.whaleHoldingsSortMargin;
      case WhaleHoldingSortKey.time:
        return l10n.whaleHoldingsSortTime;
    }
  }

  void _done() {
    final WhaleHoldingSort? sort = _dir == null
        ? null
        : WhaleHoldingSort(key: _key, dir: _dir!);
    Navigator.of(context).pop(_SortResult(sort));
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            l10n.whaleHoldingsMoreSort,
            style: TextStyle(
              color: c.text,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            l10n.whaleHoldingsSortSectionMetric,
            style: TextStyle(color: c.textMid, fontSize: 11),
          ),
          const SizedBox(height: 6),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: <Widget>[
              for (final WhaleHoldingSortKey key in WhaleHoldingSortKey.values)
                _SortPill(
                  key: Key('whaleHoldingsSortKey_${key.name}'),
                  label: _keyLabel(l10n, key),
                  active: _key == key,
                  onTap: () => setState(() => _key = key),
                ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            l10n.whaleHoldingsSortSectionDir,
            style: TextStyle(color: c.textMid, fontSize: 11),
          ),
          const SizedBox(height: 6),
          Row(
            children: <Widget>[
              Expanded(
                child: _SortDirCell(
                  key: const Key('whaleHoldingsSortDirAsc'),
                  label: l10n.whaleHoldingsSortDirAsc,
                  arrow: '↑',
                  active: _dir == WhaleHoldingSortDir.asc,
                  onTap: () => setState(() => _dir = WhaleHoldingSortDir.asc),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: _SortDirCell(
                  key: const Key('whaleHoldingsSortDirDesc'),
                  label: l10n.whaleHoldingsSortDirDesc,
                  arrow: '↓',
                  active: _dir == WhaleHoldingSortDir.desc,
                  onTap: () => setState(() => _dir = WhaleHoldingSortDir.desc),
                ),
              ),
              const SizedBox(width: 6),
              Expanded(
                child: _SortDirCell(
                  key: const Key('whaleHoldingsSortDirNone'),
                  label: l10n.whaleHoldingsSortDirNone,
                  arrow: '',
                  active: _dir == null,
                  onTap: () => setState(() => _dir = null),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          GestureDetector(
            key: const Key('whaleHoldingsSortDone'),
            behavior: HitTestBehavior.opaque,
            onTap: _done,
            child: Container(
              width: double.infinity,
              height: 46,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                gradient: c.accentGrad,
                borderRadius: BorderRadius.circular(12),
                boxShadow: <BoxShadow>[c.accentShadow],
              ),
              child: Text(
                l10n.whaleHoldingsSortDone,
                style: const TextStyle(
                  color: Color(0xFFFFFFFF),
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SortPill extends StatelessWidget {
  const _SortPill({
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
        height: 30,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        decoration: BoxDecoration(
          color: active ? c.accent : c.bgSoft,
          borderRadius: BorderRadius.circular(QzRadii.pill),
        ),
        child: Align(
          widthFactor: 1,
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              color: active ? c.accentOn : c.text,
              fontSize: 12,
              fontWeight: active ? FontWeight.w600 : FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}

class _SortDirCell extends StatelessWidget {
  const _SortDirCell({
    required this.label,
    required this.arrow,
    required this.active,
    required this.onTap,
    super.key,
  });

  final String label;
  final String arrow;
  final bool active;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        height: 40,
        decoration: BoxDecoration(
          color: active ? c.accentSoft : c.bgSoft,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: active ? c.accent : Colors.transparent),
        ),
        alignment: Alignment.center,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(
              label,
              style: TextStyle(
                color: active ? c.accent : c.text,
                fontSize: 12.5,
                fontWeight: active ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
            if (arrow.isNotEmpty) ...<Widget>[
              const SizedBox(width: 5),
              Text(
                arrow,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: active ? c.accent : c.text,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

/// 币种全屏搜索：空查询展示热门 + 历史，点 chip / 结果直接返回币种。
class _CoinSearchSheet {
  const _CoinSearchSheet._();

  static Future<String?> show({
    required BuildContext context,
    required List<String> coins,
  }) {
    return Navigator.of(context, rootNavigator: true).push<String>(
      MaterialPageRoute<String>(
        fullscreenDialog: true,
        builder: (BuildContext ctx) => _CoinSearchBody(coins: coins),
      ),
    );
  }
}

class _CoinSearchBody extends StatefulWidget {
  const _CoinSearchBody({required this.coins});

  final List<String> coins;

  @override
  State<_CoinSearchBody> createState() => _CoinSearchBodyState();
}

class _CoinSearchBodyState extends State<_CoinSearchBody> {
  final TextEditingController _controller = TextEditingController();
  final FocusNode _focusNode = FocusNode();
  String _query = '';
  late List<String> _history = widget.coins.take(3).toList(growable: true);

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _focusNode.requestFocus();
    });
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
    super.dispose();
  }

  List<String> get _results {
    final String q = _query.trim().toLowerCase();
    if (q.isEmpty) return const <String>[];
    return widget.coins
        .where((String c) => c.toLowerCase().contains(q))
        .toList(growable: false);
  }

  void _pick(String coin) {
    setState(() {
      _history = <String>[
        coin,
        ..._history.where((String item) => item != coin),
      ].take(12).toList(growable: true);
    });
    Navigator.of(context).pop(coin);
  }

  void _submit(String raw) {
    final List<String> results = _results;
    if (results.isEmpty) return;
    _pick(results.first);
  }

  void _clearQuery() {
    _controller.clear();
    setState(() => _query = '');
    _focusNode.requestFocus();
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final bool hasQuery = _query.trim().isNotEmpty;
    return Scaffold(
      backgroundColor: c.bg,
      body: SafeArea(
        child: Column(
          children: <Widget>[
            _inputRow(l10n, c),
            Expanded(
              child: hasQuery ? _resultList(l10n, c) : _hotCoins(l10n, c),
            ),
          ],
        ),
      ),
    );
  }

  Widget _inputRow(AppLocalizations l10n, QzColorScheme c) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        QzSpacing.sm,
        QzSpacing.lg,
        QzSpacing.sm,
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Container(
              height: 38,
              padding: const EdgeInsets.symmetric(horizontal: QzSpacing.md),
              decoration: BoxDecoration(
                color: c.bgInput,
                border: Border.all(color: c.border),
                borderRadius: BorderRadius.circular(QzRadii.pill),
              ),
              child: Row(
                children: <Widget>[
                  Icon(Icons.search, size: 16, color: c.textMid),
                  const SizedBox(width: QzSpacing.sm),
                  Expanded(
                    child: TextField(
                      key: const Key('whaleHoldingsCoinSearchInput'),
                      controller: _controller,
                      focusNode: _focusNode,
                      onChanged: (String v) => setState(() => _query = v),
                      onSubmitted: _submit,
                      textInputAction: TextInputAction.search,
                      cursorColor: c.accent,
                      style: TextStyle(color: c.text, fontSize: 13),
                      decoration: InputDecoration(
                        filled: false,
                        border: InputBorder.none,
                        isCollapsed: true,
                        hintText: l10n.whaleHoldingsCoinSearchHint,
                        hintStyle: TextStyle(color: c.textDim, fontSize: 13),
                      ),
                    ),
                  ),
                  if (_query.isNotEmpty)
                    GestureDetector(
                      key: const Key('whaleHoldingsCoinSearchClearInput'),
                      onTap: _clearQuery,
                      child: Container(
                        width: 16,
                        height: 16,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color: c.border,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(Icons.close, size: 11, color: c.bg),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(width: QzSpacing.md),
          TextButton(
            key: const Key('whaleHoldingsCoinSearchCancel'),
            onPressed: () => Navigator.of(context).pop(),
            child: Text(
              l10n.commonCancel,
              style: TextStyle(color: c.textMid, fontSize: 13),
            ),
          ),
        ],
      ),
    );
  }

  Widget _hotCoins(AppLocalizations l10n, QzColorScheme c) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        QzSpacing.xs,
        QzSpacing.lg,
        QzSpacing.xl,
      ),
      children: <Widget>[
        Text(
          l10n.aggCoinSearchHot.toUpperCase(),
          style: TextStyle(
            color: c.textDim,
            fontSize: 11,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.4,
          ),
        ),
        const SizedBox(height: QzSpacing.md),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: <Widget>[
            for (final String coin in widget.coins)
              _CoinSearchChip(
                key: Key('whaleHoldingsCoinSearchHot_$coin'),
                label: coin,
                onTap: () => _pick(coin),
              ),
          ],
        ),
        if (_history.isNotEmpty) ...<Widget>[
          const SizedBox(height: 26),
          Row(
            children: <Widget>[
              Expanded(
                child: Text(
                  l10n.strategySearchHistoryLabel.toUpperCase(),
                  style: TextStyle(
                    color: c.textDim,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.4,
                  ),
                ),
              ),
              IconButton(
                key: const Key('whaleHoldingsCoinSearchClearHistory'),
                onPressed: () => setState(() => _history = <String>[]),
                icon: Icon(Icons.delete_outline, size: 16, color: c.textDim),
                tooltip: l10n.strategySearchClearHistory,
                padding: const EdgeInsets.all(4),
                constraints: const BoxConstraints(minWidth: 24, minHeight: 24),
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.md),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: <Widget>[
              for (final String coin in _history)
                _CoinSearchChip(
                  key: Key('whaleHoldingsCoinSearchHistory_$coin'),
                  label: coin,
                  onTap: () => _pick(coin),
                ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _resultList(AppLocalizations l10n, QzColorScheme c) {
    final List<String> results = _results;
    if (results.isEmpty) {
      return Center(
        key: const Key('whaleHoldingsCoinSearchEmpty'),
        child: Text(
          l10n.whaleHoldingsCoinSearchEmpty,
          style: TextStyle(color: c.textDim, fontSize: 13),
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        QzSpacing.xs,
        QzSpacing.lg,
        QzSpacing.xl,
      ),
      itemCount: results.length,
      itemBuilder: (BuildContext ctx, int i) {
        final String coin = results[i];
        return _CoinSearchResultRow(
          key: Key('whaleHoldingsCoinSearchResult_$coin'),
          coin: coin,
          onTap: () => _pick(coin),
        );
      },
    );
  }
}

class _CoinSearchChip extends StatelessWidget {
  const _CoinSearchChip({super.key, required this.label, required this.onTap});

  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        constraints: const BoxConstraints(minWidth: 62),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
        decoration: BoxDecoration(
          color: c.bgElev,
          borderRadius: BorderRadius.circular(QzRadii.pill),
        ),
        child: Text(
          label,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: c.textMid,
            fontSize: 13,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

class _CoinSearchResultRow extends StatelessWidget {
  const _CoinSearchResultRow({
    super.key,
    required this.coin,
    required this.onTap,
  });

  final String coin;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: QzSpacing.md),
        decoration: BoxDecoration(
          border: Border(bottom: BorderSide(color: c.borderSoft)),
        ),
        child: Row(
          children: <Widget>[
            Container(
              width: 28,
              height: 28,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: c.accent,
                shape: BoxShape.circle,
              ),
              child: Text(
                coin.substring(0, 1),
                style: TextStyle(
                  color: c.accentOn,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Text.rich(
                TextSpan(
                  children: <InlineSpan>[
                    TextSpan(text: coin),
                    TextSpan(
                      text: ' / USDT',
                      style: TextStyle(
                        color: c.textDim,
                        fontSize: 11,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ],
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: c.text,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                ),
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
