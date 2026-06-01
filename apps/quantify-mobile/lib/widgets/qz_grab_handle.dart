import 'package:flutter/material.dart';

import '../theme/colors.dart';
import '../theme/theme_context.dart';

/// 底部抽屉顶部 42×4 拖拽条（对齐设计稿各 drawer grab handle）。
///
/// 居中显示，默认上下留白对齐设计稿 `margin:'10px auto 14px'`，可按需用
/// [margin] 覆盖。用于走原生 `showModalBottomSheet`（非 [QzSheet]）的抽屉，
/// [QzSheet] 已自带 handle。
class QzGrabHandle extends StatelessWidget {
  const QzGrabHandle({
    super.key,
    this.margin = const EdgeInsets.fromLTRB(0, 10, 0, 14),
  });

  final EdgeInsetsGeometry margin;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Center(
      child: Container(
        width: 42,
        height: 4,
        margin: margin,
        decoration: BoxDecoration(
          color: c.border,
          borderRadius: BorderRadius.circular(2),
        ),
      ),
    );
  }
}
