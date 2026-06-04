import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../../data/models/whale_profile_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
part 'whale_trade_stats_sheet.cards.part.dart';
part 'whale_trade_stats_sheet.perf.part.dart';

/// 交易统计弹窗（issue #1859）。
///
/// 设计真源：`design/project/mobile/m-screens-whale-discover.jsx` 的
/// `WhaleTradeStats`（`:2183`）。底部上滑 modal：地址 chip + 周期 PillSelect →
/// 胜率卡 + 交易次数环图卡 → 「按资产 / 按仓位」双子 tab + PerfRow 列表。
///
/// 入参与 [WhaleProfile] 解耦（只收 address + stats + 可选头像），便于发现 tab
/// 卡片入口（#1860）独立唤起，不必持有完整 profile。
class WhaleTradeStatsSheet extends StatefulWidget {
  const WhaleTradeStatsSheet({
    super.key,
    required this.address,
    required this.stats,
    this.avatarGlyph,
    this.avatarColorHex,
  });

  final String address;
  final WhaleTradeStats stats;
  final String? avatarGlyph;
  final int? avatarColorHex;

  static Future<void> show(
    BuildContext context, {
    required String address,
    required WhaleTradeStats stats,
    String? avatarGlyph,
    int? avatarColorHex,
  }) {
    final QzColorScheme c = context.qzScheme;
    return showModalBottomSheet<void>(
      context: context,
      useRootNavigator: true,
      isDismissible: true,
      isScrollControlled: true,
      backgroundColor: c.bg,
      barrierColor: c.scrim,
      sheetAnimationStyle: const AnimationStyle(
        curve: QzCurves.sheetPanel,
        duration: QzCurves.sheetPanelDuration,
        reverseCurve: QzCurves.sheetPanel,
        reverseDuration: QzCurves.sheetPanelDuration,
      ),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
      ),
      builder: (BuildContext ctx) {
        return WhaleTradeStatsSheet(
          address: address,
          stats: stats,
          avatarGlyph: avatarGlyph,
          avatarColorHex: avatarColorHex,
        );
      },
    );
  }

  @override
  State<WhaleTradeStatsSheet> createState() => _WhaleTradeStatsSheetState();
}

enum _Period { day, week, month, all }

enum _PerfTab { asset, position }

class _WhaleTradeStatsSheetState extends State<WhaleTradeStatsSheet> {
  _Period _period = _Period.week;
  _PerfTab _tab = _PerfTab.asset;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final WhaleTradeStats s = widget.stats;
    final Size viewport = MediaQuery.sizeOf(context);
    final double keyboardInset = MediaQuery.viewInsetsOf(context).bottom;
    final double panelHeight = viewport.height * 0.88;

    return SizedBox(
      height: panelHeight,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          _Header(
            title: l10n.whaleTradeStatsTitle,
            onClose: () {
              Navigator.of(context).pop();
            },
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
            child: Row(
              children: <Widget>[
                Flexible(
                  child: _AddressChip(
                    address: widget.address,
                    glyph: widget.avatarGlyph,
                    colorHex: widget.avatarColorHex,
                  ),
                ),
                const Spacer(),
                const SizedBox(width: 8),
                _PeriodSelect(
                  value: _period,
                  onChanged: (_Period p) => setState(() => _period = p),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  Expanded(child: _WinRateCard(stats: s)),
                  const SizedBox(width: 8),
                  Expanded(child: _TradeCountCard(stats: s)),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(
              QzSpacing.lg,
              QzSpacing.lg,
              QzSpacing.lg,
              0,
            ),
            child: Text(
              l10n.whaleTradeStatsPerfTitle,
              style: TextStyle(
                color: c.text,
                fontSize: 14,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          _PerfTabs(
            value: _tab,
            onChanged: (_PerfTab t) => setState(() => _tab = t),
          ),
          Expanded(
            child: SingleChildScrollView(
              padding: EdgeInsets.only(bottom: math.max(20, keyboardInset)),
              child: _PerfList(stats: s, tab: _tab),
            ),
          ),
        ],
      ),
    );
  }
}

