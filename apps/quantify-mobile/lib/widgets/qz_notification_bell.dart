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
    this.circular = false,
    this.bordered = true,
  });

  /// 未读数量；<= 0 时不渲染 badge。
  final int unread;
  final VoidCallback onTap;
  final String tooltip;

  /// 为内部 IconButton 提供独立 key，便于 widget test 定位（避免 Stack 多子节点干扰）。
  final Key? iconKey;

  /// 渲染为设计稿中 36x36 带描边的圆形按钮（market 行情页样式）。默认为普通 IconButton，
  /// 沿用 whale / strategy 等页面的低强度顶栏样式。
  final bool circular;

  /// 圆形变体是否带描边/填充背景。默认 true = market 行情页样式（c.bgElev 填充 + c.border 描边）；
  /// false = 设计稿巨鲸顶栏样式（透明、无边框）。仅在 circular 为 true 时生效。
  final bool bordered;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final String label = unread > 9 ? '9+' : '$unread';
    final Widget button = circular
        ? SizedBox(
            width: 36,
            height: 36,
            child: DecoratedBox(
              decoration: BoxDecoration(
                color: bordered ? c.bgElev : Colors.transparent,
                shape: BoxShape.circle,
                border: bordered ? Border.all(color: c.border) : null,
              ),
              child: IconButton(
                key: iconKey,
                onPressed: onTap,
                padding: EdgeInsets.zero,
                iconSize: 18,
                splashRadius: 18,
                tooltip: tooltip,
                constraints: const BoxConstraints(
                  minWidth: 36,
                  minHeight: 36,
                  maxWidth: 36,
                  maxHeight: 36,
                ),
                icon: Icon(
                  Icons.notifications_outlined,
                  color: c.textMid,
                ),
              ),
            ),
          )
        : IconButton(
            key: iconKey,
            onPressed: onTap,
            icon: Icon(Icons.notifications_outlined, size: 20, color: c.text),
            tooltip: tooltip,
          );
    return Stack(
      alignment: Alignment.center,
      children: <Widget>[
        button,
        if (unread > 0)
          Positioned(
            right: 6,
            top: 6,
            child: IgnorePointer(
              child: Container(
                constraints:
                    const BoxConstraints(minWidth: 14, minHeight: 14),
                padding: const EdgeInsets.symmetric(horizontal: 3),
                decoration: BoxDecoration(
                  color: c.badgeNotification,
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
          ),
      ],
    );
  }
}
