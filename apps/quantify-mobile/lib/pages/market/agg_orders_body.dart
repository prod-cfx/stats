import 'package:flutter/material.dart';

import '../../l10n/app_localizations.dart';
import '../../theme/colors.dart';
import '../../theme/theme_context.dart';
import '../../theme/tokens.dart';
import 'widgets/agg_open_interest_tab.dart';
import 'widgets/agg_orderbook_card.dart';
import 'widgets/agg_volume_tab.dart';

/// 聚合挂单 hub 子屏（设计稿 `ScreenAggOrders`:301）。
///
/// 顶部 3 段 segment 切换：聚合挂单 / 聚合持仓量 / 聚合成交量；body 用
/// [IndexedStack] 保留各子屏状态。无 Scaffold / header（由 [DataHubPage] 提供）。
class AggOrdersBody extends StatefulWidget {
  const AggOrdersBody({super.key});

  @override
  State<AggOrdersBody> createState() => _AggOrdersBodyState();
}

enum _AggSubTab { orders, openInterest, volume }

class _AggOrdersBodyState extends State<AggOrdersBody> {
  _AggSubTab _tab = _AggSubTab.orders;

  String _label(_AggSubTab t, AppLocalizations l10n) {
    switch (t) {
      case _AggSubTab.orders:
        return l10n.aggSubTabOrders;
      case _AggSubTab.openInterest:
        return l10n.aggSubTabOpenInterest;
      case _AggSubTab.volume:
        return l10n.aggSubTabVolume;
    }
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
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
                for (final _AggSubTab t in _AggSubTab.values)
                  Expanded(
                    child: GestureDetector(
                      key: Key('agg-subtab-${t.name}'),
                      onTap: () => setState(() => _tab = t),
                      child: Container(
                        height: 32,
                        alignment: Alignment.center,
                        decoration: BoxDecoration(
                          color:
                              t == _tab ? c.bgElev : Colors.transparent,
                          borderRadius: BorderRadius.circular(8),
                          // 选中段轻阴影（对齐设计稿 :357 的 rgba(15,23,42,.06)，
                          // 替代原 border）。
                          boxShadow: t == _tab
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
                            color: t == _tab ? c.text : c.textMid,
                            fontSize: 11.5,
                            fontWeight:
                                t == _tab ? FontWeight.w600 : FontWeight.w500,
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
            index: _AggSubTab.values.indexOf(_tab),
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
