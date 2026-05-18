import 'package:flutter/material.dart';

import '../theme/colors.dart';
import '../theme/theme_context.dart';
import '../theme/tokens.dart';

/// Semantic tones for [QzChip]. Maps onto [QzColorScheme] status fields
/// (and `text`/`bgElev` for the inverse tone).
///
/// Prototype tones `info` and `violet` are renamed to `info` (mapped to
/// `statusInfo`) and `accent` to match the resolved-token model: chips track
/// the active accent, not a hard-coded violet.
enum QzChipTone {
  neutral,
  ok,
  warn,
  danger,
  info,
  accent,
  inverse,
}

/// 7-tone semantic label chip with optional leading icon. Direct port of the
/// prototype `Chip({tone, children})` primitive.
class QzChip extends StatelessWidget {
  const QzChip({
    super.key,
    required this.label,
    this.tone = QzChipTone.neutral,
    this.leading,
  });

  final String label;
  final QzChipTone tone;
  final IconData? leading;

  /// Maps [tone] onto the resolved color scheme. Static because it never
  /// reads instance state — keep it that way to make the mapping obviously
  /// pure.
  static ({Color bg, Color fg, Color border}) _paletteFor(
    QzChipTone tone,
    QzColorScheme c,
  ) {
    Color soft(Color base) => base.withValues(alpha: 0.14);
    switch (tone) {
      case QzChipTone.neutral:
        return (bg: c.bgSoft, fg: c.textMid, border: c.border);
      case QzChipTone.ok:
        return (bg: soft(c.statusOk), fg: c.statusOk, border: Colors.transparent);
      case QzChipTone.warn:
        return (
          bg: soft(c.statusWarn),
          fg: c.statusWarn,
          border: Colors.transparent,
        );
      case QzChipTone.danger:
        return (
          bg: soft(c.statusDanger),
          fg: c.statusDanger,
          border: Colors.transparent,
        );
      case QzChipTone.info:
        return (
          bg: soft(c.statusInfo),
          fg: c.statusInfo,
          border: Colors.transparent,
        );
      case QzChipTone.accent:
        return (bg: c.accentSoft, fg: c.accent, border: Colors.transparent);
      case QzChipTone.inverse:
        return (bg: c.text, fg: c.bgElev, border: Colors.transparent);
    }
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final ({Color bg, Color fg, Color border}) p = _paletteFor(tone, c);
    return Container(
      height: 22,
      padding: const EdgeInsets.symmetric(horizontal: QzSpacing.sm),
      decoration: BoxDecoration(
        color: p.bg,
        border: Border.all(color: p.border),
        borderRadius: BorderRadius.circular(QzRadii.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          if (leading != null) ...<Widget>[
            Icon(leading, size: 12, color: p.fg),
            const SizedBox(width: QzSpacing.xxs),
          ],
          Text(
            label,
            style: TextStyle(
              color: p.fg,
              fontSize: 11,
              fontWeight: FontWeight.w500,
              height: 1.0,
            ),
          ),
        ],
      ),
    );
  }
}
