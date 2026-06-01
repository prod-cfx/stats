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
    return QzSheet.show<_SortResult>(
      context: context,
      builder: (BuildContext ctx) => _SortSheetBody(current: current),
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
    final WhaleHoldingSort? sort =
        _dir == null ? null : WhaleHoldingSort(key: _key, dir: _dir!);
    Navigator.of(context).pop(_SortResult(sort));
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        0,
        QzSpacing.lg,
        QzSpacing.lg,
      ),
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
          const SizedBox(height: QzSpacing.md),
          Text(
            l10n.whaleHoldingsSortSectionMetric,
            style: TextStyle(color: c.textMid, fontSize: 11),
          ),
          const SizedBox(height: QzSpacing.sm),
          Wrap(
            spacing: QzSpacing.sm,
            runSpacing: QzSpacing.sm,
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
          const SizedBox(height: QzSpacing.lg),
          Text(
            l10n.whaleHoldingsSortSectionDir,
            style: TextStyle(color: c.textMid, fontSize: 11),
          ),
          const SizedBox(height: QzSpacing.sm),
          Row(
            children: <Widget>[
              Expanded(
                child: _SortDirCell(
                  key: const Key('whaleHoldingsSortDirAsc'),
                  label: l10n.whaleHoldingsSortDirAsc,
                  icon: Icons.arrow_upward,
                  active: _dir == WhaleHoldingSortDir.asc,
                  onTap: () =>
                      setState(() => _dir = WhaleHoldingSortDir.asc),
                ),
              ),
              const SizedBox(width: QzSpacing.sm),
              Expanded(
                child: _SortDirCell(
                  key: const Key('whaleHoldingsSortDirDesc'),
                  label: l10n.whaleHoldingsSortDirDesc,
                  icon: Icons.arrow_downward,
                  active: _dir == WhaleHoldingSortDir.desc,
                  onTap: () =>
                      setState(() => _dir = WhaleHoldingSortDir.desc),
                ),
              ),
              const SizedBox(width: QzSpacing.sm),
              Expanded(
                child: _SortDirCell(
                  key: const Key('whaleHoldingsSortDirNone'),
                  label: l10n.whaleHoldingsSortDirNone,
                  icon: null,
                  active: _dir == null,
                  onTap: () => setState(() => _dir = null),
                ),
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.lg),
          SizedBox(
            width: double.infinity,
            height: 46,
            child: FilledButton(
              key: const Key('whaleHoldingsSortDone'),
              onPressed: _done,
              child: Text(l10n.whaleHoldingsSortDone),
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
        padding: const EdgeInsets.symmetric(horizontal: QzSpacing.md),
        decoration: BoxDecoration(
          color: active ? c.accent : c.bgSoft,
          borderRadius: BorderRadius.circular(QzRadii.pill),
        ),
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
    );
  }
}

class _SortDirCell extends StatelessWidget {
  const _SortDirCell({
    required this.label,
    required this.icon,
    required this.active,
    required this.onTap,
    super.key,
  });

  final String label;
  final IconData? icon;
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
          borderRadius: BorderRadius.circular(QzRadii.input),
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
                fontSize: 12,
                fontWeight: active ? FontWeight.w600 : FontWeight.w500,
              ),
            ),
            if (icon != null) ...<Widget>[
              const SizedBox(width: 4),
              Icon(icon, size: 14, color: active ? c.accent : c.textMid),
            ],
          ],
        ),
      ),
    );
  }
}

/// 币种搜索底部抽屉：实时按币种过滤，点击命中项返回该币种。
class _CoinSearchSheet {
  const _CoinSearchSheet._();

  static Future<String?> show({
    required BuildContext context,
    required List<String> coins,
  }) {
    return QzSheet.show<String>(
      context: context,
      builder: (BuildContext ctx) => _CoinSearchBody(coins: coins),
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
  String _query = '';

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  List<String> get _results {
    final String q = _query.trim().toLowerCase();
    if (q.isEmpty) return widget.coins;
    return widget.coins
        .where((String c) => c.toLowerCase().contains(q))
        .toList(growable: false);
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final List<String> results = _results;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        0,
        QzSpacing.lg,
        QzSpacing.lg,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          TextField(
            key: const Key('whaleHoldingsCoinSearchInput'),
            controller: _controller,
            autofocus: true,
            onChanged: (String v) => setState(() => _query = v),
            style: TextStyle(color: c.text, fontSize: 14),
            decoration: InputDecoration(
              prefixIcon: Icon(Icons.search, color: c.textMid, size: 18),
              hintText: l10n.whaleHoldingsCoinSearchHint,
              hintStyle: TextStyle(color: c.textDim, fontSize: 14),
              isDense: true,
            ),
          ),
          const SizedBox(height: QzSpacing.md),
          if (results.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 28),
              child: Center(
                child: Text(
                  l10n.whaleHoldingsCoinSearchEmpty,
                  style: TextStyle(color: c.textDim, fontSize: 12),
                ),
              ),
            )
          else
            Flexible(
              child: ListView(
                shrinkWrap: true,
                children: <Widget>[
                  for (final String coin in results)
                    ListTile(
                      key: Key('whaleHoldingsCoinSearchResult_$coin'),
                      dense: true,
                      title: Text(
                        coin,
                        style: TextStyle(color: c.text, fontSize: 14),
                      ),
                      onTap: () => Navigator.of(context).pop(coin),
                    ),
                ],
              ),
            ),
        ],
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
