import 'package:flutter/material.dart';

import '../../../data/models/whale_extra_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 通知中心 sheet 返回值：刷新后的通知列表（包含 unread 状态）。
class WhaleNotificationSheetResult {
  const WhaleNotificationSheetResult(this.notifications);
  final List<WhaleNotification> notifications;
}

/// 通知中心顶部下滑 panel（issue #1644）。
///
/// 设计稿 `design/project/mobile/m-screens-4.jsx` 的 `WhaleNotifPanel`：
/// 从顶部下滑、底部圆角、maxHeight ≈ 78%、scrim 点击关闭，
/// 内部包含 header（标题 + 未读 badge + subtitle + 全部已读 + 关闭）、
/// 横向 tabs（带每类数量）、列表（kind 圆形 icon + unread 底色 + dot）、
/// footer（24h 提示 + 通知设置入口）。
///
/// 通过 [showGeneralDialog] 路由，避免复用底部 `QzSheet`。
class WhaleNotificationSheet extends StatefulWidget {
  const WhaleNotificationSheet({super.key, required this.initial});

  final List<WhaleNotification> initial;

  static Future<WhaleNotificationSheetResult?> show(
    BuildContext context, {
    required List<WhaleNotification> notifications,
  }) {
    final Color scrim = context.qzScheme.scrim;
    return showGeneralDialog<WhaleNotificationSheetResult>(
      context: context,
      barrierDismissible: true,
      barrierLabel: MaterialLocalizations.of(context).modalBarrierDismissLabel,
      barrierColor: scrim,
      transitionDuration: const Duration(milliseconds: 320),
      pageBuilder: (BuildContext ctx, Animation<double> a1,
          Animation<double> a2) {
        return _PanelHost(
          child: WhaleNotificationSheet(initial: notifications),
        );
      },
      transitionBuilder: (BuildContext ctx, Animation<double> a1,
          Animation<double> a2, Widget child) {
        final Animation<Offset> slide = Tween<Offset>(
          begin: const Offset(0, -0.12),
          end: Offset.zero,
        ).animate(CurvedAnimation(parent: a1, curve: Curves.easeOutCubic));
        return FadeTransition(
          opacity: a1,
          child: SlideTransition(position: slide, child: child),
        );
      },
    );
  }

  @override
  State<WhaleNotificationSheet> createState() => _WhaleNotificationSheetState();
}

/// 把 panel 顶到屏幕顶部、限制最大高度 78%，并处理 SafeArea 上边距。
class _PanelHost extends StatelessWidget {
  const _PanelHost({required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final double maxH = MediaQuery.sizeOf(context).height * 0.78;
    return SafeArea(
      bottom: false,
      child: Align(
        alignment: Alignment.topCenter,
        child: ConstrainedBox(
          constraints: BoxConstraints(maxHeight: maxH),
          child: child,
        ),
      ),
    );
  }
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

  void _close() {
    Navigator.of(context).pop(WhaleNotificationSheetResult(_items));
  }

  List<WhaleNotification> _filterByIndex(
      List<WhaleNotification> items, int index) {
    switch (index) {
      case 1:
        return items
            .where((WhaleNotification n) =>
                n.kind == WhaleNotificationKind.alert)
            .toList();
      case 2:
        return items
            .where((WhaleNotification n) =>
                n.kind == WhaleNotificationKind.watch)
            .toList();
      case 3:
        return items
            .where((WhaleNotification n) =>
                n.kind == WhaleNotificationKind.flow ||
                n.kind == WhaleNotificationKind.system)
            .toList();
      default:
        return items;
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
    final List<WhaleNotification> visible = _filterByIndex(_items, _tabIndex);
    final int unread =
        _items.where((WhaleNotification n) => n.unread).length;
    // 单次遍历计算各 tab 计数，避免 _countOfTab(0..3) 4 次重复 filter。
    int alertCount = 0;
    int watchCount = 0;
    int flowOrSystemCount = 0;
    for (final WhaleNotification n in _items) {
      switch (n.kind) {
        case WhaleNotificationKind.alert:
          alertCount++;
        case WhaleNotificationKind.watch:
          watchCount++;
        case WhaleNotificationKind.flow:
        case WhaleNotificationKind.system:
          flowOrSystemCount++;
      }
    }
    final List<int> tabCounts = <int>[
      _items.length,
      alertCount,
      watchCount,
      flowOrSystemCount,
    ];

    return Material(
      color: Colors.transparent,
      child: Container(
        decoration: BoxDecoration(
          color: c.bgElev,
          borderRadius: const BorderRadius.vertical(
            bottom: Radius.circular(18),
          ),
          border: Border(bottom: BorderSide(color: c.borderSoft)),
          boxShadow: <BoxShadow>[
            BoxShadow(
              color: c.scrim.withValues(alpha: 0.28),
              blurRadius: 48,
              offset: const Offset(0, 24),
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            _Header(
              unread: unread,
              onMarkAllRead: unread == 0 ? null : _markAllRead,
              onClose: _close,
            ),
            _Tabs(
              labels: tabLabels,
              counts: tabCounts,
              selected: _tabIndex,
              onTap: (int i) => setState(() => _tabIndex = i),
            ),
            Flexible(
              child: visible.isEmpty
                  ? Padding(
                      padding: const EdgeInsets.symmetric(
                          horizontal: QzSpacing.lg, vertical: 36),
                      child: Center(
                        child: Text(
                          l10n.whaleNotificationEmpty,
                          style: TextStyle(color: c.textDim, fontSize: 13),
                        ),
                      ),
                    )
                  : ListView.builder(
                      itemCount: visible.length,
                      itemBuilder: (BuildContext ctx, int index) {
                        return _NotifRow(item: visible[index]);
                      },
                    ),
            ),
            _Footer(onSettings: () => _showSettingsPlaceholder(context, l10n)),
          ],
        ),
      ),
    );
  }

  void _showSettingsPlaceholder(BuildContext context, AppLocalizations l10n) {
    ScaffoldMessenger.maybeOf(context)?.showSnackBar(
      SnackBar(
        content: Text(l10n.whaleNotificationSettings),
        duration: const Duration(seconds: 1),
      ),
    );
  }
}

class _Header extends StatelessWidget {
  const _Header({
    required this.unread,
    required this.onMarkAllRead,
    required this.onClose,
  });

  final int unread;
  final VoidCallback? onMarkAllRead;
  final VoidCallback onClose;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
          QzSpacing.lg, 14, QzSpacing.lg, 10),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.center,
        children: <Widget>[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Flexible(
                      child: Text(
                        l10n.whaleNotificationTitle,
                        style: TextStyle(
                          color: c.text,
                          fontSize: 16,
                          fontWeight: FontWeight.w700,
                          letterSpacing: -0.2,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    if (unread > 0) ...<Widget>[
                      const SizedBox(width: QzSpacing.sm),
                      _UnreadBadge(count: unread),
                    ],
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  l10n.whaleNotificationSubtitle,
                  style: TextStyle(color: c.textDim, fontSize: 11),
                ),
              ],
            ),
          ),
          const SizedBox(width: QzSpacing.sm),
          _MarkAllReadButton(onTap: onMarkAllRead),
          const SizedBox(width: QzSpacing.xs),
          _CloseRoundButton(onTap: onClose),
        ],
      ),
    );
  }
}

class _UnreadBadge extends StatelessWidget {
  const _UnreadBadge({required this.count});
  final int count;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Container(
      height: 18,
      padding: const EdgeInsets.symmetric(horizontal: 7),
      decoration: BoxDecoration(
        color: c.statusDanger.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(9),
      ),
      alignment: Alignment.center,
      child: Text(
        l10n.whaleNotificationUnreadBadge(count),
        style: TextStyle(
          color: c.statusDanger,
          fontSize: 11,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

class _MarkAllReadButton extends StatelessWidget {
  const _MarkAllReadButton({required this.onTap});
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final bool enabled = onTap != null;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        height: 28,
        padding: const EdgeInsets.symmetric(horizontal: 10),
        decoration: BoxDecoration(
          color: Colors.transparent,
          border: Border.all(color: c.borderSoft),
          borderRadius: BorderRadius.circular(14),
        ),
        alignment: Alignment.center,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Icon(Icons.check, size: 12,
                color: enabled ? c.textMid : c.textDim),
            const SizedBox(width: 4),
            Text(
              l10n.whaleNotificationMarkAllRead,
              style: TextStyle(
                color: enabled ? c.textMid : c.textDim,
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _CloseRoundButton extends StatelessWidget {
  const _CloseRoundButton({required this.onTap});
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Tooltip(
      message: l10n.whaleNotificationCloseTooltip,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(
            color: c.bgSoft,
            borderRadius: BorderRadius.circular(14),
          ),
          alignment: Alignment.center,
          child: Icon(Icons.close, size: 14, color: c.textMid),
        ),
      ),
    );
  }
}

class _Tabs extends StatelessWidget {
  const _Tabs({
    required this.labels,
    required this.counts,
    required this.selected,
    required this.onTap,
  });

  final List<String> labels;
  final List<int> counts;
  final int selected;
  final ValueChanged<int> onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: c.borderSoft)),
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: QzSpacing.lg),
        child: Row(
          children: <Widget>[
            for (int i = 0; i < labels.length; i++)
              _NotifTab(
                label: labels[i],
                count: counts[i],
                selected: selected == i,
                onTap: () => onTap(i),
              ),
          ],
        ),
      ),
    );
  }
}

class _NotifTab extends StatelessWidget {
  const _NotifTab({
    required this.label,
    required this.count,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final int count;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        padding: const EdgeInsets.fromLTRB(4, 8, 4, 10),
        margin: const EdgeInsets.only(right: 14),
        decoration: BoxDecoration(
          border: Border(
            bottom: BorderSide(
              color: selected ? c.accent : Colors.transparent,
              width: 2,
            ),
          ),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Text(
              label,
              style: TextStyle(
                color: selected ? c.text : c.textMid,
                fontSize: 12,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
              ),
            ),
            const SizedBox(width: 5),
            Text(
              '$count',
              style: TextStyle(
                color: selected ? c.accent : c.textDim,
                fontSize: 10,
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
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
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final _KindPalette palette = _palette(c);
    return Container(
      padding: const EdgeInsets.fromLTRB(
          QzSpacing.lg, QzSpacing.md, QzSpacing.lg, QzSpacing.md),
      decoration: BoxDecoration(
        color: item.unread ? c.accentSoft : Colors.transparent,
        border: Border(bottom: BorderSide(color: c.borderSoft)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          if (item.unread)
            Padding(
              padding: const EdgeInsets.only(top: 6, right: 4),
              child: Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  color: c.accent,
                  borderRadius: BorderRadius.circular(3),
                ),
              ),
            )
          else
            const SizedBox(width: 10),
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: palette.bg,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(palette.icon, size: 15, color: palette.accent),
          ),
          const SizedBox(width: 11),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Row(
                  children: <Widget>[
                    Text(
                      _kindLabel(l10n, item.kind),
                      style: TextStyle(
                        color: palette.accent,
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                        letterSpacing: 0.3,
                      ),
                    ),
                    if (item.address != null) ...<Widget>[
                      const SizedBox(width: 6),
                      Text(
                        '· ${item.address}',
                        style: TextStyle(
                          color: c.textDim,
                          fontSize: 10,
                          fontFamily: QzFont.mono,
                          fontFamilyFallback: QzFont.monoFallback,
                        ),
                      ),
                    ],
                  ],
                ),
                const SizedBox(height: 2),
                Text(
                  item.title,
                  style: TextStyle(
                    color: c.text,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    height: 1.35,
                  ),
                ),
                const SizedBox(height: 3),
                Text(
                  item.body,
                  style: TextStyle(
                      color: c.textMid, fontSize: 12, height: 1.45),
                ),
                const SizedBox(height: 6),
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

  String _kindLabel(AppLocalizations l10n, WhaleNotificationKind kind) {
    switch (kind) {
      case WhaleNotificationKind.alert:
        return l10n.whaleNotifKindAlert;
      case WhaleNotificationKind.watch:
        return l10n.whaleNotifKindWatch;
      case WhaleNotificationKind.flow:
        return l10n.whaleNotifKindFlow;
      case WhaleNotificationKind.system:
        return l10n.whaleNotifKindSystem;
    }
  }

  _KindPalette _palette(QzColorScheme c) {
    switch (item.kind) {
      case WhaleNotificationKind.alert:
        return _KindPalette(
          icon: Icons.warning_amber,
          accent: c.statusWarn,
          bg: c.statusWarn.withValues(alpha: 0.14),
        );
      case WhaleNotificationKind.watch:
        return _KindPalette(
          icon: Icons.visibility,
          accent: c.accent,
          bg: c.accentSoft,
        );
      case WhaleNotificationKind.flow:
        return _KindPalette(
          icon: Icons.trending_up,
          accent: c.statusInfo,
          bg: c.statusInfo.withValues(alpha: 0.14),
        );
      case WhaleNotificationKind.system:
        return _KindPalette(
          icon: Icons.schedule,
          accent: c.textMid,
          bg: c.bgSoft,
        );
    }
  }
}

class _KindPalette {
  const _KindPalette({required this.icon, required this.accent, required this.bg});
  final IconData icon;
  final Color accent;
  final Color bg;
}

class _Footer extends StatelessWidget {
  const _Footer({required this.onSettings});
  final VoidCallback onSettings;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding:
          const EdgeInsets.symmetric(horizontal: QzSpacing.lg, vertical: 10),
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border(top: BorderSide(color: c.borderSoft)),
        borderRadius: const BorderRadius.vertical(
          bottom: Radius.circular(18),
        ),
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Text(
              l10n.whaleNotificationFooterHint,
              style: TextStyle(color: c.textDim, fontSize: 11),
            ),
          ),
          GestureDetector(
            onTap: onSettings,
            behavior: HitTestBehavior.opaque,
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Icon(Icons.tune, size: 13, color: c.accent),
                const SizedBox(width: 4),
                Text(
                  l10n.whaleNotificationSettings,
                  style: TextStyle(
                    color: c.accent,
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
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
