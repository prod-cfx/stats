import 'package:flutter/material.dart';

import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 删除 running 策略前的守卫对话框（#1773）。
///
/// 对齐设计稿 `m-screens-livestrats.jsx:683-761`：提示需先暂停。「去暂停策略」
/// 返回 true（调用方据此打开暂停流程）；取消 / 关闭返回 null。
class LiveNeedPauseSheet extends StatelessWidget {
  const LiveNeedPauseSheet({super.key, required this.name});

  final String name;

  static Future<bool?> show(BuildContext context, {required String name}) {
    return showModalBottomSheet<bool>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (BuildContext ctx) => LiveNeedPauseSheet(name: name),
    );
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final EdgeInsets safe = MediaQuery.viewPaddingOf(context);

    return Container(
      decoration: BoxDecoration(
        color: c.bg,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(18)),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(
            padding: const EdgeInsets.all(QzSpacing.md),
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: c.borderSoft)),
            ),
            child: Row(
              children: <Widget>[
                Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                    color: c.statusWarn.withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  alignment: Alignment.center,
                  child: Icon(
                    Icons.warning_amber_rounded,
                    size: 16,
                    color: c.statusWarn,
                  ),
                ),
                const SizedBox(width: QzSpacing.sm),
                Expanded(
                  child: Text(
                    l10n.liveNeedPauseTitle,
                    style: TextStyle(
                      color: c.text,
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(QzSpacing.md),
            child: Text(
              l10n.liveNeedPauseBody(name),
              style: TextStyle(color: c.textMid, fontSize: 13, height: 1.65),
            ),
          ),
          Container(
            padding: EdgeInsets.fromLTRB(
              QzSpacing.md,
              QzSpacing.md,
              QzSpacing.md,
              QzSpacing.xl + safe.bottom,
            ),
            decoration: BoxDecoration(
              color: c.bgElev,
              border: Border(top: BorderSide(color: c.borderSoft)),
            ),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: OutlinedButton(
                    onPressed: () => Navigator.of(context).pop(),
                    style: OutlinedButton.styleFrom(
                      minimumSize: const Size.fromHeight(44),
                      side: BorderSide(color: c.border),
                    ),
                    child: Text(
                      l10n.liveActionCancel,
                      style: TextStyle(color: c.text),
                    ),
                  ),
                ),
                const SizedBox(width: QzSpacing.sm),
                Expanded(
                  flex: 2,
                  child: FilledButton(
                    key: const Key('live-need-pause-confirm'),
                    onPressed: () => Navigator.of(context).pop(true),
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(44),
                      backgroundColor: c.accent,
                    ),
                    child: Text(l10n.liveNeedPausePrimary),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
