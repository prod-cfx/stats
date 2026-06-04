part of 'agg_orderbook_card.dart';

class _ColumnHeader extends StatelessWidget {
  const _ColumnHeader({required this.coin});

  final String coin;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    TextStyle s() => TextStyle(
      color: c.textDim,
      fontSize: 10,
      fontFamily: QzFont.mono,
      fontFamilyFallback: QzFont.monoFallback,
    );
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.md,
        vertical: QzSpacing.sm,
      ),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: c.borderSoft)),
      ),
      child: Row(
        children: <Widget>[
          Expanded(flex: _bookFlex[0], child: const SizedBox()),
          Expanded(
            flex: _bookFlex[1],
            child: Text(l10n.aggColPrice, style: s()),
          ),
          Expanded(
            flex: _bookFlex[2],
            child: Text(
              l10n.aggColQty(coin),
              textAlign: TextAlign.right,
              style: s(),
            ),
          ),
          Expanded(
            flex: _bookFlex[3],
            child: Text(
              l10n.aggColTotal(coin),
              textAlign: TextAlign.right,
              style: s(),
            ),
          ),
        ],
      ),
    );
  }
}

class _BookRow extends StatelessWidget {
  const _BookRow({
    required this.level,
    required this.isAsk,
    required this.maxCum,
    required this.exchangeMap,
  });

  final AggBookLevel level;
  final bool isAsk;
  final double maxCum;
  final Map<String, AggExchange> exchangeMap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color side = isAsk ? c.marketDown : c.marketUp;
    final Color sideSoft = _marketSoft(c, isAsk);
    final double w = maxCum <= 0 ? 0 : (level.total / maxCum).clamp(0, 1);
    final double hotW = (w + 0.3).clamp(0, 1);
    final AggExchange? ex = exchangeMap[level.exchange];
    final String priceKey = level.price.toStringAsFixed(2);
    return Stack(
      children: <Widget>[
        Positioned.fill(
          child: Align(
            alignment: Alignment.centerRight,
            child: FractionallySizedBox(
              widthFactor: w,
              child: ColoredBox(
                key: Key('agg-book-depth-base-$priceKey'),
                color: sideSoft.withValues(alpha: 0.35),
              ),
            ),
          ),
        ),
        if (level.hot)
          Positioned.fill(
            child: Align(
              alignment: Alignment.centerRight,
              child: FractionallySizedBox(
                widthFactor: hotW,
                child: ColoredBox(
                  key: Key('agg-book-depth-hot-$priceKey'),
                  color: sideSoft.withValues(alpha: 0.45),
                ),
              ),
            ),
          ),
        Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: QzSpacing.md,
            vertical: 7,
          ),
          child: Row(
            children: <Widget>[
              Expanded(
                flex: _bookFlex[0],
                child: ex == null
                    ? const SizedBox()
                    : Align(
                        alignment: Alignment.centerLeft,
                        child: AggExchangeAvatar(
                          exchange: ex,
                          size: 16,
                          shape: AggExchangeAvatarShape.circle,
                        ),
                      ),
              ),
              Expanded(
                flex: _bookFlex[1],
                child: Text(
                  level.price.toStringAsFixed(2),
                  style: TextStyle(
                    color: side,
                    fontSize: 11.5,
                    fontWeight: FontWeight.w600,
                    fontFamily: QzFont.mono,
                    fontFamilyFallback: QzFont.monoFallback,
                  ),
                ),
              ),
              Expanded(
                flex: _bookFlex[2],
                child: Text(
                  level.qty.toStringAsFixed(4),
                  textAlign: TextAlign.right,
                  style: TextStyle(
                    color: c.text,
                    fontSize: 11.5,
                    fontFamily: QzFont.mono,
                    fontFamilyFallback: QzFont.monoFallback,
                  ),
                ),
              ),
              Expanded(
                flex: _bookFlex[3],
                child: Text(
                  level.total.toStringAsFixed(4),
                  textAlign: TextAlign.right,
                  style: TextStyle(
                    color: c.text,
                    fontSize: 11.5,
                    fontWeight: FontWeight.w500,
                    fontFamily: QzFont.mono,
                    fontFamilyFallback: QzFont.monoFallback,
                  ),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _MidStrip extends StatelessWidget {
  const _MidStrip({required this.bestBid, required this.bestAsk});

  final double? bestBid;
  final double? bestAsk;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Container(
      key: const Key('agg-mid-strip'),
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.md,
        vertical: QzSpacing.sm,
      ),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
          colors: <Color>[
            _marketSoft(c, false).withValues(alpha: 0.20),
            _marketSoft(c, true).withValues(alpha: 0.20),
          ],
        ),
        border: Border(
          top: BorderSide(color: c.borderSoft),
          bottom: BorderSide(color: c.borderSoft),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: <Widget>[
          Text(
            l10n.aggBestBidAsk,
            style: TextStyle(color: c.textDim, fontSize: 10),
          ),
          Text.rich(
            TextSpan(
              children: <InlineSpan>[
                TextSpan(
                  text: bestBid?.toStringAsFixed(2) ?? '--',
                  style: TextStyle(
                    color: c.marketUp,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    fontFamily: QzFont.mono,
                    fontFamilyFallback: QzFont.monoFallback,
                  ),
                ),
                TextSpan(
                  text: '  ↔  ',
                  style: TextStyle(color: c.textDim, fontSize: 13),
                ),
                TextSpan(
                  text: bestAsk?.toStringAsFixed(2) ?? '--',
                  style: TextStyle(
                    color: c.marketDown,
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    fontFamily: QzFont.mono,
                    fontFamilyFallback: QzFont.monoFallback,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _DepthLegend extends StatelessWidget {
  const _DepthLegend({required this.coin});

  final String coin;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    Widget dot(Color color, String label) => Row(
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(2),
          ),
        ),
        const SizedBox(width: QzSpacing.xxs),
        Text(label, style: TextStyle(color: c.textDim, fontSize: 10)),
      ],
    );
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: <Widget>[
        Row(
          children: <Widget>[
            dot(c.marketUp, l10n.aggDepthLegendBids),
            const SizedBox(width: QzSpacing.md),
            dot(c.marketDown, l10n.aggDepthLegendAsks),
          ],
        ),
        Text(
          l10n.aggUnit(coin),
          style: TextStyle(
            color: c.textDim,
            fontSize: 10,
            fontFamily: QzFont.mono,
            fontFamilyFallback: QzFont.monoFallback,
          ),
        ),
      ],
    );
  }
}

/// 交易所来源底部抽屉（多选 + 全选/清空）。
class _SourceSheet extends StatefulWidget {
  const _SourceSheet({
    required this.initial,
    required this.exchanges,
    required this.onSelectionChanged,
  });

  final Set<String> initial;
  final List<AggExchange> exchanges;
  final ValueChanged<Set<String>> onSelectionChanged;

  @override
  State<_SourceSheet> createState() => _SourceSheetState();
}

class _SourceSheetState extends State<_SourceSheet> {
  late Set<String> _selected = widget.initial.toSet();

  void _update(Set<String> next) {
    setState(() => _selected = next);
    widget.onSelectionChanged(next.toSet());
  }

  void _toggle(String key) {
    final Set<String> next = _selected.toSet();
    if (next.contains(key)) {
      next.remove(key);
    } else {
      next.add(key);
    }
    _update(next);
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return SafeArea(
      top: false,
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          const QzGrabHandle(margin: EdgeInsets.fromLTRB(0, 10, 0, 0)),
          Padding(
            padding: const EdgeInsets.fromLTRB(
              QzSpacing.lg,
              QzSpacing.md,
              QzSpacing.sm,
              QzSpacing.sm,
            ),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: Text(
                    l10n.aggExchangeSourceTitle,
                    style: TextStyle(
                      color: c.text,
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                TextButton(
                  key: const Key('agg-source-select-all'),
                  onPressed: () => _update(
                    widget.exchanges.map((AggExchange e) => e.key).toSet(),
                  ),
                  child: Text(
                    l10n.aggSelectAll,
                    style: TextStyle(color: c.accent),
                  ),
                ),
                TextButton(
                  key: const Key('agg-source-clear-all'),
                  onPressed: () => _update(<String>{}),
                  child: Text(
                    l10n.aggClearAll,
                    style: TextStyle(color: c.textMid),
                  ),
                ),
              ],
            ),
          ),
          for (final AggExchange ex in widget.exchanges)
            InkWell(
              key: Key('agg-source-${ex.key}'),
              onTap: () => _toggle(ex.key),
              child: Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: QzSpacing.lg,
                  vertical: QzSpacing.md,
                ),
                child: Row(
                  children: <Widget>[
                    AggExchangeAvatar(
                      key: Key('agg-source-avatar-${ex.key}'),
                      exchange: ex,
                      size: 20,
                      shape: AggExchangeAvatarShape.circle,
                    ),
                    const SizedBox(width: QzSpacing.sm),
                    Expanded(
                      child: Text(
                        ex.name,
                        style: TextStyle(
                          color: _selected.contains(ex.key)
                              ? c.text
                              : c.textMid,
                          fontSize: 13.5,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                    _CircleChoice(
                      key: Key('agg-source-choice-${ex.key}'),
                      selected: _selected.contains(ex.key),
                    ),
                  ],
                ),
              ),
            ),
          const SizedBox(height: QzSpacing.md),
        ],
      ),
    );
  }
}

class _CircleChoice extends StatelessWidget {
  const _CircleChoice({super.key, required this.selected});

  final bool selected;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      width: 20,
      height: 20,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: selected ? c.accent : Colors.transparent,
        border: Border.all(color: selected ? c.accent : c.border, width: 1.5),
      ),
      child: selected ? Icon(Icons.check, size: 13, color: c.accentOn) : null,
    );
  }
}
