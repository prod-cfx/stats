part of 'strategy_home_page.dart';
// ignore_for_file: unused_element

/// 顶栏搜索按钮（设计稿 m-screens-2 line 566-577）。
///
/// 有 query 时呈激活态：accentSoft 圆底 + 右上红点 badge；否则普通图标按钮。
class _SearchButton extends StatelessWidget {
  const _SearchButton({
    required this.active,
    required this.tooltip,
    required this.onPressed,
  });

  final bool active;
  final String tooltip;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Tooltip(
      key: const Key('strategy-search-btn'),
      message: tooltip,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onPressed,
        child: SizedBox(
          // 设计稿 m-screens-2:566 操作按钮 36×36 圆形。
          width: 36,
          height: 36,
          child: Stack(
            children: <Widget>[
              Positioned.fill(
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: active ? c.accentSoft : Colors.transparent,
                    shape: BoxShape.circle,
                  ),
                ),
              ),
              Center(
                child: Icon(
                  Icons.search,
                  size: 20,
                  color: active ? c.accent : c.textMid,
                ),
              ),
              if (active)
                Positioned(
                  // 设计稿 m-screens-2:584 红点 7×7，定位 top:6 right:6。
                  right: 6,
                  top: 6,
                  child: Container(
                    key: const Key('strategy-search-btn-dot'),
                    width: 7,
                    height: 7,
                    decoration: BoxDecoration(
                      color: c.accent,
                      shape: BoxShape.circle,
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 顶部「筛选 & 排序」按钮（设计稿 m-screens-2:578-583）。
///
/// 图标样式对齐「实盘策略」顶部排序入口：使用 tune 线性滑杆图标，
/// 不使用漏斗图标。
class _FilterButton extends StatelessWidget {
  const _FilterButton({
    required this.active,
    required this.tooltip,
    required this.onPressed,
  });

  final bool active;
  final String tooltip;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Tooltip(
      key: const Key('strategy-filter-btn'),
      message: tooltip,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onPressed,
        child: SizedBox(
          // 设计稿操作按钮统一 36×36 圆形、图标 20。
          width: 36,
          height: 36,
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: active ? c.accentSoft : Colors.transparent,
              shape: BoxShape.circle,
            ),
            child: Center(
              child: Icon(
                Icons.tune,
                size: 20,
                color: active ? c.accent : c.textMid,
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// 收藏视图空态（设计稿 m-screens-2 line 712-740）：琥珀星标图标 +
/// 「还没有收藏的策略」+ 引导文案 + 「去策略广场看看」CTA。
class _FavoritesEmptyState extends StatelessWidget {
  const _FavoritesEmptyState({required this.onBrowse});

  final VoidCallback onBrowse;

  static const Color _amber = Color(0xFFF59E0B);

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Padding(
      key: const Key('strategy-fav-empty'),
      padding: const EdgeInsets.symmetric(horizontal: QzSpacing.xl),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          // 琥珀星标圆形徽标。
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: _amber.withValues(alpha: 0.12),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.star_rounded, size: 26, color: _amber),
          ),
          const SizedBox(height: QzSpacing.lg),
          Text(
            l10n.strategyHomeFavEmptyTitle,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: c.text,
              fontSize: 15,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: QzSpacing.xs),
          ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 240),
            child: Text(
              l10n.strategyHomeFavEmptyHint,
              textAlign: TextAlign.center,
              style: TextStyle(color: c.textDim, fontSize: 13, height: 1.6),
            ),
          ),
          const SizedBox(height: QzSpacing.lg),
          FilledButton(
            key: const Key('strategy-fav-empty-cta'),
            onPressed: onBrowse,
            child: Text(l10n.strategyHomeFavEmptyCta),
          ),
        ],
      ),
    );
  }
}

/// 排序行（#1565）：标签 + 4 个 chip + 结果计数。
class _SortRow extends StatelessWidget {
  const _SortRow({
    required this.sort,
    required this.resultCount,
    required this.onChanged,
  });

  final StrategySortKey sort;
  final int resultCount;
  final ValueChanged<StrategySortKey> onChanged;

  String _label(BuildContext ctx, StrategySortKey k) {
    final AppLocalizations l10n = AppLocalizations.of(ctx);
    return switch (k) {
      StrategySortKey.hot => l10n.strategyHomeSortHot,
      StrategySortKey.returnPct => l10n.strategyHomeSortReturn,
      StrategySortKey.trades => l10n.strategyHomeSortTrades,
      StrategySortKey.drawdownLow => l10n.strategyHomeSortLowDrawdown,
      StrategySortKey.latest => l10n.strategyHomeSortLatest,
    };
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        QzSpacing.xs,
        QzSpacing.lg,
        0,
      ),
      child: Row(
        children: <Widget>[
          Text(
            l10n.strategyHomeSortLabel,
            style: TextStyle(color: c.textDim, fontSize: 11),
          ),
          const SizedBox(width: QzSpacing.xs),
          for (final StrategySortKey k in StrategySortKey.values) ...<Widget>[
            _SortChip(
              key: Key('strategy-sort-${k.name}'),
              label: _label(context, k),
              selected: k == sort,
              onTap: () => onChanged(k),
            ),
            const SizedBox(width: 2),
          ],
          const Spacer(),
          Text(
            l10n.strategyHomeResultCount(resultCount),
            style: TextStyle(
              color: c.textDim,
              fontSize: 11,
              fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}

class _SortChip extends StatelessWidget {
  const _SortChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(6),
        child: SizedBox(
          height: 24,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10),
            decoration: BoxDecoration(
              color: selected ? c.accentSoft : Colors.transparent,
              borderRadius: BorderRadius.circular(6),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Text(
                  label,
                  style: TextStyle(
                    color: selected ? c.accent : c.textDim,
                    fontSize: 11,
                    fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                  ),
                ),
                if (selected) ...<Widget>[
                  const SizedBox(width: 4),
                  Icon(Icons.keyboard_arrow_down, size: 10, color: c.accent),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
