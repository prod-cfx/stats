part of 'whale_live_tab.dart';
// ignore_for_file: unused_element

class _GroupHeader extends StatelessWidget {
  const _GroupHeader({required this.label, required this.count});

  final String label;
  final int count;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      color: c.bg,
      padding: const EdgeInsets.fromLTRB(QzSpacing.lg, 8, QzSpacing.lg, 8),
      child: Row(
        children: <Widget>[
          Text(
            label,
            style: TextStyle(
              color: c.textDim,
              fontSize: 11,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.4,
            ),
          ),
          const SizedBox(width: QzSpacing.sm),
          Expanded(child: Container(height: 1, color: c.borderSoft)),
          const SizedBox(width: QzSpacing.sm),
          Text('$count', style: TextStyle(color: c.textMid, fontSize: 11)),
        ],
      ),
    );
  }
}

class _CountdownBadge extends StatelessWidget {
  const _CountdownBadge({required this.tick});
  final int tick;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Container(
          width: 6,
          height: 6,
          decoration: BoxDecoration(
            color: c.marketUp,
            borderRadius: BorderRadius.circular(3),
          ),
        ),
        const SizedBox(width: 5),
        Text.rich(
          TextSpan(
            children: <InlineSpan>[
              TextSpan(
                text: '$tick',
                style: TextStyle(color: c.text, fontWeight: FontWeight.w600),
              ),
              TextSpan(text: l10n.localeName == 'zh' ? ' 秒后更新' : 's'),
            ],
          ),
          style: TextStyle(
            color: c.textMid,
            fontSize: 11,
            fontFamily: QzFont.mono,
            fontFamilyFallback: QzFont.monoFallback,
          ),
        ),
      ],
    );
  }
}

class _CoinChip extends StatelessWidget {
  const _CoinChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        height: 30,
        padding: const EdgeInsets.symmetric(horizontal: 14),
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: selected ? c.accentSoft : Colors.transparent,
          border: Border.all(color: selected ? c.accent : Colors.transparent),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: selected ? c.accent : c.textMid,
            fontSize: 13,
            fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
            letterSpacing: 0.3,
            fontFamily: QzFont.mono,
            fontFamilyFallback: QzFont.monoFallback,
          ),
        ),
      ),
    );
  }
}
