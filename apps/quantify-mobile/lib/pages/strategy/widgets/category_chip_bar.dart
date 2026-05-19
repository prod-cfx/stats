import 'package:flutter/material.dart';

import '../../../data/models/strategy_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_chip.dart';

/// 顶部分类筛选条。
///
/// `QzChip` 自身不带 `selected` API（只 tone 切换），因此用 GestureDetector
/// 包裹后切换 tone（inverse=选中 / neutral=未选）。
class CategoryChipBar extends StatelessWidget {
  const CategoryChipBar({
    super.key,
    required this.selected,
    required this.onChanged,
  });

  final StrategyCategory selected;
  final ValueChanged<StrategyCategory> onChanged;

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
        itemCount: entries.length,
        separatorBuilder: (_, int _) =>
            const SizedBox(width: QzSpacing.sm),
        itemBuilder: (BuildContext context, int i) {
          final ({StrategyCategory key, String label}) e = entries[i];
          final bool on = e.key == selected;
          return GestureDetector(
            key: Key('strategy-chip-${e.key.name}'),
            behavior: HitTestBehavior.opaque,
            onTap: () => onChanged(e.key),
            child: Center(
              child: QzChip(
                label: e.label,
                tone: on ? QzChipTone.inverse : QzChipTone.neutral,
              ),
            ),
          );
        },
      ),
    );
  }
}
