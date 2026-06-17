import 'package:flutter/material.dart';

import '../../../data/models/ai_chat_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

typedef AiSessionRenameCallback = void Function(String sessionId, String title);

/// AI 多会话历史抽屉（#1557）。
///
/// 左侧 Drawer，宽度 ~82% 屏宽。包含：
/// - 头部：标题「策略方案」+ 副标题 + 「新建会话」CTA
/// - 列表：每条 session（标题 + 状态徽标 + 更新时间）
/// - 当前会话高亮（accentSoft 背景）；可点删除按钮
class QzAiSessionDrawer extends StatelessWidget {
  const QzAiSessionDrawer({
    super.key,
    required this.sessions,
    required this.currentId,
    required this.onSelect,
    required this.onCreate,
    required this.onDelete,
    required this.onRename,
    required this.onRefresh,
  });

  final List<AiSession> sessions;
  final String? currentId;
  final ValueChanged<String> onSelect;
  final VoidCallback onCreate;
  final ValueChanged<String> onDelete;
  final AiSessionRenameCallback onRename;
  final Future<void> Function() onRefresh;

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
              child: RefreshIndicator(
                onRefresh: onRefresh,
                color: c.accent,
                child: sessions.isEmpty
                    ? ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.all(QzSpacing.lg),
                        children: <Widget>[
                          SizedBox(
                            height: MediaQuery.of(context).size.height * 0.45,
                            child: _Empty(
                              scheme: c,
                              hint: l10n.aiSessionEmptyHint,
                            ),
                          ),
                        ],
                      )
                    : ListView.separated(
                        physics: const AlwaysScrollableScrollPhysics(),
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
                            onRename: (String title) => onRename(s.id, title),
                          );
                        },
                      ),
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

class _SessionTile extends StatefulWidget {
  const _SessionTile({
    required this.session,
    required this.isCurrent,
    required this.onTap,
    required this.onDelete,
    required this.onRename,
  });

  final AiSession session;
  final bool isCurrent;
  final VoidCallback onTap;
  final VoidCallback onDelete;
  final ValueChanged<String> onRename;

  @override
  State<_SessionTile> createState() => _SessionTileState();
}

class _SessionTileState extends State<_SessionTile> {
  late final TextEditingController _titleController;
  late final FocusNode _titleFocus;
  bool _editing = false;

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController(text: widget.session.title);
    _titleFocus = FocusNode();
  }

  @override
  void didUpdateWidget(covariant _SessionTile oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!_editing && widget.session.title != _titleController.text) {
      _titleController.text = widget.session.title;
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _titleFocus.dispose();
    super.dispose();
  }

  void _beginRename() {
    setState(() {
      _editing = true;
      _titleController.text = widget.session.title;
    });
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _titleFocus.requestFocus();
      _titleController.selection = TextSelection(
        baseOffset: 0,
        extentOffset: _titleController.text.length,
      );
    });
  }

  void _cancelRename() {
    setState(() {
      _editing = false;
      _titleController.text = widget.session.title;
    });
    _titleFocus.unfocus();
  }

  void _commitRename() {
    final String title = _titleController.text.trim();
    if (title.isNotEmpty && title != widget.session.title) {
      widget.onRename(title);
    }
    if (!mounted) return;
    setState(() => _editing = false);
    _titleFocus.unfocus();
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final bool isDeployed = widget.session.deployedTo != null;
    return InkWell(
      key: Key('ai-session-tile-${widget.session.id}'),
      onTap: _editing ? null : widget.onTap,
      borderRadius: BorderRadius.circular(QzRadii.input),
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: QzSpacing.md,
          vertical: QzSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: widget.isCurrent ? c.accentSoft : Colors.transparent,
          border: Border.all(
            color: widget.isCurrent
                ? c.accent.withValues(alpha: 0.3)
                : Colors.transparent,
          ),
          borderRadius: BorderRadius.circular(QzRadii.input),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: widget.isCurrent ? c.accent : c.bgSoft,
                    borderRadius: BorderRadius.circular(QzRadii.input),
                  ),
                  alignment: Alignment.center,
                  child: Icon(
                    Icons.auto_awesome,
                    size: 16,
                    color: widget.isCurrent ? c.accentOn : c.textDim,
                  ),
                ),
                const SizedBox(width: QzSpacing.sm),
                Expanded(
                  child: _editing
                      ? TextField(
                          key: Key(
                            'ai-session-title-input-${widget.session.id}',
                          ),
                          controller: _titleController,
                          focusNode: _titleFocus,
                          textInputAction: TextInputAction.done,
                          maxLines: 1,
                          style: TextStyle(
                            color: c.text,
                            fontSize: 16,
                            fontWeight: FontWeight.w700,
                          ),
                          decoration: InputDecoration(
                            isDense: true,
                            contentPadding: const EdgeInsets.symmetric(
                              horizontal: QzSpacing.sm,
                              vertical: 8,
                            ),
                            filled: true,
                            fillColor: c.bgSoft,
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: BorderSide(color: c.border),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: BorderSide(color: c.border),
                            ),
                            focusedBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(10),
                              borderSide: BorderSide(color: c.accent),
                            ),
                          ),
                          onSubmitted: (_) => _commitRename(),
                        )
                      : Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: <Widget>[
                            Row(
                              children: <Widget>[
                                Flexible(
                                  child: Text(
                                    widget.session.title,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: TextStyle(
                                      color: widget.isCurrent
                                          ? c.accent
                                          : c.text,
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
                                  dotColor: isDeployed
                                      ? c.marketUp
                                      : c.statusWarn,
                                  textColor: isDeployed
                                      ? c.accent
                                      : c.statusWarn,
                                  bgColor: isDeployed
                                      ? c.accentSoft
                                      : c.statusWarn.withValues(alpha: 0.12),
                                ),
                              ],
                            ),
                            const SizedBox(height: 5),
                            Text(
                              _formatUpdatedAt(widget.session.updatedAt),
                              style: TextStyle(
                                color: c.textFaint,
                                fontSize: 10,
                              ),
                            ),
                          ],
                        ),
                ),
              ],
            ),
            const SizedBox(height: QzSpacing.xs),
            Padding(
              padding: const EdgeInsets.only(left: 32 + QzSpacing.sm),
              child: _editing
                  ? Row(
                      children: <Widget>[
                        OutlinedButton(
                          key: Key(
                            'ai-session-rename-cancel-${widget.session.id}',
                          ),
                          onPressed: _cancelRename,
                          style: OutlinedButton.styleFrom(
                            visualDensity: VisualDensity.compact,
                            minimumSize: const Size(48, 32),
                            foregroundColor: c.textDim,
                            side: BorderSide(color: c.border),
                            shape: const StadiumBorder(),
                          ),
                          child: Text(l10n.commonCancel),
                        ),
                        const SizedBox(width: QzSpacing.xs),
                        FilledButton(
                          key: Key(
                            'ai-session-rename-save-${widget.session.id}',
                          ),
                          onPressed: _commitRename,
                          style: FilledButton.styleFrom(
                            visualDensity: VisualDensity.compact,
                            minimumSize: const Size(48, 32),
                            backgroundColor: c.accent,
                            foregroundColor: c.accentOn,
                            shape: const StadiumBorder(),
                          ),
                          child: const Text('保存'),
                        ),
                      ],
                    )
                  : Row(
                      children: <Widget>[
                        _SessionActionButton(
                          key: Key('ai-session-rename-${widget.session.id}'),
                          icon: Icons.edit_outlined,
                          tooltip: '编辑名称',
                          onPressed: _beginRename,
                        ),
                        const SizedBox(width: QzSpacing.xs),
                        _SessionActionButton(
                          key: Key('ai-session-delete-${widget.session.id}'),
                          icon: Icons.delete_outline,
                          tooltip: l10n.aiSessionDeleteConfirm,
                          onPressed: widget.onDelete,
                          danger: true,
                        ),
                      ],
                    ),
            ),
          ],
        ),
      ),
    );
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

class _SessionActionButton extends StatelessWidget {
  const _SessionActionButton({
    super.key,
    required this.icon,
    required this.tooltip,
    required this.onPressed,
    this.danger = false,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;
  final bool danger;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color color = danger ? const Color(0xFFE5484D) : c.textDim;
    return SizedBox.square(
      dimension: 34,
      child: IconButton(
        onPressed: onPressed,
        tooltip: tooltip,
        padding: EdgeInsets.zero,
        visualDensity: VisualDensity.compact,
        style: IconButton.styleFrom(
          backgroundColor: c.bgSoft,
          foregroundColor: color,
          side: BorderSide(color: c.border),
          shape: const CircleBorder(),
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        ),
        icon: Icon(icon, size: 17),
      ),
    );
  }
}

Future<bool> showQzAiSessionDeleteDialog(
  BuildContext context, {
  required AiSession session,
}) async {
  final bool? confirmed = await showDialog<bool>(
    context: context,
    barrierColor: Colors.black.withValues(alpha: 0.45),
    builder: (BuildContext ctx) => _DeleteSessionDialog(session: session),
  );
  return confirmed == true;
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
