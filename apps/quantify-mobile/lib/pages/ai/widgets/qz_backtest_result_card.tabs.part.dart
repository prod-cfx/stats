part of 'qz_backtest_result_card.dart';
// ignore_for_file: unused_element

class _ResultSegmentedTabs extends StatelessWidget {
  const _ResultSegmentedTabs({
    required this.options,
    required this.value,
    required this.onChanged,
  });

  final List<String> options;
  final String value;
  final ValueChanged<String> onChanged;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      key: const Key('backtest-result-tabs'),
      width: double.infinity,
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: c.bgInput,
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: <Widget>[
          for (final String opt in options)
            Expanded(
              child: GestureDetector(
                key: Key('backtest-result-tab-$opt'),
                behavior: HitTestBehavior.opaque,
                onTap: () => onChanged(opt),
                child: Container(
                  height: 32,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: opt == value ? c.bgElev : Colors.transparent,
                    borderRadius: BorderRadius.circular(7),
                    boxShadow: opt == value
                        ? <BoxShadow>[
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.06),
                              blurRadius: 3,
                              offset: const Offset(0, 1),
                            ),
                          ]
                        : null,
                  ),
                  child: Text(
                    opt,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      color: opt == value ? c.accent : c.textMid,
                      fontSize: 12,
                      fontWeight: opt == value
                          ? FontWeight.w600
                          : FontWeight.w500,
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

class _DownloadButton extends StatelessWidget {
  const _DownloadButton({required this.onTap, required this.tooltip});

  final VoidCallback? onTap;
  final String tooltip;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Tooltip(
      message: tooltip,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          customBorder: const CircleBorder(),
          child: Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: c.bgElev,
              border: Border.all(color: c.border),
              shape: BoxShape.circle,
            ),
            child: Icon(
              Icons.file_download_outlined,
              size: 16,
              color: c.textMid,
            ),
          ),
        ),
      ),
    );
  }
}

class _MetricsGrid extends StatelessWidget {
  const _MetricsGrid({required this.result});

  final BacktestResult result;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final List<_Metric> metrics = <_Metric>[
      _Metric(
        label: l10n.backtestResultMetricCagr,
        value:
            '${result.cagrPercent >= 0 ? '+' : ''}${result.cagrPercent.toStringAsFixed(1)}%',
        sub: l10n.backtestResultMetricCagrSub,
        color: result.cagrPercent >= 0 ? c.marketUp : c.marketDown,
      ),
      _Metric(
        label: l10n.backtestResultSharpe,
        value: result.sharpe.toStringAsFixed(2),
        sub: l10n.backtestResultMetricSharpeSub,
        color: c.text,
      ),
      _Metric(
        label: l10n.backtestResultMaxDrawdown,
        value: '${result.maxDrawdownPercent.toStringAsFixed(1)}%',
        sub: l10n.backtestResultMetricMaxDrawdownSub,
        color: c.marketDown,
      ),
      _Metric(
        label: l10n.backtestResultMetricCalmar,
        value: result.calmar.toStringAsFixed(2),
        sub: l10n.backtestResultMetricCalmarSub,
        color: c.text,
      ),
      _Metric(
        label: l10n.backtestResultMetricWinRate,
        value: '${result.winRatePercent.toStringAsFixed(1)}%',
        sub: l10n.backtestResultMetricWinRateSub,
        color: c.text,
      ),
      _Metric(
        label: l10n.backtestResultMetricProfitLoss,
        value: result.profitLossRatio.toStringAsFixed(2),
        sub: l10n.backtestResultMetricProfitLossSub,
        color: c.text,
      ),
      _Metric(
        label: l10n.backtestResultMetricTotalTrades,
        value: '${result.totalTrades}${l10n.backtestResultTradesSuffix}',
        sub: l10n.backtestResultMetricTotalTradesSub,
        color: c.text,
      ),
      _Metric(
        label: l10n.backtestResultMetricAvgHold,
        value: result.avgHoldDuration,
        sub: l10n.backtestResultMetricAvgHoldSub,
        color: c.text,
      ),
    ];

    return Container(
      decoration: BoxDecoration(
        color: c.borderSoft,
        border: Border.all(color: c.border),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        children: <Widget>[
          for (int row = 0; row < metrics.length; row += 2)
            IntrinsicHeight(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: <Widget>[
                  Expanded(child: _MetricCell(metric: metrics[row])),
                  Container(width: 1, color: c.borderSoft),
                  Expanded(child: _MetricCell(metric: metrics[row + 1])),
                ],
              ),
            ),
        ],
      ),
    );
  }
}

class _Metric {
  const _Metric({
    required this.label,
    required this.value,
    required this.sub,
    required this.color,
  });

  final String label;
  final String value;
  final String sub;
  final Color color;
}

class _MetricCell extends StatelessWidget {
  const _MetricCell({required this.metric});

  final _Metric metric;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Container(
      color: c.bgElev,
      padding: const EdgeInsets.symmetric(
        horizontal: QzSpacing.md,
        vertical: QzSpacing.md,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Text(metric.label, style: TextStyle(color: c.textDim, fontSize: 11)),
          const SizedBox(height: QzSpacing.xxs),
          Text(
            metric.value,
            style: TextStyle(
              color: metric.color,
              fontSize: 17,
              fontWeight: FontWeight.w700,
              fontFeatures: const <FontFeature>[FontFeature.tabularFigures()],
            ),
          ),
          const SizedBox(height: 2),
          Text(metric.sub, style: TextStyle(color: c.textDim, fontSize: 10)),
        ],
      ),
    );
  }
}
