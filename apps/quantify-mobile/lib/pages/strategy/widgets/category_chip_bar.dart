import 'package:flutter/material.dart';

import '../../../data/models/strategy_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_chip.dart';

/// 顶部分类筛选条。
///
/// 行头是一枚独立「收藏」toggle（设计稿 m-screens-2 line 588-621）：开启后
/// 列表只显示已星标策略，与分类标签互斥——开收藏即清掉分类高亮、分类 chip
/// 半透明示意失效。
///
/// `QzChip` 自身不带 `selected` API（只 tone 切换），因此用 GestureDetector
/// 包裹后切换 tone（inverse=选中 / neutral=未选）。
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
            child: GestureDetector(
              key: Key('strategy-chip-${e.key.name}'),
              behavior: HitTestBehavior.opaque,
              onTap: () => onChanged(e.key),
              child: Center(
                child: QzChip(
                  label: e.label,
                  tone: on ? QzChipTone.inverse : QzChipTone.neutral,
                ),
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
