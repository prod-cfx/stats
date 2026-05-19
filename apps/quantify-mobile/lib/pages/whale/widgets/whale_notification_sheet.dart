import 'package:flutter/material.dart';

import '../../../data/models/whale_extra_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_sheet.dart';

/// 通知中心 sheet 返回值：刷新后的通知列表（包含 unread 状态）。
class WhaleNotificationSheetResult {
  const WhaleNotificationSheetResult(this.notifications);
  final List<WhaleNotification> notifications;
}

/// 通知中心 sheet。4 个 tab（全部 / 巨鲸预警 / 监控触发 / 系统）+ 列表 +
/// 「全部已读」按钮。
class WhaleNotificationSheet extends StatefulWidget {
  const WhaleNotificationSheet({super.key, required this.initial});

  final List<WhaleNotification> initial;

  static Future<WhaleNotificationSheetResult?> show(
    BuildContext context, {
    required List<WhaleNotification> notifications,
  }) {
    return QzSheet.show<WhaleNotificationSheetResult>(
      context: context,
      builder: (BuildContext ctx) =>
          WhaleNotificationSheet(initial: notifications),
    );
  }

  @override
  State<WhaleNotificationSheet> createState() => _WhaleNotificationSheetState();
}

class _WhaleNotificationSheetState extends State<WhaleNotificationSheet> {
  late List<WhaleNotification> _items;
  int _tabIndex = 0;

  @override
  void initState() {
    super.initState();
    _items = List<WhaleNotification>.of(widget.initial);
  }

  void _markAllRead() {
    setState(() {
      _items = _items
          .map((WhaleNotification n) => n.copyWith(unread: false))
          .toList();
    });
  }

  List<WhaleNotification> _filter(List<WhaleNotification> tabs) {
    switch (_tabIndex) {
      case 1:
        return tabs
            .where((WhaleNotification n) =>
                n.kind == WhaleNotificationKind.alert)
            .toList();
      case 2:
        return tabs
            .where((WhaleNotification n) =>
                n.kind == WhaleNotificationKind.watch)
            .toList();
      case 3:
        return tabs
            .where((WhaleNotification n) =>
                n.kind == WhaleNotificationKind.flow ||
                n.kind == WhaleNotificationKind.system)
            .toList();
      default:
        return tabs;
    }
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final List<String> tabLabels = <String>[
      l10n.whaleNotificationTabAll,
      l10n.whaleNotificationTabAlert,
      l10n.whaleNotificationTabWatch,
      l10n.whaleNotificationTabSystem,
    ];
    final List<WhaleNotification> visible = _filter(_items);
    final int unread =
        _items.where((WhaleNotification n) => n.unread).length;
    final MediaQueryData mq = MediaQuery.of(context);

    return SizedBox(
      height: mq.size.height * 0.75,
      child: Column(
        children: <Widget>[
          Padding(
            padding: const EdgeInsets.fromLTRB(
                QzSpacing.lg, 0, QzSpacing.lg, QzSpacing.sm),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    l10n.whaleNotificationTitle,
                    style: TextStyle(
                      color: c.text,
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                TextButton(
                  onPressed: unread == 0 ? null : _markAllRead,
                  style: TextButton.styleFrom(
                    foregroundColor: c.accent,
                    disabledForegroundColor: c.textDim,
                    padding: const EdgeInsets.symmetric(
                        horizontal: 8, vertical: 4),
                    minimumSize: const Size(0, 0),
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  child: Text(
                    l10n.whaleNotificationMarkAllRead,
                    style: const TextStyle(
                        fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ),
                IconButton(
                  icon: Icon(Icons.close, size: 20, color: c.textMid),
                  onPressed: () => Navigator.of(context).pop(
                      WhaleNotificationSheetResult(_items)),
                  visualDensity: VisualDensity.compact,
                  tooltip: l10n.whaleNotificationCloseTooltip,
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: QzSpacing.lg),
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: c.borderSoft)),
            ),
            child: Row(
              children: <Widget>[
                for (int i = 0; i < tabLabels.length; i++)
                  _NotifTab(
                    label: tabLabels[i],
                    selected: _tabIndex == i,
                    onTap: () => setState(() => _tabIndex = i),
                  ),
              ],
            ),
          ),
          Expanded(
            child: visible.isEmpty
                ? Center(
                    child: Text(
                      l10n.whaleNotificationEmpty,
                      style: TextStyle(color: c.textDim, fontSize: 13),
                    ),
                  )
                : ListView.builder(
                    itemCount: visible.length,
                    itemBuilder: (BuildContext ctx, int index) {
                      return _NotifRow(item: visible[index]);
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

class _NotifTab extends StatelessWidget {
  const _NotifTab({
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
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        margin: const EdgeInsets.only(right: 18),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(
              color: selected ? c.accent : Colors.transparent,
              width: 2,
            ),
          ),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? c.text : c.textMid,
            fontSize: 13,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

class _NotifRow extends StatelessWidget {
  const _NotifRow({required this.item});
  final WhaleNotification item;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final ({IconData icon, Color accent, Color bg}) palette = _palette(c);
    return Container(
      padding: const EdgeInsets.fromLTRB(
          QzSpacing.lg, QzSpacing.md, QzSpacing.lg, QzSpacing.md),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: c.borderSoft)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(
            width: 34,
            height: 34,
            decoration: BoxDecoration(
              color: palette.bg,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(palette.icon, size: 16, color: palette.accent),
          ),
          const SizedBox(width: QzSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Expanded(
                      child: Text(
                        item.title,
                        style: TextStyle(
                          color: c.text,
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                    ),
                    if (item.unread)
                      Container(
                        width: 7,
                        height: 7,
                        decoration: BoxDecoration(
                          color: c.statusDanger,
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 3),
                Text(
                  item.body,
                  style: TextStyle(color: c.textMid, fontSize: 12),
                ),
                const SizedBox(height: 3),
                Text(
                  item.meta,
                  style: TextStyle(color: c.textDim, fontSize: 10),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  ({IconData icon, Color accent, Color bg}) _palette(QzColorScheme c) {
    switch (item.kind) {
      case WhaleNotificationKind.alert:
        return (
          icon: Icons.warning_amber,
          accent: c.statusWarn,
          bg: c.statusWarn.withValues(alpha: 0.14),
        );
      case WhaleNotificationKind.watch:
        return (
          icon: Icons.visibility,
          accent: c.accent,
          bg: c.accentSoft,
        );
      case WhaleNotificationKind.flow:
        return (
          icon: Icons.trending_up,
          accent: c.statusInfo,
          bg: c.statusInfo.withValues(alpha: 0.14),
        );
      case WhaleNotificationKind.system:
        return (
          icon: Icons.schedule,
          accent: c.textMid,
          bg: c.bgSoft,
        );
    }
  }
}
