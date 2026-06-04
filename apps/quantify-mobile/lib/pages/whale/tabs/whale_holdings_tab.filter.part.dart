part of 'whale_holdings_tab.dart';
// ignore_for_file: unused_element

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
