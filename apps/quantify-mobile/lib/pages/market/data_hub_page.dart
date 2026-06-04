import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../whale/widgets/whale_notification_sheet.dart';
import 'agg_orders_body.dart';
import 'coin_stock_body.dart';
import 'data_hub_page_controller.dart';
import 'data_hub_page_state.dart';
import 'long_short_page.dart';
import 'market_home_page.dart';
import 'pred_market_body.dart';
import 'widgets/data_hub_header.dart';

/// 「数据」hub 容器（issue #1851）。
///
/// 底栏 market tab 的落地页：统一 [DataHubHeader]（横滑 tab + 标题下拉 +
/// 通知铃铛）切换 5 个子屏，body 用 [IndexedStack] 保留各子屏状态。
///
/// 子屏：
/// - market → [MarketHomeBody]（行情数据）
/// - longShort → [LongShortBody]（多空比，hub 内可达，不再依赖手敲 URL）
/// - aggOrders → [AggOrdersBody]（聚合挂单/持仓量/成交量，#1854）
/// - predict → [PredMarketBody]（预测市场，#1855）
/// - coinStock → [CoinStockBody]（币股，#1856）
///
/// 通知状态（unread badge 真值来源）由本容器持有，复用 #1560 的
/// [WhaleNotificationSheet] 数据与弹层；header 铃铛点击打开通知中心。
///
/// IndexedStack 一次性构建全部子屏 → MarketHomeBody / LongShortBody 在 hub 挂载
/// 时即触发各自 mock 仓库加载。mock 数据廉价，接受 eager 构建（KISS），不引入
/// lazy 缓存复杂度。
class DataHubPage extends ConsumerWidget {
  const DataHubPage({super.key, this.initial = DataHubScreen.market});

  /// 初始选中的子屏。底栏 market tab 默认进 [DataHubScreen.market]；
  /// `/market/long-short` 深链传 [DataHubScreen.longShort] 预选多空比（#1853）。
  final DataHubScreen initial;

  Future<void> _openNotifications(BuildContext context, WidgetRef ref) async {
    final DataHubState s = ref.read(dataHubControllerProvider(initial));
    final WhaleNotificationSheetResult? result =
        await WhaleNotificationSheet.show(
      context,
      notifications: s.notifications,
    );
    if (result == null) return;
    ref
        .read(dataHubControllerProvider(initial).notifier)
        .setNotifications(result.notifications);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final QzColorScheme c = context.qzScheme;
    final DataHubState s = ref.watch(dataHubControllerProvider(initial));
    return Scaffold(
      backgroundColor: c.bg,
      body: Column(
        children: <Widget>[
          DataHubHeader(
            current: s.current,
            unread: s.unreadCount,
            onSelect: (DataHubScreen screen) => ref
                .read(dataHubControllerProvider(initial).notifier)
                .select(screen),
            onBell: () => _openNotifications(context, ref),
          ),
          Expanded(
            child: IndexedStack(
              index: DataHubScreen.values.indexOf(s.current),
              // children 顺序由 DataHubScreen.values 单一来源派生，杜绝 index 与
              // 手写列表的隐式排序耦合（重排枚举不会静默错位）。
              children: <Widget>[
                for (final DataHubScreen screen in DataHubScreen.values)
                  _bodyFor(screen),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _bodyFor(DataHubScreen screen) {
    switch (screen) {
      case DataHubScreen.market:
        return const MarketHomeBody();
      case DataHubScreen.longShort:
        return const LongShortBody();
      case DataHubScreen.aggOrders:
        return const AggOrdersBody();
      case DataHubScreen.predict:
        return const PredMarketBody();
      case DataHubScreen.coinStock:
        return const CoinStockBody();
    }
  }
}
