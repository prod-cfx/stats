import 'package:flutter/material.dart';

import '../../../data/models/whale_extra_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import 'whale_flow_sparkline.dart';

/// 实时 tab 顶部净流入 hero 卡。
class WhaleNetFlowCard extends StatelessWidget {
  const WhaleNetFlowCard({super.key, required this.stat});

  final WhaleNetFlowStat stat;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final bool up = stat.tone == 'up';
    final Color toneColor = up ? c.marketUp : c.marketDown;
    final Color softTone = toneColor.withValues(alpha: 0.10);

    return Container(
      decoration: BoxDecoration(
        color: c.bgElev,
        border: Border.all(color: c.borderSoft),
        borderRadius: BorderRadius.circular(QzRadii.card),
        gradient: LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: <Color>[softTone, c.bgElev],
          stops: const <double>[0.0, 0.7],
        ),
      ),
      padding: const EdgeInsets.fromLTRB(
          QzSpacing.md, QzSpacing.md, QzSpacing.md, QzSpacing.md - 2),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      l10n.whaleNetFlowLabel(stat.symbol),
                      style: TextStyle(
                        color: c.textDim,
                        fontSize: 10,
                        letterSpacing: 0.6,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: QzSpacing.xs),
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: <Widget>[
                        Text(
                          stat.netFlowDisplay,
                          style: TextStyle(
                            color: toneColor,
                            fontSize: 26,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.5,
                          ),
                        ),
                        const SizedBox(width: QzSpacing.sm),
                        Text(
                          stat.pctDisplay,
                          style: TextStyle(
                            color: toneColor,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      stat.summary,
                      style: TextStyle(color: c.textDim, fontSize: 11),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: WhaleFlowSparkline(tone: stat.tone),
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.md),
          Container(
            padding: const EdgeInsets.only(top: QzSpacing.md),
            decoration: BoxDecoration(
              border: Border(top: BorderSide(color: c.borderSoft)),
            ),
            child: Row(
              children: <Widget>[
                Expanded(
                  child: _HeroStat(
                    label: l10n.whaleStatBigTrades,
                    value: stat.bigTrades,
                    sub: '≥ \$1M',
                  ),
                ),
                Expanded(
                  child: _HeroStat(
                    label: l10n.whaleStatActiveWhales,
                    value: stat.activeWhales,
                    sub: l10n.whaleStatPast1h,
                  ),
                ),
                Expanded(
                  child: _HeroStat(
                    label: l10n.whaleStatNetAccumulation,
                    value: stat.netAccumulationDisplay,
                    sub: stat.symbol,
                    tone: stat.netAccumulationTone,
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

class _HeroStat extends StatelessWidget {
  const _HeroStat({
    required this.label,
    required this.value,
    required this.sub,
    this.tone = 'flat',
  });

  final String label;
  final String value;
  final String sub;
  final String tone;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color valueColor = tone == 'up'
        ? c.marketUp
        : tone == 'dn'
            ? c.marketDown
            : c.text;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          label,
          style: TextStyle(
            color: c.textDim,
            fontSize: 10,
            letterSpacing: 0.4,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(height: 3),
        Text(
          value,
          style: TextStyle(
            color: valueColor,
            fontSize: 16,
            fontWeight: FontWeight.w700,
            letterSpacing: -0.3,
          ),
        ),
        const SizedBox(height: 2),
        Text(
          sub,
          style: TextStyle(color: c.textFaint, fontSize: 10),
        ),
      ],
    );
  }
}
