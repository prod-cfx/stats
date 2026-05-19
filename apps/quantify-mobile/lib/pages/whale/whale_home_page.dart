import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/mock/fixtures/whale_extras.dart';
import '../../data/models/whale_extra_models.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_top_bar.dart';
import 'tabs/whale_discover_tab.dart';
import 'tabs/whale_holdings_tab.dart';
import 'tabs/whale_live_tab.dart';
import 'tabs/whale_watch_tab.dart';
import 'widgets/whale_notification_sheet.dart';

/// 巨鲸动向首页（issue #1560）。
///
/// QzTopBar + 通知中心入口（铃铛 + 未读 badge），下方 4 个二级 tab：
/// 发现 / 实时 / 持仓 / 监控（IndexedStack 保留各 tab 滚动/订阅状态）。
class WhaleHomePage extends ConsumerStatefulWidget {
  const WhaleHomePage({super.key});

  @override
  ConsumerState<WhaleHomePage> createState() => _WhaleHomePageState();
}

class _WhaleHomePageState extends ConsumerState<WhaleHomePage> {
  int _tabIndex = 1; // 默认实时 tab
  late List<WhaleNotification> _notifications;

  @override
  void initState() {
    super.initState();
    _notifications = List<WhaleNotification>.of(mockWhaleNotifications);
  }

  int get _unreadCount =>
      _notifications.where((WhaleNotification n) => n.unread).length;

  Future<void> _openNotifications() async {
    final WhaleNotificationSheetResult? result =
        await WhaleNotificationSheet.show(
      context,
      notifications: _notifications,
    );
    if (!mounted || result == null) return;
    setState(() {
      _notifications = result.notifications;
    });
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final List<({String label})> tabs = <({String label})>[
      (label: l10n.whaleTabDiscover),
      (label: l10n.whaleTabLive),
      (label: l10n.whaleTabHoldings),
      (label: l10n.whaleTabWatch),
    ];
    return Scaffold(
      backgroundColor: c.bg,
      appBar: QzTopBar(
        title: l10n.whaleFeedTitle,
        subtitle: l10n.whaleTopBarSubtitle,
        actions: <Widget>[
          IconButton(
            onPressed: () {},
            icon: Icon(Icons.search, size: 20, color: c.text),
            tooltip: l10n.whaleSearchTooltip,
          ),
          _NotificationBell(
            unread: _unreadCount,
            onTap: _openNotifications,
            tooltip: l10n.whaleNotificationTooltip,
          ),
          const SizedBox(width: QzSpacing.xs),
        ],
      ),
      body: Column(
        children: <Widget>[
          Container(
            decoration: BoxDecoration(
              color: c.bgElev,
              border: Border(
                bottom: BorderSide(color: c.borderSoft),
              ),
            ),
            padding:
                const EdgeInsets.fromLTRB(QzSpacing.lg, 4, QzSpacing.lg, 0),
            child: Row(
              children: <Widget>[
                for (int i = 0; i < tabs.length; i++)
                  _SubTab(
                    label: tabs[i].label,
                    selected: _tabIndex == i,
                    onTap: () => setState(() => _tabIndex = i),
                  ),
              ],
            ),
          ),
          Expanded(
            child: IndexedStack(
              index: _tabIndex,
              children: const <Widget>[
                WhaleDiscoverTab(),
                WhaleLiveTab(),
                WhaleHoldingsTab(),
                WhaleWatchTab(),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _SubTab extends StatelessWidget {
  const _SubTab({
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
        margin: const EdgeInsets.only(right: 20),
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

/// 铃铛 + 未读 badge。badge 用 Stack + Positioned 覆盖在 IconButton 上。
class _NotificationBell extends StatelessWidget {
  const _NotificationBell({
    required this.unread,
    required this.onTap,
    required this.tooltip,
  });

  final int unread;
  final VoidCallback onTap;
  final String tooltip;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Stack(
      alignment: Alignment.center,
      children: <Widget>[
        IconButton(
          onPressed: onTap,
          icon: Icon(Icons.notifications_outlined, size: 20, color: c.text),
          tooltip: tooltip,
        ),
        if (unread > 0)
          Positioned(
            right: 6,
            top: 6,
            child: Container(
              constraints: const BoxConstraints(minWidth: 14, minHeight: 14),
              padding: const EdgeInsets.symmetric(horizontal: 3),
              decoration: BoxDecoration(
                color: c.statusDanger,
                borderRadius: BorderRadius.circular(7),
                border: Border.all(color: c.bgElev, width: 1.5),
              ),
              alignment: Alignment.center,
              child: Text(
                '$unread',
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
      ],
    );
  }
}
