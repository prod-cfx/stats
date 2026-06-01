import 'package:flutter/material.dart';

import '../theme/colors.dart';
import '../theme/theme_context.dart';
import '../theme/tokens.dart';
import 'qz_glyph_icon.dart';

/// AI 量化首页顶栏（设计稿 `MTopBar compact`）。
///
/// 从 `AiHomePage` 内联 AppBar 抽出为独立 `PreferredSizeWidget`，让顶栏可被
/// 单独 golden 快照（#2023）——避免对整页 pump、动画 spinner、聊天内容造成的
/// 不确定性。两种渲染态由 [title] 是否为空决定：
///   - [title] == null → 占位「AI」标题（会话加载完成前）
///   - [title] != null → 会话标题 + [subtitle] 副标题
///
/// 左按钮：32×32 / borderRadius 9 软背景方钮 + 历史 glyph（打开抽屉）。
/// 右按钮：32×32 / borderRadius 999 软背景圆钮 + 新建会话 glyph。
class QzAiTopBar extends StatelessWidget implements PreferredSizeWidget {
  const QzAiTopBar({
    super.key,
    required this.title,
    required this.subtitle,
    required this.historyTooltip,
    required this.newSessionTooltip,
    required this.onOpenHistory,
    required this.onNewSession,
  });

  /// 当前会话标题；为 null 时渲染占位「AI」态。
  final String? title;

  /// 会话副标题（分类 · 交易对 · 周期）；仅 [title] != null 时显示。
  final String? subtitle;

  final String historyTooltip;
  final String newSessionTooltip;
  final VoidCallback onOpenHistory;
  final VoidCallback onNewSession;

  @override
  Size get preferredSize => const Size.fromHeight(kToolbarHeight);

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return AppBar(
      // 设计稿左按钮：32×32 / borderRadius 9 / bgSoft 软背景方钮 + 历史 glyph
      // （m-screens-1.jsx:368-378）。_TopBarButton 命中区 48 宽（视觉 32 居中，
      // 左右各溢出 8）。leading 槽需容纳 padding + 48 命中区，否则按钮被裁回
      // ~32 命中区。padding 取 lg-8，使视觉钮距屏左仍为 lg(16)：8(pad)+8(命中溢出)=16。
      leadingWidth: 48 + (QzSpacing.lg - 8),
      leading: Padding(
        padding: const EdgeInsets.only(left: QzSpacing.lg - 8),
        child: _TopBarButton(
          buttonKey: const Key('ai-appbar-history'),
          tooltip: historyTooltip,
          borderRadius: 9,
          background: c.bgSoft,
          onTap: onOpenHistory,
          child: QzGlyphIcon(
            path: 'M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2',
            color: c.text,
            strokeWidth: 2,
          ),
        ),
      ),
      title: title == null
          ? Text(
              'AI',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                letterSpacing: -0.2,
                color: c.text,
              ),
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Text(
                  title!,
                  // 设计稿标题：14 / 700 / letterSpacing -0.2（m-shell.jsx:163）。
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.2,
                    color: c.text,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                if (subtitle != null)
                  Text(
                    subtitle!,
                    style: TextStyle(fontSize: 11, color: c.textDim),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
              ],
            ),
      actions: <Widget>[
        // 设计稿右按钮：32×32 / borderRadius 999 / bgSoft 圆钮 + 新建会话 glyph
        // （m-screens-1.jsx:387-393）。
        Padding(
          // 命中区 48 视觉 32，右溢出 8；pad 取 lg-8 使视觉钮距屏右仍为 lg(16)，与左对称。
          padding: const EdgeInsets.only(right: QzSpacing.lg - 8),
          // AppBar actions 默认纵向拉伸子项；用 Center 固定 32×32 不被撑高。
          child: Center(
            child: _TopBarButton(
              buttonKey: const Key('ai-appbar-new-session'),
              tooltip: newSessionTooltip,
              borderRadius: 999,
              background: c.bgSoft,
              onTap: onNewSession,
              child: QzGlyphIcon(
                path: 'M21 12a9 9 0 1 1-9-9M16 3h6v6M12 8v8M8 12h8',
                color: c.text,
                strokeWidth: 2.2,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// 设计稿 `MTopBar compact` 左右软背景按钮：32×32 容器 + 可配圆角 / 背景，
/// 居中承载 glyph。左为方钮（borderRadius 9），右为圆钮（borderRadius 999）。
class _TopBarButton extends StatelessWidget {
  const _TopBarButton({
    required this.buttonKey,
    required this.tooltip,
    required this.borderRadius,
    required this.background,
    required this.onTap,
    required this.child,
  });

  final Key buttonKey;
  final String tooltip;
  final double borderRadius;
  final Color background;
  final VoidCallback onTap;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final BorderRadius radius = BorderRadius.circular(borderRadius);
    // 背景与圆角下沉到 Material（ink 表面），InkWell 水波纹才能绘在背景之上而非
    // 被不透明子节点遮挡。外层 48×48 命中区满足 Material 最小触控目标，视觉仍 32×32。
    return Tooltip(
      message: tooltip,
      child: SizedBox(
        width: 48,
        height: 48,
        child: Center(
          child: Material(
            color: background,
            borderRadius: radius,
            clipBehavior: Clip.antiAlias,
            child: InkWell(
              key: buttonKey,
              onTap: onTap,
              child: SizedBox(
                width: 32,
                height: 32,
                child: Center(child: child),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
