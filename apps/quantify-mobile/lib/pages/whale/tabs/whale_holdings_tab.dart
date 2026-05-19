import 'package:flutter/material.dart';

import '../../../data/mock/fixtures/whale_extras.dart';
import '../../../data/models/whale_extra_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';

/// 巨鲸动向 — 持仓 tab（issue #1560）。
class WhaleHoldingsTab extends StatelessWidget {
  const WhaleHoldingsTab({super.key});

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    final int maxBar = mockExchangeFlows
        .map((ExchangeFlowEntry e) => e.barWeight)
        .reduce((int a, int b) => a > b ? a : b);

    return ListView(
      padding: EdgeInsets.zero,
      children: <Widget>[
        Container(
          color: c.bgElev,
          padding: const EdgeInsets.fromLTRB(
              QzSpacing.lg, QzSpacing.md, QzSpacing.lg, QzSpacing.xs),
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
                          l10n.whaleSectionExchangeFlow,
                          style: TextStyle(
                            color: c.text,
                            fontSize: 15,
                            fontWeight: FontWeight.w700,
                            letterSpacing: -0.2,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(l10n.whaleSectionExchangeFlowSub,
                            style:
                                TextStyle(color: c.textDim, fontSize: 11)),
                      ],
                    ),
                  ),
                  Text(l10n.whaleHoldingsLabel24h,
                      style: TextStyle(color: c.textDim, fontSize: 11)),
                ],
              ),
              const SizedBox(height: QzSpacing.sm),
              Container(
                decoration: BoxDecoration(
                  border: Border.all(color: c.borderSoft),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  children: <Widget>[
                    for (int i = 0; i < mockExchangeFlows.length; i++)
                      _ExchangeFlowRow(
                        entry: mockExchangeFlows[i],
                        widthRatio: mockExchangeFlows[i].barWeight / maxBar,
                        isLast: i == mockExchangeFlows.length - 1,
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
        Container(
          color: c.bgElev,
          padding: const EdgeInsets.fromLTRB(
              QzSpacing.lg, QzSpacing.lg, QzSpacing.lg, QzSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: <Widget>[
                  Expanded(
                    child: Text(
                      l10n.whaleSectionTopHolders,
                      style: TextStyle(
                        color: c.text,
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                        letterSpacing: -0.2,
                      ),
                    ),
                  ),
                  Text(l10n.whaleSectionTopHoldersSub,
                      style: TextStyle(color: c.textDim, fontSize: 11)),
                ],
              ),
              const SizedBox(height: QzSpacing.sm),
              Container(
                decoration: BoxDecoration(
                  border: Border.all(color: c.borderSoft),
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  children: <Widget>[
                    for (int i = 0; i < mockTopHolders.length; i++)
                      _TopHolderRow(
                        entry: mockTopHolders[i],
                        isLast: i == mockTopHolders.length - 1,
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _ExchangeFlowRow extends StatelessWidget {
  const _ExchangeFlowRow({
    required this.entry,
    required this.widthRatio,
    required this.isLast,
  });

  final ExchangeFlowEntry entry;
  final double widthRatio;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final bool up = entry.tone == 'up';
    final Color toneColor = up ? c.marketUp : c.marketDown;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: isLast ? Colors.transparent : c.borderSoft,
          ),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            children: <Widget>[
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: Color(entry.colorHex),
                  borderRadius: BorderRadius.circular(4),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  entry.exchange,
                  style: TextStyle(
                    color: c.text,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
              Text(
                entry.netDisplay,
                style: TextStyle(
                  color: toneColor,
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -0.2,
                ),
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.sm),
          Padding(
            padding: const EdgeInsets.only(left: 18),
            child: LayoutBuilder(
              builder: (BuildContext ctx, BoxConstraints constraints) {
                return Container(
                  height: 4,
                  decoration: BoxDecoration(
                    color: c.bgSoft,
                    borderRadius: BorderRadius.circular(2),
                  ),
                  child: Align(
                    alignment: Alignment.centerLeft,
                    child: Container(
                      width: (constraints.maxWidth * widthRatio)
                          .clamp(0.0, constraints.maxWidth),
                      height: 4,
                      decoration: BoxDecoration(
                        color: toneColor.withValues(alpha: 0.85),
                        borderRadius: BorderRadius.circular(2),
                      ),
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

class _TopHolderRow extends StatelessWidget {
  const _TopHolderRow({required this.entry, required this.isLast});

  final TopHolderEntry entry;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    final Color changeColor = entry.tone == 'up'
        ? c.marketUp
        : entry.tone == 'dn'
            ? c.marketDown
            : c.textDim;
    return Container(
      padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(
            color: isLast ? Colors.transparent : c.borderSoft,
          ),
        ),
      ),
      child: Row(
        children: <Widget>[
          SizedBox(
            width: 18,
            child: Text(
              '${entry.rank}',
              textAlign: TextAlign.center,
              style: TextStyle(
                color: c.textDim,
                fontSize: 11,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          const SizedBox(width: QzSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  entry.label,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: c.text,
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  entry.amountDisplay,
                  style: TextStyle(color: c.textMid, fontSize: 11),
                ),
              ],
            ),
          ),
          SizedBox(
            width: 64,
            child: Text(
              entry.changeDisplay,
              textAlign: TextAlign.right,
              style: TextStyle(
                color: changeColor,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
