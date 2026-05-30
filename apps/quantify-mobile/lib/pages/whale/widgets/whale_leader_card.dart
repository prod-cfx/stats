import 'package:flutter/material.dart';

import '../../../data/models/whale_leader_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// AI 标签 chip 配色（对齐设计稿 AI_TAG_COLOR）。
const Map<String, ({int fg, int bg})> _aiTagColors = <String, ({int fg, int bg})>{
  '金库管家': (fg: 0xFF92400E, bg: 0xFFFEF3C7),
  '多头战神': (fg: 0xFF1E40AF, bg: 0xFFDBEAFE),
  '波段之王': (fg: 0xFF6D28D9, bg: 0xFFEDE9FE),
  '聪明交易者': (fg: 0xFF92400E, bg: 0xFFFEF3C7),
};

/// 发现 tab 巨鲸列表卡（issue #1789）。地址 + 账户总价值 + 盈亏/持仓/胜率 +
/// AI 标签 chip 行。
class WhaleLeaderCard extends StatelessWidget {
  const WhaleLeaderCard({required this.entry, required this.onTap, super.key});

  final WhaleLeaderEntry entry;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(QzSpacing.lg),
          decoration: BoxDecoration(
            border: Border.all(color: c.borderSoft),
            borderRadius: BorderRadius.circular(QzRadii.card),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              _addressRow(c),
              const SizedBox(height: QzSpacing.md),
              Text('账户总价值', style: TextStyle(color: c.textDim, fontSize: 11)),
              const SizedBox(height: 2),
              Text(
                entry.aumDisplay,
                style: TextStyle(
                  color: c.text,
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.3,
                ),
              ),
              const SizedBox(height: QzSpacing.md),
              _statsGrid(l10n, c),
              const SizedBox(height: QzSpacing.md),
              Divider(height: 1, color: c.borderSoft),
              const SizedBox(height: QzSpacing.sm),
              _tagsRow(l10n, c),
            ],
          ),
        ),
      ),
    );
  }

  Widget _addressRow(QzColorScheme c) {
    return Row(
      children: <Widget>[
        Expanded(
          child: Text(
            entry.id,
            style: TextStyle(
              color: c.accent,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        Icon(Icons.show_chart, size: 16, color: c.accent),
      ],
    );
  }

  Widget _statsGrid(AppLocalizations l10n, QzColorScheme c) {
    final Color pnlColor = entry.pnlPositive ? c.marketUp : c.marketDown;
    return Row(
      children: <Widget>[
        Expanded(
          child: _StatCell(
            label: l10n.whaleLeaderPnlLabel,
            value: entry.pnlDisplay,
            valueColor: pnlColor,
            align: CrossAxisAlignment.start,
          ),
        ),
        Expanded(
          child: _StatCell(
            label: l10n.whaleLeaderPositionsLabel,
            value: '${entry.positions}',
            valueColor: c.text,
            align: CrossAxisAlignment.center,
          ),
        ),
        Expanded(
          child: _StatCell(
            label: l10n.whaleLeaderWinRateLabel,
            value: '${entry.winRate.toStringAsFixed(2)}%',
            valueColor: c.text,
            align: CrossAxisAlignment.end,
          ),
        ),
      ],
    );
  }

  Widget _tagsRow(AppLocalizations l10n, QzColorScheme c) {
    return Wrap(
      spacing: QzSpacing.xs,
      runSpacing: QzSpacing.xs,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: <Widget>[
        Text(
          '${l10n.whaleLeaderAiTagsLabel}:',
          style: TextStyle(color: c.textDim, fontSize: 11),
        ),
        if (entry.tags.isEmpty)
          Text(
            l10n.whaleLeaderTagsEmpty,
            style: TextStyle(color: c.textFaint, fontSize: 11),
          )
        else
          for (final String t in entry.tags) _AiTagChip(label: t),
      ],
    );
  }
}

class _StatCell extends StatelessWidget {
  const _StatCell({
    required this.label,
    required this.value,
    required this.valueColor,
    required this.align,
  });

  final String label;
  final String value;
  final Color valueColor;
  final CrossAxisAlignment align;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final TextAlign textAlign = align == CrossAxisAlignment.start
        ? TextAlign.left
        : align == CrossAxisAlignment.end
            ? TextAlign.right
            : TextAlign.center;
    return Column(
      crossAxisAlignment: align,
      children: <Widget>[
        Text(
          label,
          textAlign: textAlign,
          style: TextStyle(color: c.textDim, fontSize: 10),
        ),
        const SizedBox(height: 3),
        Text(
          value,
          textAlign: textAlign,
          style: TextStyle(
            color: valueColor,
            fontSize: 13,
            fontWeight: FontWeight.w700,
          ),
        ),
      ],
    );
  }
}

class _AiTagChip extends StatelessWidget {
  const _AiTagChip({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final ({int fg, int bg})? palette = _aiTagColors[label];
    final Color fg = palette != null ? Color(palette.fg) : c.textMid;
    final Color bg = palette != null ? Color(palette.bg) : c.bgSoft;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: fg,
          fontSize: 10.5,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }
}
