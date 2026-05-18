import 'package:flutter/material.dart';

import '../../theme/colors.dart';
import '../../theme/theme_context.dart';

/// 占位详情页。本期只展示 id；后续 issue 接入策略详情接口。
class StrategyDetailPage extends StatelessWidget {
  const StrategyDetailPage({super.key, required this.id});

  final String id;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Scaffold(
      appBar: AppBar(title: const Text('策略详情')),
      body: Center(
        child: Text(
          '策略 #$id（占位）',
          style: TextStyle(color: c.textMid, fontSize: 14),
        ),
      ),
    );
  }
}
