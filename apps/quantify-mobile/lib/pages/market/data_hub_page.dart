import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/mock/fixtures/whale_extras.dart';
import '../../data/models/whale_extra_models.dart';
import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../whale/widgets/whale_notification_sheet.dart';
import 'long_short_page.dart';
import 'market_home_page.dart';
import 'widgets/data_hub_header.dart';
import 'widgets/data_hub_placeholder.dart';

/// 「数据」hub 容器（issue #1851）。
///
/// 底栏 market tab 的落地页：统一 [DataHubHeader]（横滑 tab + 标题下拉 +
/// 通知铃铛）切换 5 个子屏，body 用 [IndexedStack] 保留各子屏状态。
///
/// 子屏：
/// - market → [MarketHomeBody]（行情数据）
/// - longShort → [LongShortBody]（多空比，hub 内可达，不再依赖手敲 URL）
/// - aggOrders / predict / coinStock → [DataHubPlaceholder]（占位，后续 issue 填充）
///
/// 通知状态（unread badge 真值来源）由本容器持有，复用 #1560 的
/// [WhaleNotificationSheet] 数据与弹层；header 铃铛点击打开通知中心。
///
/// IndexedStack 一次性构建全部子屏 → MarketHomeBody / LongShortBody 在 hub 挂载
/// 时即触发各自 mock 仓库加载。mock 数据廉价，接受 eager 构建（KISS），不引入
/// lazy 缓存复杂度。
class DataHubPage extends ConsumerStatefulWidget {
  const DataHubPage({super.key, this.initial = DataHubScreen.market});

  /// 初始选中的子屏。底栏 market tab 默认进 [DataHubScreen.market]；
  /// `/market/long-short` 深链传 [DataHubScreen.longShort] 预选多空比（#1853）。
  final DataHubScreen initial;

  @override
  ConsumerState<DataHubPage> createState() => _DataHubPageState();
}

class _DataHubPageState extends ConsumerState<DataHubPage> {
  late DataHubScreen _current;
  late List<WhaleNotification> _notifications;

  @override
  void initState() {
    super.initState();
    _current = widget.initial;
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
    setState(() => _notifications = result.notifications);
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final List<DataHubItem> items = DataHubHeader.items(l10n);
    return Scaffold(
      backgroundColor: c.bg,
      body: Column(
        children: <Widget>[
          DataHubHeader(
            current: _current,
            unread: _unreadCount,
            onSelect: (DataHubScreen screen) =>
                setState(() => _current = screen),
            onBell: _openNotifications,
          ),
          Expanded(
            child: IndexedStack(
              index: DataHubScreen.values.indexOf(_current),
              // children 顺序由 DataHubScreen.values 单一来源派生，杜绝 index 与
              // 手写列表的隐式排序耦合（重排枚举不会静默错位）。
              children: <Widget>[
                for (final DataHubScreen screen in DataHubScreen.values)
                  _bodyFor(screen, items),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _bodyFor(DataHubScreen screen, List<DataHubItem> items) {
    switch (screen) {
      case DataHubScreen.market:
        return const MarketHomeBody();
      case DataHubScreen.longShort:
        return const LongShortBody();
      case DataHubScreen.aggOrders:
      case DataHubScreen.predict:
      case DataHubScreen.coinStock:
        return DataHubPlaceholder(label: _labelFor(items, screen));
    }
  }

  String _labelFor(List<DataHubItem> items, DataHubScreen screen) =>
      items.firstWhere((DataHubItem i) => i.screen == screen).label;
}
