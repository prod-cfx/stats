part of 'qz_trade_order_sheet.dart';
// ignore_for_file: unused_element

class _HeaderRow extends StatelessWidget {
  const _HeaderRow({
    required this.symbol,
    required this.direction,
    required this.exchangeName,
  });

  final String symbol;
  final TradeDirection direction;
  final String exchangeName;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final String base = _QzTradeOrderSheetState._extractBase(symbol);
    final String title = direction == TradeDirection.buy
        ? l10n.tradeOrderSheetHeaderTitleBuy(base)
        : l10n.tradeOrderSheetHeaderTitleSell(base);
    final String subtitle = l10n.tradeOrderSheetHeaderSubtitle(
      symbol,
      exchangeName,
    );
    return Row(
      children: <Widget>[
        Container(
          width: 36,
          height: 36,
          decoration: BoxDecoration(
            color: c.bgSoft,
            borderRadius: BorderRadius.circular(QzRadii.pill),
          ),
          alignment: Alignment.center,
          child: Text(
            base.isNotEmpty ? base.substring(0, 1) : '?',
            style: TextStyle(
              color: c.text,
              fontSize: 14,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        const SizedBox(width: QzSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Text(
                title,
                style: TextStyle(
                  color: c.text,
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                subtitle,
                style: TextStyle(color: c.textMid, fontSize: 12),
              ),
            ],
          ),
        ),
        IconButton(
          key: const Key('trade-order-close'),
          tooltip: l10n.tradeOrderSheetCloseTooltip,
          onPressed: () => Navigator.of(context).maybePop(),
          icon: Icon(Icons.close, color: c.textMid, size: 18),
        ),
      ],
    );
  }
}

class _PopoverRow extends StatelessWidget {
  const _PopoverRow({
    required this.marginMode,
    required this.leverage,
    required this.showMarginPopover,
    required this.showLevPopover,
    required this.onTapMargin,
    required this.onTapLeverage,
    required this.onPickMargin,
    required this.onPickLeverage,
    required this.leverageOptions,
    required this.accentColor,
  });

  final TradeMarginMode marginMode;
  final int leverage;
  final bool showMarginPopover;
  final bool showLevPopover;
  final VoidCallback onTapMargin;
  final VoidCallback onTapLeverage;
  final ValueChanged<TradeMarginMode> onPickMargin;
  final ValueChanged<int> onPickLeverage;
  final List<int> leverageOptions;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final String marginLabel = marginMode == TradeMarginMode.cross
        ? l10n.tradeOrderSheetMarginCross
        : l10n.tradeOrderSheetMarginIsolated;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            Expanded(
              child: _PopoverButton(
                key: const Key('trade-order-margin-toggle'),
                label: marginLabel,
                active: showMarginPopover,
                onTap: onTapMargin,
              ),
            ),
            const SizedBox(width: QzSpacing.sm),
            Expanded(
              child: _PopoverButton(
                key: const Key('trade-order-leverage-toggle'),
                label: '${leverage}x',
                active: showLevPopover,
                onTap: onTapLeverage,
                emphasize: true,
              ),
            ),
          ],
        ),
        // 设计稿用 absolute popover；Flutter modal sheet 内的 Positioned
        // 会被 Stack 的 hit-test 边界裁掉。退而求其次：popover 直接撑高
        // 占位，把下方内容推下去——hit-test 正常、布局可预测、对滚动友好。
        if (showMarginPopover)
          Padding(
            padding: const EdgeInsets.only(top: QzSpacing.xs),
            child: Align(
              alignment: Alignment.centerLeft,
              child: _MarginModeMenu(
                value: marginMode,
                onPick: onPickMargin,
                accentColor: accentColor,
              ),
            ),
          ),
        if (showLevPopover)
          Padding(
            padding: const EdgeInsets.only(top: QzSpacing.xs),
            child: Align(
              alignment: Alignment.centerRight,
              child: _LeverageGrid(
                key: const Key('trade-order-leverage-grid'),
                options: leverageOptions,
                value: leverage,
                onPick: onPickLeverage,
                accentColor: accentColor,
                title: l10n.tradeOrderSheetLeverageGridTitle,
                scheme: c,
              ),
            ),
          ),
      ],
    );
  }
}

class _PopoverButton extends StatelessWidget {
  const _PopoverButton({
    super.key,
    required this.label,
    required this.active,
    required this.onTap,
    this.emphasize = false,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;
  final bool emphasize;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(QzRadii.input),
        child: Container(
          height: 34,
          padding: const EdgeInsets.symmetric(horizontal: QzSpacing.md),
          decoration: BoxDecoration(
            color: active ? c.bgInput : c.bgSoft,
            border: Border.all(color: active ? c.accent : c.borderSoft),
            borderRadius: BorderRadius.circular(QzRadii.input),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              Text(
                label,
                style: TextStyle(
                  color: c.text,
                  fontSize: 12,
                  fontWeight: emphasize ? FontWeight.w700 : FontWeight.w500,
                ),
              ),
              Icon(Icons.expand_more, size: 14, color: c.textMid),
            ],
          ),
        ),
      ),
    );
  }
}

class _MarginModeMenu extends StatelessWidget {
  const _MarginModeMenu({
    required this.value,
    required this.onPick,
    required this.accentColor,
  });

  final TradeMarginMode value;
  final ValueChanged<TradeMarginMode> onPick;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Material(
      elevation: 4,
      borderRadius: BorderRadius.circular(QzRadii.input),
      color: c.bgElev,
      child: Container(
        width: 160,
        decoration: BoxDecoration(
          border: Border.all(color: c.borderSoft),
          borderRadius: BorderRadius.circular(QzRadii.input),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            _menuItem(
              key: const Key('trade-order-margin-cross'),
              label: l10n.tradeOrderSheetMarginCross,
              active: value == TradeMarginMode.cross,
              scheme: c,
              accentColor: accentColor,
              onTap: () => onPick(TradeMarginMode.cross),
            ),
            _menuItem(
              key: const Key('trade-order-margin-isolated'),
              label: l10n.tradeOrderSheetMarginIsolated,
              active: value == TradeMarginMode.isolated,
              scheme: c,
              accentColor: accentColor,
              onTap: () => onPick(TradeMarginMode.isolated),
            ),
          ],
        ),
      ),
    );
  }

  Widget _menuItem({
    required Key key,
    required String label,
    required bool active,
    required QzColorScheme scheme,
    required Color accentColor,
    required VoidCallback onTap,
  }) {
    return InkWell(
      key: key,
      onTap: onTap,
      child: Container(
        width: double.infinity,
        padding: const EdgeInsets.symmetric(
          horizontal: QzSpacing.md,
          vertical: QzSpacing.sm,
        ),
        child: Text(
          label,
          style: TextStyle(
            color: active ? accentColor : scheme.text,
            fontSize: 13,
            fontWeight: active ? FontWeight.w700 : FontWeight.w500,
          ),
        ),
      ),
    );
  }
}

class _LeverageGrid extends StatelessWidget {
  const _LeverageGrid({
    super.key,
    required this.options,
    required this.value,
    required this.onPick,
    required this.accentColor,
    required this.title,
    required this.scheme,
  });

  final List<int> options;
  final int value;
  final ValueChanged<int> onPick;
  final Color accentColor;
  final String title;
  final QzColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    return Material(
      elevation: 4,
      borderRadius: BorderRadius.circular(QzRadii.input),
      color: scheme.bgElev,
      child: Container(
        width: 220,
        padding: const EdgeInsets.all(QzSpacing.sm),
        decoration: BoxDecoration(
          border: Border.all(color: scheme.borderSoft),
          borderRadius: BorderRadius.circular(QzRadii.input),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: <Widget>[
            Padding(
              padding: const EdgeInsets.fromLTRB(4, 2, 4, 6),
              child: Text(
                title,
                style: TextStyle(color: scheme.textMid, fontSize: 11),
              ),
            ),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: <Widget>[
                for (final int lev in options)
                  SizedBox(
                    width: 46,
                    height: 30,
                    child: _LeverageChip(
                      key: Key('trade-order-leverage-$lev'),
                      label: '${lev}x',
                      active: lev == value,
                      onTap: () => onPick(lev),
                      accentColor: accentColor,
                    ),
                  ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _LeverageChip extends StatelessWidget {
  const _LeverageChip({
    super.key,
    required this.label,
    required this.active,
    required this.onTap,
    required this.accentColor,
  });

  final String label;
  final bool active;
  final VoidCallback onTap;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Material(
      color: active ? accentColor : c.bgSoft,
      borderRadius: BorderRadius.circular(6),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(6),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              color: active ? Colors.white : c.text,
              fontSize: 12,
              fontWeight: FontWeight.w700,
              fontFamily: QzFont.mono,
              fontFamilyFallback: QzFont.monoFallback,
            ),
          ),
        ),
      ),
    );
  }
}

class _OrderTypeTabs extends StatelessWidget {
  const _OrderTypeTabs({
    required this.value,
    required this.onChanged,
    required this.accentColor,
  });

  final TradeOrderKind value;
  final ValueChanged<TradeOrderKind> onChanged;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<(TradeOrderKind, String, Key)> entries =
        <(TradeOrderKind, String, Key)>[
      (TradeOrderKind.limit, l10n.tradeOrderSheetTabLimit,
          const Key('trade-order-tab-limit')),
      (TradeOrderKind.market, l10n.tradeOrderSheetTabMarket,
          const Key('trade-order-tab-market')),
      (TradeOrderKind.conditional, l10n.tradeOrderSheetTabConditional,
          const Key('trade-order-tab-conditional')),
    ];
    return Container(
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: c.borderSoft)),
      ),
      child: Row(
        children: <Widget>[
          for (final (TradeOrderKind k, String label, Key key) in entries)
            Padding(
              padding: const EdgeInsets.only(right: QzSpacing.md),
              child: InkWell(
                key: key,
                onTap: () => onChanged(k),
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: QzSpacing.sm),
                  child: Column(
                    children: <Widget>[
                      Text(
                        label,
                        style: TextStyle(
                          color: k == value ? c.text : c.textMid,
                          fontSize: 13,
                          fontWeight:
                              k == value ? FontWeight.w700 : FontWeight.w500,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Container(
                        height: 2,
                        width: 24,
                        color: k == value ? accentColor : Colors.transparent,
                      ),
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

