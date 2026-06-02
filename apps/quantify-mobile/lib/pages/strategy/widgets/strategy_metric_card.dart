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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          label.toUpperCase(),
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            color: c.textDim,
            fontSize: 10,
            letterSpacing: 0.4,
          ),
        ),
        const SizedBox(height: QzSpacing.xxs),
        Text(
          value,
          style: TextStyle(
            color: valueColor,
            fontSize: 16,
            fontWeight: FontWeight.w700,
            fontFamily: QzFont.mono,
            fontFamilyFallback: QzFont.monoFallback,
          ),
        ),
      ],
    );
  }
}
