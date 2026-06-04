part of 'orderbook_view.dart';

/// 盘口工具栏：视图模式三态 + 精度下拉；refresh / sort icon 暂禁用标 future。
class _Toolbar extends StatelessWidget {
  const _Toolbar({
    required this.view,
    required this.precision,
    required this.onViewChanged,
    required this.onPrecisionTap,
  });

  final ObView view;
  final double precision;
  final ValueChanged<ObView> onViewChanged;
  final VoidCallback onPrecisionTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.lg,
        vertical: QzSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border(bottom: BorderSide(color: c.borderSoft)),
      ),
      child: Row(
        children: <Widget>[
          _ToolbarIconButton(
            tooltip: l10n.orderbookRefreshFuture,
            icon: Icons.refresh,
            onTap: null, // future（#1682/#1683 真实数据接入后启用）
          ),
          const SizedBox(width: QzSpacing.xs),
          _ViewSegmented(view: view, onChanged: onViewChanged),
          const SizedBox(width: QzSpacing.xs),
          _ToolbarIconButton(
            tooltip: l10n.orderbookSortFuture,
            icon: Icons.swap_vert,
            onTap: null, // future
          ),
          const Spacer(),
          Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: onPrecisionTap,
              borderRadius: BorderRadius.circular(6),
              child: Container(
                height: 24,
                padding: const EdgeInsets.symmetric(horizontal: QzSpacing.sm),
                decoration: BoxDecoration(
                  color: c.bgElev,
                  border: Border.all(color: c.border),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: <Widget>[
                    Text(
                      _fmtPrecision(precision),
                      style: TextStyle(
                        color: c.text,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                        fontFamily: QzFont.mono,
                        fontFamilyFallback: QzFont.monoFallback,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Icon(Icons.keyboard_arrow_down, size: 12, color: c.textMid),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _ToolbarIconButton extends StatelessWidget {
  const _ToolbarIconButton({
    required this.tooltip,
    required this.icon,
    required this.onTap,
  });

  final String tooltip;
  final IconData icon;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(6),
          child: SizedBox(
            width: 26,
            height: 24,
            child: Icon(icon, size: 14, color: c.textDim),
          ),
        ),
      ),
    );
  }
}

class _ViewSegmented extends StatelessWidget {
  const _ViewSegmented({required this.view, required this.onChanged});

  final ObView view;
  final ValueChanged<ObView> onChanged;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<({ObView view, String label, Key key})> items =
        <({ObView view, String label, Key key})>[
          (
            view: ObView.both,
            label: l10n.orderbookViewBoth,
            key: const Key('orderbook-view-both'),
          ),
          (
            view: ObView.asks,
            label: l10n.orderbookViewAsks,
            key: const Key('orderbook-view-asks'),
          ),
          (
            view: ObView.bids,
            label: l10n.orderbookViewBids,
            key: const Key('orderbook-view-bids'),
          ),
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
          for (final item in items)
            Tooltip(
              message: item.label,
              child: Container(
                key: item.key,
                decoration: BoxDecoration(
                  color: view == item.view ? c.bgElev : Colors.transparent,
                  borderRadius: BorderRadius.circular(5),
                ),
                child: GestureDetector(
                  onTap: () => onChanged(item.view),
                  child: SizedBox(
                    width: 26,
                    height: 22,
                    child: Center(
                      child: _ObViewIcon(
                        view: item.view,
                        color: view == item.view ? c.accent : c.textMid,
                      ),
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _ObViewIcon extends StatelessWidget {
  const _ObViewIcon({required this.view, required this.color});

  final ObView view;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final List<double> widths = switch (view) {
      ObView.asks => <double>[12, 9, 6],
      ObView.bids => <double>[6, 9, 12],
      ObView.both => <double>[11, 8, 11],
    };
    final List<double> opacities = switch (view) {
      ObView.asks => <double>[0.9, 0.7, 0.5],
      ObView.bids => <double>[0.5, 0.7, 0.9],
      ObView.both => <double>[0.85, 0.85, 0.55],
    };
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        for (int i = 0; i < widths.length; i++) ...<Widget>[
          Container(
            width: widths[i],
            height: 1.8,
            decoration: BoxDecoration(
              color: color.withValues(alpha: opacities[i]),
              borderRadius: BorderRadius.circular(0.5),
            ),
          ),
          if (i != widths.length - 1) const SizedBox(height: 3),
        ],
      ],
    );
  }
}

/// 三列列头：价格(quote) / 数量(base) / 委托额($)，对齐设计稿 `:558-568`。
class _Header extends StatelessWidget {
  const _Header({required this.base, required this.quote});

  final String base;
  final String quote;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    TextStyle style() => TextStyle(
      color: c.textDim,
      fontSize: 10,
      fontFamily: QzFont.mono,
      fontFamilyFallback: QzFont.monoFallback,
    );
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.lg,
        vertical: 6,
      ),
      child: Row(
        children: <Widget>[
          Expanded(child: Text(l10n.orderbookColPrice(quote), style: style())),
          Expanded(
            child: Text(
              l10n.orderbookColQty(base),
              textAlign: TextAlign.right,
              style: style(),
            ),
          ),
          Expanded(
            child: Text(
              l10n.orderbookColAmount,
              textAlign: TextAlign.right,
              style: style(),
            ),
          ),
        ],
      ),
    );
  }
}

/// 单档行：累计量背景深度条 + 价格 / 数量 / 委托额三列，对齐设计稿 `OrderRow`。
class _OrderRow extends StatelessWidget {
  const _OrderRow({
    required this.level,
    required this.cum,
    required this.maxCum,
    required this.isBid,
  });

  final OrderbookLevel level;
  final double cum;
  final double maxCum;
  final bool isBid;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color color = isBid ? c.marketUp : c.marketDown;
    final double widthFactor = maxCum > 0
        ? (cum / maxCum).clamp(0.0, 1.0)
        : 0.0;
    // 委托额 = 价格 × 累计数量（notional），设计稿口径。
    final double notional = level.price * cum;
    TextStyle mono(Color col) => TextStyle(
      color: col,
      fontSize: 12,
      fontFamily: QzFont.mono,
      fontFamilyFallback: QzFont.monoFallback,
    );
    return Stack(
      children: <Widget>[
        Positioned.fill(
          child: Align(
            alignment: Alignment.centerRight,
            child: FractionallySizedBox(
              widthFactor: widthFactor,
              child: ColoredBox(color: color.withValues(alpha: 0.10)),
            ),
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(
            horizontal: QzSpacing.lg,
            vertical: 5,
          ),
          child: Row(
            children: <Widget>[
              Expanded(
                child: Text(level.price.toStringAsFixed(2), style: mono(color)),
              ),
              Expanded(
                child: Text(
                  level.quantity.toStringAsFixed(3),
                  textAlign: TextAlign.right,
                  style: mono(c.text),
                ),
              ),
              Expanded(
                child: Text(
                  _fmtNotional(notional),
                  textAlign: TextAlign.right,
                  style: mono(c.textMid),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

/// 双向视图中间 mid 价格行：大字价格 + 涨跌% + ≈$，对齐设计稿 `:575-588`。
class _MidRow extends StatelessWidget {
  const _MidRow({required this.mid, required this.changePercent});

  final double mid;
  final double? changePercent;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final double? pct = changePercent;
    final Color pctColor = pct == null || pct >= 0 ? c.marketUp : c.marketDown;
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.lg,
        vertical: 10,
      ),
      decoration: BoxDecoration(
        color: c.bgSoft,
        border: Border(
          top: BorderSide(color: c.borderSoft),
          bottom: BorderSide(color: c.borderSoft),
        ),
      ),
      child: Row(
        children: <Widget>[
          Text(
            mid.toStringAsFixed(2),
            style: TextStyle(
              color: c.text,
              fontSize: 18,
              fontWeight: FontWeight.w700,
              letterSpacing: -0.3,
              fontFamily: QzFont.mono,
              fontFamilyFallback: QzFont.monoFallback,
            ),
          ),
          const SizedBox(width: QzSpacing.sm),
          if (pct != null)
            Text(
              '${pct >= 0 ? '+' : ''}${pct.toStringAsFixed(2)}%',
              style: TextStyle(
                color: pctColor,
                fontSize: 11,
                fontWeight: FontWeight.w600,
                fontFamily: QzFont.mono,
                fontFamilyFallback: QzFont.monoFallback,
              ),
            ),
          const Spacer(),
          Text(
            '≈ \$${_fmtNotional(mid)}',
            style: TextStyle(
              color: c.textDim,
              fontSize: 10.5,
              fontFamily: QzFont.mono,
              fontFamilyFallback: QzFont.monoFallback,
            ),
          ),
        ],
      ),
    );
  }
}

/// 委托额/金额格式化：千分位整数，保持紧凑。
String _fmtNotional(double v) {
  final int rounded = v.round();
  final String s = rounded.abs().toString();
  final StringBuffer buf = StringBuffer();
  for (int i = 0; i < s.length; i++) {
    if (i > 0 && (s.length - i) % 3 == 0) buf.write(',');
    buf.write(s[i]);
  }
  return '${rounded < 0 ? '-' : ''}$buf';
}
