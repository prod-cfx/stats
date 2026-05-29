import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/mock/fixtures/whale_extras.dart';
import '../../data/models/whale_extra_models.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import '../../widgets/qz_notification_bell.dart';
import '../../widgets/qz_top_bar.dart';
import 'tabs/whale_discover_tab.dart';
import 'tabs/whale_holdings_tab.dart';
import 'tabs/whale_live_tab.dart';
import 'tabs/whale_watch_tab.dart';
import 'widgets/whale_notification_sheet.dart';
import 'widgets/whale_search_sheet.dart';

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
          _CircularIconAction(
            icon: Icons.search,
            tooltip: l10n.whaleSearchTooltip,
            // #1754：搜索能力落地，点击打开搜索 sheet（解除 #1651 暂缓）。
            onTap: () => WhaleSearchSheet.show(context),
          ),
          const SizedBox(width: QzSpacing.xs),
          QzNotificationBell(
            unread: _unreadCount,
            onTap: _openNotifications,
            tooltip: l10n.whaleNotificationTooltip,
            circular: true,
          ),
          const SizedBox(width: QzSpacing.md),
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

/// 36x36 soft/elevated 圆形按钮，对齐设计稿 `iconBtn`
/// (`design/project/mobile/m-screens-3.jsx:277`)。
class _CircularIconAction extends StatelessWidget {
  const _CircularIconAction({
    required this.icon,
    required this.tooltip,
    required this.onTap,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return SizedBox(
      width: 36,
      height: 36,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: c.bgElev,
          shape: BoxShape.circle,
          border: Border.all(color: c.border),
        ),
        child: IconButton(
          onPressed: onTap,
          padding: EdgeInsets.zero,
          iconSize: 18,
          splashRadius: 18,
          tooltip: tooltip,
          constraints: const BoxConstraints(
            minWidth: 36,
            minHeight: 36,
            maxWidth: 36,
            maxHeight: 36,
          ),
          icon: Icon(icon, color: c.textMid),
        ),
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

