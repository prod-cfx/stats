import 'package:flutter/material.dart';

import '../../../data/models/strategy_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 「筛选 & 排序」sheet 设计稿外壳（m-screens-2:783-787）：20 顶部圆角、
/// `bgElev` 表面、`0 -16 48 rgba(15,11,34,0.2)` 上方阴影、padding `16/20/36`、
/// 42×4 handle。与通用 [QzSheet] 分离，避免改动通用外壳波及其余 15 处调用。
const Color _sheetShadow = Color(0x330F0B22);

/// 排序键（#1565）：热门 / 收益 / Sharpe / 低回撤。
enum StrategySortKey { hot, cagr, sharpe, mddLow }

/// 「筛选 & 排序」底部 sheet 选择结果。
class StrategySortFilterResult {
  final StrategyCategory category;
  final StrategySortKey sort;

  const StrategySortFilterResult({required this.category, required this.sort});
}

/// 「筛选 & 排序」底部 sheet 内容（#1565）。
///
/// 设计为受控 child：父页面通过 [StrategySortSheet.show] 弹出，sheet 维护本地
/// draft 选择状态，点击"查看 N 个结果"按钮才回传 [StrategySortFilterResult]。
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

  /// 以设计稿专用外壳弹出 sheet 并回传选择结果。外壳规格见 [_sheetShadow]
  /// 注释：20 顶部圆角、42×4 handle、padding `16/20/36`、上方阴影。
  ///
  /// Known limitation：外壳颜色在 builder 闭包外捕获 `context.qzScheme`，
  /// sheet 打开期间切换主题不会重绘外壳（与 [QzSheet] 一致，关闭重开即刷新）。
  static Future<StrategySortFilterResult?> show({
    required BuildContext context,
    required StrategyCategory initialCategory,
    required StrategySortKey initialSort,
    required int resultCount,
  }) {
    final QzColorScheme c = context.qzScheme;
    return showModalBottomSheet<StrategySortFilterResult>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      barrierColor: c.scrim,
      sheetAnimationStyle: const AnimationStyle(
        curve: QzCurves.sheetPanel,
        duration: QzCurves.sheetPanelDuration,
        reverseCurve: QzCurves.sheetPanel,
        reverseDuration: QzCurves.sheetPanelDuration,
      ),
      builder: (BuildContext ctx) => Container(
        decoration: const BoxDecoration(
          // 阴影 shape 须与内层 20 顶部圆角一致，否则按矩形投射、顶角方形外溢。
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
          boxShadow: <BoxShadow>[
            BoxShadow(
              color: _sheetShadow,
              blurRadius: 48,
              offset: Offset(0, -16),
            ),
          ],
        ),
        child: DecoratedBox(
          decoration: BoxDecoration(
            color: c.bgElev,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
          ),
          child: SafeArea(
            top: false,
            // 设计稿 padding 16/20/36（顶/左右/底）；SafeArea 吸收手势条。
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 36),
              child: StrategySortSheet(
                initialCategory: initialCategory,
                initialSort: initialSort,
                resultCount: resultCount,
              ),
            ),
          ),
        ),
      ),
    );
  }

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
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        // 设计稿 m-screens-2:788 handle：42×4、圆角 2、margin 底 14。
        Center(
          child: Container(
            width: 42,
            height: 4,
            margin: const EdgeInsets.only(bottom: 14),
            decoration: BoxDecoration(
              color: c.border,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        ),
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
        // 设计稿 m-screens-2:804-815 两列网格，按钮 36 高 / 圆角 8。
        GridView(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
            crossAxisCount: 2,
            mainAxisSpacing: QzSpacing.xs,
            crossAxisSpacing: QzSpacing.xs,
            mainAxisExtent: 36,
          ),
          children: <Widget>[
            for (final StrategySortKey k in StrategySortKey.values)
              _SortChoice(
                key: Key('strategy-sheet-sort-${k.name}'),
                label: l10n.strategyHomeSortByOption(_sortLabel(context, k)),
                selected: k == _sort,
                onTap: () => setState(() => _sort = k),
              ),
          ],
        ),
        const SizedBox(height: QzSpacing.md),
        SizedBox(
          width: double.infinity,
          height: 46,
          child: Container(
            decoration: BoxDecoration(
              gradient: c.accentGrad,
              borderRadius: BorderRadius.circular(12),
              boxShadow: const <BoxShadow>[
                BoxShadow(
                  color: Color(0x527C5CFF),
                  blurRadius: 20,
                  offset: Offset(0, 6),
                ),
              ],
            ),
            child: Material(
              color: Colors.transparent,
              borderRadius: BorderRadius.circular(12),
              child: InkWell(
                key: const Key('strategy-sheet-apply-btn'),
                borderRadius: BorderRadius.circular(12),
                onTap: () => Navigator.of(context).pop(
                  StrategySortFilterResult(category: _category, sort: _sort),
                ),
                child: Center(
                  child: Text(
                    l10n.strategyHomeSheetApply(widget.resultCount),
                    style: TextStyle(
                      color: c.accentOn,
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// 类型 pill（设计稿 m-screens-2:795-799）：30 高、padding `0 12`、圆角 999。
/// 选中 accent 实底 + accentOn 文字；未选 `bgSoft` + `text`。
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
          height: 30,
          padding: const EdgeInsets.symmetric(horizontal: QzSpacing.md),
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

/// 排序按钮（设计稿 m-screens-2:808-812）：网格内 36 高、圆角 8。
/// 选中 accentSoft 底 + accent 文字；未选 `bgSoft` + `text`。
class _SortChoice extends StatelessWidget {
  const _SortChoice({
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
        borderRadius: BorderRadius.circular(8),
        child: Container(
          decoration: BoxDecoration(
            color: selected ? c.accentSoft : c.bgSoft,
            borderRadius: BorderRadius.circular(8),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              color: selected ? c.accent : c.text,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}
