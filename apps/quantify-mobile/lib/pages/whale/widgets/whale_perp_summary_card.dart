import 'package:flutter/material.dart';

import '../../../data/models/whale_profile_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 永续合约总价值明细卡（设计稿 `WhaleProfileDetail` `:856`）。
///
/// 总价值 + 平均保证金使用率进度条 + 方向偏差（多/空 BiasBar）+ 仓位分布
/// （多头/空头价值）+ ROI + 未实现盈亏。消费 [WhalePerpSummary]。
class WhalePerpSummaryCard extends StatelessWidget {
  const WhalePerpSummaryCard({super.key, required this.summary});

  final WhalePerpSummary summary;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final bool roiUp = summary.roiPct >= 0;
    return Container(
      padding: const EdgeInsets.all(QzSpacing.lg),
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Text(
                l10n.whaleProfilePerpTotalValue,
                style: TextStyle(fontSize: 12, color: c.textMid),
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: c.bgSoft,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  l10n.whaleProfileCurrentPosition,
                  style: TextStyle(fontSize: 10.5, color: c.textMid),
                ),
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.xs),
          Text(
            summary.totalValueDisplay,
            style: TextStyle(
              fontSize: 22,
              fontWeight: FontWeight.w700,
              color: c.text,
              letterSpacing: -0.4,
              fontFamily: QzFont.mono,
              fontFamilyFallback: QzFont.monoFallback,
            ),
          ),
          const SizedBox(height: QzSpacing.lg),
          _LabeledValue(
            label: l10n.whaleProfileMarginUsage,
            value: '${summary.marginUsagePct.toStringAsFixed(2)} %',
          ),
          const SizedBox(height: QzSpacing.xs),
          _Progress(pct: summary.marginUsagePct, color: QzStatus.cyan),
          const _Divider(),
          _LabeledValue(
            label: l10n.whaleProfileDirectionBias2,
            value: summary.biasLabel,
            mono: false,
          ),
          const SizedBox(height: QzSpacing.sm),
          _BiasBar(
            label: l10n.whaleProfileLongPosition,
            pct: summary.longPct,
            color: c.marketUp,
          ),
          const SizedBox(height: QzSpacing.sm),
          _BiasBar(
            label: l10n.whaleProfileShortPosition,
            pct: summary.shortPct,
            color: c.marketDown,
          ),
          const _Divider(),
          Text(
            l10n.whaleProfilePositionDist,
            style: TextStyle(fontSize: 12, color: c.textMid),
          ),
          const SizedBox(height: QzSpacing.sm),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              _ValueBlock(
                label: l10n.whaleProfileLongValue,
                value: summary.longValueDisplay,
                align: CrossAxisAlignment.start,
              ),
              const Spacer(),
              _ValueBlock(
                label: l10n.whaleProfileShortValue,
                value: summary.shortValueDisplay,
                align: CrossAxisAlignment.end,
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.sm),
          Container(
            height: 3,
            decoration: BoxDecoration(
              color: c.marketDown,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const _Divider(),
          _LabeledValue(
            label: l10n.whaleProfileRoi,
            value: '${summary.roiPct.toStringAsFixed(2)} %',
            valueColor: roiUp ? c.marketUp : c.marketDown,
          ),
          const SizedBox(height: QzSpacing.xs),
          _LabeledValue(
            label: l10n.whaleProfileStatUnrealized,
            value: summary.unrealizedDisplay,
            valueColor: roiUp ? c.marketUp : c.marketDown,
          ),
        ],
      ),
    );
  }
}

class _Divider extends StatelessWidget {
  const _Divider();
  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: QzSpacing.md),
      child: Container(height: 1, color: c.borderSoft),
    );
  }
}

class _LabeledValue extends StatelessWidget {
  const _LabeledValue({
    required this.label,
    required this.value,
    this.valueColor,
    this.mono = true,
  });
  final String label;
  final String value;
  final Color? valueColor;
  final bool mono;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: <Widget>[
        Text(label, style: TextStyle(fontSize: 12, color: c.textMid)),
        Text(
          value,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w600,
            color: valueColor ?? c.text,
            fontFamily: mono ? QzFont.mono : null,
            fontFamilyFallback: mono ? QzFont.monoFallback : null,
          ),
        ),
      ],
    );
  }
}

class _ValueBlock extends StatelessWidget {
  const _ValueBlock({
    required this.label,
    required this.value,
    required this.align,
  });
  final String label;
  final String value;
  final CrossAxisAlignment align;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Column(
      crossAxisAlignment: align,
      children: <Widget>[
        Text(label, style: TextStyle(fontSize: 10.5, color: c.textDim)),
        const SizedBox(height: 2),
        Text(
          value,
          style: TextStyle(
            fontSize: 13,
            fontWeight: FontWeight.w700,
            color: c.text,
            fontFamily: QzFont.mono,
            fontFamilyFallback: QzFont.monoFallback,
          ),
        ),
      ],
    );
  }
}

class _Progress extends StatelessWidget {
  const _Progress({required this.pct, required this.color});
  final double pct;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return ClipRRect(
      borderRadius: BorderRadius.circular(2),
      child: LinearProgressIndicator(
        value: (pct / 100).clamp(0, 1),
        minHeight: 3,
        backgroundColor: c.bgSoft,
        valueColor: AlwaysStoppedAnimation<Color>(color),
      ),
    );
  }
}

class _BiasBar extends StatelessWidget {
  const _BiasBar({required this.label, required this.pct, required this.color});
  final String label;
  final int pct;
  final Color color;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: <Widget>[
            Text(label, style: TextStyle(fontSize: 11, color: c.textMid)),
            Text(
              '$pct %',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: color,
                fontFamily: QzFont.mono,
                fontFamilyFallback: QzFont.monoFallback,
              ),
            ),
          ],
        ),
        const SizedBox(height: 5),
        ClipRRect(
          borderRadius: BorderRadius.circular(1),
          child: LinearProgressIndicator(
            value: (pct / 100).clamp(0, 1),
            minHeight: 2,
            backgroundColor: c.bgSoft,
            valueColor: AlwaysStoppedAnimation<Color>(color),
          ),
        ),
      ],
    );
  }
}
