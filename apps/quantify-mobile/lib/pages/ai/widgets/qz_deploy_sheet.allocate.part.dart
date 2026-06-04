part of 'qz_deploy_sheet.dart';
// ignore_for_file: unused_element

class _AllocatePane extends StatelessWidget {
  const _AllocatePane({
    required this.target,
    required this.amount,
    required this.perTradePct,
    required this.maxDailyLossPct,
    required this.notifyOpen,
    required this.notifyClose,
    required this.notifyStopLoss,
    required this.onAmountChanged,
    required this.onPerTradeChanged,
    required this.onMaxDailyLossChanged,
    required this.onNotifyOpenChanged,
    required this.onNotifyCloseChanged,
    required this.onNotifyStopLossChanged,
    required this.onNext,
  });

  /// mock 可用额度，快捷比例据此换算。
  static const double _available = 10000;

  final _DeployTarget target;
  final double amount;
  final int perTradePct;
  final int maxDailyLossPct;
  final bool notifyOpen;
  final bool notifyClose;
  final bool notifyStopLoss;
  final ValueChanged<double> onAmountChanged;
  final ValueChanged<int> onPerTradeChanged;
  final ValueChanged<int> onMaxDailyLossChanged;
  final ValueChanged<bool> onNotifyOpenChanged;
  final ValueChanged<bool> onNotifyCloseChanged;
  final ValueChanged<bool> onNotifyStopLossChanged;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      mainAxisSize: MainAxisSize.min,
      children: <Widget>[
        // 投入金额
        Text(
          l10n.deployAllocateAmountLabel,
          style: TextStyle(
            color: c.textDim,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: QzSpacing.xs),
        Container(
          key: const Key('deploy-allocate-amount'),
          padding: const EdgeInsets.all(QzSpacing.md),
          decoration: BoxDecoration(
            color: c.bgSoft,
            border: Border.all(color: c.border),
            borderRadius: BorderRadius.circular(QzRadii.card),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: <Widget>[
              Text(
                '\$${amount.toStringAsFixed(0)} USDT',
                style: TextStyle(
                  color: c.text,
                  fontSize: 24,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: QzSpacing.sm),
              Row(
                children: <Widget>[
                  for (final int pct in <int>[25, 50, 75, 100])
                    Expanded(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 3),
                        child: InkWell(
                          key: Key('deploy-allocate-pct-$pct'),
                          onTap: () => onAmountChanged(_available * pct / 100),
                          borderRadius: BorderRadius.circular(QzRadii.card),
                          child: Container(
                            height: 30,
                            alignment: Alignment.center,
                            decoration: BoxDecoration(
                              color: c.border.withValues(alpha: 0.3),
                              borderRadius: BorderRadius.circular(QzRadii.card),
                            ),
                            child: Text(
                              pct == 100 ? 'MAX' : '$pct%',
                              style: TextStyle(
                                color: c.textDim,
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 4),
        Text(
          l10n.deployAllocateAmountHint,
          style: TextStyle(color: c.textDim, fontSize: 11),
        ),
        const SizedBox(height: QzSpacing.md),
        // 单笔仓位上限（滑块）
        _AllocateSliderRow(
          fieldKey: const Key('deploy-allocate-per-trade'),
          label: l10n.deployAllocatePerTradeLabel,
          caption: l10n.deployAllocatePerTradeCaption,
          value: perTradePct,
          min: 10,
          max: 100,
          step: 5,
          ticks: const <String>['10%', '50%', '100%'],
          valueLabel: '$perTradePct%',
          valueColor: c.accent,
          onChanged: onPerTradeChanged,
          scheme: c,
        ),
        const SizedBox(height: QzSpacing.sm),
        // 日内最大亏损（滑块，danger 色）
        _AllocateSliderRow(
          fieldKey: const Key('deploy-allocate-max-loss'),
          label: l10n.deployAllocateMaxDailyLossLabel,
          caption: l10n.deployAllocateMaxDailyLossCaption,
          value: maxDailyLossPct,
          min: 1,
          max: 15,
          step: 1,
          ticks: const <String>['-1%', '-8%', '-15%'],
          valueLabel: '-$maxDailyLossPct%',
          valueColor: c.statusDanger,
          onChanged: onMaxDailyLossChanged,
          scheme: c,
        ),
        const SizedBox(height: QzSpacing.sm),
        // 通知（分渠道开关）
        Text(
          l10n.deployAllocateNotifySectionLabel,
          style: TextStyle(
            color: c.textDim,
            fontSize: 12,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: QzSpacing.xs),
        Container(
          key: const Key('deploy-allocate-notify'),
          decoration: BoxDecoration(
            color: c.bgSoft,
            border: Border.all(color: c.border),
            borderRadius: BorderRadius.circular(QzRadii.card),
          ),
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: <Widget>[
              _NotifyRow(
                rowKey: const Key('deploy-allocate-notify-open'),
                label: l10n.deployAllocateNotifyOpenLabel,
                caption: l10n.deployAllocateNotifyOpenCaption,
                value: notifyOpen,
                onChanged: onNotifyOpenChanged,
                showDivider: false,
                scheme: c,
              ),
              _NotifyRow(
                rowKey: const Key('deploy-allocate-notify-close'),
                label: l10n.deployAllocateNotifyCloseLabel,
                caption: l10n.deployAllocateNotifyCloseCaption,
                value: notifyClose,
                onChanged: onNotifyCloseChanged,
                showDivider: true,
                scheme: c,
              ),
              _NotifyRow(
                rowKey: const Key('deploy-allocate-notify-stop-loss'),
                label: l10n.deployAllocateNotifyStopLossLabel,
                caption: l10n.deployAllocateNotifyStopLossCaption,
                value: notifyStopLoss,
                onChanged: onNotifyStopLossChanged,
                showDivider: true,
                scheme: c,
              ),
            ],
          ),
        ),
        const SizedBox(height: QzSpacing.lg),
        QzButton(
          key: const Key('deploy-allocate-next'),
          label: l10n.deployAllocateNextButton,
          variant: QzButtonVariant.accent,
          onPressed: onNext,
        ),
      ],
    );
  }
}

/// 资金配置内的「label + 值 + 滑块 + 刻度」行（#1796，对齐设计稿 DpSlider）。
class _AllocateSliderRow extends StatelessWidget {
  const _AllocateSliderRow({
    required this.fieldKey,
    required this.label,
    required this.caption,
    required this.value,
    required this.min,
    required this.max,
    required this.step,
    required this.ticks,
    required this.valueLabel,
    required this.valueColor,
    required this.onChanged,
    required this.scheme,
  });

  final Key fieldKey;
  final String label;
  final String caption;
  final int value;
  final int min;
  final int max;
  final int step;

  /// 滑块下方刻度标签（左/中/右），对齐设计稿三档。
  final List<String> ticks;
  final String valueLabel;
  final Color valueColor;
  final ValueChanged<int> onChanged;
  final QzColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = scheme;
    final int divisions = ((max - min) / step).round();
    return Container(
      key: fieldKey,
      padding: const EdgeInsets.all(QzSpacing.md),
      decoration: BoxDecoration(
        color: c.bgSoft,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: <Widget>[
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      label,
                      style: TextStyle(
                        color: c.text,
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    Text(
                      caption,
                      style: TextStyle(color: c.textDim, fontSize: 11),
                    ),
                  ],
                ),
              ),
              Text(
                valueLabel,
                style: TextStyle(
                  color: valueColor,
                  fontSize: 20,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          SliderTheme(
            data: SliderTheme.of(context).copyWith(
              activeTrackColor: valueColor,
              thumbColor: valueColor,
              inactiveTrackColor: c.border,
              overlayColor: valueColor.withValues(alpha: 0.16),
              trackHeight: 4,
            ),
            child: Slider(
              value: value.toDouble().clamp(min.toDouble(), max.toDouble()),
              min: min.toDouble(),
              max: max.toDouble(),
              divisions: divisions,
              label: valueLabel,
              onChanged: (double v) => onChanged(v.round().clamp(min, max)),
            ),
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: <Widget>[
              for (final String t in ticks)
                Text(t, style: TextStyle(color: c.textDim, fontSize: 10)),
            ],
          ),
        ],
      ),
    );
  }
}

/// 通知分渠道开关行（#1796，对齐设计稿 3 个开关）。
class _NotifyRow extends StatelessWidget {
  const _NotifyRow({
    required this.rowKey,
    required this.label,
    required this.caption,
    required this.value,
    required this.onChanged,
    required this.showDivider,
    required this.scheme,
  });

  final Key rowKey;
  final String label;
  final String caption;
  final bool value;
  final ValueChanged<bool> onChanged;
  final bool showDivider;
  final QzColorScheme scheme;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = scheme;
    return Container(
      key: rowKey,
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.md,
        vertical: QzSpacing.xs,
      ),
      decoration: BoxDecoration(
        border: showDivider
            ? Border(top: BorderSide(color: c.borderSoft))
            : null,
      ),
      child: Row(
        children: <Widget>[
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  label,
                  style: TextStyle(
                    color: c.text,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                Text(caption, style: TextStyle(color: c.textDim, fontSize: 11)),
              ],
            ),
          ),
          Switch(value: value, onChanged: onChanged),
        ],
      ),
    );
  }
}
