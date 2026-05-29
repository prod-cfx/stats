import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../data/mock/fixtures/whale_extras.dart';
import '../../../data/models/whale_extra_models.dart';
import '../../../data/models/whale_watch_models.dart';
import '../../../data/providers.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../widgets/whale_watch_rule_sheet.dart';

/// 巨鲸动向 — 监控 tab（issue #1560 / #1754）。我的监控 + 最近告警 + CTA。
///
/// #1754：监控规则可新增 / 编辑 / 静音 / 删除。mock 阶段规则为 session 内存
/// 态——initState 从 repository 载入种子后由本地 [_rules] 作为单一数据源，
/// 重建 app 回到种子；真实持久化随 #1682/#1683 接入。
class WhaleWatchTab extends ConsumerStatefulWidget {
  const WhaleWatchTab({super.key});

  @override
  ConsumerState<WhaleWatchTab> createState() => _WhaleWatchTabState();
}

class _WhaleWatchTabState extends ConsumerState<WhaleWatchTab> {
  List<WatchRule>? _rules;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final List<WatchRule> rules =
        await ref.read(whaleWatchRepositoryProvider).listRules();
    if (!mounted) return;
    setState(() => _rules = rules);
  }

  Future<void> _addRule() async {
    final WatchRule? rule = await WhaleWatchRuleSheet.show(context);
    if (rule == null) return;
    setState(() => _rules = <WatchRule>[...?_rules, rule]);
  }

  Future<void> _editRule(WatchRule rule) async {
    final WatchRule? updated =
        await WhaleWatchRuleSheet.show(context, initial: rule);
    if (updated == null) return;
    setState(() {
      _rules = <WatchRule>[
        for (final WatchRule r in _rules ?? <WatchRule>[])
          if (r.id == updated.id) updated else r,
      ];
    });
  }

  void _toggleMute(WatchRule rule) {
    setState(() {
      _rules = <WatchRule>[
        for (final WatchRule r in _rules ?? <WatchRule>[])
          if (r.id == rule.id) r.copyWith(muted: !r.muted) else r,
      ];
    });
  }

  Future<void> _deleteRule(WatchRule rule) async {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final bool? ok = await showDialog<bool>(
      context: context,
      builder: (BuildContext ctx) => AlertDialog(
        title: Text(l10n.whaleRuleDeleteTitle),
        content: Text(l10n.whaleRuleDeleteBody(rule.name)),
        actions: <Widget>[
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(l10n.commonCancel),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(l10n.whaleRuleDeleteConfirm),
          ),
        ],
      ),
    );
    if (ok != true) return;
    setState(() {
      _rules = <WatchRule>[
        for (final WatchRule r in _rules ?? <WatchRule>[])
          if (r.id != rule.id) r,
      ];
    });
  }

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final List<WatchRule> rules = _rules ?? const <WatchRule>[];
    return ListView(
      padding: EdgeInsets.zero,
      children: <Widget>[
        Container(
          color: c.bgElev,
          padding: const EdgeInsets.fromLTRB(
            QzSpacing.lg,
            QzSpacing.md,
            QzSpacing.lg,
            QzSpacing.xs,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      l10n.whaleSectionMyWatch,
                      style: TextStyle(
                        color: c.text,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.2,
                      ),
                    ),
                  ),
                  Text(
                    '${rules.length}${l10n.whaleSectionMyWatchCountSuffix}',
                    style: TextStyle(color: c.textDim, fontSize: 11),
                  ),
                ],
              ),
              const SizedBox(height: QzSpacing.sm),
              if (rules.isEmpty)
                _EmptyRules(text: l10n.whaleWatchEmpty)
              else
                Container(
                  decoration: BoxDecoration(
                    border: Border.all(color: c.borderSoft),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    children: <Widget>[
                      for (int i = 0; i < rules.length; i++)
                        _WatchRow(
                          rule: rules[i],
                          isLast: i == rules.length - 1,
                          onEdit: () => _editRule(rules[i]),
                          onToggleMute: () => _toggleMute(rules[i]),
                          onDelete: () => _deleteRule(rules[i]),
                        ),
                    ],
                  ),
                ),
              const SizedBox(height: QzSpacing.md),
              SizedBox(
                width: double.infinity,
                height: 44,
                // #1754：能力落地，按钮可点打开规则表单 sheet（解除 #1663
                // 暂缓的禁用态）。
                child: OutlinedButton.icon(
                  onPressed: _addRule,
                  icon: Icon(Icons.add, size: 18, color: c.accent),
                  label: Text(
                    l10n.whaleAddWatchAddress,
                    style: TextStyle(color: c.accent, fontSize: 13),
                  ),
                  style: OutlinedButton.styleFrom(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    side: BorderSide(color: c.accent),
                  ),
                ),
              ),
            ],
          ),
        ),
        Container(
          color: c.bgElev,
          padding: const EdgeInsets.fromLTRB(
            QzSpacing.lg,
            QzSpacing.lg,
            QzSpacing.lg,
            QzSpacing.lg,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                children: <Widget>[
                  Expanded(
                    child: Text(
                      l10n.whaleSectionRecentAlerts,
                      style: TextStyle(
                        color: c.text,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.2,
                      ),
                    ),
                  ),
                  Text(
                    l10n.whaleSectionRecentAlertsAction,
                    style: TextStyle(
                      color: c.accent,
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: QzSpacing.sm),
              Container(
                decoration: BoxDecoration(
                  border: Border.all(color: c.borderSoft),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  children: <Widget>[
                    for (int i = 0; i < mockWatchAlerts.length; i++)
                      _AlertRow(
                        entry: mockWatchAlerts[i],
                        isLast: i == mockWatchAlerts.length - 1,
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// 监控规则操作枚举（行尾 overflow 菜单）。
enum _RuleAction { edit, mute, delete }

class _WatchRow extends StatelessWidget {
  const _WatchRow({
    required this.rule,
    required this.isLast,
    required this.onEdit,
    required this.onToggleMute,
    required this.onDelete,
  });

  final WatchRule rule;
  final bool isLast;
  final VoidCallback onEdit;
  final VoidCallback onToggleMute;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final bool up = rule.tone == 'up';
    final Color toneColor = up ? c.marketUp : c.marketDown;
    final Color toneSoft = toneColor.withValues(alpha: 0.14);
    final double rowOpacity = rule.muted ? 0.5 : 1.0;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => context.push(
          '/whale/profile/${Uri.encodeComponent(rule.address)}',
        ),
        child: Container(
          padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: isLast ? Colors.transparent : c.borderSoft,
              ),
            ),
          ),
          child: Row(
            children: <Widget>[
              Opacity(
                opacity: rowOpacity,
                child: Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: toneSoft,
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Icon(
                    up ? Icons.arrow_upward : Icons.arrow_downward,
                    size: 14,
                    color: toneColor,
                  ),
                ),
              ),
              const SizedBox(width: QzSpacing.md),
              Expanded(
                child: Opacity(
                  opacity: rowOpacity,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Row(
                        children: <Widget>[
                          Flexible(
                            child: Text(
                              rule.name,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                color: c.text,
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          if (rule.muted) ...<Widget>[
                            const SizedBox(width: 6),
                            Icon(
                              Icons.notifications_off,
                              size: 13,
                              color: c.textDim,
                            ),
                          ] else if (rule.live) ...<Widget>[
                            const SizedBox(width: 6),
                            Container(
                              width: 6,
                              height: 6,
                              decoration: BoxDecoration(
                                color: c.marketUp,
                                borderRadius: BorderRadius.circular(3),
                              ),
                            ),
                          ],
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(
                        '${rule.address} · ${rule.lastEventDisplay}',
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(color: c.textDim, fontSize: 11),
                      ),
                    ],
                  ),
                ),
              ),
              Opacity(
                opacity: rowOpacity,
                child: Text(
                  rule.pnlDisplay,
                  style: TextStyle(
                    color: toneColor,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    letterSpacing: -0.2,
                  ),
                ),
              ),
              PopupMenuButton<_RuleAction>(
                icon: Icon(Icons.more_vert, size: 18, color: c.textMid),
                tooltip: l10n.whaleRuleMenuTooltip,
                onSelected: (_RuleAction a) {
                  switch (a) {
                    case _RuleAction.edit:
                      onEdit();
                    case _RuleAction.mute:
                      onToggleMute();
                    case _RuleAction.delete:
                      onDelete();
                  }
                },
                itemBuilder: (BuildContext ctx) => <PopupMenuEntry<_RuleAction>>[
                  PopupMenuItem<_RuleAction>(
                    value: _RuleAction.edit,
                    child: Text(l10n.whaleRuleMenuEdit),
                  ),
                  PopupMenuItem<_RuleAction>(
                    value: _RuleAction.mute,
                    child: Text(
                      rule.muted
                          ? l10n.whaleRuleMenuUnmute
                          : l10n.whaleRuleMenuMute,
                    ),
                  ),
                  PopupMenuItem<_RuleAction>(
                    value: _RuleAction.delete,
                    child: Text(l10n.whaleRuleMenuDelete),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyRules extends StatelessWidget {
  const _EmptyRules({required this.text});

  final String text;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: QzSpacing.xl),
      decoration: BoxDecoration(
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Center(
        child: Text(
          text,
          style: TextStyle(color: c.textDim, fontSize: 12),
        ),
      ),
    );
  }
}

class _AlertRow extends StatelessWidget {
  const _AlertRow({required this.entry, required this.isLast});

  final WatchAlertEntry entry;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    Color fg = c.textMid;
    Color bg = c.bgSoft;
    switch (entry.tone) {
      case 'up':
        fg = c.marketUp;
        bg = c.marketUp.withValues(alpha: 0.12);
      case 'warn':
        fg = c.statusWarn;
        bg = c.statusWarn.withValues(alpha: 0.12);
      case 'info':
        fg = c.accent;
        bg = c.accentSoft;
    }
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: isLast ? Colors.transparent : c.borderSoft),
        ),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
            decoration: BoxDecoration(
              color: bg,
              borderRadius: BorderRadius.circular(4),
            ),
            child: Text(
              entry.type,
              style: TextStyle(
                color: fg,
                fontSize: 10,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(width: QzSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  entry.detail,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(color: c.text, fontSize: 12),
                ),
                const SizedBox(height: 3),
                Text(
                  entry.timeDisplay,
                  style: TextStyle(color: c.textDim, fontSize: 10),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
