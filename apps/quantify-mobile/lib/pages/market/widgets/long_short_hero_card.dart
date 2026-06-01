import 'package:flutter/material.dart';

import '../../../data/models/exchange_long_short_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_card.dart';
import 'long_short_bar.dart';

/// 多空比页顶部 total hero 卡。
class LongShortHeroCard extends StatelessWidget {
  const LongShortHeroCard({super.key, required this.snapshot});

  final MarketLongShortSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return QzCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              _AssetGlyph(label: snapshot.assetGlyph),
              const SizedBox(width: QzSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      '全部',
                      style: TextStyle(
                        color: c.text,
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      '${snapshot.baseAsset} 总计',
                      style: TextStyle(color: c.textDim, fontSize: 11),
                    ),
                  ],
                ),
              ),
              _NotionalLabel(
                title: l10n.marketLongShortLongHolding,
                amount: snapshot.longNotional,
                color: c.marketUp,
                alignEnd: true,
              ),
              const SizedBox(width: QzSpacing.md),
              _NotionalLabel(
                title: l10n.marketLongShortShortHolding,
                amount: snapshot.shortNotional,
                color: c.marketDown,
                alignEnd: true,
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.md),
          LongShortBar(
            longRatio: snapshot.longPct / 100.0,
            shortRatio: snapshot.shortPct / 100.0,
            height: 32,
            radius: 6,
            precision: 2,
          ),
        ],
      ),
    );
  }
}

class _AssetGlyph extends StatelessWidget {
  const _AssetGlyph({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      key: const Key('long-short-hero-asset-glyph'),
      width: 30,
      height: 30,
      decoration: const BoxDecoration(
        shape: BoxShape.circle,
        color: Color(0xFFF7931A),
      ),
      alignment: Alignment.center,
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.black,
          fontSize: 13,
          fontWeight: FontWeight.w700,
          height: 1,
        ),
      ),
    );
  }
}

class _NotionalLabel extends StatelessWidget {
  const _NotionalLabel({
    required this.title,
    required this.amount,
    required this.color,
    required this.alignEnd,
  });

  final String title;
  final String amount;
  final Color color;
  final bool alignEnd;

  @override
  Widget build(BuildContext context) {
    final QzColorScheme c = context.qzScheme;
    return Column(
      crossAxisAlignment: alignEnd
          ? CrossAxisAlignment.end
          : CrossAxisAlignment.start,
      children: <Widget>[
        Text(title, style: TextStyle(color: c.textDim, fontSize: 10)),
        const SizedBox(height: 2),
        Text(
          _formatUsd(amount),
          style: TextStyle(
            color: color,
            fontSize: 12,
            fontWeight: FontWeight.w700,
            fontFamily: QzFont.mono,
            fontFamilyFallback: QzFont.monoFallback,
          ),
        ),
      ],
    );
  }

  String _formatUsd(String amount) {
    final String normalized = amount.startsWith(r'$')
        ? amount.substring(1)
        : amount;
    return 'US\$$normalized';
  }
}
