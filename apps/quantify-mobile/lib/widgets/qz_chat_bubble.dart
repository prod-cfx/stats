import 'package:flutter/material.dart';

import '../theme/colors.dart';
import '../theme/theme_context.dart';
import '../theme/tokens.dart';

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
/// - `user` bubbles align trailing, paint with the active accent gradient,
///   use `accentOn` for the body text.
/// - `assistant` bubbles align leading, paint with `bgSoft`, use `text` for
///   the body text.
///
/// `codeBlock` is a separate sub-segment rendered with a monospace font on a
/// `border`-tinted background. Many model replies interleave prose +
/// code; the page composes those by emitting two adjacent bubbles, but
/// inline-only callers can pass the snippet via [codeBlock] directly.
class QzChatBubble extends StatelessWidget {
  const QzChatBubble({
    super.key,
    required this.role,
    required this.content,
    this.time,
    this.codeBlock,
    this.params,
  });

  final QzChatRole role;
  final String content;
  final DateTime? time;
  final String? codeBlock;

  /// 当传入时，气泡末尾追加一个等宽字体代码块渲染策略参数（#1557）。
  /// 与 [codeBlock] 互斥：如二者同时存在，[params] 优先。
  final Map<String, String>? params;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
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
    final BorderRadius radius = BorderRadius.circular(QzRadii.card);

    final Color fg = isUser ? c.accentOn : c.text;
    final Decoration decoration = isUser
        ? BoxDecoration(gradient: c.accentGrad, borderRadius: radius)
        : BoxDecoration(
            color: c.bgSoft,
            border: Border.all(color: c.border),
            borderRadius: radius,
          );

    return LayoutBuilder(
      builder: (BuildContext ctx, BoxConstraints constraints) {
        // Cap bubble width at 72% of available width so very long lines wrap
        // instead of stretching edge-to-edge.
        final double maxW = constraints.maxWidth * 0.72;
        return Align(
          alignment:
              isUser ? Alignment.centerRight : Alignment.centerLeft,
          child: ConstrainedBox(
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
                      style: TextStyle(
                        color: fg,
                        fontSize: 14,
                        height: 1.4,
                      ),
                    ),
                  if (params != null && params!.isNotEmpty) ...<Widget>[
                    const SizedBox(height: QzSpacing.sm),
                    Container(
                      key: const Key('ai-bubble-params'),
                      width: double.infinity,
                      padding: const EdgeInsets.all(QzSpacing.sm),
                      decoration: BoxDecoration(
                        color: isUser
                            ? c.accentOn.withValues(alpha: 0.12)
                            : c.border.withValues(alpha: 0.4),
                        borderRadius:
                            BorderRadius.circular(QzRadii.input),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: <Widget>[
                          for (final MapEntry<String, String> e
                              in params!.entries)
                            Padding(
                              padding:
                                  const EdgeInsets.only(bottom: 2),
                              child: RichText(
                                text: TextSpan(
                                  style: TextStyle(
                                    fontSize: 12,
                                    height: 1.7,
                                    fontFamily: 'monospace',
                                    fontFamilyFallback: const <String>[
                                      'Menlo',
                                      'Consolas',
                                      'Courier New',
                                    ],
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
                  ] else if (codeBlock != null && codeBlock!.isNotEmpty) ...<Widget>[
                    const SizedBox(height: QzSpacing.sm),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(QzSpacing.sm),
                      decoration: BoxDecoration(
                        color: isUser
                            ? c.accentOn.withValues(alpha: 0.12)
                            : c.border.withValues(alpha: 0.4),
                        borderRadius:
                            BorderRadius.circular(QzRadii.input),
                      ),
                      child: Text(
                        codeBlock!,
                        style: TextStyle(
                          color: fg,
                          fontSize: 12,
                          height: 1.4,
                          fontFamily: 'monospace',
                          fontFamilyFallback: const <String>[
                            'Menlo',
                            'Consolas',
                            'Courier New',
                          ],
                        ),
                      ),
                    ),
                  ],
                  if (time != null) ...<Widget>[
                    const SizedBox(height: QzSpacing.xxs),
                    Text(
                      _formatTime(time!),
                      style: TextStyle(
                        color: isUser
                            ? c.accentOn.withValues(alpha: 0.75)
                            : c.textDim,
                        fontSize: 10,
                      ),
                    ),
                  ],
                ],
              ),
            ),
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
