part of 'whale_detail_rows.dart';
// ignore_for_file: unused_element

/// coin 字形头像。
class _CoinHead extends StatelessWidget {
  const _CoinHead({required this.sym, required this.colorHex, this.size = 34});
  final String sym;
  final int colorHex;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: Color(colorHex), shape: BoxShape.circle),
      alignment: Alignment.center,
      child: Text(
        sym.isEmpty ? '?' : sym.substring(0, 1),
        style: const TextStyle(
          color: Colors.white,
          fontSize: 13,
          fontWeight: FontWeight.w700,
          fontFamily: QzFont.mono,
          fontFamilyFallback: QzFont.monoFallback,
        ),
      ),
    );
  }
}

/// side / 状态 chip（up 绿底 / dn 红底）。
class _SideChip extends StatelessWidget {
  const _SideChip({required this.up, required this.children});
  final bool up;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color tone = up ? c.marketUp : c.marketDown;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3),
      decoration: BoxDecoration(
        color: tone.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(6),
      ),
      child: DefaultTextStyle.merge(
        style: TextStyle(
          fontSize: 11.5,
          fontWeight: FontWeight.w600,
          color: tone,
          fontFamily: QzFont.mono,
          fontFamilyFallback: QzFont.monoFallback,
        ),
        child: Row(mainAxisSize: MainAxisSize.min, children: children),
      ),
    );
  }
}

/// 标签化数据 cell。
class _Cell extends StatelessWidget {
  const _Cell({
    required this.label,
    required this.value,
    required this.align,
    this.color,
  });
  final String label;
  final String value;
  final CrossAxisAlignment align;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final TextAlign ta = align == CrossAxisAlignment.end
        ? TextAlign.right
        : align == CrossAxisAlignment.center
        ? TextAlign.center
        : TextAlign.left;
    return Column(
      crossAxisAlignment: align,
      children: <Widget>[
        Text(label, style: TextStyle(fontSize: 10.5, color: c.textDim)),
        const SizedBox(height: 6),
        Text(
          value,
          textAlign: ta,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: color ?? c.text,
            letterSpacing: -0.3,
            fontFamily: QzFont.mono,
            fontFamilyFallback: QzFont.monoFallback,
          ),
        ),
      ],
    );
  }
}

class _AmountCell extends StatelessWidget {
  const _AmountCell({
    required this.label,
    required this.amount,
    required this.unit,
  });

  final String label;
  final String amount;
  final String unit;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(label, style: TextStyle(fontSize: 10.5, color: c.textDim)),
        const SizedBox(height: 6),
        RichText(
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          text: TextSpan(
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: c.text,
              letterSpacing: -0.3,
              fontFamily: QzFont.mono,
              fontFamilyFallback: QzFont.monoFallback,
            ),
            children: <InlineSpan>[
              TextSpan(text: amount),
              TextSpan(
                text: ' $unit',
                style: TextStyle(color: c.textDim, fontFamily: null),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// 3 列网格（左中右），不足补空。
class _Grid extends StatelessWidget {
  const _Grid({required this.cells});
  final List<Widget> cells;

  @override
  Widget build(BuildContext context) {
    final List<Widget> rows = <Widget>[];
    for (int i = 0; i < cells.length; i += 3) {
      if (i > 0) rows.add(const SizedBox(height: QzSpacing.md));
      rows.add(
        Row(
          children: <Widget>[
            Expanded(child: cells[i]),
            Expanded(
              child: i + 1 < cells.length ? cells[i + 1] : const SizedBox(),
            ),
            Expanded(
              child: i + 2 < cells.length ? cells[i + 2] : const SizedBox(),
            ),
          ],
        ),
      );
    }
    return Column(children: rows);
  }
}

class _RowShell extends StatelessWidget {
  const _RowShell({required this.head, required this.grid});
  final Widget head;
  final Widget grid;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 16, 14, 18),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: c.borderSoft)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          head,
          const SizedBox(height: QzSpacing.lg),
          grid,
        ],
      ),
    );
  }
}
