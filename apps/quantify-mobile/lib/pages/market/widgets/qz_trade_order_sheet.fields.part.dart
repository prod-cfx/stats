part of 'qz_trade_order_sheet.dart';
// ignore_for_file: unused_element

class _NumberField extends StatelessWidget {
  const _NumberField({
    super.key,
    required this.label,
    required this.controller,
    this.labelColor,
  });

  final String label;
  final TextEditingController controller;
  final Color? labelColor;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          label,
          style: TextStyle(
            color: labelColor ?? c.textMid,
            fontSize: 12,
            fontWeight: labelColor == null ? FontWeight.w500 : FontWeight.w700,
          ),
        ),
        const SizedBox(height: 4),
        TextField(
          controller: controller,
          keyboardType: const TextInputType.numberWithOptions(decimal: true),
          inputFormatters: <TextInputFormatter>[
            FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
            TextInputFormatter.withFunction((
              TextEditingValue oldValue,
              TextEditingValue newValue,
            ) {
              final int dotCount = '.'.allMatches(newValue.text).length;
              return dotCount > 1 ? oldValue : newValue;
            }),
          ],
          style: TextStyle(
            color: c.text,
            fontSize: 14,
            fontWeight: FontWeight.w600,
            fontFamily: QzFont.mono,
            fontFamilyFallback: QzFont.monoFallback,
          ),
          decoration: InputDecoration(
            isDense: true,
            hintStyle: TextStyle(color: c.textFaint, fontSize: 14),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: QzSpacing.md,
              vertical: QzSpacing.sm,
            ),
            filled: true,
            fillColor: c.bgInput,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(QzRadii.input),
              borderSide: BorderSide(color: c.border),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(QzRadii.input),
              borderSide: BorderSide(color: c.border),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(QzRadii.input),
              borderSide: BorderSide(color: c.accent),
            ),
          ),
        ),
      ],
    );
  }
}

class _PriceFieldWithStepper extends StatelessWidget {
  const _PriceFieldWithStepper({
    required this.controller,
    required this.label,
    required this.onStepUp,
    required this.onStepDown,
  });

  final TextEditingController controller;
  final String label;
  final VoidCallback onStepUp;
  final VoidCallback onStepDown;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          label,
          style: TextStyle(color: c.textMid, fontSize: 12),
        ),
        const SizedBox(height: 4),
        Row(
          children: <Widget>[
            Expanded(
              child: TextField(
                key: const Key('trade-order-price'),
                controller: controller,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                inputFormatters: <TextInputFormatter>[
                  FilteringTextInputFormatter.allow(RegExp(r'[0-9.]')),
                  TextInputFormatter.withFunction((
                    TextEditingValue oldValue,
                    TextEditingValue newValue,
                  ) {
                    final int dotCount =
                        '.'.allMatches(newValue.text).length;
                    return dotCount > 1 ? oldValue : newValue;
                  }),
                ],
                style: TextStyle(
                  color: c.text,
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  fontFamily: QzFont.mono,
                  fontFamilyFallback: QzFont.monoFallback,
                ),
                decoration: InputDecoration(
                  isDense: true,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: QzSpacing.md,
                    vertical: QzSpacing.sm,
                  ),
                  filled: true,
                  fillColor: c.bgInput,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(QzRadii.input),
                    borderSide: BorderSide(color: c.border),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(QzRadii.input),
                    borderSide: BorderSide(color: c.border),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(QzRadii.input),
                    borderSide: BorderSide(color: c.accent),
                  ),
                ),
              ),
            ),
            const SizedBox(width: QzSpacing.xs),
            Column(
              children: <Widget>[
                _StepperButton(
                  key: const Key('trade-order-price-step-up'),
                  icon: Icons.add,
                  onTap: onStepUp,
                ),
                const SizedBox(height: 2),
                _StepperButton(
                  key: const Key('trade-order-price-step-down'),
                  icon: Icons.remove,
                  onTap: onStepDown,
                ),
              ],
            ),
          ],
        ),
      ],
    );
  }
}

class _StepperButton extends StatelessWidget {
  const _StepperButton({super.key, required this.icon, required this.onTap});

  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Material(
      color: c.bgSoft,
      borderRadius: BorderRadius.circular(4),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(4),
        child: Container(
          width: 28,
          height: 18,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            border: Border.all(color: c.borderSoft),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Icon(icon, size: 12, color: c.textMid),
        ),
      ),
    );
  }
}

class _ReferencePriceRow extends StatelessWidget {
  const _ReferencePriceRow({
    required this.latest,
    required this.bid1,
    required this.ask1,
    required this.onPick,
  });

  final double? latest;
  final double? bid1;
  final double? ask1;
  final ValueChanged<double?> onPick;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<(Key, String, double?)> entries = <(Key, String, double?)>[
      (
        const Key('trade-order-ref-latest'),
        l10n.tradeOrderSheetReferenceLatest,
        latest,
      ),
      (
        const Key('trade-order-ref-bid1'),
        l10n.tradeOrderSheetReferenceBid1,
        bid1,
      ),
      (
        const Key('trade-order-ref-ask1'),
        l10n.tradeOrderSheetReferenceAsk1,
        ask1,
      ),
    ];
    return Row(
      children: <Widget>[
        for (final (Key key, String label, double? value) in entries)
          Expanded(
            child: Padding(
              padding: const EdgeInsets.only(right: QzSpacing.xs),
              child: Material(
                color: c.bgSoft,
                borderRadius: BorderRadius.circular(6),
                child: InkWell(
                  key: key,
                  onTap: value == null ? null : () => onPick(value),
                  borderRadius: BorderRadius.circular(6),
                  child: Container(
                    height: 26,
                    alignment: Alignment.center,
                    child: Text(
                      value == null
                          ? label
                          : '$label ${value.toStringAsFixed(2)}',
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        color: c.textMid,
                        fontSize: 11,
                        fontFamily: QzFont.mono,
                        fontFamilyFallback: QzFont.monoFallback,
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _MarketHintCard extends StatelessWidget {
  const _MarketHintCard({required this.refPrice});

  final double? refPrice;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.md,
        vertical: QzSpacing.sm,
      ),
      decoration: BoxDecoration(
        color: c.bgSoft,
        borderRadius: BorderRadius.circular(QzRadii.input),
      ),
      child: Row(
        children: <Widget>[
          Icon(Icons.bolt, size: 14, color: c.accent),
          const SizedBox(width: QzSpacing.xs),
          Expanded(
            child: Text.rich(
              TextSpan(
                style: TextStyle(color: c.textMid, fontSize: 12),
                children: <InlineSpan>[
                  TextSpan(text: l10n.tradeOrderSheetMarketHintPrefix),
                  TextSpan(
                    text: refPrice?.toStringAsFixed(2) ?? '—',
                    style: TextStyle(
                      color: c.text,
                      fontWeight: FontWeight.w700,
                      fontFamily: QzFont.mono,
                      fontFamilyFallback: QzFont.monoFallback,
                    ),
                  ),
                  TextSpan(text: l10n.tradeOrderSheetMarketHintSuffix),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _AmountRow extends StatelessWidget {
  const _AmountRow({required this.amount, required this.availableBalance});

  final double amount;
  final double availableBalance;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          children: <Widget>[
            Text(
              l10n.tradeOrderSheetFieldAmount,
              style: TextStyle(color: c.textMid, fontSize: 12),
            ),
            const Spacer(),
            Text(
              l10n.tradeOrderSheetAvailableLabel(
                availableBalance.toStringAsFixed(2),
              ),
              style: TextStyle(
                color: c.textDim,
                fontSize: 11,
                fontFamily: QzFont.mono,
                fontFamilyFallback: QzFont.monoFallback,
              ),
            ),
          ],
        ),
        const SizedBox(height: 4),
        Container(
          key: const Key('trade-order-amount'),
          height: 46,
          padding: const EdgeInsets.symmetric(horizontal: QzSpacing.md),
          decoration: BoxDecoration(
            color: c.bgInput,
            border: Border.all(color: c.border),
            borderRadius: BorderRadius.circular(QzRadii.input),
          ),
          alignment: Alignment.centerLeft,
          child: Text(
            amount.toStringAsFixed(4),
            style: TextStyle(
              color: c.text,
              fontSize: 14,
              fontWeight: FontWeight.w600,
              fontFamily: QzFont.mono,
              fontFamilyFallback: QzFont.monoFallback,
            ),
          ),
        ),
      ],
    );
  }
}

class _PercentSlider extends StatelessWidget {
  const _PercentSlider({
    required this.value,
    required this.onChanged,
    required this.accentColor,
  });

  final double value;
  final ValueChanged<double> onChanged;
  final Color accentColor;

  static const List<int> _stops = <int>[0, 25, 50, 75, 100];

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return SizedBox(
      key: const Key('trade-order-pct-slider'),
      height: 48,
      child: LayoutBuilder(
        builder: (BuildContext ctx, BoxConstraints constraints) {
          final double w = constraints.maxWidth;
          double pctFromDx(double dx) {
            if (w <= 0) return 0;
            return (dx / w * 100).clamp(0, 100).toDouble();
          }

          return GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTapDown: (TapDownDetails d) =>
                onChanged(pctFromDx(d.localPosition.dx).roundToDouble()),
            onPanUpdate: (DragUpdateDetails d) =>
                onChanged(pctFromDx(d.localPosition.dx)),
            child: Stack(
              children: <Widget>[
                Positioned(
                  left: 0,
                  right: 0,
                  top: 22,
                  child: Container(height: 2, color: c.border),
                ),
                Positioned(
                  left: 0,
                  top: 22,
                  width: w * value / 100,
                  child: Container(height: 2, color: accentColor),
                ),
                for (final int p in _stops)
                  Positioned(
                    left: (w * p / 100) - 7,
                    top: 16,
                    child: GestureDetector(
                      key: Key('trade-order-pct-$p'),
                      onTap: () => onChanged(p.toDouble()),
                      child: Container(
                        width: 14,
                        height: 14,
                        decoration: BoxDecoration(
                          color: value >= p ? accentColor : c.bgElev,
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: value >= p ? accentColor : c.border,
                            width: 2,
                          ),
                        ),
                      ),
                    ),
                  ),
                Positioned(
                  left: (w * value / 100) - 12,
                  top: 11,
                  child: IgnorePointer(
                    child: Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        color: accentColor,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 3),
                        boxShadow: <BoxShadow>[
                          BoxShadow(
                            color: accentColor.withValues(alpha: 0.4),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
                for (final int p in _stops)
                  Positioned(
                    left: (w * p / 100) - 14,
                    top: 34,
                    child: Text(
                      '$p%',
                      style: TextStyle(
                        color: value.round() == p ? accentColor : c.textDim,
                        fontSize: 10,
                        fontWeight: value.round() == p
                            ? FontWeight.w700
                            : FontWeight.w500,
                        fontFamily: QzFont.mono,
                        fontFamilyFallback: QzFont.monoFallback,
                      ),
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }
}

class _TpSlToggleRow extends StatelessWidget {
  const _TpSlToggleRow({
    required this.enabled,
    required this.onChanged,
    required this.accentColor,
  });

  final bool enabled;
  final ValueChanged<bool> onChanged;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return InkWell(
      key: const Key('trade-order-tpsl-toggle'),
      onTap: () => onChanged(!enabled),
      borderRadius: BorderRadius.circular(QzRadii.input),
      child: Container(
        padding: const EdgeInsets.symmetric(
          horizontal: QzSpacing.md,
          vertical: QzSpacing.sm,
        ),
        decoration: BoxDecoration(
          color: c.bgSoft,
          borderRadius: BorderRadius.circular(QzRadii.input),
        ),
        child: Row(
          children: <Widget>[
            Icon(
              Icons.shield_outlined,
              size: 14,
              color: enabled ? accentColor : c.textMid,
            ),
            const SizedBox(width: QzSpacing.xs),
            Expanded(
              child: Text(
                l10n.tradeOrderSheetTpsl,
                style: TextStyle(
                  color: enabled ? c.text : c.textMid,
                  fontSize: 12,
                ),
              ),
            ),
            Switch.adaptive(
              value: enabled,
              onChanged: onChanged,
              activeThumbColor: Colors.white,
              activeTrackColor: accentColor,
            ),
          ],
        ),
      ),
    );
  }
}

