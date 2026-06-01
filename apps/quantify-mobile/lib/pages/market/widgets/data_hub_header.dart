import 'package:flutter/material.dart';

import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_notification_bell.dart';

/// 「数据」hub 的 5 个子屏。
///
/// 与设计稿 `m-screens-data.jsx` 的 `DATA_HUB_ITEMS` key 对齐：
/// market / ls / aggord / predict / cstock。tab Key 统一用
/// `data-hub-tab-<enum.name>`，供 widget test 定位。
enum DataHubScreen { market, longShort, aggOrders, predict, coinStock }

/// 单个子屏的展示元数据。
///
/// `label` 用于 tab 条；`hint` 为保留字段（与设计稿 `DATA_HUB_ITEMS`
/// 数据模型对齐，#1921 收敛掉下拉后当前无消费方，不做破坏性删除）。
class DataHubItem {
  const DataHubItem({
    required this.screen,
    required this.label,
    required this.hint,
  });

  final DataHubScreen screen;
  final String label;
  final String hint;
}

/// 「数据」hub 顶部统一 header（设计稿 `DataHubHeader`）。
///
/// 单行结构：横向可滑动 tab 条（5 项，选中态 accent 下划线）`Expanded` 占满
/// 左侧，右侧通知铃铛（复用 [QzNotificationBell]，未读 > 0 显示红 badge）贴右
/// 垂直居中。无独立「数据」标题。通过 [onSelect] 切换 [current]。
///
/// 决策（#2016）：设计稿 `DataHubHeader` 为单行（tab 条 + 铃铛同行），不含静态
/// 标题。所有 5 个子屏统一形态、无按屏特例分支。
class DataHubHeader extends StatelessWidget {
  const DataHubHeader({
    super.key,
    required this.current,
    required this.unread,
    required this.onSelect,
    required this.onBell,
  });

  final DataHubScreen current;
  final int unread;
  final ValueChanged<DataHubScreen> onSelect;
  final VoidCallback onBell;

  static List<DataHubItem> items(AppLocalizations l10n) => <DataHubItem>[
        DataHubItem(
          screen: DataHubScreen.market,
          label: l10n.dataHubTabMarket,
          hint: l10n.dataHubHintMarket,
        ),
        DataHubItem(
          screen: DataHubScreen.longShort,
          label: l10n.dataHubTabLongShort,
          hint: l10n.dataHubHintLongShort,
        ),
        DataHubItem(
          screen: DataHubScreen.aggOrders,
          label: l10n.dataHubTabAggOrders,
          hint: l10n.dataHubHintAggOrders,
        ),
        DataHubItem(
          screen: DataHubScreen.predict,
          label: l10n.dataHubTabPredict,
          hint: l10n.dataHubHintPredict,
        ),
        DataHubItem(
          screen: DataHubScreen.coinStock,
          label: l10n.dataHubTabCoinStock,
          hint: l10n.dataHubHintCoinStock,
        ),
      ];

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final List<DataHubItem> list = items(l10n);

    return Material(
      color: c.bgElev,
      child: SafeArea(
        top: true,
        bottom: false,
        child: DecoratedBox(
          decoration: BoxDecoration(
            border: Border(bottom: BorderSide(color: c.border)),
          ),
          child: Row(
            children: <Widget>[
              Expanded(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.only(left: QzSpacing.lg),
                  child: Row(
                    children: <Widget>[
                      for (final DataHubItem item in list)
                        _HubTab(
                          key: Key('data-hub-tab-${item.screen.name}'),
                          label: item.label,
                          selected: item.screen == current,
                          onTap: () => onSelect(item.screen),
                        ),
                    ],
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(left: QzSpacing.xs, right: 14),
                child: QzNotificationBell(
                  iconKey: const Key('data-hub-notification-bell'),
                  unread: unread,
                  onTap: onBell,
                  tooltip: l10n.dataHubNotificationTooltip,
                  circular: true,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 横滑 tab 条单项：选中态 accent 下划线（2px）。
class _HubTab extends StatelessWidget {
  const _HubTab({
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
    return Semantics(
      label: label,
      button: true,
      selected: selected,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(8, 12, 8, 0),
          child: IntrinsicWidth(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: <Widget>[
                Text(
                  label,
                  textAlign: TextAlign.center,
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
      ),
    );
  }
}
