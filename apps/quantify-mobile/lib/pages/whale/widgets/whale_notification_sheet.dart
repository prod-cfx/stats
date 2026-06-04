import 'package:flutter/material.dart';

import '../../../data/models/whale_extra_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
part 'whale_notification_sheet.header.part.dart';
part 'whale_notification_sheet.rows.part.dart';

/// 通知中心 sheet 返回值：刷新后的通知列表（包含 unread 状态）。
class WhaleNotificationSheetResult {
  const WhaleNotificationSheetResult(this.notifications);
  final List<WhaleNotification> notifications;
}

/// 通知中心顶部下滑 panel（issue #1644）。
///
/// 设计稿 `design/project/mobile/m-screens-4.jsx` 的 `WhaleNotifPanel`：
/// 从顶部下滑、底部圆角、maxHeight ≈ 78%、scrim 点击关闭，
/// 内部包含 header（标题 + 未读 badge + subtitle + 全部已读 + 关闭）、
/// 横向 tabs（带每类数量）、列表（kind 圆形 icon + unread 底色 + dot）、
/// footer（24h 提示 + 通知设置入口）。
///
/// 通过 [showGeneralDialog] 路由，避免复用底部 `QzSheet`。
class WhaleNotificationSheet extends StatefulWidget {
  const WhaleNotificationSheet({super.key, required this.initial});

  final List<WhaleNotification> initial;

  static Future<WhaleNotificationSheetResult?> show(
    BuildContext context, {
    required List<WhaleNotification> notifications,
  }) {
    final Color scrim = context.qzScheme.scrim;
    return showGeneralDialog<WhaleNotificationSheetResult>(
      context: context,
      barrierDismissible: true,
      barrierLabel: MaterialLocalizations.of(context).modalBarrierDismissLabel,
      barrierColor: scrim,
      transitionDuration: const Duration(milliseconds: 320),
      pageBuilder:
          (BuildContext ctx, Animation<double> a1, Animation<double> a2) {
            return _PanelHost(
              child: WhaleNotificationSheet(initial: notifications),
            );
          },
      transitionBuilder:
          (
            BuildContext ctx,
            Animation<double> a1,
            Animation<double> a2,
            Widget child,
          ) {
            final Animation<Offset> slide = Tween<Offset>(
              begin: const Offset(0, -0.12),
              end: Offset.zero,
            ).animate(CurvedAnimation(parent: a1, curve: Curves.easeOutCubic));
            return FadeTransition(
              opacity: a1,
              child: SlideTransition(position: slide, child: child),
            );
          },
    );
  }

  @override
  State<WhaleNotificationSheet> createState() => _WhaleNotificationSheetState();
}

