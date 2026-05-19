import 'package:flutter/material.dart';

import '../theme/colors.dart';
import '../theme/theme_context.dart';

/// 通知铃铛 + 未读 badge。
///
/// IconButton + Stack 覆盖 Positioned badge，统一 market / whale 等多页面顶栏的
/// 通知入口样式。未读数 >= 10 显示 `9+` 避免溢出 badge 容器。
class QzNotificationBell extends StatelessWidget {
  const QzNotificationBell({
    super.key,
    required this.unread,
    required this.onTap,
    required this.tooltip,
    this.iconKey,
  });

  /// 未读数量；<= 0 时不渲染 badge。
  final int unread;
  final VoidCallback onTap;
  final String tooltip;

  /// 为内部 IconButton 提供独立 key，便于 widget test 定位（避免 Stack 多子节点干扰）。
  final Key? iconKey;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final String label = unread > 9 ? '9+' : '$unread';
    return Stack(
      alignment: Alignment.center,
      children: <Widget>[
        IconButton(
          key: iconKey,
          onPressed: onTap,
          icon: Icon(Icons.notifications_outlined, size: 20, color: c.text),
          tooltip: tooltip,
        ),
        if (unread > 0)
          Positioned(
            right: 6,
            top: 6,
            child: Container(
              constraints: const BoxConstraints(minWidth: 14, minHeight: 14),
              padding: const EdgeInsets.symmetric(horizontal: 3),
              decoration: BoxDecoration(
                color: c.statusDanger,
                borderRadius: BorderRadius.circular(7),
                border: Border.all(color: c.bgElev, width: 1.5),
              ),
              alignment: Alignment.center,
              child: Text(
                label,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 9,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
      ],
    );
  }
}
