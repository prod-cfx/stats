import 'package:flutter/material.dart';

import '../../../data/models/strategy_models.dart';
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

  static const List<({StrategyCategory key, String label})> _entries =
      <({StrategyCategory key, String label})>[
    (key: StrategyCategory.all, label: '全部'),
    (key: StrategyCategory.highReturn, label: '高收益'),
    (key: StrategyCategory.lowDrawdown, label: '低回撤'),
    (key: StrategyCategory.newListing, label: '新上架'),
  ];

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: 40,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: QzSpacing.lg),
        itemCount: _entries.length,
        separatorBuilder: (_, int _) =>
            const SizedBox(width: QzSpacing.sm),
        itemBuilder: (BuildContext context, int i) {
          final ({StrategyCategory key, String label}) e = _entries[i];
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
