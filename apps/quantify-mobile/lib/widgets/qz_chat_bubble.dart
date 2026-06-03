import 'package:flutter/material.dart';

import '../l10n/app_localizations.dart';
import '../theme/colors.dart';
import '../theme/theme_context.dart';
import '../theme/tokens.dart';
import 'qz_button.dart';

/// Chat message role. Mirrors the `role` string field on `ChatTurn`
/// (`user` / `assistant` / `system`) but typed for widget consumption to
/// avoid stringly-typed branching at render sites.
///
/// `system` is a non-conversational notice injected by the app itself (e.g.
/// 「策略已部署到 Binance · 实例 ID xxx」after a successful one-click deploy);
/// rendered as a centered hairline pill, not a left/right bubble.
enum QzChatRole { user, assistant, system }

/// Chat message bubble used by the AI conversation page.
///
/// 设计稿对齐 `design/project/mobile/m-screens-1.jsx` 的 `Bubble`：
/// - `assistant`：左侧 30x30 bot icon（`accentSoft` 背景 + `accent` 前景）
///   + 气泡 `bgElev` 白底、`borderSoft` 描边、圆角 4/16/16/16。
/// - `user`：trailing 对齐，气泡 `accentSoft` 浅紫底、`text` 正文色、
///   圆角 16/16/4/16（不再使用 `accentGrad` 紫色渐变 + `accentOn` 白字）。
///
/// `codeBlock` 与 `params` 仍以子段形式渲染，沿用既有 mono 字体与
/// 浅边框块（仅 user 气泡的描述色权重从 `accentOn` 系切到 `text` 系，
/// 因为底色不再是高对比的紫色渐变）。
class QzChatBubble extends StatelessWidget {
  const QzChatBubble({
    super.key,
    required this.role,
    required this.content,
    this.time,
    this.codeBlock,
    this.params,
    this.onConfirm,
    this.locked = false,
    this.deployedExchange,
    this.deployedInstanceId,
    this.onViewLive,
  });

  final QzChatRole role;
  final String content;
  final DateTime? time;
  final String? codeBlock;

  /// 当传入时，气泡末尾追加一个等宽字体代码块渲染策略参数（#1557）。
  /// 与 [codeBlock] 互斥：如二者同时存在，[params] 优先。
  final Map<String, String>? params;

  /// 参数气泡「确认策略」CTA 回调（#1831）。仅 [params] 非空时渲染按钮；
  /// 为 null 时不显示 CTA（保持与历史调用方兼容）。confirm 屏（#1832）
  /// 就绪前由 `ai_home_page.dart` 注入占位/回测配置入口。
  final VoidCallback? onConfirm;

  /// 会话已部署锁定态（#1834）。由会话 `deployedTo != null` 推导，
  /// 经 `ai_home_page.dart` 注入。为 true 时参数卡顶部渲染 LockedBanner
  /// 「策略已部署，参数已锁定」，并隐藏 #1831 的「确认策略」CTA——
  /// 表达已部署方案参数不可再改、请新建方案。对齐设计稿
  /// m-screens-1.jsx:403 `locked = !!current.deployedTo`。
  final bool locked;

  /// 部署终态富气泡（#1833）专用字段。三者同时注入时（[onViewLive] 非空），
  /// 气泡渲染对齐设计稿 m-screens-1.jsx:440 的富卡片：✓ 图标 +
  /// 「策略已部署到 {ex}」+「策略 ID {id} · 当前运行中」+ 归档话术 +
  /// 「查看实盘策略 →」CTA（[onViewLive] 跳 `/me/live`）。其它场景下为 null，
  /// 保持与历史调用方兼容。
  final String? deployedExchange;
  final String? deployedInstanceId;
  final VoidCallback? onViewLive;

  /// 设计稿对齐：assistant `4/16/16/16`，user `16/16/4/16`。
  static const BorderRadius _assistantRadius = BorderRadius.only(
    topLeft: Radius.circular(4),
    topRight: Radius.circular(16),
    bottomRight: Radius.circular(16),
    bottomLeft: Radius.circular(16),
  );
  static const BorderRadius _userRadius = BorderRadius.only(
    topLeft: Radius.circular(16),
    topRight: Radius.circular(16),
    bottomRight: Radius.circular(4),
    bottomLeft: Radius.circular(16),
  );

  /// 参数气泡分类 badge 前/后缀文案共用样式（dim 文本、12px、行高 1.4）。
  TextStyle _badgeTextStyle(QzColorScheme c) =>
      TextStyle(color: c.textDim, fontSize: 12, height: 1.4);

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    if (onViewLive != null) {
      return _buildDeployed(context, c);
    }
    if (role == QzChatRole.system) {
      // 居中提示条：弱化背景 + 细边框，与左右气泡区分开。
      return Center(
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: QzSpacing.md,
            vertical: QzSpacing.xs,
          ),
          decoration: BoxDecoration(
            color: c.bgSoft,
            border: Border.all(color: c.border),
            borderRadius: BorderRadius.circular(QzRadii.pill),
          ),
          child: Text(
            content,
            style: TextStyle(color: c.textDim, fontSize: 12, height: 1.4),
            textAlign: TextAlign.center,
          ),
        ),
      );
    }
    final bool isUser = role == QzChatRole.user;
    final BorderRadius radius = isUser ? _userRadius : _assistantRadius;

    // 设计稿统一用 c.text 正文色；user 气泡背景从紫色渐变切到浅紫底，
    // 不再需要 accentOn 白字。
    final Color fg = c.text;
    final Decoration decoration = isUser
        ? BoxDecoration(color: c.accentSoft, borderRadius: radius)
        : BoxDecoration(
            color: c.bgElev,
            border: Border.all(color: c.borderSoft),
            borderRadius: radius,
          );

    return LayoutBuilder(
      builder: (BuildContext ctx, BoxConstraints constraints) {
        // Cap bubble width: user 78%（无 avatar 占位），assistant 留出
        // 30px avatar + 8px gap 后允许 82% 内容宽度（与设计稿一致）。
        final double avatarReserve = isUser ? 0 : 30 + QzSpacing.sm;
        final double maxW =
            (constraints.maxWidth - avatarReserve) * (isUser ? 0.78 : 0.82);
        final Widget bubble = ConstrainedBox(
          constraints: BoxConstraints(maxWidth: maxW),
          child: Container(
            padding: const EdgeInsets.symmetric(
              horizontal: QzSpacing.md,
              vertical: QzSpacing.sm,
            ),
            decoration: decoration,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                if (content.isNotEmpty)
                  Text(
                    content,
                    style: TextStyle(color: fg, fontSize: 14, height: 1.4),
                  ),
                if (params != null && params!.isNotEmpty) ...<Widget>[
                  // 已部署锁定态横幅（#1834 / #1897，设计稿 m-screens-1.jsx:403、1135）：
                  // 参数卡顶部锁图标 +「已归档 · 仅供查看」，accentSoft 浅底。
                  if (locked) ...<Widget>[
                    const SizedBox(height: QzSpacing.sm),
                    Container(
                      key: const Key('ai-bubble-locked-banner'),
                      width: double.infinity,
                      padding: const EdgeInsets.symmetric(
                        horizontal: QzSpacing.sm,
                        vertical: QzSpacing.xs,
                      ),
                      decoration: BoxDecoration(
                        color: c.accentSoft,
                        borderRadius: BorderRadius.circular(QzRadii.input),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: <Widget>[
                          Icon(Icons.lock_outline, size: 14, color: c.accent),
                          const SizedBox(width: QzSpacing.xs),
                          Flexible(
                            child: Text(
                              AppLocalizations.of(context).aiParamsLockedBanner,
                              style: TextStyle(
                                color: c.accent,
                                fontSize: 12,
                                height: 1.4,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                  // 分类 badge（设计稿 m-screens-1.jsx:407）：
                  // 「已为你识别为」+ 分类 chip +「类策略，建议参数：」，
                  // category 取自 params['category']，前后缀走专用 l10n key
                  // （不复用 themePreviewIdentified，该 key 被主题预览页共用）。
                  if ((params!['category'] ?? '').isNotEmpty) ...<Widget>[
                    const SizedBox(height: QzSpacing.sm),
                    Wrap(
                      crossAxisAlignment: WrapCrossAlignment.center,
                      spacing: QzSpacing.xs,
                      runSpacing: QzSpacing.xxs,
                      children: <Widget>[
                        Text(
                          AppLocalizations.of(context).aiParamsBadgePrefix,
                          style: _badgeTextStyle(c),
                        ),
                        Container(
                          key: const Key('ai-bubble-category-chip'),
                          padding: const EdgeInsets.symmetric(
                            horizontal: QzSpacing.sm,
                            vertical: QzSpacing.xxs,
                          ),
                          decoration: BoxDecoration(
                            color: c.accentSoft,
                            borderRadius: BorderRadius.circular(QzRadii.pill),
                          ),
                          child: Text(
                            params!['category']!,
                            style: TextStyle(
                              color: c.accent,
                              fontSize: 12,
                              height: 1.2,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        Text(
                          AppLocalizations.of(context).aiParamsBadgeSuffix,
                          style: _badgeTextStyle(c),
                        ),
                      ],
                    ),
                  ],
                  const SizedBox(height: QzSpacing.sm),
                  Container(
                    key: const Key('ai-bubble-params'),
                    width: double.infinity,
                    padding: const EdgeInsets.all(QzSpacing.sm),
                    decoration: BoxDecoration(
                      color: c.border.withValues(alpha: 0.4),
                      borderRadius: BorderRadius.circular(QzRadii.input),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: <Widget>[
                        for (final MapEntry<String, String> e
                            in params!.entries)
                          Padding(
                            key: Key('ai-bubble-param-${e.key}'),
                            padding: const EdgeInsets.only(bottom: 2),
                            child: RichText(
                              text: TextSpan(
                                style: TextStyle(
                                  fontSize: 12,
                                  height: 1.7,
                                  fontFamily: QzFont.mono,
                                  fontFamilyFallback: QzFont.monoFallback,
                                ),
                                children: <InlineSpan>[
                                  TextSpan(
                                    text: '${e.key} ',
                                    style: TextStyle(color: c.textDim),
                                  ),
                                  TextSpan(
                                    text: '= ${e.value}',
                                    style: TextStyle(color: fg),
                                  ),
                                ],
                              ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  // 「需要我开始回测吗?」+「确认策略」CTA（设计稿 m-screens-1.jsx:417-433）。
                  // 仅 onConfirm 注入时渲染按钮，confirm 屏（#1832）未就绪前指向占位入口。
                  // locked（#1834）时隐藏 CTA——已部署方案参数不可再改。
                  if (onConfirm != null && !locked) ...<Widget>[
                    const SizedBox(height: QzSpacing.sm),
                    Text(
                      AppLocalizations.of(context).aiStartBacktestPrompt,
                      style: TextStyle(color: fg, fontSize: 13, height: 1.4),
                    ),
                    const SizedBox(height: QzSpacing.xs),
                    QzButton(
                      key: const Key('ai-bubble-confirm-cta'),
                      label: AppLocalizations.of(context).aiConfirmStrategy,
                      variant: QzButtonVariant.accent,
                      expanded: true,
                      onPressed: onConfirm,
                    ),
                  ],
                ] else if (codeBlock != null &&
                    codeBlock!.isNotEmpty) ...<Widget>[
                  const SizedBox(height: QzSpacing.sm),
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.all(QzSpacing.sm),
                    decoration: BoxDecoration(
                      color: c.border.withValues(alpha: 0.4),
                      borderRadius: BorderRadius.circular(QzRadii.input),
                    ),
                    child: Text(
                      codeBlock!,
                      style: TextStyle(
                        color: fg,
                        fontSize: 12,
                        height: 1.4,
                        fontFamily: QzFont.mono,
                        fontFamilyFallback: QzFont.monoFallback,
                      ),
                    ),
                  ),
                ],
                if (time != null) ...<Widget>[
                  const SizedBox(height: QzSpacing.xxs),
                  Text(
                    _formatTime(time!),
                    style: TextStyle(color: c.textDim, fontSize: 10),
                  ),
                ],
              ],
            ),
          ),
        );

        if (isUser) {
          return Align(alignment: Alignment.centerRight, child: bubble);
        }
        // assistant: Row(左侧 bot icon + 气泡)，与设计稿一致。
        return Align(
          alignment: Alignment.centerLeft,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Container(
                key: const Key('ai-bubble-bot-avatar'),
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: c.accentSoft,
                  borderRadius: BorderRadius.circular(QzSpacing.sm),
                ),
                alignment: Alignment.center,
                child: Icon(
                  Icons.smart_toy_outlined,
                  size: 16,
                  color: c.accent,
                ),
              ),
              const SizedBox(width: QzSpacing.sm),
              Flexible(child: bubble),
            ],
          ),
        );
      },
    );
  }

  /// 部署终态富气泡（#1833）。对齐设计稿 m-screens-1.jsx:440 的 `deployed`
  /// 分支：左侧 bot avatar + assistant 气泡，气泡内含 violetSoft 头部块
  /// （✓ + 部署交易所 + 「策略 ID … · 运行中」）+ 归档话术 + 满宽
  /// violetGrad「查看实盘策略 →」CTA。
  Widget _buildDeployed(BuildContext context, QzColorScheme c) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final String id = deployedInstanceId ?? '';
    return LayoutBuilder(
      builder: (BuildContext ctx, BoxConstraints constraints) {
        final double maxW = (constraints.maxWidth - 30 - QzSpacing.sm) * 0.82;
        final Widget bubble = ConstrainedBox(
          constraints: BoxConstraints(maxWidth: maxW),
          child: Container(
            key: const Key('ai-bubble-deployed'),
            padding: const EdgeInsets.all(QzSpacing.md),
            decoration: BoxDecoration(
              color: c.bgElev,
              border: Border.all(color: c.borderSoft),
              borderRadius: _assistantRadius,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Container(
                  padding: const EdgeInsets.all(QzSpacing.sm),
                  decoration: BoxDecoration(
                    color: c.accentSoft,
                    borderRadius: BorderRadius.circular(QzRadii.input),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Container(
                        width: 30,
                        height: 30,
                        decoration: BoxDecoration(
                          color: c.accent,
                          borderRadius: BorderRadius.circular(QzSpacing.sm),
                        ),
                        alignment: Alignment.center,
                        child: Icon(Icons.check, size: 16, color: c.accentOn),
                      ),
                      const SizedBox(width: QzSpacing.sm),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: <Widget>[
                            Text(
                              content,
                              style: TextStyle(
                                color: c.accent,
                                fontSize: 13,
                                height: 1.3,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              l10n.deployedBubbleStrategyId(id),
                              style: TextStyle(
                                color: c.textDim,
                                fontSize: 11,
                                height: 1.5,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: QzSpacing.sm),
                Text(
                  l10n.deployedBubbleArchivedNotice,
                  style: TextStyle(color: c.text, fontSize: 13, height: 1.5),
                ),
                const SizedBox(height: QzSpacing.sm),
                Material(
                  color: Colors.transparent,
                  child: InkWell(
                    key: const Key('ai-bubble-view-live'),
                    onTap: onViewLive,
                    borderRadius: BorderRadius.circular(QzRadii.input),
                    child: Container(
                      height: 38,
                      width: double.infinity,
                      decoration: BoxDecoration(
                        gradient: c.accentGrad,
                        borderRadius: BorderRadius.circular(QzRadii.input),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: <Widget>[
                          Text(
                            l10n.deployViewLiveStrategies,
                            style: TextStyle(
                              color: c.accentOn,
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(width: QzSpacing.xs),
                          Icon(
                            Icons.chevron_right,
                            size: 16,
                            color: c.accentOn,
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
        return Align(
          alignment: Alignment.centerLeft,
          child: Row(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Container(
                key: const Key('ai-bubble-bot-avatar'),
                width: 30,
                height: 30,
                decoration: BoxDecoration(
                  color: c.accentSoft,
                  borderRadius: BorderRadius.circular(QzSpacing.sm),
                ),
                alignment: Alignment.center,
                child: Icon(
                  Icons.smart_toy_outlined,
                  size: 16,
                  color: c.accent,
                ),
              ),
              const SizedBox(width: QzSpacing.sm),
              Flexible(child: bubble),
            ],
          ),
        );
      },
    );
  }

  /// HH:mm formatter — kept inline because chat bubble timestamp is the only
  /// caller in the app today and pulling in `intl` for two padded fields is
  /// disproportionate.
  static String _formatTime(DateTime t) {
    String two(int n) => n.toString().padLeft(2, '0');
    return '${two(t.hour)}:${two(t.minute)}';
  }
}
