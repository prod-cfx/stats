import 'package:flutter/material.dart';

import '../../../data/models/ai_chat_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// AI 多会话历史抽屉（#1557）。
///
/// 左侧 Drawer，宽度 ~82% 屏宽。包含：
/// - 头部：标题「策略方案」+ 副标题 + 「新建方案」CTA
/// - 列表：每条 session（标题 + 分类副本 + CAGR 标签 + 更新时间 + 消息数）
/// - 当前会话高亮（accentSoft 背景）；可点删除按钮
class QzAiSessionDrawer extends StatelessWidget {
  const QzAiSessionDrawer({
    super.key,
    required this.sessions,
    required this.currentId,
    required this.onSelect,
    required this.onCreate,
    required this.onDelete,
  });

  final List<AiSession> sessions;
  final String? currentId;
  final ValueChanged<String> onSelect;
  final VoidCallback onCreate;
  final ValueChanged<String> onDelete;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final double width = MediaQuery.of(context).size.width * 0.82;
    return Drawer(
      backgroundColor: c.bg,
      width: width,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: <Widget>[
            Padding(
              padding: const EdgeInsets.fromLTRB(
                QzSpacing.lg,
                QzSpacing.md,
                QzSpacing.lg,
                QzSpacing.md,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: <Widget>[
                            Text(
                              l10n.aiSessionDrawerTitle,
                              style: TextStyle(
                                color: c.text,
                                fontSize: 17,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                            const SizedBox(height: QzSpacing.xxs),
                            Text(
                              l10n.aiSessionDrawerSubtitle,
                              style: TextStyle(color: c.textDim, fontSize: 11),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        key: const Key('ai-drawer-close'),
                        icon: Icon(Icons.close, color: c.textDim, size: 20),
                        onPressed: () => Navigator.of(context).pop(),
                      ),
                    ],
                  ),
                  const SizedBox(height: QzSpacing.md),
                  SizedBox(
                    height: 40,
                    child: ElevatedButton.icon(
                      key: const Key('ai-drawer-new-session'),
                      onPressed: onCreate,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: c.accent,
                        foregroundColor: c.accentOn,
                        elevation: 0,
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(QzRadii.input),
                        ),
                      ),
                      icon: const Icon(Icons.add, size: 16),
                      label: Text(l10n.aiSessionNewButton),
                    ),
                  ),
                ],
              ),
            ),
            Divider(height: 1, color: c.border),
            Expanded(
              child: sessions.isEmpty
                  ? _Empty(scheme: c, hint: l10n.aiSessionEmptyHint)
                  : ListView.separated(
                      padding: const EdgeInsets.symmetric(
                        horizontal: QzSpacing.sm,
                        vertical: QzSpacing.sm,
                      ),
                      itemCount: sessions.length,
                      separatorBuilder: (BuildContext _, int _) =>
                          const SizedBox(height: 4),
                      itemBuilder: (BuildContext ctx, int i) {
                        final AiSession s = sessions[i];
                        return _SessionTile(
                          session: s,
                          isCurrent: s.id == currentId,
                          onTap: () => onSelect(s.id),
                          onDelete: () => onDelete(s.id),
                        );
                      },
                    ),
            ),
            Divider(height: 1, color: c.border),
            Padding(
              key: const Key('ai-session-privacy-footer'),
              padding: const EdgeInsets.fromLTRB(
                QzSpacing.lg,
                QzSpacing.sm,
                QzSpacing.lg,
                QzSpacing.md,
              ),
              child: Row(
                children: <Widget>[
                  Icon(Icons.shield_outlined, size: 14, color: c.textFaint),
                  const SizedBox(width: QzSpacing.xs),
                  Expanded(
                    child: Text(
                      l10n.aiSessionPrivacyFooter,
                      style: TextStyle(
                        color: c.textFaint,
                        fontSize: 10,
                        height: 1.4,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SessionTile extends StatelessWidget {
  const _SessionTile({
    required this.session,
    required this.isCurrent,
    required this.onTap,
    required this.onDelete,
  });

  final AiSession session;
  final bool isCurrent;
  final VoidCallback onTap;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final bool isDeployed = session.deployedTo != null;
    return InkWell(
      key: Key('ai-session-tile-${session.id}'),
      onTap: onTap,
      borderRadius: BorderRadius.circular(QzRadii.input),
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: QzSpacing.md,
          vertical: QzSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: isCurrent ? c.accentSoft : Colors.transparent,
          border: Border.all(
            color: isCurrent
                ? c.accent.withValues(alpha: 0.3)
                : Colors.transparent,
          ),
          borderRadius: BorderRadius.circular(QzRadii.input),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Container(
              width: 32,
              height: 32,
              decoration: BoxDecoration(
                color: isCurrent ? c.accent : c.bgSoft,
                borderRadius: BorderRadius.circular(QzRadii.input),
              ),
              alignment: Alignment.center,
              child: Icon(
                Icons.auto_awesome,
                size: 16,
                color: isCurrent ? c.accentOn : c.textDim,
              ),
            ),
            const SizedBox(width: QzSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Row(
                    children: <Widget>[
                      Flexible(
                        child: Text(
                          session.title,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: isCurrent ? c.accent : c.text,
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                      const SizedBox(width: QzSpacing.xs),
                      _StatusBadge(
                        label: isDeployed
                            ? l10n.aiSessionStatusLive
                            : l10n.aiSessionStatusPending,
                        dotColor: isDeployed ? c.marketUp : c.statusWarn,
                        textColor: isDeployed ? c.accent : c.statusWarn,
                        bgColor: isDeployed
                            ? c.accentSoft
                            : c.statusWarn.withValues(alpha: 0.12),
                      ),
                    ],
                  ),
                  const SizedBox(height: 3),
                  Text(
                    session.category,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: c.textDim, fontSize: 11),
                  ),
                  const SizedBox(height: 5),
                  Text(
                    _previewText(session),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(color: c.textFaint, fontSize: 10),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    _formatUpdatedAt(session.updatedAt),
                    style: TextStyle(color: c.textFaint, fontSize: 10),
                  ),
                ],
              ),
            ),
            if (isCurrent)
              IconButton(
                key: Key('ai-session-delete-${session.id}'),
                onPressed: () => _confirmDelete(context),
                visualDensity: VisualDensity.compact,
                icon: Icon(Icons.delete_outline, size: 16, color: c.textDim),
              ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmDelete(BuildContext context) async {
    final bool? confirmed = await showDialog<bool>(
      context: context,
      barrierColor: Colors.black.withValues(alpha: 0.45),
      builder: (BuildContext ctx) => _DeleteSessionDialog(session: session),
    );
    if (confirmed == true) onDelete();
  }

  String _previewText(AiSession session) {
    for (final ChatTurn turn in session.messages.reversed) {
      if (turn.kind == ChatTurnKind.deployed) return '✓ 已部署 · 实盘运行中';
      if (turn.content.trim().isNotEmpty) return turn.content.trim();
    }
    return '${session.messages.length} 条消息';
  }

  String _formatUpdatedAt(DateTime updatedAt) {
    final Duration diff = DateTime.now().difference(updatedAt);
    if (diff.inMinutes < 1) return '刚刚';
    if (diff.inHours < 1) return '${diff.inMinutes} 分钟前';
    if (diff.inDays < 1) return '${diff.inHours} 小时前';
    if (diff.inDays == 1) return '昨天';
    return '${diff.inDays} 天前';
  }
}

class _DeleteSessionDialog extends StatelessWidget {
  const _DeleteSessionDialog({required this.session});

  final AiSession session;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    const Color danger = Color(0xFFE5484D);
    const Color dangerSoft = Color(0xFFFFE8E8);
    return Dialog(
      key: const Key('ai-session-delete-dialog'),
      insetPadding: const EdgeInsets.symmetric(horizontal: 16),
      backgroundColor: Colors.transparent,
      elevation: 0,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: 430),
        child: DecoratedBox(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.all(Radius.circular(20)),
            boxShadow: <BoxShadow>[
              BoxShadow(
                color: Color(0x1A0F1623),
                offset: Offset(0, 12),
                blurRadius: 40,
              ),
            ],
          ),
          child: Padding(
            padding: const EdgeInsets.fromLTRB(22, 30, 22, 22),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: dangerSoft,
                    shape: BoxShape.circle,
                  ),
                  alignment: Alignment.center,
                  child: const Icon(
                    Icons.delete_outline_rounded,
                    size: 30,
                    color: danger,
                  ),
                ),
                const SizedBox(height: 24),
                Text(
                  l10n.aiSessionDeleteTitle,
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    color: Color(0xFF0F1623),
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                const SizedBox(height: QzSpacing.sm),
                Text.rich(
                  TextSpan(
                    style: TextStyle(
                      color: const Color(0xFF8A93A6),
                      fontSize: 14,
                      height: 1.5,
                    ),
                    children: <InlineSpan>[
                      TextSpan(text: l10n.aiSessionDeleteBodyPrefix),
                      TextSpan(
                        text: session.title,
                        style: const TextStyle(
                          color: Color(0xFF334155),
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      TextSpan(text: l10n.aiSessionDeleteBodySuffix),
                    ],
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                Row(
                  children: <Widget>[
                    Expanded(
                      child: SizedBox(
                        height: 56,
                        child: OutlinedButton(
                          key: const Key('ai-session-delete-cancel'),
                          onPressed: () => Navigator.of(context).pop(false),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: const Color(0xFF0F1623),
                            backgroundColor: Colors.white,
                            side: const BorderSide(color: Color(0xFFEFF1F5)),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            textStyle: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                          child: Text(l10n.commonCancel),
                        ),
                      ),
                    ),
                    const SizedBox(width: QzSpacing.md),
                    Expanded(
                      child: SizedBox(
                        height: 56,
                        child: FilledButton(
                          key: const Key('ai-session-delete-confirm'),
                          onPressed: () => Navigator.of(context).pop(true),
                          style: FilledButton.styleFrom(
                            backgroundColor: danger,
                            foregroundColor: Colors.white,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                            textStyle: const TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w700,
                            ),
                            shadowColor: danger.withValues(alpha: 0.28),
                            elevation: 10,
                          ),
                          child: Text(l10n.aiSessionDeleteConfirm),
                        ),
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _StatusBadge extends StatelessWidget {
  const _StatusBadge({
    required this.label,
    required this.dotColor,
    required this.textColor,
    required this.bgColor,
  });

  final String label;
  final Color dotColor;
  final Color textColor;
  final Color bgColor;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Container(
            width: 5,
            height: 5,
            decoration: BoxDecoration(
              color: dotColor,
              shape: BoxShape.circle,
              boxShadow: <BoxShadow>[
                BoxShadow(
                  color: dotColor.withValues(alpha: 0.18),
                  spreadRadius: 2,
                  blurRadius: 0,
                ),
              ],
            ),
          ),
          const SizedBox(width: 3),
          Text(
            label,
            style: TextStyle(
              color: textColor,
              fontSize: 9,
              fontWeight: FontWeight.w700,
              height: 1.2,
            ),
          ),
        ],
      ),
    );
  }
}

class _Empty extends StatelessWidget {
  const _Empty({required this.scheme, required this.hint});
  final QzColorScheme scheme;
  final String hint;
  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(QzSpacing.lg),
        child: Text(
          hint,
          textAlign: TextAlign.center,
          style: TextStyle(color: scheme.textDim, fontSize: 13),
        ),
      ),
    );
  }
}
