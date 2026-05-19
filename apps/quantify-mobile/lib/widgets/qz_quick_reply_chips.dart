import 'package:flutter/material.dart';

import '../theme/colors.dart';
import '../theme/theme_context.dart';
import '../theme/tokens.dart';

/// AI 输入框上方的快捷回复 chips 水平滚动条（#1557）。
///
/// 点击任一 chip 触发 `onTap(label)`；调用方负责把文本塞进输入框或直接发送。
/// 对齐原型：高度 28px、accent soft 背景、accent 主色文字、圆角 999、12sp。
class QzQuickReplyChips extends StatelessWidget {
  const QzQuickReplyChips({
    super.key,
    required this.labels,
    required this.onTap,
  });

  final List<String> labels;
  final ValueChanged<String> onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return SizedBox(
      height: 36,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        padding: const EdgeInsets.symmetric(horizontal: QzSpacing.lg),
        itemCount: labels.length,
        separatorBuilder: (BuildContext _, int _) =>
            const SizedBox(width: QzSpacing.xs),
        itemBuilder: (BuildContext ctx, int i) {
          final String label = labels[i];
          return InkWell(
            key: Key('ai-quick-reply-$i'),
            onTap: () => onTap(label),
            borderRadius: BorderRadius.circular(QzRadii.pill),
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: QzSpacing.md,
                vertical: QzSpacing.xs,
              ),
              decoration: BoxDecoration(
                color: c.accentSoft,
                borderRadius: BorderRadius.circular(QzRadii.pill),
              ),
              alignment: Alignment.center,
              child: Text(
                label,
                style: TextStyle(
                  color: c.accent,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
