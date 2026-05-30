import 'package:flutter/material.dart';

import '../../../data/models/exchange_long_short_models.dart';
import '../../../l10n/app_localizations.dart';
import '../../../theme/colors.dart';
import '../../../theme/theme_context.dart';
import '../../../theme/tokens.dart';
import '../../../widgets/qz_card.dart';
import '../../../widgets/qz_chip.dart';
import 'long_short_bar.dart';

/// 多空比页顶部 hero 卡：币种 + 总持仓 + 多空比进度条 + 多/空总金额。
///
/// 参考 `design/project/mobile/m-screens-3.jsx:337-371`。
class LongShortHeroCard extends StatelessWidget {
  const LongShortHeroCard({super.key, required this.snapshot});

  final MarketLongShortSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final AppLocalizations l10n = AppLocalizations.of(context);
    final QzColorScheme c = context.qzScheme;
    return QzCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: <Widget>[
          Row(
            children: <Widget>[
              _AssetGlyph(
                label: snapshot.assetGlyph,
                gradientStart: snapshot.assetGradientStart,
                gradientEnd: snapshot.assetGradientEnd,
              ),
              const SizedBox(width: QzSpacing.md),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      '${snapshot.baseAsset} ${l10n.marketLongShortHeroSuffix}',
                      style: TextStyle(
                        color: c.text,
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      l10n.marketLongShortTotalNotional(snapshot.totalNotional),
                      style: TextStyle(color: c.textMid, fontSize: 12),
                    ),
                  ],
                ),
              ),
              QzChip(
                label: l10n.marketLongShortLive,
                tone: QzChipTone.ok,
              ),
            ],
          ),
          const SizedBox(height: QzSpacing.md),
          LongShortBar(
            longRatio: snapshot.longPct / 100.0,
            shortRatio: snapshot.shortPct / 100.0,
            height: 38,
          ),
          const SizedBox(height: QzSpacing.md),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Expanded(
                child: _NotionalLabel(
                  title: l10n.marketLongShortLongHolding,
                  amount: snapshot.longNotional,
                  color: c.marketUp,
                  alignEnd: false,
                ),
              ),
              Expanded(
                child: _NotionalLabel(
                  title: l10n.marketLongShortShortHolding,
                  amount: snapshot.shortNotional,
                  color: c.marketDown,
                  alignEnd: true,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AssetGlyph extends StatelessWidget {
  const _AssetGlyph({
    required this.label,
    required this.gradientStart,
    required this.gradientEnd,
  });

  final String label;
  final Color gradientStart;
  final Color gradientEnd;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 48,
      height: 48,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
          colors: <Color>[gradientStart, gradientEnd],
        ),
      ),
      alignment: Alignment.center,
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 22,
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
      crossAxisAlignment:
          alignEnd ? CrossAxisAlignment.end : CrossAxisAlignment.start,
      children: <Widget>[
        Text(
          title,
          style: TextStyle(color: c.textDim, fontSize: 12),
        ),
        const SizedBox(height: 2),
        Text(
          amount,
          style: TextStyle(
            color: color,
            fontSize: 16,
            fontWeight: FontWeight.w700,
            fontFamily: QzFont.mono,
            fontFamilyFallback: QzFont.monoFallback,
          ),
        ),
      ],
    );
  }
}
