import 'package:flutter/material.dart';

import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 删除确认对话框（#1773）。
///
/// 对齐设计稿 `m-screens-livestrats.jsx:764-897`：
/// - [stopped] 策略：已是软删态，直接「永久删除」，不提供软删选项。
/// - 非 stopped 策略：默认软删（保留 30 天），可展开「不保留历史?」勾选永久删除。
///
/// 确认回 `bool permanent`（true=永久删除，false=软删）；取消返回 null。
class LiveDeleteSheet extends StatefulWidget {
  const LiveDeleteSheet({
    super.key,
    required this.name,
    required this.stopped,
  });

  final String name;
  final bool stopped;

  static Future<bool?> show(
    BuildContext context, {
    required String name,
    required bool stopped,
  }) {
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (BuildContext ctx) => LiveDeleteSheet(
        name: name,
        stopped: stopped,
      ),
    );
  }

  @override
  State<LiveDeleteSheet> createState() => _LiveDeleteSheetState();
}

class _LiveDeleteSheetState extends State<LiveDeleteSheet> {
  bool _showDanger = false;
  bool _permanent = false;

  bool get _hardDelete => widget.stopped || _permanent;

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
            padding: const EdgeInsets.fromLTRB(
              QzSpacing.md,
              QzSpacing.md,
              QzSpacing.md,
              QzSpacing.md,
            ),
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: c.borderSoft)),
            ),
            child: Row(
              children: <Widget>[
                Container(
                  width: 30,
                  height: 30,
                  decoration: BoxDecoration(
                    color: c.statusDanger.withValues(alpha: 0.16),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  alignment: Alignment.center,
                  child: Icon(
                    Icons.delete_outline,
                    size: 16,
                    color: c.statusDanger,
                  ),
                ),
                const SizedBox(width: QzSpacing.sm),
                Expanded(
                  child: Text(
                    _hardDelete
                        ? l10n.liveDeleteSheetTitlePermanent
                        : l10n.liveDeleteSheetTitleSoft,
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
            padding: const EdgeInsets.fromLTRB(
              QzSpacing.md,
              QzSpacing.md,
              QzSpacing.md,
              QzSpacing.md,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  _bodyText(l10n),
                  style: TextStyle(color: c.textMid, fontSize: 13, height: 1.65),
                ),
                if (!widget.stopped) _dangerToggle(c, l10n),
              ],
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
                    key: const Key('live-delete-confirm'),
                    onPressed: () => Navigator.of(context).pop(_hardDelete),
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(44),
                      backgroundColor: c.statusDanger,
                    ),
                    child: Text(
                      _hardDelete
                          ? l10n.liveDeletePrimaryPermanent
                          : l10n.liveDeletePrimarySoft,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _bodyText(AppLocalizations l10n) {
    if (widget.stopped) return l10n.liveDeleteBodyStopped(widget.name);
    if (_permanent) return l10n.liveDeleteBodyPermanentRunning(widget.name);
    return l10n.liveDeleteBodySoft(widget.name);
  }

  Widget _dangerToggle(QzColorScheme c, AppLocalizations l10n) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        const SizedBox(height: 10),
        GestureDetector(
          onTap: () => setState(() => _showDanger = !_showDanger),
          child: Text(
            _showDanger
                ? l10n.liveDeleteToggleCollapse
                : l10n.liveDeleteToggleExpand,
            style: TextStyle(
              color: c.accent,
              fontSize: 12,
              fontWeight: FontWeight.w500,
              decoration: TextDecoration.underline,
            ),
          ),
        ),
        if (_showDanger) ...<Widget>[
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: QzSpacing.md,
              vertical: 10,
            ),
            decoration: BoxDecoration(
              color: c.statusDanger.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  l10n.liveDeleteDangerNote,
                  style: TextStyle(
                    color: c.statusDanger,
                    fontSize: 11,
                    height: 1.6,
                  ),
                ),
                const SizedBox(height: 7),
                InkWell(
                  key: const Key('live-delete-permanent-checkbox'),
                  onTap: () => setState(() => _permanent = !_permanent),
                  child: Row(
                    children: <Widget>[
                      Icon(
                        _permanent
                            ? Icons.check_box
                            : Icons.check_box_outline_blank,
                        size: 16,
                        color: c.statusDanger,
                      ),
                      const SizedBox(width: 7),
                      Expanded(
                        child: Text(
                          l10n.liveDeleteDangerCheckbox,
                          style: TextStyle(
                            color: c.statusDanger,
                            fontSize: 11,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}
