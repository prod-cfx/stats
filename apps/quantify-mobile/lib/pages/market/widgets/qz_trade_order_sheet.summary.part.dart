part of 'qz_trade_order_sheet.dart';
// ignore_for_file: unused_element

class _EstimatesPanel extends StatelessWidget {
  const _EstimatesPanel({
    required this.margin,
    required this.notional,
    required this.liquidation,
    required this.fee,
    required this.tpReturn,
    required this.slLoss,
    required this.direction,
  });

  final double margin;
  final double notional;
  final double? liquidation;
  final double fee;
  final double? tpReturn;
  final double? slLoss;
  final TradeDirection direction;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Container(
      padding: const EdgeInsets.all(QzSpacing.md),
      decoration: BoxDecoration(
        color: c.bgSoft,
        borderRadius: BorderRadius.circular(QzRadii.input),
      ),
      child: Column(
        children: <Widget>[
          _StatRow(
            label: l10n.tradeOrderSheetStatMargin,
            value: '${margin.toStringAsFixed(2)} USDT',
          ),
          const SizedBox(height: QzSpacing.xs),
          _StatRow(
            label: l10n.tradeOrderSheetStatNotional,
            value: '${notional.toStringAsFixed(2)} USDT',
          ),
          const SizedBox(height: QzSpacing.xs),
          _StatRow(
            label: l10n.tradeOrderSheetEstLiqPrice,
            value: liquidation == null
                ? l10n.tradeOrderSheetEstLiqPlaceholder
                : liquidation!.toStringAsFixed(2),
            tone: direction == TradeDirection.buy
                ? c.marketDown
                : c.marketUp,
          ),
          const SizedBox(height: QzSpacing.xs),
          _StatRow(
            label: l10n.tradeOrderSheetStatFee,
            value: '${fee.toStringAsFixed(2)} USDT',
          ),
          if (tpReturn != null) ...<Widget>[
            const SizedBox(height: QzSpacing.xs),
            _StatRow(
              label: l10n.tradeOrderSheetStatTpReturn,
              value: '+${tpReturn!.toStringAsFixed(2)} USDT',
              tone: c.marketUp,
            ),
          ],
          if (slLoss != null) ...<Widget>[
            const SizedBox(height: QzSpacing.xs),
            _StatRow(
              label: l10n.tradeOrderSheetStatSlLoss,
              value: '-${slLoss!.toStringAsFixed(2)} USDT',
              tone: c.marketDown,
            ),
          ],
        ],
      ),
    );
  }
}

class _StatRow extends StatelessWidget {
  const _StatRow({required this.label, required this.value, this.tone});

  final String label;
  final String value;
  final Color? tone;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Row(
      children: <Widget>[
        Text(label, style: TextStyle(color: c.textMid, fontSize: 12)),
        const Spacer(),
        Text(
          value,
          style: TextStyle(
            color: tone ?? c.text,
            fontSize: 12,
            fontWeight: FontWeight.w600,
            fontFamily: QzFont.mono,
            fontFamilyFallback: QzFont.monoFallback,
          ),
        ),
      ],
    );
  }
}

class _StickyFooter extends StatelessWidget {
  const _StickyFooter({
    super.key,
    required this.direction,
    required this.amount,
    required this.base,
    required this.enabled,
    required this.loading,
    required this.onPressed,
    required this.accentColor,
  });

  final TradeDirection direction;
  final double amount;
  final String base;
  final bool enabled;
  final bool loading;
  final VoidCallback onPressed;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final bool empty = amount <= 0;
    final String label;
    if (loading) {
      label = l10n.tradeOrderSheetSubmitting;
    } else if (empty) {
      label = l10n.tradeOrderSheetSubmitEmpty;
    } else {
      label = direction == TradeDirection.buy
          ? l10n.tradeOrderSheetSubmitConfirmBuy(
              amount.toStringAsFixed(4), base)
          : l10n.tradeOrderSheetSubmitConfirmSell(
              amount.toStringAsFixed(4), base);
    }
    return Column(
      children: <Widget>[
        Opacity(
          opacity: enabled ? 1 : 0.5,
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              onTap: enabled ? onPressed : null,
              borderRadius: BorderRadius.circular(QzRadii.input),
              child: Container(
                height: 50,
                width: double.infinity,
                decoration: BoxDecoration(
                  color: empty && !loading ? c.borderSoft : accentColor,
                  borderRadius: BorderRadius.circular(QzRadii.input),
                ),
                alignment: Alignment.center,
                child: loading
                    ? const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor:
                              AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      )
                    : Text(
                        label,
                        style: TextStyle(
                          color: empty
                              ? c.textMid
                              : Colors.white,
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
              ),
            ),
          ),
        ),
        const SizedBox(height: QzSpacing.xs),
        Text(
          l10n.tradeOrderSheetRiskHint,
          style: TextStyle(color: c.textDim, fontSize: 10),
        ),
      ],
    );
  }
}
