import 'package:flutter/material.dart';

import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_sheet.dart';

/// 基本信息 tab 图表筛选底部抽屉（issue #1906）。
///
/// 设计真源：`design/project/mobile/m-screens-whale-discover.jsx`
/// 的图表筛选 drawer（`:925`）：标题 + 选项列表（选中态打勾，accent 紫）+
/// 底部「取消」。点选项即回填并关闭，返回选中值；点取消 / 点遮罩返回 null。
class WhaleChartFilterSheet extends StatelessWidget {
  const WhaleChartFilterSheet({
    super.key,
    required this.title,
    required this.options,
    required this.value,
  });

  final String title;
  final List<String> options;
  final String value;

  /// 弹出抽屉，返回用户选中的新值；取消 / 关闭返回 null。
  static Future<String?> show(
    BuildContext context, {
    required String title,
    required List<String> options,
    required String value,
  }) {
    return QzSheet.show<String>(
      context: context,
      useRootNavigator: true,
      builder: (BuildContext ctx) => WhaleChartFilterSheet(
        title: title,
        options: options,
        value: value,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;

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
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: c.text,
            ),
          ),
        ),
        for (final String o in options)
          _OptionRow(
            label: o,
            selected: o == value,
            onTap: () => Navigator.of(context).pop(o),
          ),
        Divider(height: 1, thickness: 1, color: c.borderSoft),
        SizedBox(
          height: 46,
          child: TextButton(
            onPressed: () => Navigator.of(context).pop(),
            style: TextButton.styleFrom(
              minimumSize: const Size.fromHeight(46),
              shape: const RoundedRectangleBorder(),
            ),
            child: Text(
              l10n.whaleProfilePillCancel,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w600,
                color: c.text,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// 单个选项行：左标签（选中 accent 色）+ 右选中圆点（打勾）。
class _OptionRow extends StatelessWidget {
  const _OptionRow({
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
        padding: const EdgeInsets.symmetric(
          horizontal: QzSpacing.lg,
          vertical: 12,
        ),
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
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: selected ? c.accent : Colors.transparent,
                border: Border.all(
                  color: selected ? c.accent : c.border,
                  width: 1.5,
                ),
              ),
              child: selected
                  ? Icon(Icons.check, size: 12, color: c.accentOn)
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}
