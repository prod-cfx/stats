import 'package:flutter/material.dart';

import '../../../data/models/strategy_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 单条历史信号行：[时间] [方向 Pill] [价格] [盈亏%]。
///
/// 方向 buy = 绿，sell = 红；盈亏正数 marketUp，负数 marketDown。
class StrategySignalTile extends StatelessWidget {
  const StrategySignalTile({super.key, required this.signal});

  final StrategySignal signal;

  String _fmtTime(DateTime t) {
    final String mm = t.minute.toString().padLeft(2, '0');
    final String hh = t.hour.toString().padLeft(2, '0');
    final String mo = t.month.toString().padLeft(2, '0');
    final String d = t.day.toString().padLeft(2, '0');
    return '$mo-$d $hh:$mm';
  }

  String _fmtPrice(double p) {
    if (p >= 1000) return p.toStringAsFixed(0);
    if (p >= 10) return p.toStringAsFixed(2);
    return p.toStringAsFixed(4);
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final bool buy = signal.side == StrategySignalSide.buy;
    final Color sideColor = buy ? c.marketUp : c.marketDown;
    final Color pnlColor =
        signal.pnlPercent >= 0 ? c.marketUp : c.marketDown;
    final String pnlText =
        '${signal.pnlPercent >= 0 ? '+' : ''}${signal.pnlPercent.toStringAsFixed(2)}%';
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.lg,
        vertical: QzSpacing.sm,
      ),
      child: Row(
        children: <Widget>[
          SizedBox(
            width: 88,
            child: Text(
              _fmtTime(signal.time),
              style: TextStyle(color: c.textDim, fontSize: 12),
            ),
          ),
          const SizedBox(width: QzSpacing.sm),
          Container(
            padding: const EdgeInsets.symmetric(
              horizontal: QzSpacing.sm,
              vertical: 2,
            ),
            decoration: BoxDecoration(
              color: sideColor.withValues(alpha: 0.14),
              borderRadius: BorderRadius.circular(QzRadii.pill),
            ),
            child: Text(
              buy ? l10n.strategySignalBuy : l10n.strategySignalSell,
              style: TextStyle(
                color: sideColor,
                fontSize: 12,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(width: QzSpacing.md),
          Expanded(
            child: Text(
              _fmtPrice(signal.price),
              style: TextStyle(
                color: c.text,
                fontSize: 13,
                fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
              ),
            ),
          ),
          Text(
            pnlText,
            style: TextStyle(
              color: pnlColor,
              fontSize: 13,
              fontWeight: FontWeight.w600,
              fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}
