part of 'agg_orderbook_card.dart';

class _ModeSegment extends StatelessWidget {
  const _ModeSegment({required this.futures, required this.onChanged});

  final bool futures;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    return _Pills(
      options: <String>[l10n.aggModeFutures, l10n.aggModeSpot],
      selectedIndex: futures ? 0 : 1,
      onIndex: (int i) => onChanged(i == 0),
      keyPrefix: 'agg-mode',
    );
  }
}

class _CoinSegment extends StatelessWidget {
  const _CoinSegment({required this.coin, required this.onChanged});

  final String coin;
  final ValueChanged<String> onChanged;

  static const List<String> _coins = <String>['BTC', 'ETH'];

  @override
  Widget build(BuildContext context) {
    return _Pills(
      options: _coins,
      selectedIndex: _coins.indexOf(coin).clamp(0, _coins.length - 1),
      onIndex: (int i) => onChanged(_coins[i]),
      keyPrefix: 'agg-coin-mode',
    );
  }
}

/// accent 填充的 pill 段控件（合约/现货、BTC/ETH）。
class _Pills extends StatelessWidget {
  const _Pills({
    required this.options,
    required this.selectedIndex,
    required this.onIndex,
    required this.keyPrefix,
  });

  final List<String> options;
  final int selectedIndex;
  final ValueChanged<int> onIndex;
  final String keyPrefix;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: c.bgSoft,
        borderRadius: BorderRadius.circular(QzRadii.input),
        border: Border.all(color: c.borderSoft),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          for (int i = 0; i < options.length; i++)
            GestureDetector(
              key: Key('$keyPrefix-$i'),
              onTap: () => onIndex(i),
              child: Container(
                height: 26,
                padding: const EdgeInsets.symmetric(horizontal: 14),
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: i == selectedIndex ? c.accent : Colors.transparent,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  options[i],
                  style: TextStyle(
                    color: i == selectedIndex ? c.accentOn : c.textMid,
                    fontSize: 12,
                    fontWeight: i == selectedIndex
                        ? FontWeight.w600
                        : FontWeight.w500,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _StatsLine extends StatelessWidget {
  const _StatsLine({required this.coin});

  final String coin;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    TextStyle dim() => TextStyle(
      color: c.textDim,
      fontSize: 10.5,
      fontFamily: QzFont.mono,
      fontFamilyFallback: QzFont.monoFallback,
    );
    TextStyle strong() => TextStyle(
      color: c.text,
      fontSize: 10.5,
      fontWeight: FontWeight.w600,
      fontFamily: QzFont.mono,
      fontFamilyFallback: QzFont.monoFallback,
    );
    Widget statText(String label, String value) => Text.rich(
      TextSpan(
        children: <InlineSpan>[
          TextSpan(text: '$label ', style: dim()),
          TextSpan(text: value, style: strong()),
        ],
      ),
    );

    return Wrap(
      spacing: 14,
      runSpacing: QzSpacing.xs,
      crossAxisAlignment: WrapCrossAlignment.center,
      children: <Widget>[
        statText(l10n.aggStat24hVolume, '6.82万 $coin'),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            SizedBox(
              key: const Key('agg-stat-divider'),
              width: 1,
              height: 11,
              child: ColoredBox(color: c.borderSoft),
            ),
            const SizedBox(width: 14),
            statText(l10n.aggStat24hTurnover, 'US\$7159万'),
          ],
        ),
      ],
    );
  }
}

class _CardHeader extends StatelessWidget {
  const _CardHeader({
    required this.title,
    required this.view,
    required this.precision,
    required this.precisionExpanded,
    required this.onView,
    required this.onPrecision,
    required this.onSource,
  });

  final String title;
  final AggView view;
  final int precision;
  final bool precisionExpanded;
  final ValueChanged<AggView> onView;
  final VoidCallback onPrecision;
  final VoidCallback onSource;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      padding: const EdgeInsets.fromLTRB(
        QzSpacing.md,
        QzSpacing.md,
        QzSpacing.md,
        QzSpacing.sm,
      ),
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: c.borderSoft)),
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Text(
              key: const Key('agg-orderbook-title'),
              title,
              maxLines: 2,
              style: TextStyle(
                color: c.text,
                fontSize: 12.5,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(width: QzSpacing.sm),
          _ViewToggle(view: view, onChanged: onView),
          const SizedBox(width: QzSpacing.xs),
          _PrecisionButton(
            precision: precision,
            expanded: precisionExpanded,
            onPressed: onPrecision,
          ),
          const SizedBox(width: QzSpacing.xs),
          IconButton(
            key: const Key('agg-source-button'),
            tooltip: AppLocalizations.of(context).aggExchangeSourceTooltip,
            onPressed: onSource,
            iconSize: 16,
            visualDensity: VisualDensity.compact,
            constraints: const BoxConstraints(minWidth: 28, minHeight: 24),
            padding: EdgeInsets.zero,
            icon: Icon(Icons.settings_outlined, color: c.textMid),
          ),
        ],
      ),
    );
  }
}

/// 价格精度按钮：展开时紫色渐变底 + 反白文本 + caret 翻转 180°。
class _PrecisionButton extends StatelessWidget {
  const _PrecisionButton({
    required this.precision,
    required this.expanded,
    required this.onPressed,
  });

  final int precision;
  final bool expanded;
  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color fg = expanded ? c.accentOn : c.text;
    return Semantics(
      button: true,
      label: 'precision $precision',
      child: GestureDetector(
        key: const Key('agg-precision-button'),
        onTap: onPressed,
        child: Container(
          height: 24,
          padding: const EdgeInsets.symmetric(horizontal: QzSpacing.xs),
          decoration: BoxDecoration(
            gradient: expanded ? c.accentGrad : null,
            color: expanded ? null : Colors.transparent,
            borderRadius: BorderRadius.circular(QzRadii.input),
            border: Border.all(color: expanded ? Colors.transparent : c.border),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Text(
                '$precision',
                style: TextStyle(
                  color: fg,
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  fontFamily: QzFont.mono,
                  fontFamilyFallback: QzFont.monoFallback,
                ),
              ),
              AnimatedRotation(
                turns: expanded ? 0.5 : 0,
                duration: const Duration(milliseconds: 150),
                child: Icon(
                  Icons.keyboard_arrow_down,
                  size: 14,
                  color: expanded ? fg : c.textMid,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// 价格精度抽屉单行：圆形单选（选中 accent 实心 + 勾）。
class _PrecisionOption extends StatelessWidget {
  const _PrecisionOption({
    super.key,
    required this.value,
    required this.selected,
    required this.onTap,
  });

  final int value;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: QzSpacing.lg,
          vertical: QzSpacing.md,
        ),
        child: Row(
          children: <Widget>[
            Expanded(
              child: Text(
                '$value',
                style: TextStyle(
                  color: selected ? c.accent : c.text,
                  fontFamily: QzFont.mono,
                  fontFamilyFallback: QzFont.monoFallback,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            Container(
              width: 20,
              height: 20,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: selected ? c.accent : Colors.transparent,
                border: Border.all(
                  color: selected ? c.accent : c.border,
                  width: 1.5,
                ),
              ),
              child: selected
                  ? Icon(Icons.check, size: 13, color: c.accentOn)
                  : null,
            ),
          ],
        ),
      ),
    );
  }
}

class _ViewToggle extends StatelessWidget {
  const _ViewToggle({required this.view, required this.onChanged});

  final AggView view;
  final ValueChanged<AggView> onChanged;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<(AggView, String)> items = <(AggView, String)>[
      (AggView.both, l10n.aggViewBoth),
      (AggView.asks, l10n.aggViewAsks),
      (AggView.bids, l10n.aggViewBids),
    ];
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(
        color: c.bgSoft,
        borderRadius: BorderRadius.circular(7),
        border: Border.all(color: c.borderSoft),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          for (final (AggView, String) item in items)
            GestureDetector(
              key: Key('agg-view-${item.$1.name}'),
              onTap: () => onChanged(item.$1),
              child: Semantics(
                label: item.$2,
                selected: view == item.$1,
                button: true,
                child: Container(
                  width: 24,
                  height: 22,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: view == item.$1 ? c.bgElev : Colors.transparent,
                    borderRadius: BorderRadius.circular(5),
                  ),
                  child: _ViewModeIcon(
                    view: item.$1,
                    color: view == item.$1 ? c.accent : c.textMid,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

/// 视图模式条形语义图标（对齐设计稿 `ViewModeIcon`）。
///
/// 用堆叠横条区分三态：双向上下对称、卖单上密、买单下密。
class _ViewModeIcon extends StatelessWidget {
  const _ViewModeIcon({required this.view, required this.color});

  final AggView view;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 13,
      height: 13,
      child: CustomPaint(painter: _ViewModeIconPainter(view, color)),
    );
  }
}

class _ViewModeIconPainter extends CustomPainter {
  const _ViewModeIconPainter(this.view, this.color);

  final AggView view;
  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final Paint paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
    const double barHeight = 2;
    const Radius radius = Radius.circular(1);
    // 每条横条的中心 y（以 13 逻辑单位为基准）。
    final List<double> centers = switch (view) {
      // 双向：上下两组对称分布。
      AggView.both => <double>[2.5, 5, 8, 10.5],
      // 卖单：顶部三条密集。
      AggView.asks => <double>[2, 4.5, 7],
      // 买单：底部三条密集。
      AggView.bids => <double>[6, 8.5, 11],
    };
    for (final double cy in centers) {
      final RRect bar = RRect.fromRectAndRadius(
        Rect.fromLTWH(0, cy - barHeight / 2, size.width, barHeight),
        radius,
      );
      canvas.drawRRect(bar, paint);
    }
  }

  @override
  bool shouldRepaint(_ViewModeIconPainter old) =>
      old.view != view || old.color != color;
}

const List<int> _bookFlex = <int>[16, 34, 24, 26];

Color _marketSoft(QzColorScheme c, bool isAsk) {
  if (c.brightness == Brightness.dark) {
    return isAsk ? QzStatusDark.dangerSoft : QzStatusDark.okSoft;
  }
  return isAsk ? QzStatus.dangerSoft : QzStatus.okSoft;
}
