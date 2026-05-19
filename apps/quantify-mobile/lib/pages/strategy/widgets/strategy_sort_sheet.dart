import 'package:flutter/material.dart';

import '../../../data/models/strategy_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 排序键（#1565）：热门 / 收益 / Sharpe / 低回撤。
enum StrategySortKey { hot, cagr, sharpe, mddLow }

/// 「筛选 & 排序」底部 sheet 选择结果。
class StrategySortFilterResult {
  final StrategyCategory category;
  final StrategySortKey sort;

  const StrategySortFilterResult({
    required this.category,
    required this.sort,
  });
}

/// 「筛选 & 排序」底部 sheet 内容（#1565）。
///
/// 设计为受控 child：父页面通过 [QzSheet.show] 弹出，sheet 维护本地 draft
/// 选择状态，点击"查看 N 个结果"按钮才回传 [StrategySortFilterResult]。
class StrategySortSheet extends StatefulWidget {
  const StrategySortSheet({
    super.key,
    required this.initialCategory,
    required this.initialSort,
    required this.resultCount,
  });

  final StrategyCategory initialCategory;
  final StrategySortKey initialSort;

  /// 用于按钮文案"查看 N 个结果"。父页传当前过滤下的结果计数；sheet 内部
  /// 切换 draft 不实时联动该计数（避免要求父层提供回调），保持视觉简洁。
  final int resultCount;

  @override
  State<StrategySortSheet> createState() => _StrategySortSheetState();
}

class _StrategySortSheetState extends State<StrategySortSheet> {
  late StrategyCategory _category = widget.initialCategory;
  late StrategySortKey _sort = widget.initialSort;

  String _categoryLabel(BuildContext ctx, StrategyCategory c) {
    final AppLocalizations l10n = AppLocalizations.of(ctx);
    return switch (c) {
      StrategyCategory.all => l10n.commonAll,
      StrategyCategory.trend => l10n.strategyCategoryTrend,
      StrategyCategory.grid => l10n.strategyCategoryGrid,
      StrategyCategory.arbitrage => l10n.strategyCategoryArbitrage,
      StrategyCategory.reversal => l10n.strategyCategoryReversal,
      StrategyCategory.hedge => l10n.strategyCategoryHedge,
      StrategyCategory.highFreq => l10n.strategyCategoryHighFreq,
    };
  }

  String _sortLabel(BuildContext ctx, StrategySortKey k) {
    final AppLocalizations l10n = AppLocalizations.of(ctx);
    return switch (k) {
      StrategySortKey.hot => l10n.strategyHomeSortHot,
      StrategySortKey.cagr => l10n.strategyHomeSortReturn,
      StrategySortKey.sharpe => l10n.strategyHomeSortSharpe,
      StrategySortKey.mddLow => l10n.strategyHomeSortLowDrawdown,
    };
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          QzSpacing.lg, 0, QzSpacing.lg, QzSpacing.lg),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            l10n.strategyHomeFilterButton,
            style: TextStyle(
              color: c.text,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: QzSpacing.md),
          Text(
            l10n.strategyHomeSheetCategory,
            style: TextStyle(color: c.textDim, fontSize: 11),
          ),
          const SizedBox(height: QzSpacing.xs),
          Wrap(
            spacing: QzSpacing.xs,
            runSpacing: QzSpacing.xs,
            children: <Widget>[
              for (final StrategyCategory cat in StrategyCategory.values)
                _PillChoice(
                  key: Key('strategy-sheet-cat-${cat.name}'),
                  label: _categoryLabel(context, cat),
                  selected: cat == _category,
                  onTap: () => setState(() => _category = cat),
                ),
            ],
          ),
          const SizedBox(height: QzSpacing.md),
          Text(
            l10n.strategyHomeSheetSort,
            style: TextStyle(color: c.textDim, fontSize: 11),
          ),
          const SizedBox(height: QzSpacing.xs),
          GridView.count(
            crossAxisCount: 2,
            mainAxisSpacing: QzSpacing.xs,
            crossAxisSpacing: QzSpacing.xs,
            childAspectRatio: 4.0,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            children: <Widget>[
              for (final StrategySortKey k in StrategySortKey.values)
                _PillChoice(
                  key: Key('strategy-sheet-sort-${k.name}'),
                  label: _sortLabel(context, k),
                  selected: k == _sort,
                  onTap: () => setState(() => _sort = k),
                ),
            ],
          ),
          const SizedBox(height: QzSpacing.md),
          SizedBox(
            width: double.infinity,
            height: 46,
            child: ElevatedButton(
              key: const Key('strategy-sheet-apply-btn'),
              style: ElevatedButton.styleFrom(
                backgroundColor: c.accent,
                foregroundColor: c.accentOn,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(QzRadii.card),
                ),
              ),
              onPressed: () => Navigator.of(context).pop(
                StrategySortFilterResult(category: _category, sort: _sort),
              ),
              child: Text(
                l10n.strategyHomeSheetApply(widget.resultCount),
                style: const TextStyle(
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

class _PillChoice extends StatelessWidget {
  const _PillChoice({
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
        borderRadius: BorderRadius.circular(QzRadii.pill),
        child: Container(
          padding: const EdgeInsets.symmetric(
              horizontal: QzSpacing.md, vertical: 6),
          decoration: BoxDecoration(
            color: selected ? c.accent : c.bgSoft,
            borderRadius: BorderRadius.circular(QzRadii.pill),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              color: selected ? c.accentOn : c.text,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}
