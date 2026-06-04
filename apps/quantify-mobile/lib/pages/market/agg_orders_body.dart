import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import 'agg_orders_body_controller.dart';
import 'agg_orders_body_state.dart';
import 'widgets/agg_open_interest_tab.dart';
import 'widgets/agg_orderbook_card.dart';
import 'widgets/agg_volume_tab.dart';

/// 聚合挂单 hub 子屏（设计稿 `ScreenAggOrders`:301）。
///
/// 顶部 3 段 segment 切换：聚合挂单 / 聚合持仓量 / 聚合成交量；body 用
/// [IndexedStack] 保留各子屏状态。无 Scaffold / header（由 [DataHubPage] 提供）。
/// 页面级 segment 态由 [AggOrdersController] 持有（issue #2184）。
class AggOrdersBody extends ConsumerWidget {
  const AggOrdersBody({super.key});

  String _label(AggSubTab t, AppLocalizations l10n) {
    switch (t) {
      case AggSubTab.orders:
        return l10n.aggSubTabOrders;
      case AggSubTab.openInterest:
        return l10n.aggSubTabOpenInterest;
      case AggSubTab.volume:
        return l10n.aggSubTabVolume;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final AggSubTab tab = ref.watch(
      aggOrdersControllerProvider.select((AggOrdersState s) => s.tab),
    );
    final AggOrdersController controller = ref.read(
      aggOrdersControllerProvider.notifier,
    );
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: <Widget>[
        Padding(
          padding: const EdgeInsets.fromLTRB(
              QzSpacing.lg, QzSpacing.sm + 2, QzSpacing.lg, QzSpacing.xs),
          child: Container(
            padding: const EdgeInsets.all(3),
            decoration: BoxDecoration(
              color: c.bgSoft,
              borderRadius: BorderRadius.circular(QzRadii.input),
              border: Border.all(color: c.borderSoft),
            ),
            child: Row(
              children: <Widget>[
                for (final AggSubTab t in AggSubTab.values)
                  Expanded(
                    child: GestureDetector(
                      key: Key('agg-subtab-${t.name}'),
                      onTap: () => controller.selectTab(t),
                      child: Container(
                        height: 32,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color:
                              t == tab ? c.bgElev : Colors.transparent,
                          borderRadius: BorderRadius.circular(8),
                          // 选中段轻阴影（对齐设计稿 :357 的 rgba(15,23,42,.06)，
                          // 替代原 border）。
                          boxShadow: t == tab
                              ? const <BoxShadow>[
                                  BoxShadow(
                                    color: Color(0x0F0F1723),
                                    blurRadius: 2,
                                    offset: Offset(0, 1),
                                  ),
                                ]
                              : null,
                        ),
                        child: Text(
                          _label(t, l10n),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: t == tab ? c.text : c.textMid,
                            fontSize: 11.5,
                            fontWeight:
                                t == tab ? FontWeight.w600 : FontWeight.w500,
                          ),
                        ),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        Expanded(
          child: IndexedStack(
            index: AggSubTab.values.indexOf(tab),
            children: const <Widget>[
              AggOrderbookCard(),
              AggOpenInterestTab(),
              AggVolumeTab(),
            ],
          ),
        ),
      ],
    );
  }
}
