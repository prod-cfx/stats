import 'package:flutter/material.dart';

import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_sheet.dart';

/// 详情页 5 个明细 tab 的排序/筛选交互原子（#1908）。
///
/// 设计真源：`design/project/mobile/m-screens-whale-discover.jsx` `TabBody`
/// （列头三态排序 :1166 / 币种筛选抽屉 CoinFilter :1992 / 更多排序抽屉
/// PerpMoreSort :1531）。
///
/// 排序键策略（KISS）：display 串带逗号的数值用 [whaleSortNum] 解析；
/// `time` 为相对时间文案（"少于一分钟前"）无法解析，调用方改用 fixture 行
/// 原始索引作为排序键（index 越小越新）。真实数据接入（#1682）时如需精确
/// 时间序，由后端保证顺序或补数值字段，属 #1682 范围。

/// 三态排序方向。null（不排序）由 [WhaleSortState.dir] 为 null 表达。
enum WhaleSortDir { asc, desc }

/// 单 tab 的排序状态：列 key + 方向。两者同时为 null 表示「不排序」。
@immutable
class WhaleSortState {
  const WhaleSortState({this.key, this.dir});

  final String? key;
  final WhaleSortDir? dir;

  bool get active => key != null && dir != null;

  /// 列头三态循环：新列→desc；desc→asc；asc→不排序。
  WhaleSortState cycle(String tappedKey) {
    if (key != tappedKey) {
      return WhaleSortState(key: tappedKey, dir: WhaleSortDir.desc);
    }
    if (dir == WhaleSortDir.desc) {
      return WhaleSortState(key: tappedKey, dir: WhaleSortDir.asc);
    }
    return const WhaleSortState();
  }
}

/// display 串 → 排序用数值。去逗号与货币/单位符号后 `double.tryParse`，
/// 解析失败回退 0（不排序列不会调用，故无副作用）。
double whaleSortNum(String display) {
  final String cleaned =
      display.replaceAll(RegExp(r'[^0-9.\-]'), '');
  return double.tryParse(cleaned) ?? 0;
}

/// 列头三态排序标签（上下 caret，active 紫色）。
class WhaleSortLabel extends StatelessWidget {
  const WhaleSortLabel({
    super.key,
    required this.label,
    required this.dir,
    required this.onTap,
  });

  final String label;

  /// 当前列方向；null 表示该列未参与排序。
  final WhaleSortDir? dir;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final bool active = dir != null;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: active ? FontWeight.w600 : FontWeight.w500,
              color: active ? c.accent : c.textDim,
            ),
          ),
          const SizedBox(width: 4),
          _SortCaret(dir: dir, accent: c.accent, faint: c.textFaint),
        ],
      ),
    );
  }
}

class _SortCaret extends StatelessWidget {
  const _SortCaret({required this.dir, required this.accent, required this.faint});

  final WhaleSortDir? dir;
  final Color accent;
  final Color faint;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Icon(
          Icons.arrow_drop_up,
          size: 12,
          color: dir == WhaleSortDir.asc ? accent : faint,
        ),
        const SizedBox(height: 0),
        Icon(
          Icons.arrow_drop_down,
          size: 12,
          color: dir == WhaleSortDir.desc ? accent : faint,
        ),
      ],
    );
  }
}

/// 币种筛选触发器（文案 + 漏斗图标，active 紫色显示当前 sym）。
class WhaleCoinFilterTrigger extends StatelessWidget {
  const WhaleCoinFilterTrigger({
    super.key,
    required this.value,
    required this.options,
    required this.onChanged,
    this.label,
  });

  /// 当前选中 sym；'全部' 视为未筛选。
  final String value;
  final List<String> options;
  final ValueChanged<String> onChanged;

  /// 触发器文案（默认「币种筛选」），现货 tab 用「筛选」。
  final String? label;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final bool active = value != l10n.whaleProfileFilterAll;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () async {
        final String? picked = await WhaleCoinFilterSheet.show(
          context,
          current: value,
          options: options,
        );
        if (picked != null) onChanged(picked);
      },
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Text(
            active ? value : (label ?? l10n.whaleProfileFilterCoin),
            style: TextStyle(
              fontSize: 11,
              fontWeight: active ? FontWeight.w600 : FontWeight.w500,
              color: active ? c.accent : c.textDim,
            ),
          ),
          const SizedBox(width: 4),
          Icon(Icons.filter_list, size: 13, color: c.textDim),
        ],
      ),
    );
  }
}

/// 币种筛选底部抽屉（单选 + 勾选标记 + 「全部」默认）。
class WhaleCoinFilterSheet {
  const WhaleCoinFilterSheet._();

  static Future<String?> show(
    BuildContext context, {
    required String current,
    required List<String> options,
  }) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return QzSheet.show<String>(
      context: context,
      builder: (BuildContext ctx) {
        final QzColorScheme c = ctx.qzScheme;
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, QzSpacing.sm),
              child: Text(
                l10n.whaleProfileFilterTitle,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: c.text,
                ),
              ),
            ),
            Flexible(
              child: ListView(
                padding: const EdgeInsets.symmetric(horizontal: QzSpacing.sm),
                shrinkWrap: true,
                children: <Widget>[
                  for (final String o in options)
                    _CoinOption(
                      label: o,
                      selected: o == current,
                      onTap: () => Navigator.of(ctx).pop(o),
                    ),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}

class _CoinOption extends StatelessWidget {
  const _CoinOption({
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
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
        child: Row(
          children: <Widget>[
            Expanded(
              child: Text(
                label,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: selected ? c.accent : c.text,
                ),
              ),
            ),
            Container(
              width: 20,
              height: 20,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: selected ? c.accent : Colors.transparent,
                border: Border.all(
                  color: selected ? c.accent : c.border,
                  width: 1.5,
                ),
              ),
              child: selected
                  ? Icon(Icons.check, size: 13, color: c.accentOn)
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}

/// 更多排序触发器（文案 + 下拉箭头，active 紫色）。
class WhaleMoreSortTrigger extends StatelessWidget {
  const WhaleMoreSortTrigger({
    super.key,
    required this.sort,
    required this.metrics,
    required this.onChanged,
  });

  final WhaleSortState sort;

  /// 可排序指标：(key, 本地化 label)。
  final List<({String key, String label})> metrics;
  final ValueChanged<WhaleSortState> onChanged;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final bool active =
        sort.active && metrics.any((m) => m.key == sort.key);
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: () async {
        final WhaleSortState? next = await WhaleMoreSortSheet.show(
          context,
          current: sort,
          metrics: metrics,
        );
        if (next != null) onChanged(next);
      },
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Text(
            l10n.whaleProfileMoreSort,
            style: TextStyle(
              fontSize: 11,
              fontWeight: active ? FontWeight.w600 : FontWeight.w500,
              color: active ? c.accent : c.textDim,
            ),
          ),
          const SizedBox(width: 3),
          Icon(Icons.expand_more, size: 14, color: c.textDim),
        ],
      ),
    );
  }
}

/// 更多排序底部抽屉（指标 pill 单选 + 升序/降序/不排序 + 完成）。
class WhaleMoreSortSheet {
  const WhaleMoreSortSheet._();

  static Future<WhaleSortState?> show(
    BuildContext context, {
    required WhaleSortState current,
    required List<({String key, String label})> metrics,
  }) {
    return QzSheet.show<WhaleSortState>(
      context: context,
      builder: (BuildContext ctx) => _MoreSortBody(
        current: current,
        metrics: metrics,
      ),
    );
  }
}

class _MoreSortBody extends StatefulWidget {
  const _MoreSortBody({required this.current, required this.metrics});

  final WhaleSortState current;
  final List<({String key, String label})> metrics;

  @override
  State<_MoreSortBody> createState() => _MoreSortBodyState();
}

class _MoreSortBodyState extends State<_MoreSortBody> {
  late WhaleSortState _draft = widget.current;

  void _pickMetric(String key) {
    setState(() {
      _draft = WhaleSortState(
        key: key,
        dir: _draft.dir ?? WhaleSortDir.desc,
      );
    });
  }

  void _pickDir(WhaleSortDir? dir) {
    setState(() {
      if (dir == null) {
        _draft = const WhaleSortState();
        return;
      }
      _draft = WhaleSortState(
        key: _draft.key ?? widget.metrics.first.key,
        dir: dir,
      );
    });
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 0, 20, QzSpacing.lg),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            l10n.whaleProfileMoreSort,
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: c.text,
            ),
          ),
          const SizedBox(height: QzSpacing.md),
          Text(
            l10n.whaleProfileSortMetric,
            style: TextStyle(fontSize: 11, color: c.textMid),
          ),
          const SizedBox(height: QzSpacing.xs),
          Wrap(
            spacing: QzSpacing.xs,
            runSpacing: QzSpacing.xs,
            children: <Widget>[
              for (final ({String key, String label}) m in widget.metrics)
                _MetricPill(
                  label: m.label,
                  selected: _draft.key == m.key,
                  onTap: () => _pickMetric(m.key),
                ),
            ],
          ),
          const SizedBox(height: QzSpacing.lg),
          Text(
            l10n.whaleProfileSortDirection,
            style: TextStyle(fontSize: 11, color: c.textMid),
          ),
          const SizedBox(height: QzSpacing.xs),
          Row(
            children: <Widget>[
              Expanded(
                child: _DirOption(
                  label: l10n.whaleProfileSortAsc,
                  arrow: '↑',
                  selected: _draft.dir == WhaleSortDir.asc,
                  onTap: () => _pickDir(WhaleSortDir.asc),
                ),
              ),
              const SizedBox(width: QzSpacing.xs),
              Expanded(
                child: _DirOption(
                  label: l10n.whaleProfileSortDesc,
                  arrow: '↓',
                  selected: _draft.dir == WhaleSortDir.desc,
                  onTap: () => _pickDir(WhaleSortDir.desc),
                ),
              ),
              const SizedBox(width: QzSpacing.xs),
              Expanded(
                child: _DirOption(
                  label: l10n.whaleProfileSortNone,
                  arrow: '',
                  selected: _draft.dir == null,
                  onTap: () => _pickDir(null),
                ),
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.lg),
          SizedBox(
            width: double.infinity,
            height: 46,
            child: FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: c.accent,
                foregroundColor: c.accentOn,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
                ),
              ),
              onPressed: () => Navigator.of(context).pop(_draft),
              child: Text(
                l10n.whaleProfileSortDone,
                style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _MetricPill extends StatelessWidget {
  const _MetricPill({
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
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        height: 30,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? c.accent : c.bgSoft,
          borderRadius: BorderRadius.circular(QzRadii.pill),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
            color: selected ? c.accentOn : c.text,
          ),
        ),
      ),
    );
  }
}

class _DirOption extends StatelessWidget {
  const _DirOption({
    required this.label,
    required this.arrow,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final String arrow;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        height: 40,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? c.accentSoft : c.bgSoft,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(
            color: selected ? c.accent : Colors.transparent,
          ),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(
              label,
              style: TextStyle(
                fontSize: 12.5,
                fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                color: selected ? c.accent : c.text,
              ),
            ),
            if (arrow.isNotEmpty) ...<Widget>[
              const SizedBox(width: 5),
              Text(
                arrow,
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: selected ? c.accent : c.text,
                  fontFamily: QzFont.mono,
                  fontFamilyFallback: QzFont.monoFallback,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
