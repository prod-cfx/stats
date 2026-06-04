import 'package:flutter/material.dart';

import '../../../domain/models/whale_leader_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import 'whale_card_controls.dart';

/// AI 标签 chip 配色（对齐设计稿 AI_TAG_COLOR）。
const Map<String, ({int fg, int bg})> _aiTagColors =
    <String, ({int fg, int bg})>{
      '金库管家': (fg: 0xFF92400E, bg: 0xFFFEF3C7),
      '多头战神': (fg: 0xFF1E40AF, bg: 0xFFDBEAFE),
      '波段之王': (fg: 0xFF6D28D9, bg: 0xFFEDE9FE),
      '聪明交易者': (fg: 0xFF92400E, bg: 0xFFFEF3C7),
    };

/// 发现 tab 巨鲸列表卡（issue #1789 / #1860）。地址（复制 / chevron）+ 账户总价值
/// + 盈亏/持仓/胜率 + AI 标签 chip 行 + 右上趋势按钮。
///
/// 双入口（#1860）：点地址 → [onOpen]（详情页）；点卡片或趋势按钮 → [onStats]
/// （交易统计弹窗）。
class WhaleLeaderCard extends StatelessWidget {
  const WhaleLeaderCard({
    required this.entry,
    required this.onOpen,
    required this.onStats,
    required this.onCopy,
    super.key,
  });

  final WhaleLeaderEntry entry;
  final VoidCallback onOpen;
  final VoidCallback onStats;
  final VoidCallback onCopy;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onStats,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            color: c.bgElev,
            border: Border.all(color: c.borderSoft),
            borderRadius: BorderRadius.circular(12),
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
                  fontFamily: QzFont.mono,
                  fontFamilyFallback: QzFont.monoFallback,
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
        Flexible(
          child: WhaleAddressLink(address: entry.id, onOpen: onOpen),
        ),
        const SizedBox(width: QzSpacing.xs),
        WhaleCopyButton(onCopy: onCopy),
        const Spacer(),
        WhaleTrendButton(onStats: onStats),
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
            fontFamily: QzFont.mono,
            fontFamilyFallback: QzFont.monoFallback,
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
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Text(
            label,
            style: TextStyle(
              color: fg,
              fontSize: 10.5,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(width: 3),
          // info 图标（圆圈 + i），对齐设计稿 jsx:79-82，0.55 透明度。
          Opacity(
            opacity: 0.55,
            child: CustomPaint(
              size: const Size(9, 9),
              painter: _InfoIconPainter(color: fg),
            ),
          ),
        ],
      ),
    );
  }
}

/// AI 标签尾部 info 图标：9x9 圆圈 + "i"，描边色继承标签前景色（对齐设计稿）。
class _InfoIconPainter extends CustomPainter {
  const _InfoIconPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    // 设计稿 viewBox 24，stroke-width 2 → 缩放后线宽。
    final double scale = size.width / 24;
    final Paint stroke = Paint()
      ..color = color
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2 * scale
      ..strokeCap = StrokeCap.round;
    final Offset center = Offset(size.width / 2, size.height / 2);
    // circle cx=12 cy=12 r=9
    canvas.drawCircle(center, 9 * scale, stroke);
    // path M12 8v5（竖线主体）
    canvas.drawLine(
      Offset(center.dx, 8 * scale),
      Offset(center.dx, 13 * scale),
      stroke,
    );
    // path M12 16v.5（点）
    canvas.drawLine(
      Offset(center.dx, 16 * scale),
      Offset(center.dx, 16.5 * scale),
      stroke,
    );
  }

  @override
  bool shouldRepaint(_InfoIconPainter oldDelegate) =>
      oldDelegate.color != color;
}
