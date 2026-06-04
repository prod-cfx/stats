part of 'market_home_page.dart';

class _SubTab extends StatelessWidget {
  const _SubTab({
    super.key,
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
    return Semantics(
      label: label,
      button: true,
      selected: selected,
      child: GestureDetector(
        onTap: onTap,
        behavior: HitTestBehavior.opaque,
        child: Container(
          padding: const EdgeInsets.only(bottom: 6),
          margin: const EdgeInsets.only(right: 18),
          decoration: BoxDecoration(
            border: Border(
              bottom: BorderSide(
                color: selected ? c.text : Colors.transparent,
                width: 2,
              ),
            ),
          ),
          child: Text(
            label,
            style: TextStyle(
              color: selected ? c.text : c.textDim,
              fontSize: 13,
              fontWeight: selected ? FontWeight.w600 : FontWeight.w500,
            ),
          ),
        ),
      ),
    );
  }
}

class _ColumnHeader extends StatelessWidget {
  const _ColumnHeader({
    required this.name,
    required this.price,
    required this.change,
  });

  final String name;
  final String price;
  final String change;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final TextStyle style = TextStyle(
      color: c.textDim,
      fontSize: 11,
      fontWeight: FontWeight.w500,
    );
    return Container(
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border(bottom: BorderSide(color: c.borderSoft)),
      ),
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.lg,
        vertical: 10,
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            flex: kTickerRowNameFlex,
            child: Text(name, style: style),
          ),
          Expanded(
            flex: kTickerRowPriceFlex,
            child: Text(price, style: style, textAlign: TextAlign.right),
          ),
          Expanded(
            flex: kTickerRowChangeFlex,
            child: Text(change, style: style, textAlign: TextAlign.right),
          ),
        ],
      ),
    );
  }
}
