import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/models/whale_extra_models.dart';
import '../../data/whale_notifications_notifier.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../widgets/qz_notification_bell.dart';
import 'tabs/whale_discover_tab.dart';
import 'tabs/whale_holdings_tab.dart';
import 'tabs/whale_live_tab.dart';
import 'tabs/whale_watch_tab.dart';
import 'whale_home_page_controller.dart';
import 'widgets/whale_notification_sheet.dart';

/// 巨鲸动向首页（issue #1560 / 三件套迁移 #2183）。
///
/// 单行合并 header（issue #2012）：左侧 4 个二级 tab strip + 右侧通知铃铛，
/// 对齐设计稿 `m-screens-4.jsx` ScreenWhale header（无标题/副标题/搜索）。
/// tab 切换走 IndexedStack 保留各 tab 滚动/订阅状态。页面级导航态收敛进
/// [whaleHomePageControllerProvider]，widget 退化为纯消费层。
class WhaleHomePage extends ConsumerWidget {
  const WhaleHomePage({super.key});

  /// issue #1769：通知中心改为单一数据源 [whaleNotificationsProvider]，
  /// 铃铛 panel 与监控 Tab「通知中心」子 Tab 共享同一份列表/已读态。
  Future<void> _openNotifications(BuildContext context, WidgetRef ref) async {
    final List<WhaleNotification> current = ref.read(
      whaleNotificationsProvider,
    );
    final WhaleNotificationSheetResult? result =
        await WhaleNotificationSheet.show(context, notifications: current);
    if (!context.mounted || result == null) return;
    ref
        .read(whaleNotificationsProvider.notifier)
        .replaceAll(result.notifications);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final int tabIndex = ref.watch(whaleHomePageControllerProvider).tabIndex;
    final int unreadCount = ref.watch(whaleUnreadCountProvider);
    final List<({String label})> tabs = <({String label})>[
      (label: l10n.whaleTabDiscover),
      (label: l10n.whaleTabLive),
      (label: l10n.whaleTabHoldings),
      (label: l10n.whaleTabWatch),
    ];
    return Scaffold(
      backgroundColor: c.bg,
      body: Column(
        children: <Widget>[
          // 单行合并 header：tab strip（flex:1）+ 右侧铃铛，对齐设计稿
          // m-screens-4.jsx:393-454。bg=elev、底边 1px border、顶部避让状态栏。
          DecoratedBox(
            decoration: BoxDecoration(
              color: c.bgElev,
              border: Border(bottom: BorderSide(color: c.border)),
            ),
            child: SafeArea(
              bottom: false,
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: <Widget>[
                  Expanded(
                    child: Padding(
                      padding: const EdgeInsets.only(left: 16),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.end,
                        children: <Widget>[
                          for (int i = 0; i < tabs.length; i++) ...<Widget>[
                            _SubTab(
                              key: Key('whaleSubTab_$i'),
                              label: tabs[i].label,
                              selected: tabIndex == i,
                              onTap: () => ref
                                  .read(whaleHomePageControllerProvider.notifier)
                                  .selectTab(i),
                            ),
                            if (i < tabs.length - 1) const SizedBox(width: 20),
                          ],
                        ],
                      ),
                    ),
                  ),
                  Padding(
                    padding: const EdgeInsets.fromLTRB(6, 0, 14, 4),
                    child: QzNotificationBell(
                      unread: unreadCount,
                      onTap: () => _openNotifications(context, ref),
                      tooltip: l10n.whaleNotificationTooltip,
                      circular: true,
                      bordered: false,
                    ),
                  ),
                ],
              ),
            ),
          ),
          Expanded(
            child: IndexedStack(
              index: tabIndex,
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
    super.key,
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
    // 设计稿 m-screens-4.jsx:406-420：tab 上内边距 12、文字下方 10px 处为
    // 2px 下划线（选中 violet，未选透明）；选中 w600/text，未选 w400/textMid。
    return GestureDetector(
      onTap: onTap,
      behavior: HitTestBehavior.opaque,
      child: Padding(
        padding: const EdgeInsets.only(top: 12),
        child: IntrinsicWidth(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(
                textAlign: TextAlign.center,
                label,
                style: TextStyle(
                  color: selected ? c.text : c.textMid,
                  fontSize: 14,
                  fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                ),
              ),
              const SizedBox(height: 10),
              Container(
                height: 2,
                decoration: BoxDecoration(
                  color: selected ? c.accent : Colors.transparent,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
