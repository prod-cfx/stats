import 'package:flutter/material.dart';

import '../theme/colors.dart';
import '../theme/theme_context.dart';
import '../theme/tokens.dart';
import 'qz_card.dart';
import 'qz_segmented_tabs.dart';

class QzKlinePlaceholder extends StatelessWidget {
  const QzKlinePlaceholder({
    super.key,
    required this.value,
    required this.onChanged,
  });

  static const List<String> intervals = <String>[
    '1m',
    '5m',
    '15m',
    '1h',
    '4h',
    '1d',
  ];

  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return QzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          QzSegmentedTabs(
            options: intervals,
            value: value,
            onChanged: onChanged,
          ),
          const SizedBox(height: QzSpacing.md),
          Container(
            height: 220,
            decoration: BoxDecoration(
              color: c.bgSoft,
              borderRadius: BorderRadius.circular(QzRadii.card),
            ),
            alignment: Alignment.center,
            child: Text(
              'K 线开发中',
              style: TextStyle(
                color: c.textDim,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
