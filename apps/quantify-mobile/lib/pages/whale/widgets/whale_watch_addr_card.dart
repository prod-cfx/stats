import 'package:flutter/material.dart';

import '../../../data/models/whale_watch_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 监控地址卡（issue #1769）。对齐设计稿 `m-screens-4.jsx` `WatchAddrCard`
/// (`:2100`)：head（地址 + 复制 + live + alias + 趋势/静音/编辑/删除）、
/// hero（永续合约总价值 + 未实现盈亏）、3 列 footer（可用保证金 / 保证金
/// 使用率 bar / 持仓）。
///
/// 空仓语义：[WatchRule.perpValueUsd] 为 null 时整卡数值灰显 `-` 占位。
class WhaleWatchAddrCard extends StatelessWidget {
  const WhaleWatchAddrCard({
    super.key,
    required this.rule,
    required this.onOpen,
    required this.onToggleMute,
    required this.onEdit,
    required this.onDelete,
  });

  final WatchRule rule;
  final VoidCallback onOpen;
  final VoidCallback onToggleMute;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final bool empty = rule.perpValueUsd == null;
    final double pnl = rule.unrealizedPnlUsd ?? 0;
    final Color pnlColor = empty
        ? c.textDim
        : pnl > 0
            ? c.marketUp
            : pnl < 0
                ? c.marketDown
                : c.text;
    final int? usage = rule.marginUsagePct;
    final Color usageColor = usage == null
        ? c.textDim
        : usage >= 80
            ? c.marketDown
            : usage >= 50
                ? c.statusWarn
                : c.accent;

    return Container(
      padding: const EdgeInsets.fromLTRB(12, 12, 12, 10),
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          _head(context, l10n, c),
          const SizedBox(height: 10),
          Container(height: 1, color: c.borderSoft),
          const SizedBox(height: 10),
          _heroRow(l10n, c, empty, pnlColor),
          const SizedBox(height: 10),
          _footerRow(l10n, c, empty, usage, usageColor),
        ],
      ),
    );
  }

  Widget _head(
      BuildContext context, AppLocalizations l10n, QzColorScheme c) {
    return Row(
      children: <Widget>[
        Flexible(
          child: GestureDetector(
            onTap: onOpen,
            behavior: HitTestBehavior.opaque,
            child: Text(
              rule.address,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: c.accent,
                fontSize: 13,
                fontWeight: FontWeight.w600,
                fontFamily: QzFont.mono,
                fontFamilyFallback: QzFont.monoFallback,
                letterSpacing: -0.2,
              ),
            ),
          ),
        ),
        if (rule.live) ...<Widget>[
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
        if (rule.alias != null && rule.alias!.isNotEmpty) ...<Widget>[
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              rule.alias!,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                color: c.textMid,
                fontSize: 11.5,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ] else
          const Spacer(),
        _ActionBtn(
          icon: rule.muted
              ? Icons.notifications_off_outlined
              : Icons.notifications_outlined,
          tooltip: rule.muted
              ? l10n.whaleRuleMenuUnmute
              : l10n.whaleRuleMenuMute,
          onTap: onToggleMute,
        ),
        const SizedBox(width: 4),
        _ActionBtn(
          icon: Icons.edit_outlined,
          tooltip: l10n.whaleRuleMenuEdit,
          onTap: onEdit,
        ),
        const SizedBox(width: 4),
        _ActionBtn(
          icon: Icons.delete_outline,
          tooltip: l10n.whaleRuleMenuDelete,
          color: c.marketDown,
          onTap: onDelete,
        ),
      ],
    );
  }

  Widget _heroRow(AppLocalizations l10n, QzColorScheme c, bool empty,
      Color pnlColor) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.end,
      children: <Widget>[
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              _MetricLabel(text: l10n.whaleWatchPerpValue),
              const SizedBox(height: 2),
              Text(
                _fmtUsd(rule.perpValueUsd),
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: empty ? c.textDim : c.text,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  fontFamily: QzFont.mono,
                  fontFamilyFallback: QzFont.monoFallback,
                  letterSpacing: -0.3,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 10),
        Column(
          crossAxisAlignment: CrossAxisAlignment.end,
          children: <Widget>[
            _MetricLabel(text: l10n.whaleWatchUnrealizedPnl),
            const SizedBox(height: 2),
            Text(
              _fmtPnl(rule.unrealizedPnlUsd),
              style: TextStyle(
                color: pnlColor,
                fontSize: 13,
                fontWeight: FontWeight.w700,
                fontFamily: QzFont.mono,
                fontFamilyFallback: QzFont.monoFallback,
                letterSpacing: -0.2,
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _footerRow(AppLocalizations l10n, QzColorScheme c, bool empty,
      int? usage, Color usageColor) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Expanded(
          flex: 11,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              _MetricLabel(text: l10n.whaleWatchAvailMargin),
              const SizedBox(height: 2),
              Text(
                _fmtUsd(rule.availMarginUsd),
                overflow: TextOverflow.ellipsis,
                style: TextStyle(
                  color: empty ? c.textDim : c.text,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  fontFamily: QzFont.mono,
                  fontFamilyFallback: QzFont.monoFallback,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          flex: 12,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              _MetricLabel(text: l10n.whaleWatchMarginUsage),
              const SizedBox(height: 3),
              Row(
                children: <Widget>[
                  SizedBox(
                    width: 32,
                    child: Text(
                      usage == null ? '-' : '$usage%',
                      style: TextStyle(
                        color: empty ? c.textDim : c.text,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        fontFamily: QzFont.mono,
                        fontFamilyFallback: QzFont.monoFallback,
                      ),
                    ),
                  ),
                  if (usage != null)
                    Expanded(
                      child: ClipRRect(
                        borderRadius: BorderRadius.circular(2),
                        child: LinearProgressIndicator(
                          value: (usage.clamp(2, 100)) / 100,
                          minHeight: 3,
                          backgroundColor: c.bgSoft,
                          valueColor:
                              AlwaysStoppedAnimation<Color>(usageColor),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(width: 10),
        Expanded(
          flex: 6,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: <Widget>[
              _MetricLabel(text: l10n.whaleWatchPositions),
              const SizedBox(height: 2),
              Text(
                rule.positions == null ? '-' : '${rule.positions}',
                style: TextStyle(
                  color: empty ? c.textDim : c.text,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  fontFamily: QzFont.mono,
                  fontFamilyFallback: QzFont.monoFallback,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// USD 紧凑格式：null → `-`；否则 `$x.xM` / `$x.xK`。
String _fmtUsd(double? v) {
  if (v == null) return '-';
  final double abs = v.abs();
  final String sign = v < 0 ? '-' : '';
  if (abs >= 1e6) return '$sign\$${(abs / 1e6).toStringAsFixed(1)}M';
  if (abs >= 1e3) return '$sign\$${(abs / 1e3).toStringAsFixed(1)}K';
  return '$sign\$${abs.toStringAsFixed(0)}';
}

/// PnL 紧凑格式：带正负号；null → `-`。
String _fmtPnl(double? v) {
  if (v == null) return '-';
  final String body = _fmtUsd(v.abs());
  return v < 0 ? '-$body' : '+$body';
}

class _MetricLabel extends StatelessWidget {
  const _MetricLabel({required this.text});
  final String text;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Text(
      text,
      style: TextStyle(
        color: c.textDim,
        fontSize: 10,
        fontWeight: FontWeight.w500,
        letterSpacing: 0.2,
      ),
    );
  }
}

class _ActionBtn extends StatelessWidget {
  const _ActionBtn({
    required this.icon,
    required this.tooltip,
    required this.onTap,
    this.color,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onTap;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Tooltip(
      message: tooltip,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          width: 26,
          height: 26,
          decoration: BoxDecoration(
            color: c.bgElev,
            border: Border.all(color: c.borderSoft),
            borderRadius: BorderRadius.circular(6),
          ),
          alignment: Alignment.center,
          child: Icon(icon, size: 13, color: color ?? c.textMid),
        ),
      ),
    );
  }
}
