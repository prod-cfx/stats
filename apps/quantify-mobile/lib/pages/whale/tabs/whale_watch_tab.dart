import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../data/models/whale_extra_models.dart';
import '../../../data/models/whale_watch_models.dart';
import '../../../data/whale_notifications_notifier.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../widgets/whale_watch_addr_card.dart';
import '../widgets/whale_watch_rule_sheet.dart';
import 'whale_live_tab.dart';
import 'whale_watch_tab_controller.dart';
import 'whale_watch_tab_state.dart';

/// 巨鲸动向 — 监控 tab（issue #1560 / #1754 / #1769 / 三件套迁移 #2183）。
///
/// #1769：顶部 segmented 三层子 Tab，对齐设计稿 `m-screens-4.jsx` WhaleWatch
/// `:1545-1760`：
/// - 实时巨鲸：复用 [WhaleLiveTab]（时间分组 + LIVE pulse + 胜率排序 + 推送）。
/// - 监控地址：监控规则 CRUD + 永续字段卡（[WhaleWatchAddrCard]）。
/// - 通知中心：与顶部铃铛共享 [whaleNotificationsProvider] 单一数据源。
///
/// 子 Tab 选择与监控规则异步态收敛进 [whaleWatchTabControllerProvider]，widget
/// 退化为消费层：CRUD 弹窗等 context 副作用留在此处，结果回写 controller。
class WhaleWatchTab extends ConsumerWidget {
  const WhaleWatchTab({super.key});

  Future<void> _addRule(BuildContext context, WidgetRef ref) async {
    final WatchRule? rule = await WhaleWatchRuleSheet.show(context);
    if (rule == null) return;
    ref.read(whaleWatchTabControllerProvider.notifier).appendRule(rule);
  }

  Future<void> _editRule(
    BuildContext context,
    WidgetRef ref,
    WatchRule rule,
  ) async {
    final WatchRule? updated = await WhaleWatchRuleSheet.show(
      context,
      initial: rule,
    );
    if (updated == null) return;
    ref.read(whaleWatchTabControllerProvider.notifier).replaceRule(updated);
  }

  Future<void> _deleteRule(
    BuildContext context,
    WidgetRef ref,
    WatchRule rule,
  ) async {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final bool? ok = await showDialog<bool>(
      context: context,
      builder: (BuildContext ctx) => AlertDialog(
        title: Text(l10n.whaleRuleDeleteTitle),
        content: Text(l10n.whaleRuleDeleteBody(rule.name)),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(l10n.commonCancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(l10n.whaleRuleDeleteConfirm),
          ),
        ],
      ),
    );
    if (ok != true) return;
    ref.read(whaleWatchTabControllerProvider.notifier).removeRule(rule);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final WhaleWatchTabState st = ref.watch(whaleWatchTabControllerProvider);
    final WhaleWatchTabController controller = ref.read(
      whaleWatchTabControllerProvider.notifier,
    );
    final List<WhaleNotification> notifications = ref.watch(
      whaleNotificationsProvider,
    );
    final int unread = ref.watch(whaleUnreadCountProvider);
    final int ruleCount = st.rules?.length ?? 0;

    return Column(
      children: <Widget>[
        _SegmentedSubTabs(
          selected: st.subTab,
          addressCount: ruleCount,
          notificationCount: notifications.length,
          notificationDot: unread > 0,
          onChanged: controller.setSubTab,
        ),
        Expanded(
          child: IndexedStack(
            index: st.subTab.index,
            children: <Widget>[
              const WhaleLiveTab(),
              _AddressesBody(
                rules: st.rules,
                onAdd: () => _addRule(context, ref),
                onEdit: (WatchRule r) => _editRule(context, ref, r),
                onToggleMute: controller.toggleMute,
                onDelete: (WatchRule r) => _deleteRule(context, ref, r),
              ),
              _NotificationsBody(notifications: notifications),
            ],
          ),
        ),
      ],
    );
  }
}

/// segmented 三段子 Tab（issue #1769）。对齐设计稿圆角 pill 分段 + 计数 + dot。
class _SegmentedSubTabs extends StatelessWidget {
  const _SegmentedSubTabs({
    required this.selected,
    required this.addressCount,
    required this.notificationCount,
    required this.notificationDot,
    required this.onChanged,
  });

  final WhaleWatchSubTab selected;
  final int addressCount;
  final int notificationCount;
  final bool notificationDot;
  final ValueChanged<WhaleWatchSubTab> onChanged;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final List<({WhaleWatchSubTab tab, String label, int? count, bool dot})> segs =
        <({WhaleWatchSubTab tab, String label, int? count, bool dot})>[
          (
            tab: WhaleWatchSubTab.live,
            label: l10n.whaleWatchSubTabLive,
            count: null,
            dot: false,
          ),
          (
            tab: WhaleWatchSubTab.addresses,
            label: l10n.whaleWatchSubTabAddresses,
            count: addressCount,
            dot: false,
          ),
          (
            tab: WhaleWatchSubTab.notifications,
            label: l10n.whaleWatchSubTabNotifications,
            count: notificationCount,
            dot: notificationDot,
          ),
        ];
    return Container(
      color: c.bgElev,
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        4,
        QzSpacing.lg,
        QzSpacing.md,
      ),
      child: Container(
        padding: const EdgeInsets.all(3),
        decoration: BoxDecoration(
          color: c.bgSoft,
          border: Border.all(color: c.borderSoft),
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          children: <Widget>[
            for (final ({WhaleWatchSubTab tab, String label, int? count, bool dot}) s
                in segs)
              Expanded(
                child: _Segment(
                  label: s.label,
                  count: s.count,
                  dot: s.dot,
                  selected: selected == s.tab,
                  onTap: () => onChanged(s.tab),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class _Segment extends StatelessWidget {
  const _Segment({
    required this.label,
    required this.count,
    required this.dot,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final int? count;
  final bool dot;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Container(
        height: 32,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? c.bgElev : Colors.transparent,
          borderRadius: BorderRadius.circular(8),
          border: selected ? Border.all(color: c.borderSoft) : null,
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: <Widget>[
            Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Text(
                  label,
                  style: TextStyle(
                    color: selected ? c.text : c.textMid,
                    fontSize: 11.5,
                    fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
                  ),
                ),
                if (count != null) ...<Widget>[
                  const SizedBox(width: 3),
                  Text(
                    '$count',
                    style: TextStyle(
                      color: selected ? c.textDim : c.textFaint,
                      fontSize: 10.5,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ],
            ),
            if (dot)
              Positioned(
                top: -2,
                right: -8,
                child: Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: c.marketDown,
                    borderRadius: BorderRadius.circular(3),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// 监控地址子 Tab body（issue #1769）：创建监控按钮 + 地址卡列表 / 空态。
class _AddressesBody extends StatelessWidget {
  const _AddressesBody({
    required this.rules,
    required this.onAdd,
    required this.onEdit,
    required this.onToggleMute,
    required this.onDelete,
  });

  final List<WatchRule>? rules;
  final VoidCallback onAdd;
  final ValueChanged<WatchRule> onEdit;
  final ValueChanged<WatchRule> onToggleMute;
  final ValueChanged<WatchRule> onDelete;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<WatchRule> list = rules ?? const <WatchRule>[];
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        QzSpacing.md,
        QzSpacing.lg,
        100,
      ),
      children: <Widget>[
        Align(
          alignment: Alignment.centerRight,
          child: _CreateButton(
            key: const Key('whaleWatchAddressCreateMonitorButton'),
            label: l10n.whaleWatchCreateMonitor,
            onTap: onAdd,
          ),
        ),
        const SizedBox(height: QzSpacing.md),
        if (list.isEmpty)
          _EmptyBox(text: l10n.whaleWatchAddressesEmpty)
        else
          for (int i = 0; i < list.length; i++) ...<Widget>[
            WhaleWatchAddrCard(
              rule: list[i],
              onOpen: () => context.push(
                '/whale/profile/${Uri.encodeComponent(list[i].address)}',
              ),
              onToggleMute: () => onToggleMute(list[i]),
              onEdit: () => onEdit(list[i]),
              onDelete: () => onDelete(list[i]),
            ),
            if (i != list.length - 1) const SizedBox(height: QzSpacing.sm),
          ],
      ],
    );
  }
}

/// 通知中心子 Tab body（issue #1769）：全部已读 + NotifRow 列表 / 空态。
/// 与顶部铃铛共享 [whaleNotificationsProvider]。
class _NotificationsBody extends ConsumerWidget {
  const _NotificationsBody({required this.notifications});

  final List<WhaleNotification> notifications;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final int unread = ref.watch(whaleUnreadCountProvider);
    final WhaleNotificationsNotifier notifier = ref.read(
      whaleNotificationsProvider.notifier,
    );
    return ListView(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.lg,
        QzSpacing.md,
        QzSpacing.lg,
        100,
      ),
      children: <Widget>[
        Align(
          alignment: Alignment.centerRight,
          child: _MarkAllReadButton(
            label: unread > 0
                ? l10n.whaleWatchMarkAllReadCount(unread)
                : l10n.whaleNotificationMarkAllRead,
            enabled: unread > 0,
            onTap: unread > 0 ? notifier.markAllRead : null,
          ),
        ),
        const SizedBox(height: QzSpacing.md),
        if (notifications.isEmpty)
          _EmptyBox(text: l10n.whaleNotificationEmpty)
        else
          Container(
            decoration: BoxDecoration(
              border: Border.all(color: c.borderSoft),
              borderRadius: BorderRadius.circular(12),
            ),
            clipBehavior: Clip.antiAlias,
            child: Column(
              children: <Widget>[
                for (int i = 0; i < notifications.length; i++)
                  _NotifRow(
                    item: notifications[i],
                    isLast: i == notifications.length - 1,
                    onTap: () {
                      notifier.markRead(notifications[i].id);
                      final String? addr = notifications[i].address;
                      if (addr != null) {
                        context.push(
                          '/whale/profile/${Uri.encodeComponent(addr)}',
                        );
                      }
                    },
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

class _CreateButton extends StatelessWidget {
  const _CreateButton({required this.label, required this.onTap, super.key});
  final String label;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return FilledButton.icon(
      onPressed: onTap,
      icon: const Icon(Icons.add, size: 14),
      label: Text(label, style: const TextStyle(fontSize: 12)),
      style: FilledButton.styleFrom(
        backgroundColor: c.accent,
        foregroundColor: c.accentOn,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        minimumSize: const Size(0, 28),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    );
  }
}

class _MarkAllReadButton extends StatelessWidget {
  const _MarkAllReadButton({
    required this.label,
    required this.enabled,
    required this.onTap,
  });

  final String label;
  final bool enabled;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return OutlinedButton(
      onPressed: onTap,
      style: OutlinedButton.styleFrom(
        foregroundColor: enabled ? c.text : c.textDim,
        side: BorderSide(color: enabled ? c.border : c.borderSoft),
        padding: const EdgeInsets.symmetric(horizontal: 12),
        minimumSize: const Size(0, 28),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
      child: Text(label, style: const TextStyle(fontSize: 12)),
    );
  }
}

class _EmptyBox extends StatelessWidget {
  const _EmptyBox({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: QzSpacing.xl),
      decoration: BoxDecoration(
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Center(
        child: Text(text, style: TextStyle(color: c.textDim, fontSize: 12)),
      ),
    );
  }
}

/// 通知行（issue #1769）。监控 tab 内嵌版本，复用通知中心 kind 配色与 unread
/// 底色，点击标记已读 + 跳转地址详情。
class _NotifRow extends StatelessWidget {
  const _NotifRow({
    required this.item,
    required this.isLast,
    required this.onTap,
  });

  final WhaleNotification item;
  final bool isLast;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final _NotifPalette p = _palette(c, item.kind);
    return InkWell(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
        decoration: BoxDecoration(
          color: item.unread ? c.bgElev : Colors.transparent,
          border: Border(
            bottom: BorderSide(
              color: isLast ? Colors.transparent : c.borderSoft,
            ),
          ),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Container(
              width: 28,
              height: 28,
              decoration: BoxDecoration(
                color: p.bg,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(p.icon, size: 14, color: p.accent),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Flexible(
                        child: Text(
                          item.title,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: c.text,
                            fontSize: 12.5,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      if (item.unread) ...<Widget>[
                        const SizedBox(width: 6),
                        Container(
                          width: 6,
                          height: 6,
                          decoration: BoxDecoration(
                            color: c.accent,
                            borderRadius: BorderRadius.circular(3),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    item.body,
                    style: TextStyle(
                      color: c.textMid,
                      fontSize: 11,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    item.meta,
                    style: TextStyle(color: c.textDim, fontSize: 10),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  _NotifPalette _palette(QzColorScheme c, WhaleNotificationKind kind) {
    switch (kind) {
      case WhaleNotificationKind.alert:
        return _NotifPalette(
          Icons.warning_amber,
          c.statusWarn,
          c.statusWarn.withValues(alpha: 0.14),
        );
      case WhaleNotificationKind.watch:
        return _NotifPalette(Icons.visibility, c.accent, c.accentSoft);
      case WhaleNotificationKind.flow:
        return _NotifPalette(
          Icons.trending_up,
          c.statusInfo,
          c.statusInfo.withValues(alpha: 0.14),
        );
      case WhaleNotificationKind.system:
        return _NotifPalette(Icons.schedule, c.textMid, c.bgSoft);
    }
  }
}

class _NotifPalette {
  const _NotifPalette(this.icon, this.accent, this.bg);
  final IconData icon;
  final Color accent;
  final Color bg;
}
