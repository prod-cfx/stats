import 'package:flutter/material.dart';

import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 「我的」页面的分组小标题（账户 / 交易所 API / 偏好）。
///
/// 原型 `m-screens-4.jsx:1052` —— UPPERCASE，letterSpacing 0.6，dim 文字色。
class QzSectionTitle extends StatelessWidget {
  const QzSectionTitle({super.key, required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.xxs,
        QzSpacing.xl,
        QzSpacing.xxs,
        QzSpacing.sm + 2,
      ),
      child: Text(
        text,
        style: TextStyle(
          color: c.textDim,
          fontSize: 12,
          fontWeight: FontWeight.w600,
          letterSpacing: 0.6,
        ),
      ),
    );
  }
}
