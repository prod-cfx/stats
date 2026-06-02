import 'package:flutter/material.dart';

import '../../../data/models/strategy_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 顶部分类筛选条。
///
/// 行头是一枚独立「收藏」toggle（设计稿 m-screens-2 line 588-621）：开启后
/// 列表只显示已星标策略，与分类标签互斥——开收藏即清掉分类高亮、分类 chip
/// 半透明示意失效。
///
/// 普通分类 chip 用设计稿规格（line 608-619）的 [_CategoryChip] 渲染：
/// 30 高、padding `0 14`、字体 12，与行头收藏 chip 等高；选中态走 `text`
/// 实底 + `bgElev` 文字，未选态走 `bgElev` 表面 + `border` 描边。不再复用
/// `QzChip`（22 高 / 11 字），避免与收藏 chip 高度不一致。
class CategoryChipBar extends StatelessWidget {
  const CategoryChipBar({
    super.key,
    required this.selected,
    required this.favOnly,
    required this.onChanged,
    required this.onFavOnlyChanged,
  });

  final StrategyCategory selected;
  final bool favOnly;
  final ValueChanged<StrategyCategory> onChanged;
  final ValueChanged<bool> onFavOnlyChanged;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<({StrategyCategory key, String label})> entries =
        <({StrategyCategory key, String label})>[
      (key: StrategyCategory.all, label: l10n.commonAll),
      (key: StrategyCategory.trend, label: l10n.strategyCategoryTrend),
      (key: StrategyCategory.grid, label: l10n.strategyCategoryGrid),
      (key: StrategyCategory.arbitrage, label: l10n.strategyCategoryArbitrage),
      (key: StrategyCategory.reversal, label: l10n.strategyCategoryReversal),
      (key: StrategyCategory.hedge, label: l10n.strategyCategoryHedge),
      (key: StrategyCategory.highFreq, label: l10n.strategyCategoryHighFreq),
    ];
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: QzSpacing.lg),
        // +1 给行头的「收藏」toggle。
        itemCount: entries.length + 1,
        separatorBuilder: (_, int _) =>
            const SizedBox(width: QzSpacing.sm),
        itemBuilder: (BuildContext context, int i) {
          if (i == 0) {
            return Center(
              child: _FavoriteToggle(
                label: l10n.strategyHomeFavorites,
                on: favOnly,
                onTap: () => onFavOnlyChanged(!favOnly),
              ),
            );
          }
          final ({StrategyCategory key, String label}) e = entries[i - 1];
          // favOnly 与分类互斥：开收藏时分类无高亮、半透明示意失效。
          final bool on = !favOnly && e.key == selected;
          return Opacity(
            opacity: favOnly ? 0.55 : 1,
            child: Center(
              child: _CategoryChip(
                chipKey: Key('strategy-chip-${e.key.name}'),
                label: e.label,
                on: on,
                onTap: () => onChanged(e.key),
              ),
            ),
          );
        },
      ),
    );
  }
}

/// 行头「收藏」toggle：选中态琥珀色填充星标 + 琥珀边框（设计稿 #F59E0B），
/// 未选态走 neutral 表面 + 边框。
class _FavoriteToggle extends StatelessWidget {
  const _FavoriteToggle({
    required this.label,
    required this.on,
    required this.onTap,
  });

  final String label;
  final bool on;
  final VoidCallback onTap;

  static const Color _amber = Color(0xFFF59E0B);

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color fg = on ? _amber : c.textMid;
    return GestureDetector(
      key: const Key('strategy-fav-toggle'),
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        height: 30,
        padding: const EdgeInsets.symmetric(horizontal: QzSpacing.md),
        decoration: BoxDecoration(
          color: on ? _amber.withValues(alpha: 0.14) : c.bgSoft,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(
            color: on ? _amber.withValues(alpha: 0.32) : c.border,
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(
              on ? Icons.star_rounded : Icons.star_outline_rounded,
              size: 14,
              color: fg,
            ),
            const SizedBox(width: 5),
            Text(
              label,
              style: TextStyle(
                color: fg,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// 普通分类 chip（设计稿 m-screens-2 line 608-619）：30 高、padding `0 14`、
/// 字体 12 / w500，圆角 999。选中态 `text` 实底 + `bgElev` 文字（无边框）；
/// 未选态 `bgElev` 表面 + `border` 描边 + `textMid` 文字。
class _CategoryChip extends StatelessWidget {
  const _CategoryChip({
    required this.chipKey,
    required this.label,
    required this.on,
    required this.onTap,
  });

  final Key chipKey;
  final String label;
  final bool on;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return GestureDetector(
      key: chipKey,
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        height: 30,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: on ? c.text : c.bgElev,
          borderRadius: BorderRadius.circular(QzRadii.pill),
          border: Border.all(color: on ? Colors.transparent : c.border),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: on ? c.bgElev : c.textMid,
            fontSize: 12,
            fontWeight: FontWeight.w500,
          ),
        ),
      ),
    );
  }
}
