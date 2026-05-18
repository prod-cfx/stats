import 'package:flutter/material.dart';

import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 单格收益指标。
///
/// 渲染 label + value 两行；当 [emphasis] = `up|down` 时数值染色（涨绿跌红，
/// 与 marketUp/marketDown 一致），中性不染色避免视觉噪声。
enum QzMetricEmphasis { neutral, up, down }

class StrategyMetricCard extends StatelessWidget {
  const StrategyMetricCard({
    super.key,
    required this.label,
    required this.value,
    this.emphasis = QzMetricEmphasis.neutral,
  });

  final String label;
  final String value;
  final QzMetricEmphasis emphasis;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color valueColor;
    switch (emphasis) {
      case QzMetricEmphasis.up:
        valueColor = c.marketUp;
        break;
      case QzMetricEmphasis.down:
        valueColor = c.marketDown;
        break;
      case QzMetricEmphasis.neutral:
        valueColor = c.text;
        break;
    }
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.md,
        vertical: QzSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: c.bgSoft,
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(
            label,
            style: TextStyle(color: c.textDim, fontSize: 12),
          ),
          const SizedBox(height: QzSpacing.xxs),
          Text(
            value,
            style: TextStyle(
              color: valueColor,
              fontSize: 18,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }
}
