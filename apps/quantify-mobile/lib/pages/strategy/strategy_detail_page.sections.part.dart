part of 'strategy_detail_page.dart';
// ignore_for_file: unused_element

class _EquitySection extends StatelessWidget {
  const _EquitySection({required this.data});

  final List<double> data;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      key: const Key('strategy-detail-equity-section'),
      height: 120,
      child: EquityCurveView(data: data),
    );
  }
}

class _LogicSection extends StatelessWidget {
  const _LogicSection({required this.detail});
  final StrategyDetail detail;

  StrategyCard get card => detail.card;

  String _fallbackLogic(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final String desc = card.description.trim();
    return desc.isNotEmpty ? desc : l10n.strategyDetailLogicEmpty;
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final String logic = detail.logicDescription.trim().isNotEmpty
        ? detail.logicDescription.trim()
        : _fallbackLogic(context);
    return Container(
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      padding: const EdgeInsets.all(QzSpacing.md),
      child: Text(
        logic,
        style: TextStyle(color: c.text, fontSize: 13, height: 1.6),
      ),
    );
  }
}

class _EvidenceSection extends StatelessWidget {
  const _EvidenceSection({required this.detail});
  final StrategyDetail detail;

  String _dash(String value) => value.trim().isEmpty ? '--' : value.trim();

  String _dateFromMs(int? ms) {
    if (ms == null || ms <= 0) return '--';
    final DateTime date = DateTime.fromMillisecondsSinceEpoch(
      ms,
      isUtc: true,
    ).toLocal();
    return _date(date);
  }

  String _dateFromIso(String value) {
    final DateTime? date = DateTime.tryParse(value.trim());
    if (date == null) return '--';
    return _date(date.toLocal());
  }

  String _date(DateTime date) {
    final String month = date.month.toString().padLeft(2, '0');
    final String day = date.day.toString().padLeft(2, '0');
    return '${date.year}-$month-$day';
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final rows = <({String label, String value})>[
      (
        label: l10n.strategyDetailEvidenceRange,
        value:
            '${_dateFromMs(detail.backtestFromMs)} - ${_dateFromMs(detail.backtestToMs)}',
      ),
      (
        label: l10n.strategyDetailEvidenceDataSource,
        value: _dash(detail.dataSourceLabel),
      ),
      (
        label: l10n.strategyDetailEvidenceGeneratedAt,
        value: _dateFromIso(detail.generatedAt),
      ),
      (
        label: l10n.strategyDetailEvidenceCandles,
        value: detail.candleCount == null ? '--' : '${detail.candleCount}',
      ),
    ];
    return Container(
      key: const Key('strategy-detail-evidence-section'),
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      padding: const EdgeInsets.all(QzSpacing.md),
      child: LayoutBuilder(
        builder: (BuildContext context, BoxConstraints constraints) {
          final double gap = QzSpacing.sm;
          final double itemWidth = (constraints.maxWidth - gap) / 2;
          return Wrap(
            spacing: gap,
            runSpacing: QzSpacing.md,
            children: <Widget>[
              for (final row in rows)
                SizedBox(
                  width: itemWidth,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      Text(
                        row.label,
                        style: TextStyle(color: c.textDim, fontSize: 11),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        row.value,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: c.text,
                          fontSize: 12,
                          height: 1.25,
                          fontFeatures: const <FontFeature>[
                            FontFeature.tabularFigures(),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}

/// equity 卡（对齐设计稿 StratDetail equity 卡，#1825）：
/// 左上大号 `+CAGR%` + 「{period} 累计收益」+ 下方官方样本曲线。
class _EquityCard extends StatelessWidget {
  const _EquityCard({
    required this.cagr,
    required this.periodLabel,
    required this.curve,
  });

  final double cagr;
  final String periodLabel;
  final Widget curve;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final bool up = cagr >= 0;
    return Container(
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      padding: const EdgeInsets.all(QzSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: <Widget>[
              Text(
                '${up ? '+' : ''}${cagr.toStringAsFixed(1)}%',
                style: TextStyle(
                  color: up ? c.marketUp : c.marketDown,
                  fontSize: 22,
                  fontWeight: FontWeight.w700,
                  fontFeatures: const <FontFeature>[
                    FontFeature.tabularFigures(),
                  ],
                ),
              ),
              const SizedBox(width: QzSpacing.xs),
              Padding(
                padding: const EdgeInsets.only(bottom: 3),
                child: Text(
                  l10n.strategyDetailCumulativeReturn(periodLabel),
                  style: TextStyle(color: c.textDim, fontSize: 11),
                ),
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.sm),
          curve,
        ],
      ),
    );
  }
}

class _ConfidenceSection extends StatelessWidget {
  const _ConfidenceSection({required this.detail});
  final StrategyDetail detail;

  String _label(AppLocalizations l10n) {
    return switch (detail.confidenceLevel) {
      'high' => l10n.strategyDetailConfidenceHigh,
      'medium' => l10n.strategyDetailConfidenceMedium,
      'low' => l10n.strategyDetailConfidenceLow,
      _ => l10n.strategyDetailConfidenceUnknown,
    };
  }

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final List<String> reasons = detail.confidenceReasons.isNotEmpty
        ? detail.confidenceReasons
        : <String>[l10n.strategyDetailConfidenceReasonEmpty];
    return Container(
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      padding: const EdgeInsets.all(QzSpacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Icon(Icons.verified_outlined, color: c.marketUp, size: 18),
              const SizedBox(width: QzSpacing.xs),
              Text(
                _label(l10n),
                style: TextStyle(
                  color: c.text,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.sm),
          for (final String reason in reasons)
            Padding(
              padding: const EdgeInsets.only(bottom: 4),
              child: Text(
                reason,
                style: TextStyle(color: c.textDim, fontSize: 12, height: 1.45),
              ),
            ),
        ],
      ),
    );
  }
}

class _DisclaimerSection extends StatelessWidget {
  const _DisclaimerSection({required this.detail});
  final StrategyDetail detail;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final AppLocalizations l10n = AppLocalizations.of(context);
    final String disclaimer = detail.disclaimer.trim().isNotEmpty
        ? detail.disclaimer.trim()
        : l10n.strategyDetailDisclaimerFallback;
    return Container(
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(QzRadii.card),
      ),
      padding: const EdgeInsets.all(QzSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(Icons.info_outline, color: c.textDim, size: 18),
          const SizedBox(width: QzSpacing.sm),
          Expanded(
            child: Text(
              disclaimer,
              style: TextStyle(color: c.textDim, fontSize: 12, height: 1.45),
            ),
          ),
        ],
      ),
    );
  }
}
