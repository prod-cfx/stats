import 'package:flutter/material.dart';

import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// `QzSettingsRow` 的 value tone。
///
/// - `neutral` 用 `textMid`（默认值）
/// - `ok` 用 `statusOk`（已绑定、已开启）
/// - `warn` 用 `statusWarn`（未配置）
/// - `danger` 用 `statusDanger`（退出登录文字色）
enum QzSettingsRowTone { neutral, ok, warn, danger }

/// 「我的」页面的设置行：`label ............ value [trailing]`。
///
/// - [trailing] 默认为右箭头 caret；可以传 `null` 隐藏，或传自定义 Widget（如 Switch）
/// - [mono] 控制 value 是否用等宽字体（UID 类用 true）
/// - [onTap] 整行可点
/// - [last] 是否最后一行，决定是否绘制底部分隔线
class QzSettingsRow extends StatelessWidget {
  const QzSettingsRow({
    super.key,
    required this.label,
    this.value,
    this.tone = QzSettingsRowTone.neutral,
    this.trailing,
    this.mono = false,
    this.onTap,
    this.last = false,
  });

  final String label;
  final String? value;
  final QzSettingsRowTone tone;
  final Widget? trailing;
  final bool mono;
  final VoidCallback? onTap;
  final bool last;

  Color _toneColor(QzColorScheme c) {
    switch (tone) {
      case QzSettingsRowTone.neutral:
        return c.textMid;
      case QzSettingsRowTone.ok:
        return c.statusOk;
      case QzSettingsRowTone.warn:
        return c.statusWarn;
      case QzSettingsRowTone.danger:
        return c.statusDanger;
    }
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Widget row = Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.lg,
        vertical: 13,
      ),
      child: Row(
        children: <Widget>[
          Text(
            label,
            style: TextStyle(
              color: c.text,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
          const Spacer(),
          if (value != null)
            Flexible(
              child: Text(
                value!,
                textAlign: TextAlign.right,
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: _toneColor(c),
                  fontSize: 13,
                  fontFamilyFallback:
                      mono ? const <String>['ui-monospace', 'monospace'] : null,
                ),
              ),
            ),
          if (trailing != null) ...<Widget>[
            const SizedBox(width: QzSpacing.sm),
            trailing!,
          ],
        ],
      ),
    );

    final Widget content = onTap == null
        ? row
        : Material(
            color: Colors.transparent,
            child: InkWell(onTap: onTap, child: row),
          );

    return DecoratedBox(
      decoration: BoxDecoration(
        border: last
            ? null
            : Border(
                bottom: BorderSide(color: c.borderSoft),
              ),
      ),
      child: content,
    );
  }
}

/// 默认的右箭头 caret 图标，供 `QzSettingsRow.trailing` 复用。
class QzSettingsCaret extends StatelessWidget {
  const QzSettingsCaret({super.key});

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Icon(Icons.chevron_right, size: 18, color: c.textDim);
  }
}
